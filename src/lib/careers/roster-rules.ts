// Nombre de places de contrat STANDARD (les contrats alternatifs — two-way
// NBA / développement WNBA, voir contract-type-rules.ts — sont des slots à
// part, hors de ces bornes). Depuis la saison 2026, le roster standard WNBA
// est passé à 12 places (+ jusqu'à 2 places de développement, soit 14 au
// total) ; la NBA reste sur le format simplifié existant de ce jeu.
export const MAX_ROSTER_SIZE: Record<string, number> = {
  nba: 10,
  wnba: 12,
};
export const MIN_ROSTER_SIZE: Record<string, number> = {
  nba: 5,
  wnba: 6,
};
