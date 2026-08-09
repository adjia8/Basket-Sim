// Page /trades (offres reçues/envoyées) + messages des server actions de
// src/app/actions/trade.ts. Nom de fichier "tradeOffers" (pas "trade", déjà
// pris par team.ts qui couvre TradeProposalForm) pour éviter toute ambiguïté.
export const keys = [
  "tradeOffers.title",
  "tradeOffers.deadlinePassedNotice",
  "tradeOffers.received",
  "tradeOffers.sent",
  "tradeOffers.noneePending",
  "tradeOffers.proposesVerb",
  "tradeOffers.forVerb",
  "tradeOffers.sentTo",
  "tradeOffers.accept",
  "tradeOffers.reject",
  "tradeOffers.cancel",
  "tradeAction.noCareer",
  "tradeAction.deadlinePassed",
  "tradeAction.selectAtLeastOne",
  "tradeAction.invalidOpponent",
  "tradeAction.invalidSelection",
  "tradeAction.rosterSizeOutOfRange",
  "tradeAction.exceedsCap",
  "tradeAction.aiRefuses",
  "tradeAction.accepted",
  "tradeAction.sentAwaitingResponse",
] as const;

export type TradeOffersKey = (typeof keys)[number];

export const fr: Record<TradeOffersKey, string> = {
  "tradeOffers.title": "Échanges",
  "tradeOffers.deadlinePassedNotice":
    "Date limite des échanges dépassée pour cette saison — les offres en attente ne peuvent plus être acceptées, seulement refusées ou annulées.",
  "tradeOffers.received": "Propositions reçues",
  "tradeOffers.sent": "Propositions envoyées",
  "tradeOffers.noneePending": "Aucune proposition en attente.",
  "tradeOffers.proposesVerb": "propose",
  "tradeOffers.forVerb": "contre",
  "tradeOffers.sentTo": "À {team} :",
  "tradeOffers.accept": "Accepter",
  "tradeOffers.reject": "Refuser",
  "tradeOffers.cancel": "Annuler",
  "tradeAction.noCareer": "Aucune carrière.",
  "tradeAction.deadlinePassed": "La date limite des échanges est dépassée pour cette saison.",
  "tradeAction.selectAtLeastOne": "Sélectionne au moins un actif de chaque côté.",
  "tradeAction.invalidOpponent": "Équipe adverse invalide.",
  "tradeAction.invalidSelection": "Sélection invalide.",
  "tradeAction.rosterSizeOutOfRange": "Cet échange ferait sortir un effectif de la fourchette {min}-{max} joueurs.",
  "tradeAction.exceedsCap": "Cet échange ferait dépasser le plafond salarial ({cap}) pour l'une des deux équipes.",
  "tradeAction.aiRefuses": "L'IA refuse : échange trop déséquilibré en ta faveur.",
  "tradeAction.accepted": "Échange accepté !",
  "tradeAction.sentAwaitingResponse": "Proposition envoyée à {email}, en attente de réponse.",
};

export const en: Record<TradeOffersKey, string> = {
  "tradeOffers.title": "Trades",
  "tradeOffers.deadlinePassedNotice":
    "Trade deadline has passed for this season — pending offers can no longer be accepted, only rejected or cancelled.",
  "tradeOffers.received": "Received offers",
  "tradeOffers.sent": "Sent offers",
  "tradeOffers.noneePending": "No pending offers.",
  "tradeOffers.proposesVerb": "offers",
  "tradeOffers.forVerb": "for",
  "tradeOffers.sentTo": "To {team}:",
  "tradeOffers.accept": "Accept",
  "tradeOffers.reject": "Reject",
  "tradeOffers.cancel": "Cancel",
  "tradeAction.noCareer": "No career.",
  "tradeAction.deadlinePassed": "The trade deadline has passed for this season.",
  "tradeAction.selectAtLeastOne": "Select at least one asset on each side.",
  "tradeAction.invalidOpponent": "Invalid opposing team.",
  "tradeAction.invalidSelection": "Invalid selection.",
  "tradeAction.rosterSizeOutOfRange": "This trade would put a roster outside the {min}-{max} player range.",
  "tradeAction.exceedsCap": "This trade would put one of the two teams over the salary cap ({cap}).",
  "tradeAction.aiRefuses": "The AI refuses: trade too unbalanced in your favor.",
  "tradeAction.accepted": "Trade accepted!",
  "tradeAction.sentAwaitingResponse": "Offer sent to {email}, awaiting response.",
};
