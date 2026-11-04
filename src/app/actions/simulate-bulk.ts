"use server";

import { revalidatePath } from "next/cache";
import { verifySession } from "@/lib/auth/dal";
import { prisma } from "@/lib/prisma";
import { toDomainGame } from "@/lib/data-access/mappers";
import { simulateAndResolveGame } from "@/lib/data-access/simulate";
import { getTranslator } from "@/lib/i18n/translate";
import { endOfGameDay } from "@/lib/data-access/game-clock";
import { getOrAdvancePlayoffs } from "@/lib/data-access/playoffs";
import { markAllInboxMessagesRead } from "@/lib/data-access/inbox";

// Les matchs IA-vs-IA se jouent quand le manager avance : avant chacun de
// ses matchs, le reste de la ligue est rattrapé jusqu'au même jour (voir
// simulateAiGamesUpTo, appelé par "Simuler le match", "Simuler les
// prochains matchs" et "Avancer"). Le bouton ci-dessous joue en plus tout
// le reste de la saison d'un coup. Sans ça, le reste de la ligue resterait figé à 0-0 pour
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

// Rattrapage de la ligue avant un match de mon équipe : autant de matchs IA
// que possible par appel dans ce budget (sous le maxDuration de 60 s des
// pages/routes, avec la marge d'un match en cours), plutôt qu'un seul — un
// match coûte ~4 s, et la page n'est revalidée qu'à la fin du rattrapage
// (un rendu complet du tableau de bord à chaque match doublait le coût).
const CATCH_UP_TIME_BUDGET_MS = 15_000;

// Simule, dans l'ordre chronologique, les matchs IA-vs-IA non joués datés
// au plus tard `upTo` — jamais un match impliquant un manager humain (voir
// l'en-tête de ce fichier).
async function simulateAiGamesUpTo(
  careerId: string,
  locale: Awaited<ReturnType<typeof getTranslator>>["locale"],
  upTo: Date | null
): Promise<{ simulated: number; remaining: number }> {
  const humanTeamIds = (
    await prisma.membership.findMany({ where: { careerId }, select: { teamId: true } })
  ).map((m) => m.teamId);
  const where = {
    careerId,
    status: { not: "final" },
    homeTeamId: { notIn: humanTeamIds },
    awayTeamId: { notIn: humanTeamIds },
    ...(upTo ? { gameDate: { lte: upTo } } : {}),
  };

  const startedAt = Date.now();
  let simulated = 0;
  while (Date.now() - startedAt < CATCH_UP_TIME_BUDGET_MS) {
    const row = await prisma.game.findFirst({ where, orderBy: { gameDate: "asc" } });
    if (!row) break;
    try {
      await simulateAndResolveGame(careerId, toDomainGame(row), locale);
      simulated++;
    } catch {
      // Match à données incohérentes : on s'arrête là (il restera
      // "scheduled" et sera retenté) plutôt que de boucler dessus.
      break;
    }
  }
  const remaining = await prisma.game.count({ where });
  return { simulated, remaining };
}

export interface CatchUpResult {
  simulated: number;
  remaining: number;
  error?: string;
}

// Appelé en boucle par le bouton "Simuler le match" AVANT de simuler un
// match de mon équipe : joue d'abord tous les autres matchs de la ligue
// jusqu'au jour de ce match inclus.
export async function catchUpLeagueBefore(gameId: string): Promise<CatchUpResult> {
  const { userId } = await verifySession();
  const { locale } = await getTranslator();
  const membership = await prisma.membership.findUnique({ where: { userId } });
  if (!membership) return { simulated: 0, remaining: 0, error: "No career" };

  const target = await prisma.game.findFirst({ where: { id: gameId, careerId: membership.careerId } });
  if (!target) return { simulated: 0, remaining: 0, error: "Game not found" };

  return simulateAiGamesUpTo(membership.careerId, locale, endOfGameDay(target.gameDate));
}

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
  leagueGamesSimulated: number; // matchs IA joués avant le mien à cet appel
  catchingUp?: boolean; // rattrapage de la ligue pas fini : rappeler sans compter de match

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
    return { simulated: 0, remaining: 0, leagueGamesSimulated: 0, error: "No career" };
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
    return { simulated: 0, remaining: 0, leagueGamesSimulated: 0 };
  }

  // Le reste de la ligue joue d'abord jusqu'au jour de mon match inclus.
  const catchUp = await simulateAiGamesUpTo(careerId, locale, endOfGameDay(nextGame.gameDate));
  if (catchUp.remaining > 0) {
    return { simulated: 0, remaining, leagueGamesSimulated: catchUp.simulated, catchingUp: true };
  }

  const opponentTeamId = nextGame.homeTeamId === myTeamId ? nextGame.awayTeamId : nextGame.homeTeamId;
  if (otherHumanTeamIds.includes(opponentTeamId)) {
    return { simulated: 0, remaining, leagueGamesSimulated: catchUp.simulated, blockedByOtherManager: true };
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

  return {
    simulated: simulatedCount,
    remaining: remaining - simulatedCount,
    leagueGamesSimulated: catchUp.simulated,
  };
}

// Messages qui arrêtent « Continuer » (une décision ou une info qui compte) —
// pas le classement ni la presse (déjà imposée par une redirection, voir
// getCurrentMembership).
const CONTINUE_STOPPING_MESSAGE_TYPES = ["injury", "trade_request", "free_agent", "poach_offer"];

export type ContinueResult =
  | { kind: "advanced"; simulated: number } // lot de matchs IA joué : rappeler
  | { kind: "matchDay"; gameId: string } // jour de mon prochain match, tout le reste est joué
  | { kind: "inbox"; count: number } // messages importants non lus : à lire avant d'avancer
  | { kind: "seasonOver" } // plus rien à jouer cette saison
  | { kind: "error" };

// « Continuer » façon Football Manager (barre du haut, voir
// GameTopBar.tsx) : avance le calendrier jusqu'au prochain moment qui
// demande le manager — le jour de son prochain match, une fois tous les
// autres matchs de ce jour joués. Jamais son match à sa place. À rappeler
// tant que kind === "advanced" (lots sous budget de temps, voir
// simulateAiGamesUpTo). Sans match à venir pour mon équipe, joue le reste de
// la saison, playoffs compris (tour par tour), jusqu'au bout.
export async function continueGame(options: { acknowledgeInbox?: boolean } = {}): Promise<ContinueResult> {
  const { userId } = await verifySession();
  const { locale } = await getTranslator();
  const membership = await prisma.membership.findUnique({ where: { userId }, include: { career: true } });
  if (!membership) return { kind: "error" };

  const { careerId, teamId, career } = membership;

  // Comme dans Football Manager, on ne passe pas devant un message
  // important sans l'avoir vu : « Continuer » mène d'abord à la boîte de
  // réception ; relancé depuis celle-ci (acknowledgeInbox), il vaut lecture.
  const [unreadImportant, pendingTradeOffers] = await Promise.all([
    prisma.inboxMessage.count({
      where: { careerId, teamId, status: "unread", type: { in: CONTINUE_STOPPING_MESSAGE_TYPES } },
    }),
    prisma.tradeOffer.count({ where: { careerId, toTeamId: teamId, status: "pending" } }),
  ]);
  if (unreadImportant + pendingTradeOffers > 0) {
    if (!options.acknowledgeInbox) return { kind: "inbox", count: unreadImportant + pendingTradeOffers };
    await markAllInboxMessagesRead(careerId, teamId);
  }
  // Saison régulière terminée : crée les matchs de playoffs à venir (match
  // suivant d'une série, tour suivant) — sans effet avant.
  await getOrAdvancePlayoffs(careerId, career.season, career.leagueId);

  const nextMyGame = await prisma.game.findFirst({
    where: { careerId, status: { not: "final" }, OR: [{ homeTeamId: teamId }, { awayTeamId: teamId }] },
    orderBy: { gameDate: "asc" },
  });
  const { simulated } = await simulateAiGamesUpTo(
    careerId,
    locale,
    nextMyGame ? endOfGameDay(nextMyGame.gameDate) : null
  );
  if (simulated > 0) return { kind: "advanced", simulated };
  if (nextMyGame) return { kind: "matchDay", gameId: nextMyGame.id };
  return { kind: "seasonOver" };
}
