import type { BoxScoreEntry, Player, Team } from "@/lib/types";
import type { SimulationEngine, SimulationResult } from "./engine";

const HOME_ADVANTAGE = 2.5;
const ROTATION_SIZE = 8; // joueurs qui touchent des minutes significatives

function average(values: number[]): number {
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

// Approxime une loi normale via la somme de deux tirages uniformes (loi triangulaire) :
// donne un effet "courbe en cloche" plus réaliste qu'un bruit purement uniforme.
function noise(spread: number): number {
  return (Math.random() + Math.random() - 1) * spread;
}

function teamStrength(roster: Player[]): number {
  const rotation = [...roster]
    .sort((a, b) => b.overallRating - a.overallRating)
    .slice(0, ROTATION_SIZE);
  const starters = rotation.slice(0, 5);
  const bench = rotation.slice(5);
  const startersAvg = average(starters.map((p) => p.overallRating));
  const benchAvg = bench.length
    ? average(bench.map((p) => p.overallRating))
    : startersAvg;
  return startersAvg * 0.75 + benchAvg * 0.25;
}

function basePointsForLeague(leagueId: string): number {
  return leagueId === "wnba" ? 82 : 112;
}

function distributeBoxScore(
  teamId: string,
  roster: Player[],
  teamScore: number
): BoxScoreEntry[] {
  const rotation = [...roster]
    .sort((a, b) => b.overallRating - a.overallRating)
    .slice(0, ROTATION_SIZE);

  if (rotation.length === 0) return [];

  const weights = rotation.map((p) => Math.max(p.ratings.scoring + noise(6), 1));
  const totalWeight = weights.reduce((sum, w) => sum + w, 0);

  let distributedPoints = 0;
  const entries: BoxScoreEntry[] = rotation.map((player, index) => {
    const points = Math.round((weights[index] / totalWeight) * teamScore);
    distributedPoints += points;
    return {
      playerId: player.id,
      teamId,
      points,
      rebounds: Math.max(
        0,
        Math.round((player.ratings.rebounding / 99) * 11 + noise(2))
      ),
      assists: Math.max(
        0,
        Math.round((player.ratings.playmaking / 99) * 8 + noise(2))
      ),
    };
  });

  // Ajuste le premier joueur pour que la somme colle exactement au score d'équipe.
  entries[0].points = Math.max(0, entries[0].points + (teamScore - distributedPoints));

  return entries;
}

export class MockSimulationEngine implements SimulationEngine {
  simulateGame(
    home: Team,
    homeRoster: Player[],
    away: Team,
    awayRoster: Player[]
  ): SimulationResult {
    const base = basePointsForLeague(home.leagueId);
    const homeStrength = teamStrength(homeRoster) + HOME_ADVANTAGE;
    const awayStrength = teamStrength(awayRoster);

    const homeScore = Math.max(
      60,
      Math.round(base + (homeStrength - 75) * 0.9 + noise(9))
    );
    const awayScore = Math.max(
      60,
      Math.round(base + (awayStrength - 75) * 0.9 + noise(9))
    );

    return {
      homeScore,
      awayScore,
      boxScore: [
        ...distributeBoxScore(home.id, homeRoster, homeScore),
        ...distributeBoxScore(away.id, awayRoster, awayScore),
      ],
    };
  }
}

export const simulationEngine: SimulationEngine = new MockSimulationEngine();
