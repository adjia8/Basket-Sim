import type { BoxScoreEntry, Player, Team } from "@/lib/types";
import type { Tactics } from "@/lib/careers/tactics-rules";

// État d'un match arrêté à la mi-temps (causerie de mi-temps), repris
// ensuite tel quel pour jouer la 2e mi-temps.
// Événements d'un quart-temps (match en direct) : matière première du fil
// de commentaires, rendu côté page dans la langue du joueur.
export interface QuarterEvent {
  q: number; // 1-4, 5+ = prolongations
  home: number; // points marqués dans le quart-temps
  away: number;
  homeTotal: number;
  awayTotal: number;
  top: { playerId: string; teamId: string; pts: number }[]; // meilleurs marqueurs du quart
  foulTrouble: string[]; // joueurs passés à 4 fautes ou plus
  technicals: string[];
  ejected: string[]; // expulsés (techniques, flagrantes)
  fouledOut?: string[]; // sortis pour 6 fautes
  timeout?: "home" | "away";
}

// État d'un match arrêté entre deux quarts-temps (historiquement : à la
// mi-temps seulement, d'où le nom). `quarter` absent = mi-temps (2).
export interface HalfState {
  homeScore: number;
  awayScore: number;
  boxScore: BoxScoreEntry[];
  disqualified: string[];
  quarter?: number;
  quarterLog?: QuarterEvent[];
  timeoutsUsed?: { home: number[]; away: number[] }; // mi-temps (1 ou 2) où le temps mort a servi
  // Forme du soir de chaque joueur, conservée d'un quart-temps à l'autre.
  form?: Record<string, { pts: number; reb: number; ast: number }>;
}

export interface SimulationResult {
  homeScore: number;
  awayScore: number;
  boxScore: BoxScoreEntry[];
  halftime?: HalfState; // présent seulement si le match s'est arrêté entre deux quarts-temps
  quarterLog?: QuarterEvent[];
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
  // Ordre de profondeur de banc choisi par le GM (ids joueuses), voir
  // TeamState.rotationOrderJson — absent = tri automatique par playerImpact
  // (comportement inchangé, notamment pour une équipe gérée par l'IA).
  homeRotationOrder?: string[];
  awayRotationOrder?: string[];
  // Tactiques (voir tactics-rules.ts) et compétence tactique de
  // l'entraîneur principal (0-99, voir staff-rules.ts) — absentes = tactique
  // équilibrée par défaut, exécution d'un coach moyen.
  homeTactics?: Tactics;
  awayTactics?: Tactics;
  homeCoachTactics?: number;
  awayCoachTactics?: number;
  // Causeries (voir team-talk-rules.ts) : concentration en points sur
  // chaque mi-temps.
  homeFocus?: { first: number; second: number };
  awayFocus?: { first: number; second: number };
  // Arrêt à la mi-temps / reprise depuis la mi-temps.
  stopAtHalf?: boolean;
  // Match en direct : s'arrêter après ce quart-temps (1-3).
  stopAfterQuarter?: number;
  resumeFrom?: HalfState;
  // Temps mort demandé pour le prochain quart-temps : regain de
  // concentration (en points) pour ce camp.
  timeout?: { side: "home" | "away"; points: number };
  // Joueurs mis au repos pendant le prochain quart-temps seulement.
  restNextQuarter?: string[];
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
