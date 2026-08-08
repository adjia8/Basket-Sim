// Barème salarial pur — extrait de generate-contracts.ts pour être réutilisable
// depuis player-demands.ts sans dépendance circulaire.

// Bornes réelles saison 2025-26 (NBA) / 2026 (WNBA, nouvelle convention collective
// qui a fait passer le salaire minimum de ~66k$ à 270-300k$ et le supermax à 1,4M$).
export const SALARY_RANGES: Record<string, { min: number; max: number }> = {
  nba: { min: 1_200_000, max: 51_000_000 },
  wnba: { min: 270_000, max: 1_400_000 },
};

// Nos rosters ne descendent quasiment jamais sous ~65 de overall (pas de joueurs
// de fin de banc générés) : sans plancher, une interpolation linéaire sur 0-99
// rend même les role players presque aussi chers que les stars. On borne sur la
// plage réelle des ratings (60-99) et on courbe (^3) pour que seuls les tout
// meilleurs joueurs approchent le salaire max — un roster de 8 joueurs bien notés
// reste alors proche du cap plutôt que de le pulvériser systématiquement.
const RATING_FLOOR = 60;
const RATING_CEIL = 99;
const CURVE_POWER = 3;

export function salaryForRating(
  overallRating: number,
  range: { min: number; max: number }
): number {
  const clamped = Math.min(Math.max(overallRating, RATING_FLOOR), RATING_CEIL);
  const t = (clamped - RATING_FLOOR) / (RATING_CEIL - RATING_FLOOR);
  const base = range.min + Math.pow(t, CURVE_POWER) * (range.max - range.min);
  const variance = base * 0.15 * (Math.random() * 2 - 1); // +/- 15%
  return Math.round(Math.min(range.max, Math.max(range.min, base + variance)));
}
