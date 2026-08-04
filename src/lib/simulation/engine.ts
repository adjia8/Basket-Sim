import type { BoxScoreEntry, Player, Team } from "@/lib/types";

export interface SimulationResult {
  homeScore: number;
  awayScore: number;
  boxScore: BoxScoreEntry[];
}

export interface SimulationEngine {
  simulateGame(
    home: Team,
    homeRoster: Player[],
    away: Team,
    awayRoster: Player[]
  ): SimulationResult;
}
