import { annualGrowth } from "./potential-rules";

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
// Avec un potentiel connu (voir potential-rules.ts), la progression d'un
// jeune dépend de sa marge restante et ne dépasse jamais son plafond ; sans
// potentiel (ancien comportement), barème fixe par âge.
export function ageOneSeason(state: AgeableRatings & { potential?: number }, trainingStaffLevel = 50): AgeableRatings {
  const staffBonus = state.age < 25 ? Math.round((Math.max(0, Math.min(100, trainingStaffLevel)) - 50) / 25) : 0;
  const delta = state.potential
    ? annualGrowth(state.age, state.overallRating, state.potential, staffBonus)
    : ratingDeltaForAge(state.age, trainingStaffLevel);
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

// Fin de carrière annoncée à l'issue de la saison (avant le vieillissement).
// Au-delà de 40 ans, toujours ; avant, selon l'âge et le niveau restant :
// un vétéran encore performant prolonge plus volontiers qu'un joueur en
// net déclin. Tirage stable (même graine = même décision) pour que
// l'annonce de fin de saison et l'intersaison concordent.
function unit(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 10_000) / 10_000;
}

export function retirementPlanned(p: { age: number; overallRating: number }, seed: string): boolean {
  const nextAge = p.age + 1;
  if (nextAge >= RETIREMENT_AGE) return true;
  const roll = unit(seed);
  if (nextAge >= 37) return p.overallRating < 70 || roll < 0.3;
  if (nextAge >= 35) return p.overallRating < 60 || (p.overallRating < 68 && roll < 0.35);
  if (nextAge >= 33) return p.overallRating < 52 && roll < 0.6;
  return false;
}
