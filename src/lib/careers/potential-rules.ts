// Règles pures du potentiel et du recrutement, façon Football Manager —
// aucun accès base de données ici.
//
// Chaque joueur a un potentiel caché : la note qu'il peut atteindre. Un
// joueur qui a beaucoup de marge progresse plus vite, un joueur proche de
// son plafond stagne, et personne ne le dépasse. Le GM n'en voit qu'une
// estimation, d'autant plus précise que ses recruteurs (ou, pour ses propres
// joueurs, son encadrement) sont bons.

// Marge de progression selon l'âge, tirée au hasard à la création.
export function initialPotential(overall: number, age: number, random: () => number = Math.random): number {
  const room =
    age <= 19 ? 6 + random() * 16 : age <= 21 ? 4 + random() * 13 : age <= 23 ? 2 + random() * 9 : age <= 25 ? random() * 6 : age <= 27 ? random() * 3 : 0;
  return Math.min(99, Math.round(overall + room));
}

// Multiplicateur de progression en saison selon la marge restante :
// 0 au plafond, ~1 avec 7 points de marge, jusqu'à 1,5.
export function growthFactor(overall: number, potential: number): number {
  const gap = potential - overall;
  if (gap <= 0) return 0;
  return Math.min(1.5, 0.3 + gap / 10);
}

// Progression annuelle d'un jeune (avant 25 ans) : selon la marge restante
// et l'encadrement (bonus de staff déjà calculé), sans dépasser le plafond.
// Entre 25 et 29 ans, un joueur qui a encore de la marge gagne parfois un
// point (éclosion tardive).
export function annualGrowth(
  age: number,
  overall: number,
  potential: number,
  staffBonus: number,
  random: () => number = Math.random
): number {
  const gap = potential - overall;
  if (gap <= 0) return age >= 30 ? -1 : 0;
  if (age < 25) {
    const base = gap >= 8 ? 2 : gap >= 4 ? 1 : random() < 0.5 ? 1 : 0;
    return Math.max(0, Math.min(gap, base + staffBonus));
  }
  if (age < 30) return random() < 0.4 ? 1 : 0;
  return -1;
}

// ---------------------------------------------------------------------------
// Estimations (brouillard du recrutement)

// Valeur pseudo-aléatoire stable dans [-1, 1] pour un couple (graine) : une
// même estimation ne change pas à chaque affichage, et se resserre vers la
// vraie valeur quand le recrutement s'améliore.
function seededUnit(seed: string): number {
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return ((hash >>> 0) % 2001) / 1000 - 1;
}

// Largeur de l'incertitude (en points) selon le niveau de recrutement.
export function estimateError(scoutingLevel: number): number {
  return 2 + (1 - Math.max(0, Math.min(99, scoutingLevel)) / 99) * 12;
}

export interface Estimate {
  low: number;
  high: number;
  mid: number;
}

// Estimation d'une note (potentiel ou note actuelle d'un prospect) : un
// biais stable, proportionnel à l'incertitude, puis une fourchette.
// `scale` < 1 pour une note actuelle (plus facile à jauger qu'un potentiel).
export function estimateRating(trueValue: number, scoutingLevel: number, seed: string, scale = 1): Estimate {
  const error = estimateError(scoutingLevel) * scale;
  const mid = Math.max(35, Math.min(99, Math.round(trueValue + seededUnit(seed) * error * 0.6)));
  const half = Math.max(1, Math.round(error / 2));
  return { low: Math.max(35, mid - half), high: Math.min(99, mid + half), mid };
}

// Étoiles façon FM (0,5 à 5) : 40 → 0,5 étoile, 99 → 5 étoiles.
export function ratingStars(value: number): number {
  return Math.max(0.5, Math.min(5, Math.round(((value - 40) / 59) * 10) / 2));
}
