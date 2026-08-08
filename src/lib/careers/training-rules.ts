// Règles pures de programme d'entraînement — aucun accès base de données
// ici, tout est piloté par src/lib/data-access/training.ts.

export type TrainingFocus = "offensive" | "defensive" | "tactical" | "physical" | "chemistry" | "rest";
export type TrainingIntensity = "low" | "medium" | "high";

// Attributs concernés par chaque focus — "chemistry" agit sur
// TeamState.chemistry (pas sur les attributs individuels), "rest" n'en cible
// aucun (juste la fatigue).
export const TRAINING_FOCUS_ATTRIBUTES: Record<TrainingFocus, string[]> = {
  offensive: ["scoringInside", "scoringOutside", "playmaking"],
  defensive: ["defenseInside", "defenseOutside"],
  tactical: ["basketballIQ", "clutch"],
  physical: ["athleticism", "stamina"],
  chemistry: [],
  rest: [],
};

const BOOST_CAP: Record<TrainingIntensity, number> = { low: 3, medium: 5, high: 8 };
const BOOST_DRIFT_RATE = 0.15; // façon chimie : approche lentement la cible

// Dérive lentement vers le plafond de l'intensité si le focus cible des
// attributs, redescend vers 0 sinon (focus changé, ou "chemistry"/"rest" qui
// ne ciblent aucun attribut individuel). Le pas est arrondi au plus proche
// mais jamais à zéro tant que la cible n'est pas atteinte : un simple
// Math.round(diff * taux) peut stagner indéfiniment sous la cible (ex.
// diff=3 → pas 0.45 → arrondi à 0 en boucle), donc on force au moins un
// point de progression par appel.
export function nextTrainingBoost(
  current: number,
  focusTargetsAttributes: boolean,
  intensity: TrainingIntensity
): number {
  const target = focusTargetsAttributes ? BOOST_CAP[intensity] : 0;
  const diff = target - current;
  if (diff === 0) return current;
  const step = Math.sign(diff) * Math.max(1, Math.round(Math.abs(diff) * BOOST_DRIFT_RATE));
  return Math.max(0, current + step);
}

// Coût (ou gain, pour "rest") de fatigue par match — s'ajoute à la fatigue
// de match déjà calculée par fatigue-rules.ts.
const TRAINING_FATIGUE_COST: Record<TrainingIntensity, number> = { low: 1, medium: 3, high: 6 };
export function trainingFatigueDelta(focus: TrainingFocus | null, intensity: TrainingIntensity): number {
  if (!focus) return 0;
  if (focus === "rest") return -TRAINING_FATIGUE_COST[intensity] * 1.5;
  return TRAINING_FATIGUE_COST[intensity];
}

// Bonus de dérive de chimie quand le focus est "chemistry" (en plus de la
// cible bilan/QI basket déjà en place dans chemistry-rules.ts).
const CHEMISTRY_TRAINING_BONUS: Record<TrainingIntensity, number> = { low: 1, medium: 2, high: 3 };
export function chemistryTrainingBonus(focus: TrainingFocus | null, intensity: TrainingIntensity): number {
  return focus === "chemistry" ? CHEMISTRY_TRAINING_BONUS[intensity] : 0;
}
