import "server-only";
import { prisma } from "@/lib/prisma";

// Relevé mensuel des notes (voir PlayerRatingSnapshot) : au premier match
// joué de chaque mois de jeu (et au départ de la carrière), on photographie
// la note de tous les joueurs actifs. Idempotent (une ligne par joueur et par
// mois, doublons ignorés).
export async function maybeSnapshotRatings(careerId: string, season: string): Promise<void> {
  const ref =
    (await prisma.game.findFirst({ where: { careerId, status: "final" }, orderBy: { gameDate: "desc" }, select: { gameDate: true } }))
      ?.gameDate ??
    (await prisma.game.findFirst({ where: { careerId }, orderBy: { gameDate: "asc" }, select: { gameDate: true } }))?.gameDate;
  if (!ref) return;
  const month = new Date(Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth(), 1, 12));
  if ((await prisma.playerRatingSnapshot.count({ where: { careerId, date: month } })) > 0) return;
  const states = await prisma.playerState.findMany({
    where: { careerId, retired: false },
    select: { playerId: true, overallRating: true },
  });
  await prisma.playerRatingSnapshot.createMany({
    data: states.map((s) => ({ careerId, playerId: s.playerId, season, date: month, overall: s.overallRating })),
    skipDuplicates: true,
  });
}

export interface RatingPoint {
  date: string; // AAAA-MM
  season: string;
  overall: number;
}

export async function getRatingHistory(careerId: string, playerId: string): Promise<RatingPoint[]> {
  const rows = await prisma.playerRatingSnapshot.findMany({
    where: { careerId, playerId },
    orderBy: { date: "asc" },
    select: { date: true, season: true, overall: true },
  });
  return rows.map((r) => ({ date: r.date.toISOString().slice(0, 7), season: r.season, overall: r.overall }));
}

export interface SeasonLine {
  season: string;
  gamesPlayed: number;
  mpg: number;
  ppg: number;
  rpg: number;
  apg: number;
}

// Moyennes par saison régulière (un joueur échangé a une ligne par équipe).
export async function getCareerSeasonLines(careerId: string, playerId: string): Promise<SeasonLine[]> {
  const rows = await prisma.playerSeasonStat.findMany({ where: { careerId, playerId } });
  const bySeason = new Map<string, { gp: number; min: number; pts: number; reb: number; ast: number }>();
  for (const r of rows) {
    if (!/^\d{4}-\d{4}$/.test(r.season)) continue;
    const t = bySeason.get(r.season) ?? { gp: 0, min: 0, pts: 0, reb: 0, ast: 0 };
    t.gp += r.gamesPlayed;
    t.min += r.minutes;
    t.pts += r.points;
    t.reb += r.rebounds;
    t.ast += r.assists;
    bySeason.set(r.season, t);
  }
  return [...bySeason.entries()]
    .filter(([, t]) => t.gp > 0)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([season, t]) => ({
      season,
      gamesPlayed: t.gp,
      mpg: t.min / t.gp,
      ppg: t.pts / t.gp,
      rpg: t.reb / t.gp,
      apg: t.ast / t.gp,
    }));
}
