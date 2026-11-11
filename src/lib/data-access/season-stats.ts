import "server-only";
import { Prisma } from "@prisma/client";
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

// Colonnes cumulées de PlayerSeasonStat, dans l'ordre de l'INSERT ci-dessous.
const STAT_COLUMNS = [
  "gamesPlayed",
  "minutes",
  "points",
  "rebounds",
  "assists",
  "steals",
  "blocks",
  "turnovers",
  "fgm",
  "fga",
  "tpm",
  "tpa",
  "ftm",
  "fta",
] as const;

function entryValues(e: BoxScoreEntry): number[] {
  return [
    1,
    e.minutesPlayed,
    e.points,
    e.rebounds,
    e.assists,
    e.steals,
    e.blocks,
    e.turnovers,
    e.fieldGoalsMade,
    e.fieldGoalsAttempted,
    e.threePointersMade,
    e.threePointersAttempted,
    e.freeThrowsMade,
    e.freeThrowsAttempted,
  ];
}

// Ajoute le box score d'un match aux statistiques de la saison, en UNE
// requête (INSERT … ON CONFLICT DO UPDATE) — appelée dans la vague
// d'écritures de fin de match (voir simulate.ts). Seuls les joueurs entrés
// en jeu comptent un match joué.
export async function recordGameStats(careerId: string, season: string, boxScore: BoxScoreEntry[]): Promise<void> {
  const played = boxScore.filter((e) => e.minutesPlayed > 0);
  if (played.length === 0) return;
  const rows = played.map(
    (e) =>
      Prisma.sql`(gen_random_uuid()::text, ${careerId}, ${season}, ${e.playerId}, ${e.teamId}, ${Prisma.join(
        entryValues(e)
      )})`
  );
  const columns = Prisma.raw(STAT_COLUMNS.map((c) => `"${c}"`).join(", "));
  const updates = Prisma.raw(
    STAT_COLUMNS.map((c) => `"${c}" = "PlayerSeasonStat"."${c}" + EXCLUDED."${c}"`).join(", ")
  );
  await prisma.$executeRaw`
    INSERT INTO "PlayerSeasonStat" ("id", "careerId", "season", "playerId", "teamId", ${columns})
    VALUES ${Prisma.join(rows)}
    ON CONFLICT ("careerId", "season", "playerId")
    DO UPDATE SET "teamId" = EXCLUDED."teamId", ${updates}
  `;
}

// Saisons jouées avant l'arrivée de cette table : reconstruites une fois à
// partir des box scores enregistrés (verrou consultatif : jamais deux
// reconstructions en même temps).
const rebuiltSeasons = new Set<string>();
export async function ensureSeasonStats(careerId: string, season: string): Promise<void> {
  const key = `${careerId}:${season}`;
  if (rebuiltSeasons.has(key)) return;
  const [existing, finals] = await Promise.all([
    prisma.playerSeasonStat.count({ where: { careerId, season } }),
    prisma.game.count({ where: { careerId, season, status: "final" } }),
  ]);
  if (existing === 0 && finals > 0) {
    const games = await prisma.game.findMany({
      where: { careerId, season, status: "final" },
      select: { boxScore: true },
    });
    const totals = new Map<string, { teamId: string; values: number[] }>();
    for (const game of games) {
      if (!game.boxScore) continue;
      for (const e of JSON.parse(game.boxScore) as BoxScoreEntry[]) {
        if (e.minutesPlayed <= 0) continue;
        const values = entryValues(e);
        const current = totals.get(e.playerId);
        if (current) {
          current.teamId = e.teamId;
          values.forEach((v, i) => (current.values[i] += v));
        } else {
          totals.set(e.playerId, { teamId: e.teamId, values });
        }
      }
    }
    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`stats:${key}`}))`;
      if ((await tx.playerSeasonStat.count({ where: { careerId, season } })) > 0) return;
      await tx.playerSeasonStat.createMany({
        data: [...totals].map(([playerId, t]) => ({
          careerId,
          season,
          playerId,
          teamId: t.teamId,
          ...Object.fromEntries(STAT_COLUMNS.map((c, i) => [c, t.values[i]])),
        })),
      });
    });
  }
  rebuiltSeasons.add(key);
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

// Statistiques de saison de quelques joueurs (effectif, fiche joueur, page
// de match) — lues dans PlayerSeasonStat plutôt que de rescanner tous les
// box scores de la saison à chaque affichage.
export async function getSeasonStatsForPlayers(
  careerId: string,
  season: string,
  playerIds: string[]
): Promise<Map<string, SeasonStats>> {
  await ensureSeasonStats(careerId, season);
  const rows = await prisma.playerSeasonStat.findMany({
    where: { careerId, season, playerId: { in: playerIds } },
  });
  return new Map(
    rows.map((r) => [
      r.playerId,
      {
        gamesPlayed: r.gamesPlayed,
        points: r.points,
        rebounds: r.rebounds,
        assists: r.assists,
        ppg: r.gamesPlayed ? round1(r.points / r.gamesPlayed) : 0,
        rpg: r.gamesPlayed ? round1(r.rebounds / r.gamesPlayed) : 0,
        apg: r.gamesPlayed ? round1(r.assists / r.gamesPlayed) : 0,
      },
    ])
  );
}

export interface PlayerSeasonLine {
  playerId: string;
  name: string;
  teamId: string;
  age: number;
  overall: number;
  gamesPlayed: number;
  mpg: number;
  ppg: number;
  rpg: number;
  apg: number;
  spg: number;
  bpg: number;
  tpg: number;
  fgPct: number;
  tpPct: number;
  ftPct: number;
  fga: number;
  tpa: number;
  fta: number;
  defense: number; // moyenne des attributs défensifs (trophée de défenseur de l'année)
}

// Toutes les lignes de stats d'une saison (leaders, trophées), avec nom,
// âge et note du joueur dans cette carrière.
export async function getSeasonLines(careerId: string, season: string): Promise<PlayerSeasonLine[]> {
  await ensureSeasonStats(careerId, season);
  const rows = await prisma.playerSeasonStat.findMany({ where: { careerId, season } });
  const ids = rows.map((r) => r.playerId);
  const [players, states] = await Promise.all([
    prisma.player.findMany({ where: { id: { in: ids } }, select: { id: true, firstName: true, lastName: true } }),
    prisma.playerState.findMany({
      where: { careerId, playerId: { in: ids } },
      select: { playerId: true, age: true, overallRating: true, defenseInside: true, defenseOutside: true },
    }),
  ]);
  const nameById = new Map(players.map((p) => [p.id, `${p.firstName} ${p.lastName}`]));
  const stateById = new Map(states.map((s) => [s.playerId, s]));
  return rows
    .filter((r) => r.gamesPlayed > 0)
    .map((r) => {
      const g = r.gamesPlayed;
      return {
        playerId: r.playerId,
        name: nameById.get(r.playerId) ?? r.playerId,
        teamId: r.teamId,
        age: stateById.get(r.playerId)?.age ?? 0,
        overall: stateById.get(r.playerId)?.overallRating ?? 0,
        gamesPlayed: g,
        mpg: round1(r.minutes / g),
        ppg: round1(r.points / g),
        rpg: round1(r.rebounds / g),
        apg: round1(r.assists / g),
        spg: round1(r.steals / g),
        bpg: round1(r.blocks / g),
        tpg: round1(r.turnovers / g),
        fgPct: r.fga ? Math.round((r.fgm / r.fga) * 1000) / 10 : 0,
        tpPct: r.tpa ? Math.round((r.tpm / r.tpa) * 1000) / 10 : 0,
        ftPct: r.fta ? Math.round((r.ftm / r.fta) * 1000) / 10 : 0,
        fga: r.fga,
        tpa: r.tpa,
        fta: r.fta,
        defense: (() => {
          const st = stateById.get(r.playerId);
          return st ? (st.defenseInside + st.defenseOutside) / 2 : 50;
        })(),
      };
    });
}
