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

// Intersaison : comme en vraie NBA, un effectif peut compter jusqu'à 21
// contrats (draft, camp d'entraînement) ; il doit redescendre dans les
// bornes de saison avant le premier match (voir roster-compliance.ts).
export const OFFSEASON_MAX_ROSTER_SIZE: Record<string, number> = {
  nba: 21,
  wnba: 15,
};

export type RosterIssue = "over" | "under" | null;

// L'effectif standard respecte-t-il les bornes de saison ?
export function rosterIssue(size: number, leagueId: string): RosterIssue {
  if (size > (MAX_ROSTER_SIZE[leagueId] ?? MAX_ROSTER_SIZE.nba)) return "over";
  if (size < (MIN_ROSTER_SIZE[leagueId] ?? MIN_ROSTER_SIZE.nba)) return "under";
  return null;
}

// Ordre de coupe d'une équipe IA trop fournie : on garde la valeur
// sportive ; à niveau proche, on coupe d'abord un contrat non garanti (pas
// d'argent mort) puis le salaire le plus faible.
export function releaseOrder<T extends { overall: number; guaranteed: boolean; salary: number }>(players: T[]): T[] {
  const value = (p: T) => p.overall + (p.guaranteed ? 2 : 0) + p.salary / 10_000_000;
  return [...players].sort((a, b) => value(a) - value(b));
}
