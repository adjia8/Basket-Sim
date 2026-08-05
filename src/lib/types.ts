// --- Ligue ---
export type LeagueCode = "NBA" | "WNBA";

export interface League {
  id: string; // "nba" | "wnba"
  code: LeagueCode;
  name: string;
  season: string; // "2025-2026"
  salaryCap: number; // dollars
  conferenceIds: string[];
}

export interface Conference {
  id: string; // ex: "nba-east"
  leagueId: string;
  name: string;
}

// --- Équipe ---
export interface Team {
  id: string; // "lal", "las-vegas-aces"
  leagueId: string;
  conferenceId: string;
  city: string;
  name: string; // "Lakers"
  abbreviation: string; // "LAL"
  primaryColor: string; // hex
  secondaryColor: string; // hex
  userId?: string | null; // null/undefined = géré par l'IA (préparé pour le multijoueur futur)
}

// --- Joueur ---
export type Position = "PG" | "SG" | "SF" | "PF" | "C";

export interface PlayerRatings {
  scoring: number; // 0-99
  playmaking: number;
  rebounding: number;
  defense: number;
  athleticism: number;
}

export interface Player {
  id: string;
  teamId: string;
  leagueId: string;
  firstName: string;
  lastName: string;
  position: Position;
  jerseyNumber: number;
  heightCm: number;
  age: number;
  overallRating: number; // 0-99
  ratings: PlayerRatings;
}

// --- Calendrier / Match ---
export type GameStatus = "scheduled" | "final";

export interface BoxScoreEntry {
  playerId: string;
  teamId: string;
  points: number;
  rebounds: number;
  assists: number;
}

export interface Game {
  id: string;
  leagueId: string;
  season: string;
  gameDate: string; // ISO date
  homeTeamId: string;
  awayTeamId: string;
  status: GameStatus;
  homeScore?: number;
  awayScore?: number;
  boxScore?: BoxScoreEntry[];
  homeReady: boolean;
  awayReady: boolean;
}

// --- Contrat ---
export interface Contract {
  id: string;
  playerId: string;
  teamId: string;
  salary: number; // dollars
  yearsRemaining: number;
  guaranteed: boolean;
}

// --- Prospect (draft) ---
export interface Prospect {
  id: string;
  position: Position;
  firstName: string;
  lastName: string;
  heightCm: number;
  age: number;
  overallRating: number;
  ratings: PlayerRatings;
}

// --- Classement ---
export interface StandingsRow {
  teamId: string;
  wins: number;
  losses: number;
  pointsFor: number;
  pointsAgainst: number;
  streak: string; // "W3" | "L1" | "-"
}
