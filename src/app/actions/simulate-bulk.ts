"use server";

import { revalidatePath } from "next/cache";
import { verifySession } from "@/lib/auth/dal";
import { prisma } from "@/lib/prisma";
import { toDomainGame } from "@/lib/data-access/mappers";
import { simulateAndResolveGame } from "@/lib/data-access/simulate";
import { calendarDay } from "@/lib/careers/schedule-rules";
import { maybeLeagueMilestones } from "@/lib/data-access/awards";
import { maybeAiTradeOffers } from "@/lib/data-access/ai-trades";
import { getTranslator } from "@/lib/i18n/translate";
import { endOfGameDay } from "@/lib/data-access/game-clock";
import { getOrAdvancePlayoffs } from "@/lib/data-access/playoffs";
import { createInboxMessage, markAllInboxMessagesRead } from "@/lib/data-access/inbox";
import { freeAgencyOpenMessageText } from "@/lib/careers/inbox-rules";
import { aiRosterTarget, runAiDraft, runAiFreeAgency } from "@/lib/data-access/ai-offseason";
import { isFreeAgencyOpen } from "@/lib/data-access/season-windows";

// Lot de matchs IA par appel. Historique : un match coûtait 30-50 s (une
// quinzaine de requêtes enchaînées) et un lot de 15 dépassait le maxDuration
// de la page, d'où un seul match par appel. Depuis que la résolution d'un
// match se fait en deux vagues de requêtes parallèles (~1 s) et que les
// matchs d'une même journée sont joués en parallèle (simulateInDayGroups),
// un lot de 8 tient très largement. Le client relance l'action tant que
// `remaining > 0`, avec un indicateur de progression entre chaque lot.
const BATCH_SIZE = 8;

// Rattrapage de la ligue avant un match de mon équipe : autant de matchs IA
// que possible par appel dans ce budget (sous le maxDuration de 60 s des
// pages/routes, avec la marge d'un match en cours), plutôt qu'un seul — un
// match coûte ~4 s, et la page n'est revalidée qu'à la fin du rattrapage
// (un rendu complet du tableau de bord à chaque match doublait le coût).
const CATCH_UP_TIME_BUDGET_MS = 15_000;

// Matchs IA joués en même temps (voir simulateInDayGroups).
const PARALLEL_GAMES = 4;

// Vitesse : les matchs d'une même journée n'ont aucune équipe en commun,
// donc aucun état partagé (repos, fatigue, chimie, effectifs) — on les joue
// par groupes parallèles, journée après journée (l'ordre chronologique reste
// respecté). Garde-fou : jamais deux matchs d'une même équipe dans un groupe.
// S'arrête à `deadline` (entre deux groupes) ; `stopOnError` reproduit
// l'ancien comportement du rattrapage (s'arrêter au premier match en échec).
async function simulateInDayGroups(
  careerId: string,
  locale: Awaited<ReturnType<typeof getTranslator>>["locale"],
  rows: Parameters<typeof toDomainGame>[0][],
  options: { deadline?: number; stopOnError?: boolean } = {}
): Promise<{ simulated: number; failed: boolean }> {
  let simulated = 0;
  let index = 0;
  while (index < rows.length) {
    if (options.deadline && Date.now() > options.deadline) break;
    const day = calendarDay(rows[index].gameDate);
    const group: typeof rows = [];
    const teams = new Set<string>();
    while (
      index < rows.length &&
      group.length < PARALLEL_GAMES &&
      calendarDay(rows[index].gameDate) === day &&
      !teams.has(rows[index].homeTeamId) &&
      !teams.has(rows[index].awayTeamId)
    ) {
      teams.add(rows[index].homeTeamId);
      teams.add(rows[index].awayTeamId);
      group.push(rows[index]);
      index++;
    }
    const results = await Promise.allSettled(
      group.map((row) => simulateAndResolveGame(careerId, toDomainGame(row), locale))
    );
    simulated += results.filter((r) => r.status === "fulfilled").length;
    if (options.stopOnError && results.some((r) => r.status === "rejected")) return { simulated, failed: true };
  }
  return { simulated, failed: false };
}

// All-Stars et trophées de fin de saison (voir awards.ts) : vérifiés après
// chaque lot de matchs.
async function runLeagueMilestones(
  careerId: string,
  locale: Awaited<ReturnType<typeof getTranslator>>["locale"]
): Promise<void> {
  const career = await prisma.career.findUnique({ where: { id: careerId }, select: { leagueId: true, season: true } });
  if (!career) return;
  await maybeLeagueMilestones(careerId, career.leagueId, career.season, locale);
  // Offres d'échange à l'initiative de l'IA (voir ai-trades.ts).
  await maybeAiTradeOffers(careerId, career.leagueId, career.season, locale);
}

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

  const deadline = Date.now() + CATCH_UP_TIME_BUDGET_MS;
  let simulated = 0;
  while (Date.now() < deadline) {
    // Quelques journées à la fois (au lieu d'une requête par match).
    const rows = await prisma.game.findMany({ where, orderBy: { gameDate: "asc" }, take: 40 });
    if (rows.length === 0) break;
    // Match à données incohérentes : on s'arrête là (il restera "scheduled"
    // et sera retenté) plutôt que de boucler dessus.
    const batch = await simulateInDayGroups(careerId, locale, rows, { deadline, stopOnError: true });
    simulated += batch.simulated;
    if (batch.failed || batch.simulated === 0) break;
  }
  const remaining = await prisma.game.count({ where });
  if (simulated > 0) await runLeagueMilestones(careerId, locale);
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

  // Jamais deux matchs d'une même équipe en même temps : le repos/la
  // fatigue/la chimie dépendent de l'ordre de ses matchs — d'où des groupes
  // parallèles par journée (voir simulateInDayGroups). Un match à données
  // incohérentes ne bloque pas le lot : il restera "scheduled" et sera
  // retenté au prochain lot.
  const { simulated: simulatedCount } = await simulateInDayGroups(careerId, locale, batch);
  if (simulatedCount > 0) await runLeagueMilestones(careerId, locale);

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
    await runLeagueMilestones(careerId, locale);
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
const CONTINUE_STOPPING_MESSAGE_TYPES = ["injury", "trade_request", "free_agent", "poach_offer", "free_agency"];

export type ContinueResult =
  | { kind: "advanced"; simulated: number } // lot de matchs IA joué : rappeler
  | { kind: "matchDay"; gameId: string } // jour de mon prochain match, tout le reste est joué
  | { kind: "inbox"; count: number } // messages importants non lus : à lire avant d'avancer
  | { kind: "draft" } // à mon tour (ou à celui d'un autre humain) de drafter
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
  // Intersaison : l'IA drafte jusqu'à mon tour (ou la fin de la draft)...
  const pendingDraftPicks = await prisma.draftPick.count({
    where: { careerId, season: career.season, status: "pending", pickNumber: { not: null } },
  });
  if (pendingDraftPicks > 0) {
    const draft = await runAiDraft(careerId, career.season, career.leagueId);
    if (draft.humanTeamOnTheClock) return { kind: "draft" };
    if (!draft.done && draft.picked > 0) return { kind: "advanced", simulated: 0 };
  }
  // ...puis, la draft finie (free agency ouverte), complète ses effectifs
  // avec des agents libres : plein en intersaison, remplacements en saison.
  if (await isFreeAgencyOpen(careerId, career.season)) {
    // Une draft vient d'avoir lieu cette saison (quel que soit l'auteur du
    // dernier choix) : annoncé une seule fois, et le manager a la main sur
    // le marché avant que l'IA ne recrute (au prochain « Continuer »).
    const [draftedThisSeason, announced] = await Promise.all([
      prisma.draftPick.count({ where: { careerId, season: career.season, status: "completed" } }),
      prisma.inboxMessage.count({ where: { careerId, teamId, season: career.season, type: "free_agency" } }),
    ]);
    if (draftedThisSeason > 0 && announced === 0) {
      const { title, body } = freeAgencyOpenMessageText(locale);
      await createInboxMessage(careerId, teamId, career.season, "free_agency", title, body, "/free-agents");
      return { kind: "inbox", count: 1 };
    }
    const regularSeasonStarted = await prisma.game.count({
      where: { careerId, season: career.season, status: "final" },
    });
    await runAiFreeAgency(
      careerId,
      career.leagueId,
      career.season,
      aiRosterTarget(career.leagueId, regularSeasonStarted > 0)
    );
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
