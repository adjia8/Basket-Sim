export const RETIREMENT_AGE = 40;

function ratingDeltaForAge(ageBeforeIncrement: number): number {
  if (ageBeforeIncrement < 25) return 1;
  if (ageBeforeIncrement < 30) return 0;
  return -1;
}

function clampRating(value: number): number {
  return Math.max(30, Math.min(99, value));
}

export interface AgeableRatings {
  age: number;
  overallRating: number;
  scoring: number;
  playmaking: number;
  rebounding: number;
  defense: number;
  athleticism: number;
}

// Applique un delta uniforme à l'overall ET à chaque sous-rating (plutôt que
// de recalculer l'overall comme une moyenne, ce qui écraserait les biais de
// poste déjà appliqués à la génération initiale — voir player-helpers.ts).
export function ageOneSeason(state: AgeableRatings): AgeableRatings {
  const delta = ratingDeltaForAge(state.age);
  return {
    age: state.age + 1,
    overallRating: clampRating(state.overallRating + delta),
    scoring: clampRating(state.scoring + delta),
    playmaking: clampRating(state.playmaking + delta),
    rebounding: clampRating(state.rebounding + delta),
    defense: clampRating(state.defense + delta),
    athleticism: clampRating(state.athleticism + delta),
  };
}
