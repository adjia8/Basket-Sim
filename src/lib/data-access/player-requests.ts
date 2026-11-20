import "server-only";
import { prisma } from "@/lib/prisma";
import { createInboxMessage } from "@/lib/data-access/inbox";
import { clampMorale } from "@/lib/careers/morale-rules";
import { personalityFor, scaleMoraleDelta } from "@/lib/careers/personality-rules";
import { EXPECTED_MINUTES, MINUTES_TOLERANCE, playerStatus, rankInRoster } from "@/lib/careers/player-status-rules";
import { EXTENSION_MAX_YEARS_REMAINING } from "@/lib/careers/contract-type-rules";
import {
  REQUEST_IGNORED_AFTER_DAYS,
  REQUEST_IGNORED_MORALE,
  REQUEST_PLAYER_COOLDOWN_DAYS,
  REQUEST_TEAM_COOLDOWN_DAYS,
  ignoredLeadsToTradeRequest,
  requestTrigger,
  type PlayerRequest,
} from "@/lib/careers/player-request-rules";
import type { Locale } from "@/lib/i18n/locale";

const DAY_MS = 86_400_000;
const days = (from: Date, to: Date) => Math.floor((to.getTime() - from.getTime()) / DAY_MS);

const REQUEST_TEXT: Record<PlayerRequest, { fr: [string, string]; en: [string, string] }> = {
  minutes: {
    fr: ["{name} veut parler de son temps de jeu", "{name} trouve qu'il ne joue pas assez pour son rôle et demande à te voir."],
    en: ["{name} wants to talk about his minutes", "{name} feels he isn't playing enough for his role and asks to see you."],
  },
  contract: {
    fr: ["{name} s'interroge sur son avenir", "{name} entame la dernière année de son contrat et aimerait savoir où il en est."],
    en: ["{name} wonders about his future", "{name} is entering the final year of his contract and would like to know where he stands."],
  },
  support: {
    fr: ["{name} demande à te parler", "{name} traverse une période difficile et a besoin de se sentir soutenu."],
    en: ["{name} asks to talk to you", "{name} is going through a rough patch and needs to feel supported."],
  },
};

// Après chaque match d'une équipe humaine : sanctionne les demandes restées
// sans réponse une semaine, puis laisse éventuellement un joueur en formuler
// une nouvelle (au plus une tous les REQUEST_TEAM_COOLDOWN_DAYS jours).
export async function maybePlayerRequests(
  careerId: string,
  teamId: string,
  season: string,
  gameDate: Date,
  locale: Locale
): Promise<void> {
  const fr = locale === "fr";
  const contracts = await prisma.contract.findMany({
    where: { careerId, teamId, contractType: "standard" },
    select: { playerId: true, yearsRemaining: true, isRookieScale: true },
  });
  const ids = contracts.map((c) => c.playerId);
  const [states, stats, teamState] = await Promise.all([
    prisma.playerState.findMany({
      where: { careerId, playerId: { in: ids } },
      include: { player: { select: { firstName: true, lastName: true } } },
    }),
    prisma.playerSeasonStat.findMany({ where: { careerId, season, playerId: { in: ids } } }),
    prisma.teamState.findFirst({ where: { careerId, teamId } }),
  ]);
  const name = (s: (typeof states)[number]) => `${s.player.firstName} ${s.player.lastName}`;

  // 1. Demandes ignorées.
  for (const s of states) {
    if (!s.pendingRequest || !s.requestAt || days(s.requestAt, gameDate) < REQUEST_IGNORED_AFTER_DAYS) continue;
    const p = personalityFor(s.playerId, s.age);
    const toTrade = ignoredLeadsToTradeRequest(p) && !s.wantsTrade;
    const updated = await prisma.playerState.updateMany({
      where: { id: s.id, pendingRequest: s.pendingRequest },
      data: {
        pendingRequest: null,
        requestAt: null,
        morale: clampMorale(s.morale + scaleMoraleDelta(REQUEST_IGNORED_MORALE, p)),
        ...(toTrade ? { wantsTrade: true, tradeRequestReasonsJson: JSON.stringify(["morale"]), tradeRequestSinceSeason: season } : {}),
      },
    });
    if (updated.count === 0) continue;
    await createInboxMessage(
      careerId,
      teamId,
      season,
      "player_reaction",
      fr ? `${name(s)} se sent ignoré` : `${name(s)} feels ignored`,
      fr
        ? `Tu n'as pas répondu à sa demande depuis une semaine. Son moral en prend un coup${toTrade ? ", et il demande désormais à être échangé" : ""}.`
        : `You haven't answered his request for a week. His morale takes a hit${toTrade ? ", and he now wants to be traded" : ""}.`,
      `/teams/${teamId}/players/${s.playerId}`,
      { playerId: s.playerId, priority: toTrade ? "urgent" : "important" }
    );
  }

  // 2. Nouvelle demande éventuelle.
  if (teamState?.lastPlayerRequestAt && days(teamState.lastPlayerRequestAt, gameDate) < REQUEST_TEAM_COOLDOWN_DAYS) return;
  const overalls = new Map(states.map((s) => [s.playerId, s.overallRating]));
  const mins = new Map<string, { m: number; g: number }>();
  for (const r of stats) {
    const x = mins.get(r.playerId) ?? { m: 0, g: 0 };
    x.m += r.minutes;
    x.g += r.gamesPlayed;
    mins.set(r.playerId, x);
  }
  const candidates = [...states].sort(() => Math.random() - 0.5);
  for (const s of candidates) {
    if (s.retired || s.injured || s.pendingRequest) continue;
    if (s.lastRequestAt && days(s.lastRequestAt, gameDate) < REQUEST_PLAYER_COOLDOWN_DAYS) continue;
    const contract = contracts.find((c) => c.playerId === s.playerId)!;
    const status = playerStatus({
      overall: s.overallRating,
      renown: s.renown,
      age: s.age,
      potential: s.potential || s.overallRating,
      teamRank: rankInRoster(s.overallRating, [...overalls].filter(([id]) => id !== s.playerId).map(([, o]) => o)),
    });
    const m = mins.get(s.playerId);
    const request = requestTrigger({
      personality: personalityFor(s.playerId, s.age),
      morale: s.morale,
      underExpectedMinutes: !!m && m.g >= 8 && m.m / m.g < EXPECTED_MINUTES[status] - MINUTES_TOLERANCE,
      contractYearsLeft: contract.yearsRemaining,
      extensionEligible: contract.yearsRemaining <= EXTENSION_MAX_YEARS_REMAINING,
      rookieScale: contract.isRookieScale,
    });
    if (!request) continue;
    const claimed = await prisma.playerState.updateMany({
      where: { id: s.id, pendingRequest: null },
      data: { pendingRequest: request, requestAt: gameDate, lastRequestAt: gameDate },
    });
    if (claimed.count === 0) continue;
    if (teamState) await prisma.teamState.update({ where: { id: teamState.id }, data: { lastPlayerRequestAt: gameDate } });
    const [title, body] = REQUEST_TEXT[request][fr ? "fr" : "en"];
    await createInboxMessage(
      careerId,
      teamId,
      season,
      "player_request",
      title.replace("{name}", name(s)),
      body.replace("{name}", name(s)) +
        (fr ? " Réponds-lui depuis sa fiche dans la semaine." : " Answer him from his player page within a week."),
      `/teams/${teamId}/players/${s.playerId}`,
      { playerId: s.playerId }
    );
    return; // une seule nouvelle demande à la fois
  }
}
