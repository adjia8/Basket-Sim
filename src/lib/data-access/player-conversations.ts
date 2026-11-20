import "server-only";
import { prisma } from "@/lib/prisma";
import { personalityFor } from "@/lib/careers/personality-rules";
import {
  EXPECTED_MINUTES,
  MINUTES_TOLERANCE,
  playerStatus,
  promisableStatuses,
  rankInRoster,
  type PlayerStatus,
} from "@/lib/careers/player-status-rules";
import {
  CONVERSATION_COOLDOWN_DAYS,
  availableTopics,
  type ConversationContext,
  type ConversationTopic,
} from "@/lib/careers/player-conversation-rules";
import type { BoxScoreEntry } from "@/lib/types";

const DAY_MS = 86_400_000;

export interface ConversationSetup {
  context: ConversationContext;
  topics: ConversationTopic[];
  cooldownDays: number; // 0 = on peut discuter
  today: Date | null;
  nextStatus: PlayerStatus | null; // rôle promis par « plus de minutes »
}

// Tout ce qu'il faut pour discuter avec un joueur de MON effectif : sa
// situation (statut, minutes, demande d'échange, promesses), ses derniers
// matchs (incident, forme) et le délai avant la prochaine discussion.
export async function getConversationSetup(
  careerId: string,
  season: string,
  teamId: string,
  playerId: string
): Promise<ConversationSetup | null> {
  const [state, mates, seasonRows, lastGame, recentGames] = await Promise.all([
    prisma.playerState.findUnique({ where: { careerId_playerId: { careerId, playerId } } }),
    prisma.contract
      .findMany({ where: { careerId, teamId, playerId: { not: playerId } }, select: { playerId: true } })
      .then((cs) =>
        prisma.playerState.findMany({ where: { careerId, playerId: { in: cs.map((c) => c.playerId) } }, select: { overallRating: true } })
      ),
    prisma.playerSeasonStat.findMany({ where: { careerId, season, playerId } }),
    prisma.game.findFirst({ where: { careerId, status: "final" }, orderBy: { gameDate: "desc" }, select: { gameDate: true } }),
    prisma.game.findMany({
      where: { careerId, status: "final", OR: [{ homeTeamId: teamId }, { awayTeamId: teamId }] },
      orderBy: { gameDate: "desc" },
      take: 5,
      select: { boxScore: true },
    }),
  ]);
  if (!state) return null;
  const status = playerStatus({
    overall: state.overallRating,
    renown: state.renown,
    age: state.age,
    potential: state.potential || state.overallRating,
    teamRank: rankInRoster(state.overallRating, mates.map((m) => m.overallRating)),
  });
  const gp = seasonRows.reduce((s, r) => s + r.gamesPlayed, 0);
  const mpg = gp ? seasonRows.reduce((s, r) => s + r.minutes, 0) / gp : 0;
  const ppg = gp ? seasonRows.reduce((s, r) => s + r.points, 0) / gp : 0;
  const recent = recentGames
    .map((g) => (JSON.parse(g.boxScore ?? "[]") as BoxScoreEntry[]).find((e) => e.playerId === playerId))
    .filter((e): e is BoxScoreEntry => !!e);
  const recentIncident = recent.some((e) => e.technicalFouls > 0 || e.disqualifiedReason === "ejected");
  const recentPpg = recent.length ? recent.reduce((s, e) => s + e.points, 0) / recent.length : 0;
  const promisable = promisableStatuses(status);
  const nextStatus = promisable.length ? promisable.reduce((a, b) => (EXPECTED_MINUTES[a] < EXPECTED_MINUTES[b] ? a : b)) : null;

  const context: ConversationContext = {
    personality: personalityFor(playerId, state.age),
    age: state.age,
    morale: state.morale,
    status,
    canPromiseMoreMinutes: !!nextStatus && !state.promisedStatus,
    underExpectedMinutes: gp >= 5 && mpg < EXPECTED_MINUTES[status] - MINUTES_TOLERANCE,
    wantsTrade: state.wantsTrade,
    hasActivePromise: !!state.activePromiseType,
    recentIncident,
    recentGoodForm: recent.length >= 3 && recentPpg >= ppg + 3,
  };
  const today = lastGame?.gameDate ?? null;
  const since = state.lastConversationAt && today ? Math.floor((today.getTime() - state.lastConversationAt.getTime()) / DAY_MS) : null;
  const cooldownDays = since === null ? 0 : Math.max(0, CONVERSATION_COOLDOWN_DAYS - since);
  return { context, topics: availableTopics(context), cooldownDays, today, nextStatus };
}
