import type { BoxScoreEntry, Player, Team } from "@/lib/types";

export interface SimulationResult {
  homeScore: number;
  awayScore: number;
  boxScore: BoxScoreEntry[];
}

// Chimie d'équipe (0-99) — optionnelle : les appelants qui n'ont pas encore
// de TeamState sous la main (ex. pré-simulation au tout début d'une Career)
// laissent le moteur retomber sur une valeur neutre.
export interface SimulationOptions {
  homeChemistry?: number;
  awayChemistry?: number;
  // Bonus de force permanent du GM humain de l'équipe (0 pour une équipe IA
  // ou sans GmProfile) — voir gm-rules.ts/getGmBonusForTeam.
  homeGmBonus?: number;
  awayGmBonus?: number;
}

export interface SimulationEngine {
  simulateGame(
    home: Team,
    homeRoster: Player[],
    away: Team,
    awayRoster: Player[],
    options?: SimulationOptions
  ): SimulationResult;
}
