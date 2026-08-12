// Messages/libellés de la discussion + promesse du GM avec une joueuse qui
// veut être échangée — voir src/app/actions/promise.ts et
// src/components/team/MakePromiseForm.tsx. Les libellés des 4 types de
// promesse eux-mêmes sont dans dict/domain.ts (clé `domain.promiseType.*`).
export const keys = [
  "promise.selectLabel",
  "promise.submitButton",
  "promise.pendingPrefix",
  "promise.made",
  "promise.playerDoesNotWantTrade",
  "promise.alreadyPending",
  "promise.renewalNotEligible",
  "promise.tradeDeadlinePassed",
  "promise.invalidType",
] as const;

export type PromiseKey = (typeof keys)[number];

export const fr: Record<PromiseKey, string> = {
  "promise.selectLabel": "Promesse",
  "promise.submitButton": "Faire cette promesse",
  "promise.pendingPrefix": "Promesse en attente :",
  "promise.made": "Promesse faite — à honorer d'ici la fin de la saison.",
  "promise.playerDoesNotWantTrade": "Cette joueuse ne demande pas à être échangée.",
  "promise.alreadyPending": "Une promesse est déjà en attente pour cette joueuse.",
  "promise.renewalNotEligible": "Cette joueuse n'est pas encore éligible à une prolongation.",
  "promise.tradeDeadlinePassed": "La date limite des échanges est passée.",
  "promise.invalidType": "Type de promesse invalide.",
};

export const en: Record<PromiseKey, string> = {
  "promise.selectLabel": "Promise",
  "promise.submitButton": "Make this promise",
  "promise.pendingPrefix": "Pending promise:",
  "promise.made": "Promise made — must be honored by the end of the season.",
  "promise.playerDoesNotWantTrade": "This player isn't asking to be traded.",
  "promise.alreadyPending": "A promise is already pending for this player.",
  "promise.renewalNotEligible": "This player isn't eligible for an extension yet.",
  "promise.tradeDeadlinePassed": "The trade deadline has passed.",
  "promise.invalidType": "Invalid promise type.",
};
