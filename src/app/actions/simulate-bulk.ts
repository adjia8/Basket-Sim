"use server";

import { revalidatePath } from "next/cache";
import { verifySession } from "@/lib/auth/dal";
import { prisma } from "@/lib/prisma";
import { toDomainGame } from "@/lib/data-access/mappers";
import { simulateAndResolveGame } from "@/lib/data-access/simulate";
import { getTranslator } from "@/lib/i18n/translate";

// Aucun match IA-vs-IA ne se simule tout seul dans ce jeu — seulement les
// matchs qu'un manager humain déclenche explicitement (voir
// /api/simulate-game). Sans ça, le reste de la ligue reste figé à 0-0 pour
// toujours (aucun bilan, aucune stat), et ça bloque même advanceSeason (voir
// actions/season.ts), qui exige que TOUS les matchs de la saison soient
// "final" avant de pouvoir enchaîner. Ce lot rejoue les matchs opposant deux
// équipes IA (aucune Membership des deux côtés) — jamais un match impliquant
// un manager humain, même IA vs humain, pour ne jamais court-circuiter un
// match que quelqu'un doit décider de jouer lui-même.
//
// Traité par petits lots séquentiels plutôt qu'en un seul appel géant : une
// saison complète peut compter plusieurs centaines de matchs IA, et chacun
// enchaîne une bonne quinzaine de requêtes (fatigue, blessures, chimie,
// renommée...) — en pratique 30-50s par match. Un lot de 15 dépassait de
// loin le maxDuration de la page (voir schedule/page.tsx) : la fonction
// serverless se faisait tuer par la plateforme avant de renvoyer quoi que
// ce soit, ce qui laissait l'UI figée indéfiniment. Un match à la fois tient
// large sous ce plafond et fait progresser l'affichage à chaque match plutôt
// qu'une fois tous les dix. Le client relance l'action tant que
// `remaining > 0`, avec un indicateur de progression entre chaque lot.
const BATCH_SIZE = 1;

export interface SimulateAllAiGamesResult {
  simulated: number;
  remaining: number;
  error?: string;
}

export async function simulateAllAiGames(): Promise<SimulateAllAiGamesResult> {
  const { userId } = await verifySession();
  const { locale } = await getTranslator();

  const membership = await prisma.membership.findUnique({ where: { userId } });
  if (!membership) {
    return { simulated: 0, remaining: 0, error: "No career" };
  }

  const careerId = membership.careerId;

  const humanMemberships = await prisma.membership.findMany({
    where: { careerId },
    select: { teamId: true },
  });
  const humanTeamIds = humanMemberships.map((m) => m.teamId);

  const pendingRows = await prisma.game.findMany({
    where: {
      careerId,
      status: { not: "final" },
      homeTeamId: { notIn: humanTeamIds },
      awayTeamId: { notIn: humanTeamIds },
    },
    orderBy: { gameDate: "asc" },
  });

  const totalPending = pendingRows.length;
  const batch = pendingRows.slice(0, BATCH_SIZE);

  // Séquentiel, jamais Promise.all : le repos/la fatigue/la chimie de
  // chaque match dépendent de l'état laissé par les matchs précédents de la
  // même équipe (voir simulateAndResolveGame) — les paralléliser produirait
  // des jours de repos et des classements incohérents.
  let simulatedCount = 0;
  for (const row of batch) {
    const game = toDomainGame(row);
    try {
      await simulateAndResolveGame(careerId, game, locale);
      simulatedCount++;
    } catch {
      // Un seul match à données incohérentes (équipe introuvable, ne
      // devrait jamais arriver) ne doit pas bloquer tout le lot — il
      // restera "scheduled" et sera retenté au prochain lot.
      continue;
    }
  }

  revalidatePath("/schedule");
  revalidatePath("/standings");
  revalidatePath("/", "layout");

  return { simulated: simulatedCount, remaining: totalPending - simulatedCount };
}

export interface SimulateNextMyGamesResult {
  simulated: number; // 0 ou 1
  remaining: number; // total de matchs non "final" de mon équipe
  blockedByOtherManager?: boolean; // le prochain match oppose deux humains, doit rester manuel
  error?: string;
}

// Pendant du bouton IA ci-dessus, mais pour les matchs DE l'équipe du
// joueur — jusqu'ici, il fallait cliquer "Simuler" un par un sur chaque
// /game/[gameId]. Même contrainte de coût par match (~30-50s) donc même
// principe : un match par appel, le client relance tant qu'il n'a pas
// atteint le nombre demandé.
//
// On ne saute JAMAIS le prochain match chronologique de l'équipe, même
// s'il oppose deux managers humains (donc pas auto-simulable, voir
// /api/simulate-game/route.ts) : le repos/la fatigue de l'équipe dépendent
// de l'ordre réel de ses matchs, simuler un match IA plus tardif d'abord
// produirait des jours de repos incohérents. Dans ce cas, le lot s'arrête
// simplement là — `blockedByOtherManager` permet au client de l'expliquer
// plutôt que de paraître figé.
export async function simulateNextMyGames(): Promise<SimulateNextMyGamesResult> {
  const { userId } = await verifySession();
  const { locale } = await getTranslator();

  const membership = await prisma.membership.findUnique({ where: { userId } });
  if (!membership) {
    return { simulated: 0, remaining: 0, error: "No career" };
  }

  const careerId = membership.careerId;
  const myTeamId = membership.teamId;

  const otherHumanTeamIds = (
    await prisma.membership.findMany({ where: { careerId, teamId: { not: myTeamId } }, select: { teamId: true } })
  ).map((m) => m.teamId);

  const myPendingWhere = {
    careerId,
    status: { not: "final" },
    OR: [{ homeTeamId: myTeamId }, { awayTeamId: myTeamId }],
  };
  const remaining = await prisma.game.count({ where: myPendingWhere });
  const nextGame = await prisma.game.findFirst({ where: myPendingWhere, orderBy: { gameDate: "asc" } });
  if (!nextGame) {
    return { simulated: 0, remaining: 0 };
  }

  const opponentTeamId = nextGame.homeTeamId === myTeamId ? nextGame.awayTeamId : nextGame.homeTeamId;
  if (otherHumanTeamIds.includes(opponentTeamId)) {
    return { simulated: 0, remaining, blockedByOtherManager: true };
  }

  const game = toDomainGame(nextGame);
  let simulatedCount = 0;
  try {
    await simulateAndResolveGame(careerId, game, locale);
    simulatedCount = 1;
  } catch {
    // Laisse le match "scheduled" ; l'appelant s'arrête car simulated === 0.
  }

  revalidatePath("/schedule");
  revalidatePath("/standings");
  revalidatePath("/", "layout");

  return { simulated: simulatedCount, remaining: remaining - simulatedCount };
}

export interface AdvanceCalendarResult {
  simulated: number; // 0 ou 1 — un match IA simulé à cet appel
  arrivedAtMyGame: boolean; // plus aucun match IA avant mon prochain match
  myGameId?: string;
  myGameDate?: string; // ISO, pour affichage
  seasonComplete: boolean; // plus aucun match du tout (ni IA ni le mien)
  error?: string;
}

// "Continuer" façon Football Manager : simule un match IA à la fois (même
// contrainte de coût que les deux actions ci-dessus), mais borné par mon
// propre prochain match — jamais simulé à ma place. Dès qu'il ne reste plus
// aucun match IA daté avant (ou le même jour que) mon prochain match, on
// s'arrête et on le signale au lieu de continuer : c'est là que le joueur
// reprend la main, exactement comme le "Continuer" de Football Manager
// s'arrête au jour de ton propre match.
export async function advanceCalendar(): Promise<AdvanceCalendarResult> {
  const { userId } = await verifySession();
  const { locale } = await getTranslator();
  const membership = await prisma.membership.findUnique({ where: { userId } });
  if (!membership) {
    return { simulated: 0, arrivedAtMyGame: false, seasonComplete: false, error: "No career" };
  }

  const careerId = membership.careerId;
  const myTeamId = membership.teamId;

  const nextMyGame = await prisma.game.findFirst({
    where: { careerId, status: { not: "final" }, OR: [{ homeTeamId: myTeamId }, { awayTeamId: myTeamId }] },
    orderBy: { gameDate: "asc" },
  });

  const humanTeamIds = (
    await prisma.membership.findMany({ where: { careerId }, select: { teamId: true } })
  ).map((m) => m.teamId);

  const nextAiGame = await prisma.game.findFirst({
    where: {
      careerId,
      status: { not: "final" },
      homeTeamId: { notIn: humanTeamIds },
      awayTeamId: { notIn: humanTeamIds },
      ...(nextMyGame ? { gameDate: { lte: nextMyGame.gameDate } } : {}),
    },
    orderBy: { gameDate: "asc" },
  });

  if (nextAiGame) {
    const game = toDomainGame(nextAiGame);
    try {
      await simulateAndResolveGame(careerId, game, locale);
    } catch {
      // Laisse le match "scheduled" ; le prochain appel retentera.
    }
    revalidatePath("/");
    revalidatePath("/schedule");
    revalidatePath("/standings");
    return { simulated: 1, arrivedAtMyGame: false, seasonComplete: false };
  }

  if (nextMyGame) {
    return {
      simulated: 0,
      arrivedAtMyGame: true,
      myGameId: nextMyGame.id,
      myGameDate: nextMyGame.gameDate.toISOString(),
      seasonComplete: false,
    };
  }

  return { simulated: 0, arrivedAtMyGame: false, seasonComplete: true };
}
