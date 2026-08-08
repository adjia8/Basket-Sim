import "server-only";
import { prisma } from "@/lib/prisma";
import { simulationEngine } from "@/lib/simulation/mockEngine";
import { toDomainPlayer, toDomainTeam } from "@/lib/data-access/mappers";
import { REGULAR_SEASON_GAMES, SEASON_LENGTH_DAYS } from "./schedule-rules";
import type { League, Player } from "@/lib/types";

function addDays(date: Date, days: number): Date {
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
  // true uniquement à la toute première génération (création de la Career) :
  // pré-simule les matchs dont la date calculée est déjà passée. Pour un
  // rollover de saison, tout doit démarrer "scheduled".
  presimulatePast: boolean;
}

export async function generateCareerSchedule(
  careerId: string,
  league: League,
  options: GenerateScheduleOptions
): Promise<void> {
  const teamRows = await prisma.team.findMany({ where: { leagueId: league.id } });
  const teams = teamRows.map(toDomainTeam);
  const teamIds = teams.map((t) => t.id);
  const n = teamIds.length;

  // Roster par équipe POUR CETTE CAREER (via Contract), seulement nécessaire
  // si on doit effectivement pré-simuler des matchs.
  const rosterByTeamId = new Map<string, Player[]>();
  if (options.presimulatePast) {
    const contractRows = await prisma.contract.findMany({
      where: { careerId },
      include: { player: true },
    });
    for (const contract of contractRows) {
      const roster = rosterByTeamId.get(contract.teamId) ?? [];
      roster.push(toDomainPlayer(contract.player));
      rosterByTeamId.set(contract.teamId, roster);
    }
  }

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

  const today = new Date();
  const pairs = seededShuffle(allPairs, `${careerId}-${options.seasonLabel}`);
  const roundOfPair = assignRounds(pairs);
  const totalRounds = Math.max(...roundOfPair) + 1;
  const startDate = addDays(today, -8); // une poignée de matchs déjà joués
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
    const isPast = options.presimulatePast && gameDate < today;
    const homeTeamId = index % 2 === 0 ? teamA : teamB;
    const awayTeamId = index % 2 === 0 ? teamB : teamA;

    let homeScore: number | null = null;
    let awayScore: number | null = null;
    let boxScore: string | null = null;

    if (isPast) {
      const homeTeam = teams.find((t) => t.id === homeTeamId)!;
      const awayTeam = teams.find((t) => t.id === awayTeamId)!;
      const result = simulationEngine.simulateGame(
        homeTeam,
        rosterByTeamId.get(homeTeamId) ?? [],
        awayTeam,
        rosterByTeamId.get(awayTeamId) ?? []
      );
      homeScore = result.homeScore;
      awayScore = result.awayScore;
      boxScore = JSON.stringify(result.boxScore);
    }

    return {
      careerId,
      leagueId: league.id,
      season: options.seasonLabel,
      gameDate,
      homeTeamId,
      awayTeamId,
      status: isPast ? "final" : "scheduled",
      homeScore,
      awayScore,
      boxScore,
    };
  });

  await prisma.game.createMany({ data: rows });
}
