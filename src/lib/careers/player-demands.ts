// Règles pures d'exigences des joueurs (salaire, compétitivité, marché) — pas
// d'accès base de données ici, tout est piloté par src/app/actions/roster.ts
// et les pages qui affichent ces exigences avant de laisser cliquer.

import { SALARY_RANGES, salaryForRating } from "./salary-rules";

// À partir de ce renommé, un joueur devient "star" : il exige en plus une
// équipe compétitive et un marché attractif (en dessous, seul le salaire compte).
export const STAR_RENOWN_THRESHOLD = 70;
export const COMPETITIVE_WIN_PCT_THRESHOLD = 0.45;
export const ATTRACTIVE_MARKET_THRESHOLD = 60;

// Salaire plancher accepté par un joueur, dérivé de son renommé — nul jusqu'au
// renommé "moyen" (50, comportement inchangé pour un joueur non renommé),
// jusqu'à +60% de prime au renommé maximal.
export function minAcceptableSalary(
  renown: number,
  overallRating: number,
  leagueId: string
): number {
  const range = SALARY_RANGES[leagueId] ?? SALARY_RANGES.nba;
  const baseline = salaryForRating(overallRating, range);
  const premium = (Math.max(0, renown - 50) / 49) * 0.6;
  return Math.round(baseline * (1 + premium));
}

export function wantsCompetitiveTeam(renown: number): boolean {
  return renown >= STAR_RENOWN_THRESHOLD;
}

export function wantsAttractiveMarket(renown: number): boolean {
  return renown >= STAR_RENOWN_THRESHOLD;
}

// Bilan de victoires exploitable pour juger la compétitivité d'une équipe —
// neutre (0.5) tant qu'aucun match n'a encore été joué cette saison, pour ne
// pas bloquer les signatures en tout début de saison.
export function winPctForStandings(wins: number, losses: number): number {
  const total = wins + losses;
  return total === 0 ? 0.5 : wins / total;
}

export function teamMeetsPlayerDemands(params: {
  renown: number;
  teamWinPct: number;
  teamMarketAppeal: number;
}): boolean {
  if (params.renown < STAR_RENOWN_THRESHOLD) return true;
  return (
    params.teamWinPct >= COMPETITIVE_WIN_PCT_THRESHOLD &&
    params.teamMarketAppeal >= ATTRACTIVE_MARKET_THRESHOLD
  );
}
