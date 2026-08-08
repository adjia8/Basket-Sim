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
// Le pas est arrondi au plus proche mais jamais à zéro tant que la cible
// n'est pas atteinte : un simple Math.round(diff * taux) peut stagner
// indéfiniment sous la cible (ex. diff=9 → pas 0.45 → arrondi à 0 en
// boucle), donc on force au moins un point de progression par match.
export function nextChemistry(current: number, target: number): number {
  const diff = target - current;
  if (diff === 0) return current;
  const step = Math.sign(diff) * Math.max(1, Math.round(Math.abs(diff) * 0.05));
  return Math.max(0, Math.min(99, current + step));
}
