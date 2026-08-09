import "server-only";
import { prisma } from "@/lib/prisma";
import { PRESEASON_ROUNDS, PRESEASON_SPAN_DAYS, REGULAR_SEASON_GAMES, SEASON_LENGTH_DAYS } from "./schedule-rules";
import type { League } from "@/lib/types";

export function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function roundRobinPairs(teamIds: string[]): [string, string][] {
  const pairs: [string, string][] = [];
  for (let i = 0; i < teamIds.length; i++) {
    for (let j = i + 1; j < teamIds.length; j++) {
      pairs.push([teamIds[i], teamIds[j]]);
    }
  }
  return pairs;
}

// Construit un graphe k-régulier sur n sommets (0..n-1) — chaque sommet a
// exactement k arêtes, déterministe. Nécessite n*k pair (condition nécessaire
// à l'existence d'un tel graphe) et k < n.
function regularGraphPairs(n: number, k: number): [number, number][] {
  if (k <= 0) return [];
  if (k >= n) throw new Error(`regularGraphPairs: k doit être < n (k=${k}, n=${n})`);
  if ((n * k) % 2 !== 0) {
    throw new Error(`regularGraphPairs: graphe ${k}-régulier impossible sur ${n} sommets (n*k doit être pair)`);
  }
  const pairs: [number, number][] = [];
  const half = Math.floor(k / 2);
  // Anneaux de voisinage ±1..±half : chaque sommet reçoit exactement 2 arêtes
  // par anneau (une "sortante" vers i+d, une "entrante" depuis i-d).
  for (let d = 1; d <= half; d++) {
    for (let i = 0; i < n; i++) {
      pairs.push([i, (i + d) % n]);
    }
  }
  if (k % 2 === 1) {
    // k impair implique n pair (garanti par la vérification n*k pair) :
    // complète chaque sommet avec son opposé diamétral (+1 degré chacun).
    for (let i = 0; i < n / 2; i++) {
      pairs.push([i, i + n / 2]);
    }
  }
  return pairs;
}

// Mélange déterministe : sans ça, l'ordre naturel du round-robin place toujours
// les matchs de la première équipe en tête de calendrier (donc tous "final").
function seededShuffle<T>(items: T[], seed: string): T[] {
  const arr = [...items];
  let state = 0;
  for (let i = 0; i < seed.length; i++) {
    state = (state * 31 + seed.charCodeAt(i)) >>> 0;
  }
  for (let i = arr.length - 1; i > 0; i--) {
    state = (state * 1664525 + 1013904223) >>> 0;
    const j = state % (i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// Regroupe les paires (déjà mélangées) en "tours" façon round-robin : dans un
// même tour, aucune équipe n'apparaît deux fois — glouton, chaque paire va
// dans le premier tour où ni l'une ni l'autre équipe n'est déjà engagée.
// Combiné à un mappage tour -> jour strictement croissant (voir dayForRound),
// garantit qu'aucune équipe ne se retrouve avec deux matchs le même jour
// calendaire (l'ancienne assignation par index global le permettait).
function assignRounds(pairs: [string, string][]): number[] {
  const teamsUsedInRound: Set<string>[] = [];
  const roundOfPair: number[] = [];
  for (const [teamA, teamB] of pairs) {
    let round = 0;
    while (teamsUsedInRound[round]?.has(teamA) || teamsUsedInRound[round]?.has(teamB)) {
      round++;
    }
    (teamsUsedInRound[round] ??= new Set()).add(teamA);
    teamsUsedInRound[round].add(teamB);
    roundOfPair.push(round);
  }
  return roundOfPair;
}

export interface GenerateScheduleOptions {
  // Étiquette de saison à appliquer aux Game générés (Career.season courant,
  // pas forcément league.season une fois qu'on a dépassé la 1ère saison).
  seasonLabel: string;
  // Date du 1er match généré. Par défaut aujourd'hui - 8 jours (comportement
  // historique du rollover de saison, laisse une poignée de matchs déjà
  // "dus" à la date du jour sans que ça pose problème puisqu'ils restent
  // "scheduled"). La création de Career la surcharge explicitement pour
  // positionner la saison régulière après la pré-saison (voir actions/career.ts).
  startDate?: Date;
}

export async function generateCareerSchedule(
  careerId: string,
  league: League,
  options: GenerateScheduleOptions
): Promise<void> {
  const teamRows = await prisma.team.findMany({ where: { leagueId: league.id } });
  const teamIds = teamRows.map((t) => t.id);
  const n = teamIds.length;

  // Vrai nombre de matchs par équipe (82 NBA, 44 WNBA) : chaque adversaire est
  // joué `base` fois (round-robin répété), puis un graphe régulier ajoute une
  // dernière série de matchs supplémentaires pour atteindre le total exact —
  // seul moyen d'obtenir un total identique pour toutes les équipes quand la
  // cible n'est pas un multiple du nombre d'adversaires (82 ne l'est pas).
  const targetGamesPerTeam = REGULAR_SEASON_GAMES[league.id] ?? REGULAR_SEASON_GAMES.nba;
  const opponentCount = n - 1;
  const baseRounds = Math.floor(targetGamesPerTeam / opponentCount);
  const remainder = targetGamesPerTeam - baseRounds * opponentCount;

  const basePairs = roundRobinPairs(teamIds);
  const allPairs: [string, string][] = [];
  for (let round = 0; round < baseRounds; round++) {
    allPairs.push(...basePairs);
  }
  for (const [i, j] of regularGraphPairs(n, remainder)) {
    allPairs.push([teamIds[i], teamIds[j]]);
  }

  const pairs = seededShuffle(allPairs, `${careerId}-${options.seasonLabel}`);
  const roundOfPair = assignRounds(pairs);
  const totalRounds = Math.max(...roundOfPair) + 1;
  const startDate = options.startDate ?? addDays(new Date(), -8);
  const seasonDays = SEASON_LENGTH_DAYS[league.id] ?? SEASON_LENGTH_DAYS.nba;

  // Étale les tours sur toute la durée de la saison (plusieurs équipes jouent
  // le même jour, mais jamais une même équipe deux fois). Strictement
  // croissant en tour tant que totalRounds <= seasonDays (le cas normal —
  // ~82-90 tours pour 170 jours NBA, ~44-55 pour 130 jours WNBA) ; repli à un
  // tour = un jour sinon (saison compressée mais toujours sans collision).
  const dayForRound = (round: number): number =>
    totalRounds <= seasonDays ? Math.floor((round * seasonDays) / totalRounds) : round;

  const rows = pairs.map(([teamA, teamB], index) => {
    const dayOffset = dayForRound(roundOfPair[index]);
    const gameDate = addDays(startDate, dayOffset);
    const homeTeamId = index % 2 === 0 ? teamA : teamB;
    const awayTeamId = index % 2 === 0 ? teamB : teamA;

    return {
      careerId,
      leagueId: league.id,
      season: options.seasonLabel,
      gameDate,
      homeTeamId,
      awayTeamId,
      status: "scheduled",
    };
  });

  await prisma.game.createMany({ data: rows });
}

// Calendrier de pré-saison : volontairement plus simple que la saison
// régulière (pas besoin d'un round-robin équilibré pour des matchs
// d'exhibition) — à chaque tour, mélange les équipes et les apparie deux par
// deux ; une équipe seule sur un nombre impair d'équipes (ex: 13 en WNBA)
// passe simplement ce tour (repos), comme dans un vrai calendrier de
// pré-saison qui n'est jamais parfaitement symétrique non plus.
export async function generateCareerPreseasonSchedule(
  careerId: string,
  league: League,
  options: { seasonLabel: string; startDate: Date }
): Promise<void> {
  const teamRows = await prisma.team.findMany({ where: { leagueId: league.id } });
  const teamIds = teamRows.map((t) => t.id);

  const rows: {
    careerId: string;
    leagueId: string;
    season: string;
    gameDate: Date;
    homeTeamId: string;
    awayTeamId: string;
    status: string;
  }[] = [];

  for (let round = 0; round < PRESEASON_ROUNDS; round++) {
    const shuffled = seededShuffle(teamIds, `${careerId}-preseason-${round}`);
    const gameDate = addDays(options.startDate, Math.floor((round * PRESEASON_SPAN_DAYS) / PRESEASON_ROUNDS));
    for (let i = 0; i + 1 < shuffled.length; i += 2) {
      // Alterne qui reçoit d'un tour à l'autre, pour qu'une équipe ne soit
      // pas systématiquement à l'extérieur sur les tours pairs.
      const homeTeamId = round % 2 === 0 ? shuffled[i] : shuffled[i + 1];
      const awayTeamId = round % 2 === 0 ? shuffled[i + 1] : shuffled[i];
      rows.push({
        careerId,
        leagueId: league.id,
        season: options.seasonLabel,
        gameDate,
        homeTeamId,
        awayTeamId,
        status: "scheduled",
      });
    }
  }

  await prisma.game.createMany({ data: rows });
}
