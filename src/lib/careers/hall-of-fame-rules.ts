// Règles pures d'entrée au Hall of Fame — aucun accès base de données ici,
// tout est piloté par src/app/actions/season.ts au moment de la retraite.

export const HOF_PEAK_OVERALL_THRESHOLD = 93;
export const HOF_PEAK_RENOWN_THRESHOLD = 90;

// Basé sur les meilleures valeurs jamais atteintes en carrière (pas les
// valeurs à la retraite, qui ont déjà décliné avec l'âge) — un joueur qui a
// été dominant en son temps reste éligible même après un déclin de fin de
// carrière.
export function isHallOfFameWorthy(peakOverallRating: number, peakRenown: number): boolean {
  return peakOverallRating >= HOF_PEAK_OVERALL_THRESHOLD || peakRenown >= HOF_PEAK_RENOWN_THRESHOLD;
}
