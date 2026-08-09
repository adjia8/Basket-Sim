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
  marketAppeal: number; // 0-99, attractivité de la ville (marché, climat, style de vie)
  userId?: string | null; // null/undefined = géré par l'IA (préparé pour le multijoueur futur)
}

// --- Joueur ---
export type Position = "PG" | "SG" | "SF" | "PF" | "C";

// 10 attributs techniques (0-99), pilotent la simulation (voir mockEngine.ts) —
// distincts d'overallRating, qui reste la valeur "front-office" (salaire,
// trade, ordre de draft).
export interface PlayerRatings {
  scoringInside: number;
  scoringOutside: number;
  playmaking: number;
  defenseInside: number;
  defenseOutside: number;
  rebounding: number;
  athleticism: number;
  basketballIQ: number;
  clutch: number;
  stamina: number;
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
  injuryRisk: number; // 0-99, risque de blessure basé sur l'historique réel connu
  injured: boolean;
  injuryGamesRemaining: number;
  injurySeverity?: "minor" | "moderate" | "severe"; // undefined = sain
  playingThroughInjury: boolean;
  renown: number; // 0-99, évolue à chaque match joué
  fatigue: number; // 0-99, monte après un match, redescend avec le repos
  conditioning: number; // 0-100, 100 = conditionnement optimal
  trainingBoost: number; // 0-8, bonus temporaire courant sur les attributs de trainingBoostFocus
  trainingBoostFocus?: "offensive" | "defensive" | "tactical" | "physical" | "chemistry" | "rest";
  nationality: string;
}

// --- Calendrier / Match ---
export type GameStatus = "scheduled" | "final";

export interface BoxScoreEntry {
  playerId: string;
  teamId: string;
  points: number;
  rebounds: number;
  assists: number;
  personalFouls: number;
  technicalFouls: number;
  flagrantFouls: number;
  // undefined = a joué tout le match ; sinon la raison de sa sortie prématurée.
  disqualifiedReason?: "fouled_out" | "ejected";
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
  playoffSeriesId?: string;
}

// --- Contrat ---
export type ContractType = "standard" | "two_way" | "development";

export interface Contract {
  id: string;
  playerId: string;
  teamId: string;
  salary: number; // dollars
  yearsRemaining: number;
  guaranteed: boolean;
  contractType: ContractType;
  isRookieScale: boolean;
  developmentGamesActivated: number;
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
  scoutingNote?: string; // ex. "Duke (NCAA)" — undefined pour un prospect généré
  nationality: string;
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
