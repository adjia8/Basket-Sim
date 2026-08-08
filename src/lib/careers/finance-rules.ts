// Règles pures de finances de franchise — aucun accès base de données ici,
// tout est piloté par src/lib/data-access/team-state.ts.

const BASE_SEASON_REVENUE: Record<string, number> = { nba: 4_000_000, wnba: 600_000 };
export const INITIAL_FINANCES = BASE_SEASON_REVENUE; // trésorerie de départ = un revenu de saison "moyen"

// Billetterie/maillots/snackerie : dépend du bilan de la saison qui vient de
// se terminer ET de l'attractivité du marché (Team.marketAppeal) — un grand
// marché vend plus même à bilan égal.
export function seasonRevenue(leagueId: string, winPct: number, marketAppeal: number): number {
  const base = BASE_SEASON_REVENUE[leagueId] ?? BASE_SEASON_REVENUE.nba;
  const performanceMultiplier = 0.6 + winPct * 0.8; // 0.6x à 1.4x
  const marketMultiplier = 0.7 + (marketAppeal / 99) * 0.6; // 0.7x à 1.3x
  return Math.round(base * performanceMultiplier * marketMultiplier);
}

// Coût pour gagner UPGRADE_INCREMENT points à partir du niveau courant —
// plus cher à mesure qu'on approche du maximum.
export const UPGRADE_INCREMENT = 5;
export function upgradeCost(currentLevel: number, leagueId: string): number {
  const base = BASE_SEASON_REVENUE[leagueId] ?? BASE_SEASON_REVENUE.nba;
  const t = Math.max(0, Math.min(99, currentLevel)) / 99;
  return Math.round(base * (0.03 + t * 0.12)); // 3% à 15% du revenu de base
}

export const ANNUAL_DEGRADATION = 4; // points perdus chaque intersaison sans réinvestissement

export function clampFacilityLevel(value: number): number {
  return Math.max(10, Math.min(99, value));
}
