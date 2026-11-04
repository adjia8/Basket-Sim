// Règles pures de progression en cours de saison — les jeunes (24 ans et
// moins) progressent avec l'entraînement et le temps de jeu, façon Football
// Manager, en plus de l'évolution annuelle liée à l'âge (aging-rules.ts).

import type { PlayerRatings } from "@/lib/types";
import { TRAINING_FOCUS_ATTRIBUTES, type TrainingFocus, type TrainingIntensity } from "./training-rules";

export const DEVELOPMENT_MAX_AGE = 24;
// Points d'attributs gagnés pour un point d'overall.
export const PROGRESS_PER_OVERALL_POINT = 3;

const INTENSITY_FACTOR: Record<TrainingIntensity, number> = { low: 0.6, medium: 1, high: 1.4 };
const BASE_CHANCE_PER_GAME = 0.12;

export type IndividualFocus = "offensive" | "defensive" | "tactical" | "physical";
export const INDIVIDUAL_FOCUSES: IndividualFocus[] = ["offensive", "defensive", "tactical", "physical"];

// Chance de progresser d'un point d'attribut sur un match : plus forte chez
// les plus jeunes, avec du temps de jeu, une intensité d'entraînement élevée
// et un bon staff (±20 %). ~6-10 points par saison pour un jeune de 20 ans
// titulaire, soit 2-3 points d'overall.
export function developmentChance(
  age: number,
  minutesPlayed: number,
  intensity: TrainingIntensity | null,
  staffLevel: number
): number {
  if (age > DEVELOPMENT_MAX_AGE) return 0;
  const ageFactor = age <= 20 ? 1 : age <= 22 ? 0.75 : 0.5;
  const minutesFactor = 0.4 + (Math.min(36, Math.max(0, minutesPlayed)) / 36) * 0.6;
  const intensityFactor = intensity ? INTENSITY_FACTOR[intensity] : 0.6;
  const staffFactor = 1 + ((Math.max(0, Math.min(100, staffLevel)) - 50) / 50) * 0.2;
  return BASE_CHANCE_PER_GAME * ageFactor * minutesFactor * intensityFactor * staffFactor;
}

// Attribut qui progresse : l'entraînement individuel prime, puis le thème
// d'équipe, sinon un attribut au hasard.
export function attributeToDevelop(
  individualFocus: IndividualFocus | undefined,
  teamFocus: TrainingFocus | null
): keyof PlayerRatings {
  const focused = TRAINING_FOCUS_ATTRIBUTES[individualFocus ?? teamFocus ?? "rest"] as (keyof PlayerRatings)[];
  const pool: (keyof PlayerRatings)[] =
    focused.length > 0
      ? focused
      : [
          "scoringInside",
          "scoringOutside",
          "playmaking",
          "defenseInside",
          "defenseOutside",
          "rebounding",
          "athleticism",
          "basketballIQ",
        ];
  return pool[Math.floor(Math.random() * pool.length)];
}
