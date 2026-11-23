import { NBA_INITIAL_FREE_AGENT_IDS } from "./players-nba";
import { EUROPE_PLAYER_IDS } from "./players-europe";
import { INITIAL_FREE_AGENT_IDS } from "./players-wnba";

// Joueurs du catalogue qui démarrent une carrière sans contrat (absents de
// tout effectif réel à la date de vérification) — voir la doc de chaque
// liste dans players-nba.ts / players-wnba.ts.
const INITIAL_FREE_AGENT_IDS_BY_LEAGUE: Record<string, string[]> = {
  // Joueurs d'Europe : sans contrat NBA (sous contrat dans leur club, voir
  // applyEuropeStates).
  nba: [...NBA_INITIAL_FREE_AGENT_IDS, ...EUROPE_PLAYER_IDS],
  wnba: INITIAL_FREE_AGENT_IDS,
};

export function initialFreeAgentIds(leagueId: string): Set<string> {
  return new Set(INITIAL_FREE_AGENT_IDS_BY_LEAGUE[leagueId] ?? []);
}
