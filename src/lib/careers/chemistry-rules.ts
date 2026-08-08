// Règles pures de chimie d'équipe — aucun accès base de données ici, tout est
// piloté par src/lib/data-access/team-state.ts.

// Valeur cible que la chimie approche lentement match après match : un bon
// bilan et un roster collectivement intelligent (QI basket) favorisent la
// cohésion. Pas de suivi de la stabilité de l'effectif dans cette passe
// (limite assumée — un roster qui change beaucoup ne pénalise pas la chimie
// ici).
export function chemistryTarget(winPct: number, averageBasketballIQ: number): number {
  const target = 40 + winPct * 40 + averageBasketballIQ * 0.2;
  return Math.max(0, Math.min(99, target));
}

// Dérive lente vers la cible (5% de l'écart par match) plutôt qu'un saut
// brutal — la chimie d'une équipe ne se construit/détruit pas en un match.
export function nextChemistry(current: number, target: number): number {
  const next = current + (target - current) * 0.05;
  return Math.max(0, Math.min(99, Math.round(next)));
}
