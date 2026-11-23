// Règles pures de la fin de saison (cérémonie d'intersaison) : MVP des
// Finales, réunion avec la direction et cap choisi pour la saison suivante.
// Aucun accès base de données ici (voir data-access/offseason.ts).

import { tierIndex, type ExpectationTier, type GmSeasonOutcome } from "./gm-rules";

// ---------------------------------------------------------------------------
// MVP des Finales : meilleur joueur de l'équipe championne sur la série.

export interface FinalsBoxLine {
  playerId: string;
  teamId: string;
  points: number;
  rebounds: number;
  assists: number;
  steals: number;
  blocks: number;
  turnovers: number;
  minutesPlayed: number;
}

export interface FinalsTotals {
  playerId: string;
  games: number;
  points: number;
  rebounds: number;
  assists: number;
  steals: number;
  blocks: number;
  turnovers: number;
}

export function finalsTotals(boxScores: FinalsBoxLine[][], teamId: string): FinalsTotals[] {
  const by = new Map<string, FinalsTotals>();
  for (const game of boxScores) {
    for (const e of game) {
      if (e.teamId !== teamId || e.minutesPlayed <= 0) continue;
      const t = by.get(e.playerId) ?? { playerId: e.playerId, games: 0, points: 0, rebounds: 0, assists: 0, steals: 0, blocks: 0, turnovers: 0 };
      t.games++;
      t.points += e.points;
      t.rebounds += e.rebounds;
      t.assists += e.assists;
      t.steals += e.steals;
      t.blocks += e.blocks;
      t.turnovers += e.turnovers;
      by.set(e.playerId, t);
    }
  }
  return [...by.values()];
}

// Production par match, à la manière des votes réels (le meilleur marqueur
// de la série l'emporte le plus souvent, les rebonds et passes comptent).
export function finalsMvpScore(t: FinalsTotals): number {
  if (t.games === 0) return 0;
  return (t.points + 1.1 * t.rebounds + 1.4 * t.assists + 2 * (t.steals + t.blocks) - t.turnovers) / t.games;
}

export function pickFinalsMvp(totals: FinalsTotals[]): FinalsTotals | null {
  return [...totals].sort((a, b) => finalsMvpScore(b) - finalsMvpScore(a))[0] ?? null;
}

// ---------------------------------------------------------------------------
// Réunion avec la direction.

export type SeasonPlan = "contend" | "steady" | "rebuild";
export const SEASON_PLANS: SeasonPlan[] = ["contend", "steady", "rebuild"];

// Effets du cap annoncé : l'objectif de la saison suivante bouge d'un cran,
// la direction apprécie l'ambition (et moins un projet de reconstruction,
// sauf si la saison a été ratée : elle l'attendait alors).
export function planEffects(plan: SeasonPlan, outcome: GmSeasonOutcome): { tierShift: number; approval: number } {
  if (plan === "contend") return { tierShift: 1, approval: 4 };
  if (plan === "rebuild") return { tierShift: -1, approval: outcome === "warning" ? 2 : -3 };
  return { tierShift: 0, approval: 1 };
}

const TIERS: ExpectationTier[] = ["rebuild", "play_in", "playoffs", "conf_semis", "conf_finals", "nba_finals", "champion"];

export function shiftTier(tier: ExpectationTier, shift: number): ExpectationTier {
  const i = Math.max(0, Math.min(TIERS.length - 1, tierIndex(tier) + shift));
  return TIERS[i];
}

// Verdict figé au moment de la réunion (la fin de saison le reprend tel quel).
export interface SeasonReview {
  season: string;
  outcome: GmSeasonOutcome;
  gap: number;
  expectation: ExpectationTier;
  result: ExpectationTier;
  financesNegative: boolean;
  approval: number;
  objectivesMet: number;
  objectivesTotal: number;
  plan: SeasonPlan | null;
}

export function parseSeasonReview(json: string | null | undefined): SeasonReview | null {
  if (!json) return null;
  try {
    const v = JSON.parse(json) as SeasonReview;
    return v && typeof v.season === "string" && typeof v.outcome === "string" ? v : null;
  } catch {
    return null;
  }
}

// Humeur du propriétaire pendant la réunion (texte choisi dans le dictionnaire).
// « lenient » : résultat en dessous de l'objectif, mais compensé (confiance
// de la direction) — le verdict reste favorable, le discours le nuance.
export type OwnerMood = "delighted" | "pleased" | "lenient" | "concerned" | "furious";
export function ownerMood(outcome: GmSeasonOutcome, champion: boolean, resultBelowGoal = false): OwnerMood {
  if (champion) return "delighted";
  if ((outcome === "met" || outcome === "exceeded") && resultBelowGoal) return "lenient";
  if (outcome === "exceeded") return "delighted";
  if (outcome === "met") return "pleased";
  if (outcome === "warning") return "concerned";
  return "furious";
}
