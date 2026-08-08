import "server-only";
import { prisma } from "@/lib/prisma";
import type { BoxScoreEntry } from "@/lib/types";

export interface SeasonStats {
  gamesPlayed: number;
  points: number;
  rebounds: number;
  assists: number;
  ppg: number;
  rpg: number;
  apg: number;
}

function emptyStats(): SeasonStats {
  return { gamesPlayed: 0, points: 0, rebounds: 0, assists: 0, ppg: 0, rpg: 0, apg: 0 };
}

// Un seul scan des matchs "final" de la saison en cours (career-wide, pas
// limité à une équipe — un joueur échangé en cours de saison garde ses
// stats), puis filtre les BoxScoreEntry par playerId. Même filtre season
// que getScheduleForCareer (exclut les playoffs, dont le season a un
// suffixe "-playoffs").
export async function getSeasonStatsForPlayers(
  careerId: string,
  season: string,
  playerIds: string[]
): Promise<Map<string, SeasonStats>> {
  const wanted = new Set(playerIds);
  const stats = new Map<string, SeasonStats>();

  const games = await prisma.game.findMany({
    where: { careerId, season, status: "final" },
    select: { boxScore: true },
  });

  for (const game of games) {
    if (!game.boxScore) continue;
    const entries = JSON.parse(game.boxScore) as BoxScoreEntry[];
    for (const entry of entries) {
      if (!wanted.has(entry.playerId)) continue;
      const current = stats.get(entry.playerId) ?? emptyStats();
      current.gamesPlayed += 1;
      current.points += entry.points;
      current.rebounds += entry.rebounds;
      current.assists += entry.assists;
      stats.set(entry.playerId, current);
    }
  }

  for (const s of stats.values()) {
    s.ppg = s.gamesPlayed ? Math.round((s.points / s.gamesPlayed) * 10) / 10 : 0;
    s.rpg = s.gamesPlayed ? Math.round((s.rebounds / s.gamesPlayed) * 10) / 10 : 0;
    s.apg = s.gamesPlayed ? Math.round((s.assists / s.gamesPlayed) * 10) / 10 : 0;
  }

  return stats;
}
