import "server-only";
import { prisma } from "@/lib/prisma";
import { getStandings } from "@/lib/data-access/standings";
import {
  positionDepth,
  rankMetrics,
  reportAdvice,
  strengthsAndWeaknesses,
  type Advice,
  type MetricKey,
  type PositionDepth,
  type RankedMetric,
  type TeamMetrics,
} from "@/lib/careers/team-report-rules";

export interface TeamReport {
  gamesPlayed: number;
  ranked: RankedMetric[];
  strengths: RankedMetric[];
  weaknesses: RankedMetric[];
  depth: PositionDepth[];
  advice: Advice[];
  averageAge: number;
}

const ATTRIBUTES: MetricKey[] = [
  "scoringInside",
  "scoringOutside",
  "playmaking",
  "defenseInside",
  "defenseOutside",
  "rebounding",
  "athleticism",
  "basketballIQ",
  "clutch",
];

// Rapport d'une équipe : indicateurs calculés pour TOUTE la ligue (pour
// classer), puis points forts / faibles, profondeur par poste et pistes.
export async function getTeamReport(careerId: string, leagueId: string, season: string, teamId: string): Promise<TeamReport> {
  const [standings, statRows, contracts] = await Promise.all([
    getStandings(careerId, leagueId, season),
    prisma.playerSeasonStat.groupBy({
      by: ["teamId"],
      where: { careerId, season },
      _sum: { rebounds: true, assists: true, steals: true, blocks: true, turnovers: true, fgm: true, fga: true, tpm: true, tpa: true, ftm: true, fta: true },
    }),
    prisma.contract.findMany({
      where: { careerId, contractType: "standard", team: { leagueId } },
      select: { teamId: true, playerId: true, player: { select: { position: true } } },
    }),
  ]);
  const states = await prisma.playerState.findMany({
    where: { careerId, playerId: { in: contracts.map((c) => c.playerId) } },
  });
  const stateById = new Map(states.map((s) => [s.playerId, s]));

  const league = new Map<string, TeamMetrics>();
  const gamesByTeam = new Map(standings.map((r) => [r.teamId, r.wins + r.losses]));
  for (const r of standings) {
    const g = r.wins + r.losses;
    league.set(r.teamId, g > 0 ? { ppg: r.pointsFor / g, oppPpg: r.pointsAgainst / g } : {});
  }
  for (const row of statRows) {
    const g = gamesByTeam.get(row.teamId) ?? 0;
    if (g === 0) continue;
    const s = row._sum;
    const m = league.get(row.teamId) ?? {};
    Object.assign(m, {
      rpg: (s.rebounds ?? 0) / g,
      apg: (s.assists ?? 0) / g,
      spg: (s.steals ?? 0) / g,
      bpg: (s.blocks ?? 0) / g,
      tov: (s.turnovers ?? 0) / g,
      fgPct: s.fga ? (s.fgm ?? 0) / s.fga : undefined,
      tpPct: s.tpa ? (s.tpm ?? 0) / s.tpa : undefined,
      ftPct: s.fta ? (s.ftm ?? 0) / s.fta : undefined,
    });
    league.set(row.teamId, m);
  }

  // Attributs : moyenne des 8 meilleurs joueurs ; banc = note moyenne des 6e à 10e.
  const byTeam = new Map<string, typeof states>();
  for (const c of contracts) {
    const s = stateById.get(c.playerId);
    if (s) byTeam.set(c.teamId, [...(byTeam.get(c.teamId) ?? []), s]);
  }
  for (const [id, list] of byTeam) {
    const sorted = [...list].sort((a, b) => b.overallRating - a.overallRating);
    const top = sorted.slice(0, 8);
    const m = league.get(id) ?? {};
    for (const attr of ATTRIBUTES) {
      m[attr] = top.reduce((sum, p) => sum + (p[attr as keyof typeof p] as number), 0) / Math.max(1, top.length);
    }
    const bench = sorted.slice(5, 10);
    m.bench = bench.reduce((sum, p) => sum + p.overallRating, 0) / Math.max(1, bench.length);
    league.set(id, m);
  }

  const ranked = rankMetrics(teamId, league);
  const { strengths, weaknesses } = strengthsAndWeaknesses(ranked);
  const mine = contracts.filter((c) => c.teamId === teamId);
  const depth = positionDepth(
    mine.map((c) => ({
      position: c.player.position,
      overall: stateById.get(c.playerId)?.overallRating ?? 0,
      injured: stateById.get(c.playerId)?.injured ?? false,
    }))
  );
  const myStates = mine.map((c) => stateById.get(c.playerId)).filter((s): s is NonNullable<typeof s> => !!s);
  return {
    gamesPlayed: gamesByTeam.get(teamId) ?? 0,
    ranked,
    strengths,
    weaknesses,
    depth,
    advice: reportAdvice(ranked, depth),
    averageAge: myStates.reduce((s, p) => s + p.age, 0) / Math.max(1, myStates.length),
  };
}
