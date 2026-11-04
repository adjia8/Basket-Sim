// Nombre de places de contrat STANDARD (les contrats alternatifs — two-way
// NBA / développement WNBA, voir contract-type-rules.ts — sont des slots à
// part, hors de ces bornes). Depuis la saison 2026, le roster standard WNBA
// est passé à 12 places (+ jusqu'à 2 places de développement, soit 14 au
// total) ; la NBA suit la vraie convention : 15 places standard + 3 two-way.
export const MAX_ROSTER_SIZE: Record<string, number> = {
  nba: 15,
  wnba: 12,
};
// Plancher NBA : 13 (minimum toléré par la vraie convention, 14 en temps
// normal). L'IA ne signant pas d'agents libres, un effectif peut passer
// dessous au fil des saisons (fins de contrat, retraites) : le plancher
// empêche seulement de s'y enfoncer (voir trade.ts / roster.ts).
export const MIN_ROSTER_SIZE: Record<string, number> = {
  nba: 13,
  wnba: 6,
};
