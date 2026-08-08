// Règles pures de conditionnement physique — aucun accès base de données
// ici, tout est piloté par src/lib/data-access/injuries.ts.

import type { InjurySeverity } from "./injury-rules";

const CONDITIONING_FLOOR = 20;

export function clampConditioning(value: number): number {
  return Math.max(CONDITIONING_FLOOR, Math.min(100, value));
}

// Choc initial à la survenue de la blessure, proportionnel à la gravité.
export function conditioningLossOnInjury(severity: InjurySeverity): number {
  return { minor: 15, moderate: 35, severe: 60 }[severity];
}

// Érosion par match manqué tant que le joueur reste hors des terrains — le
// temps passé loin de l'entraînement continue de coûter du conditionnement.
export function conditioningDecayPerMissedGame(severity: InjurySeverity): number {
  return { minor: 1, moderate: 2, severe: 3 }[severity];
}

// Récupération par match joué en bonne santé. Le déficit initial étant déjà
// proportionnel à la gravité (voir conditioningLossOnInjury), un rythme fixe
// suffit à faire durer plus longtemps la remontée après une blessure sévère
// qu'après une blessure légère.
export const CONDITIONING_RECOVERY_PER_GAME = 8;

// Récupération réduite quand le joueur enchaîne les matchs malgré une
// blessure non guérie — le risque explicitement demandé par l'utilisateur.
export const CONDITIONING_RECOVERY_WHILE_PLAYING_HURT = 2;
