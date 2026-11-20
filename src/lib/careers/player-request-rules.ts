// Demandes des joueurs : c'est le joueur qui vient voir le GM (façon
// Football Manager) — règles pures, sans accès base de données (voir
// player-requests.ts).
//
// Un joueur qui joue nettement moins que son statut, qui entame la dernière
// année de son contrat, ou dont le moral s'effondre, peut demander à parler
// au GM. Lui répondre (une discussion, ou une offre de prolongation pour le
// contrat) le satisfait davantage ; l'ignorer une semaine l'agace.

import type { Personality } from "./personality-rules";

export type PlayerRequest = "minutes" | "contract" | "support";

export const REQUEST_IGNORED_AFTER_DAYS = 7; // jours de jeu sans réponse
export const REQUEST_PLAYER_COOLDOWN_DAYS = 21; // entre deux demandes d'un même joueur
export const REQUEST_TEAM_COOLDOWN_DAYS = 5; // entre deux nouvelles demandes dans l'équipe
export const REQUEST_IGNORED_MORALE = -6;

export interface RequestContext {
  personality: Personality;
  morale: number;
  underExpectedMinutes: boolean;
  contractYearsLeft: number | null; // null = pas de contrat standard
  extensionEligible: boolean; // dernière année, contrat prolongeable
  rookieScale: boolean;
}

// Chance par match qu'un joueur concerné se manifeste : un ambitieux ou un
// sanguin vient vite, un professionnel patient attend davantage.
function eagerness(p: Personality): number {
  return 1 + (p.ambition >= 15 ? 0.6 : 0) + (p.temperament <= 6 ? 0.4 : 0) - (p.professionalism >= 15 ? 0.4 : 0);
}

export function requestTrigger(c: RequestContext, random: () => number = Math.random): PlayerRequest | null {
  const e = eagerness(c.personality);
  // Le motif le plus pressant d'abord.
  if (c.morale <= 30 && random() < 0.15 * e) return "support";
  if (c.underExpectedMinutes && random() < 0.08 * e) return "minutes";
  if (c.extensionEligible && !c.rookieScale && c.contractYearsLeft === 1 && random() < 0.05 * e) return "contract";
  return null;
}

// Bonus de réaction quand le GM répond à une demande en attente (le joueur
// apprécie d'être écouté), sur l'échelle de player-conversation-rules.ts.
export const ANSWERED_REQUEST_BONUS = 1;

// Sujets de discussion qui répondent à chaque demande.
export const TOPICS_FOR_REQUEST: Record<PlayerRequest, string[]> = {
  minutes: ["more_minutes", "patience", "less_minutes"],
  contract: ["praise", "convince_stay", "promise_trade"],
  support: ["praise", "patience", "more_minutes", "convince_stay"],
};

// Un ambitieux ignoré finit par demander à partir.
export function ignoredLeadsToTradeRequest(p: Personality): boolean {
  return p.ambition >= 15;
}
