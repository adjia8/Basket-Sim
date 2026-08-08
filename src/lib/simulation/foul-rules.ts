// Règles pures de fautes — aucun état ici, tout est piloté par mockEngine.ts
// au fil de sa boucle par quart-temps.

export const FOUL_OUT_LIMIT = 6; // NBA et WNBA (contrairement à la FIBA, qui utilise 5)
export const TECHNICAL_EJECTION_LIMIT = 2;
export const FLAGRANT_ONE_EJECTION_LIMIT = 2;

// Un joueur actif est vérifié plusieurs fois par quart-temps (chaque
// vérification représente un moment du quart-temps où il pourrait prendre
// faute) — indispensable pour qu'atteindre 6 fautes sur 4 quart-temps soit
// mathématiquement possible (une seule vérification/quart-temps plafonnerait
// à 4 fautes maximum sur toute la partie).
export const FOUL_CHECKS_PER_QUARTER = 3;

// Chance de commettre une faute personnelle à une vérification donnée — un
// peu plus élevée pour un profil défensif agressif. Calibrée (avec
// FOUL_CHECKS_PER_QUARTER) pour ~2-3 fautes/joueur/match en moyenne, avec une
// probabilité non négligeable mais pas dominante d'atteindre 6 en cas de
// malchance/agressivité ("foul trouble").
export function rollsPersonalFoul(defenseInside: number, defenseOutside: number): boolean {
  const aggression = (defenseInside + defenseOutside) / 2 / 99;
  const chance = 0.11 + aggression * 0.08;
  return Math.random() < chance;
}

// Rares, indépendantes du profil du joueur (tempérament non modélisé dans
// cette passe).
export function rollsTechnicalFoul(): boolean {
  return Math.random() < 0.015;
}

export function rollsFlagrantFoul(): "none" | "flagrant1" | "flagrant2" {
  const r = Math.random();
  if (r < 0.0005) return "flagrant2";
  if (r < 0.003) return "flagrant1";
  return "none";
}
