// Règles pures d'usure — la fatigue de fond façon Football Manager (le
// « jadedness ») : là où la fatigue (énergie) remonte en quelques jours,
// l'usure s'accumule sur des semaines avec les minutes jouées, les matchs
// rapprochés et l'intensité d'entraînement, et ne se résorbe que lentement.
// Elle ralentit la récupération d'énergie et augmente le risque de blessure.

import type { TrainingIntensity } from "./training-rules";

// Seuil d'alerte « Besoin de repos » (affiché au manager).
export const WEAR_NEEDS_REST = 60;
// Seuil au-delà duquel l'IA met d'elle-même un joueur au repos.
export const WEAR_AI_AUTO_REST = 80;
// L'IA ne met pas plus de joueurs que ça au repos sur un même match.
export const AI_MAX_RESTED_PER_GAME = 2;

const TRAINING_WEAR: Record<TrainingIntensity, number> = { low: 0, medium: 0.5, high: 1.5 };

// Usure gagnée sur un match : proportionnelle aux minutes (36 min ≈ +4,5),
// +3 sur un back-to-back (0-1 jour de repos), modulée par l'endurance
// (±20 %), plus le coût de l'entraînement pour tout l'effectif.
export function wearGainForGame(
  minutesPlayed: number,
  restDays: number,
  stamina: number,
  intensity: TrainingIntensity | null
): number {
  const fromMinutes = (Math.max(0, minutesPlayed) / 48) * 6;
  const backToBack = minutesPlayed > 0 && restDays <= 1 ? 3 : 0;
  const staminaFactor = 1.2 - (Math.max(0, Math.min(99, stamina)) / 99) * 0.4;
  return (fromMinutes + backToBack) * staminaFactor + (intensity ? TRAINING_WEAR[intensity] : 0);
}

// Usure résorbée avant le match, par jour de repos : d'autant plus que le
// joueur est usé (0,8 + 2,5 % de l'usure), +5 pour un match passé sur le
// banc ou au repos (gestion de la charge), ±20 % selon les infrastructures.
// Équilibre sur un calendrier NBA (~2 jours entre deux matchs) : ~15 pour
// un remplaçant à 18 min, ~45-50 pour un titulaire à 34 min, ~60+ pour une
// star à 38 min avec des back-to-backs — d'où la gestion de la charge.
export function wearRecovery(restDays: number, sat: boolean, facilitiesLevel = 50, wear = 0): number {
  const facilitiesFactor = 1 + ((Math.max(0, Math.min(100, facilitiesLevel)) - 50) / 50) * 0.2;
  const perDay = 0.8 + Math.max(0, Math.min(99, wear)) * 0.025;
  return (Math.max(0, restDays) * perDay + (sat ? 5 : 0)) * facilitiesFactor;
}

// Un joueur usé récupère moins d'énergie par jour de repos (jusqu'à -40 %).
export function energyRecoveryFactor(wear: number): number {
  return 1 - (Math.max(0, Math.min(99, wear)) / 99) * 0.4;
}

export function clampWear(value: number): number {
  return Math.max(0, Math.min(99, Math.round(value)));
}
