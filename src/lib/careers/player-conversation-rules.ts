// Discussions individuelles avec les joueurs (façon Football Manager) —
// règles pures, sans accès base de données (voir player-conversations.ts).
//
// Le GM choisit un sujet et un ton ; la réaction du joueur dépend de sa
// personnalité (voir personality-rules.ts), de son moral et de sa situation.
// Elle modifie son moral et peut avoir un effet concret : promesse de temps
// de jeu ou d'échange (jugées ensuite comme les autres promesses), demande
// d'échange apaisée… ou déclenchée.

import type { Personality } from "./personality-rules";
import type { PlayerStatus } from "./player-status-rules";

export type ConversationTopic =
  | "more_minutes" // « Tu vas avoir plus de minutes »
  | "less_minutes" // « Ton rôle va diminuer »
  | "patience" // « Patiente, ton tour viendra »
  | "convince_stay" // il veut partir : le convaincre de rester
  | "promise_trade" // il veut partir : lui promettre un échange
  | "discipline" // le recadrer (comportement, fautes techniques…)
  | "praise"; // le féliciter

export const CONVERSATION_TOPICS: ConversationTopic[] = [
  "more_minutes",
  "less_minutes",
  "patience",
  "convince_stay",
  "promise_trade",
  "discipline",
  "praise",
];

export type ConversationTone = "calm" | "firm" | "encouraging";
export const CONVERSATION_TONES: ConversationTone[] = ["calm", "firm", "encouraging"];

export type Reaction = "delighted" | "positive" | "neutral" | "annoyed" | "angry";

export type ConversationEffect = "promise_minutes" | "clear_trade_request" | "trade_request" | "promise_trade" | null;

// Jours de jeu minimum entre deux discussions avec le même joueur.
export const CONVERSATION_COOLDOWN_DAYS = 7;

export interface ConversationContext {
  personality: Personality;
  age: number;
  morale: number;
  status: PlayerStatus;
  canPromiseMoreMinutes: boolean; // un rôle supérieur est promettable et aucune promesse en cours
  underExpectedMinutes: boolean; // joue nettement moins que son statut ne le voudrait
  wantsTrade: boolean;
  hasActivePromise: boolean;
  recentIncident: boolean; // faute technique ou expulsion lors des derniers matchs
  recentGoodForm: boolean; // meilleurs matchs récents que sa moyenne
}

// Sujets qui ont du sens pour ce joueur maintenant.
export function availableTopics(c: ConversationContext): ConversationTopic[] {
  const topics: ConversationTopic[] = [];
  if (c.canPromiseMoreMinutes) topics.push("more_minutes");
  if (c.status !== "bench" && c.status !== "prospect") topics.push("less_minutes");
  if (c.underExpectedMinutes || c.status === "bench" || c.status === "prospect") topics.push("patience");
  if (c.wantsTrade) topics.push("convince_stay");
  if (c.wantsTrade && !c.hasActivePromise) topics.push("promise_trade");
  topics.push("discipline", "praise");
  return topics;
}

// Adéquation du ton à la personnalité (indépendante du sujet).
function toneFit(tone: ConversationTone, p: Personality, c: ConversationContext): number {
  if (tone === "firm") return (p.professionalism >= 14 ? 1 : 0) - (p.temperament <= 6 ? 2 : 0);
  if (tone === "calm") return p.temperament <= 6 ? 1 : 0;
  // Encourageant : aide les jeunes et les moraux en berne.
  return (c.age <= 23 ? 1 : 0) + (c.morale < 45 ? 1 : 0);
}

function topicScore(topic: ConversationTopic, tone: ConversationTone, c: ConversationContext): number {
  const p = c.personality;
  switch (topic) {
    case "more_minutes":
      return 3;
    case "less_minutes":
      return -2 + (p.professionalism >= 14 ? 1.5 : 0) + (p.loyalty >= 15 ? 1 : 0) - (p.ambition >= 15 ? 2 : 0) + (c.age >= 30 ? 0.5 : 0);
    case "patience":
      return (c.age <= 23 || c.status === "prospect" ? 1.5 : 0) - (c.age >= 28 && p.ambition >= 14 ? 2 : 0);
    case "convince_stay":
      return (p.loyalty - 10) / 3 + (c.morale - 50) / 20;
    case "promise_trade":
      return 2;
    case "discipline":
      if (!c.recentIncident) return -2 + (p.professionalism >= 15 ? 1 : 0);
      // Recadrer à raison : un professionnel l'accepte ; un sanguin le prend
      // mal, sauf si on reste posé.
      return (p.professionalism >= 13 ? 1 : 0) - (p.temperament <= 6 ? (tone === "calm" ? 0 : 2) : 0);
    case "praise":
      return c.recentGoodForm ? 2 : 0.5;
  }
}

function toReaction(score: number): Reaction {
  if (score >= 3) return "delighted";
  if (score >= 1) return "positive";
  if (score > -1) return "neutral";
  if (score > -3) return "annoyed";
  return "angry";
}

export const REACTION_MORALE: Record<Reaction, number> = {
  delighted: 8,
  positive: 4,
  neutral: 0,
  annoyed: -4,
  angry: -8,
};

export interface ConversationOutcome {
  reaction: Reaction;
  moraleDelta: number; // avant la volatilité du tempérament (voir scaleMoraleDelta)
  effect: ConversationEffect;
}

export function conversationOutcome(
  topic: ConversationTopic,
  tone: ConversationTone,
  c: ConversationContext,
  random: () => number = Math.random
): ConversationOutcome {
  const noise = (random() - 0.5) * 1.5; // une même discussion ne tourne pas toujours pareil
  const reaction = toReaction(topicScore(topic, tone, c) + toneFit(tone, c.personality, c) + noise);
  let effect: ConversationEffect = null;
  if (topic === "more_minutes") effect = "promise_minutes";
  if (topic === "promise_trade") effect = "promise_trade";
  if (topic === "convince_stay" && (reaction === "delighted" || reaction === "positive")) effect = "clear_trade_request";
  // Un ambitieux qu'on rétrograde ou qu'on retient de force finit par
  // réclamer son départ.
  if (
    reaction === "angry" &&
    (topic === "less_minutes" || topic === "convince_stay") &&
    c.personality.ambition >= 14 &&
    !c.wantsTrade
  ) {
    effect = "trade_request";
  }
  return { reaction, moraleDelta: REACTION_MORALE[reaction], effect };
}
