// Règles pures de blessure — aucun accès base de données ici, tout est piloté
// par src/lib/data-access/injuries.ts.

const BASE_INJURY_CHANCE_PER_GAME = 0.0015; // risque ≈ 0
const MAX_INJURY_CHANCE_PER_GAME = 0.02; // risque ≈ 99

// Chance de se blesser à l'occasion d'un match donné, interpolée linéairement
// sur l'échelle 0-99 du risque. Calibré pour qu'un risque ~99 corresponde à
// environ 1,5 blessure/saison en espérance (82 matchs), et un risque par
// défaut (~30) à environ une blessure tous les deux ans — ordre de grandeur
// plausible, pas une vérité statistique.
export function injuryChanceForGame(injuryRisk: number): number {
  const t = Math.max(0, Math.min(99, injuryRisk)) / 99;
  return BASE_INJURY_CHANCE_PER_GAME + t * (MAX_INJURY_CHANCE_PER_GAME - BASE_INJURY_CHANCE_PER_GAME);
}

export function rollsInjury(injuryRisk: number): boolean {
  return Math.random() < injuryChanceForGame(injuryRisk);
}

// Durée d'indisponibilité (en matchs de l'équipe) tirée aléatoirement,
// pondérée vers les blessures mineures avec une traîne vers les blessures
// sévères.
export function rollInjuryDurationGames(): number {
  const r = Math.random();
  if (r < 0.6) return 1 + Math.floor(Math.random() * 4); // 1-4 matchs (mineure)
  if (r < 0.9) return 5 + Math.floor(Math.random() * 10); // 5-14 matchs (modérée)
  return 15 + Math.floor(Math.random() * 20); // 15-34 matchs (sévère)
}
