// Barème salarial pur — extrait de generate-contracts.ts pour être réutilisable
// depuis player-demands.ts sans dépendance circulaire.

// Bornes réelles saison 2026-27 (NBA : minimum rookie / maximum 10+ ans) / 2026
// (WNBA, nouvelle convention collective qui a fait passer le salaire minimum de
// ~66k$ à 270-300k$ et le supermax à 1,4M$).
export const SALARY_RANGES: Record<string, { min: number; max: number }> = {
  nba: { min: 1_358_000, max: 57_736_000 },
  wnba: { min: 270_000, max: 1_400_000 },
};

// Courbe calée sur les vrais contrats NBA 2026-27 du catalogue (430 joueurs
// avec salaire réel) : médiane du salaire par tranche de note 2K, exprimée
// en fraction de l'écart minimum → maximum de la ligue (la WNBA, en pause,
// reprend la même forme sur sa propre échelle). Entre deux repères,
// interpolation linéaire. Repères NBA : 70 ≈ 2,9 M$, 78 ≈ 11 M$, 82 ≈
// 23 M$, 84 ≈ 33 M$, 88 ≈ 42 M$, 92 ≈ 53 M$.
const NBA_RANGE = { min: 1_358_000, max: 57_736_000 };
const SALARY_KNOTS: [number, number][] = [
  [60, 1_358_000],
  [68, 1_700_000],
  [70, 2_900_000],
  [72, 3_300_000],
  [74, 3_900_000],
  [76, 6_500_000],
  [78, 11_000_000],
  [80, 16_000_000],
  [82, 23_000_000],
  [84, 33_000_000],
  [86, 39_000_000],
  [88, 42_000_000],
  [90, 49_000_000],
  [92, 53_000_000],
  [95, 57_736_000],
];

// Valeur déterministe (sans variance aléatoire) — c'est celle-ci que
// player-demands.ts doit utiliser pour tout ce qui représente une exigence
// STABLE d'un joueur (plancher salarial, mécontentement) : un re-tirage à
// chaque rendu ferait apparaître/disparaître le badge "veut être échangé" de
// façon incohérente à chaque revalidation de page.
function baseSalaryForRating(overallRating: number, range: { min: number; max: number }): number {
  const knots = SALARY_KNOTS;
  let fraction: number;
  if (overallRating <= knots[0][0]) fraction = 0;
  else if (overallRating >= knots[knots.length - 1][0]) fraction = 1;
  else {
    const i = knots.findIndex(([o]) => o > overallRating);
    const [o0, s0] = knots[i - 1];
    const [o1, s1] = knots[i];
    const salary = s0 + ((overallRating - o0) / (o1 - o0)) * (s1 - s0);
    fraction = (salary - NBA_RANGE.min) / (NBA_RANGE.max - NBA_RANGE.min);
  }
  return range.min + Math.max(0, Math.min(1, fraction)) * (range.max - range.min);
}

// Variante avec variance aléatoire (+/- 15%) — réservée à la génération d'un
// NOUVEAU contrat (signature, prolongation), où une part d'aléatoire dans le
// montant proposé est réaliste (négociation, marché). Ne jamais l'utiliser
// pour évaluer un état existant (voir baseSalaryForRating ci-dessus).
export function salaryForRating(
  overallRating: number,
  range: { min: number; max: number }
): number {
  const base = baseSalaryForRating(overallRating, range);
  const variance = base * 0.15 * (Math.random() * 2 - 1);
  return Math.round(Math.min(range.max, Math.max(range.min, base + variance)));
}

// Plancher stable (aucun aléatoire) utilisé par minAcceptableSalary — voir
// baseSalaryForRating.
export function baseSalaryFloor(overallRating: number, range: { min: number; max: number }): number {
  return Math.round(Math.min(range.max, Math.max(range.min, baseSalaryForRating(overallRating, range))));
}
