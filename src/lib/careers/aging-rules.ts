export const RETIREMENT_AGE = 40;

// `trainingStaffLevel` (0-100, 50 = neutre) accélère la progression des
// moins de 25 ans — un encadrement de développement de qualité fait grandir
// les jeunes joueurs plus vite. Aucun effet sur les autres tranches d'âge.
function ratingDeltaForAge(ageBeforeIncrement: number, trainingStaffLevel = 50): number {
  if (ageBeforeIncrement < 25) {
    const staffBonus = Math.round((Math.max(0, Math.min(100, trainingStaffLevel)) - 50) / 25);
    return 1 + staffBonus;
  }
  if (ageBeforeIncrement < 30) return 0;
  return -1;
}

function clampRating(value: number): number {
  return Math.max(30, Math.min(99, value));
}

export interface AgeableRatings {
  age: number;
  overallRating: number;
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

// Applique un delta uniforme à l'overall ET à chaque attribut (plutôt que de
// recalculer l'overall comme une moyenne, ce qui écraserait les biais de
// poste déjà appliqués à la génération initiale — voir player-helpers.ts).
export function ageOneSeason(state: AgeableRatings, trainingStaffLevel = 50): AgeableRatings {
  const delta = ratingDeltaForAge(state.age, trainingStaffLevel);
  return {
    age: state.age + 1,
    overallRating: clampRating(state.overallRating + delta),
    scoringInside: clampRating(state.scoringInside + delta),
    scoringOutside: clampRating(state.scoringOutside + delta),
    playmaking: clampRating(state.playmaking + delta),
    defenseInside: clampRating(state.defenseInside + delta),
    defenseOutside: clampRating(state.defenseOutside + delta),
    rebounding: clampRating(state.rebounding + delta),
    athleticism: clampRating(state.athleticism + delta),
    basketballIQ: clampRating(state.basketballIQ + delta),
    clutch: clampRating(state.clutch + delta),
    stamina: clampRating(state.stamina + delta),
  };
}
