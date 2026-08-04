import "server-only";
import { prisma } from "@/lib/prisma";
import { simulationEngine } from "@/lib/simulation/mockEngine";
import { toDomainPlayer, toDomainTeam } from "@/lib/data-access/mappers";
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

  const today = new Date();
  const pairs = seededShuffle(
    roundRobinPairs(teams.map((t) => t.id)),
    `${careerId}-${options.seasonLabel}`
  );
  const startDate = addDays(today, -8); // une poignée de matchs déjà joués

  const rows = pairs.map(([teamA, teamB], index) => {
    const gameDate = addDays(startDate, index * 2); // un match tous les 2 jours
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
