// Messages des server actions de src/app/actions/roster.ts (extendContract).
export const keys = [
  "rosterAction.noCareer",
  "rosterAction.contractNotFound",
  "rosterAction.onlyStandardExtendable",
  "rosterAction.notYetEligible",
  "rosterAction.invalidOffer",
  "rosterAction.dataNotFound",
  "rosterAction.exceedsCap",
  "rosterAction.refusesToNegotiate",
  "rosterAction.refusesOffer",
  "rosterAction.acceptedOne",
  "rosterAction.acceptedMany",
  "rosterAction.alreadyStandard",
  "rosterAction.noStandardRoom",
  "rosterAction.promoted",
] as const;

export type RosterActionKey = (typeof keys)[number];

export const fr: Record<RosterActionKey, string> = {
  "rosterAction.noCareer": "Aucune carrière.",
  "rosterAction.contractNotFound": "Contrat introuvable.",
  "rosterAction.onlyStandardExtendable": "Seul un contrat standard peut être prolongé.",
  "rosterAction.notYetEligible": "Ce joueur n'est pas encore éligible à une prolongation.",
  "rosterAction.invalidOffer": "Offre invalide.",
  "rosterAction.dataNotFound": "Données introuvables.",
  "rosterAction.exceedsCap": "Cette offre ferait dépasser le plafond salarial ({cap}).",
  "rosterAction.refusesToNegotiate":
    "{player} refuse de négocier : il n'est pas satisfait du projet sportif de l'équipe.",
  "rosterAction.refusesOffer": "{player} refuse cette offre : il exige au moins {amount} par saison.",
  "rosterAction.acceptedOne": "{player} a accepté la prolongation : {amount} sur {years} an.",
  "rosterAction.acceptedMany": "{player} a accepté la prolongation : {amount} sur {years} ans.",
  "rosterAction.alreadyStandard": "Ce contrat est déjà standard.",
  "rosterAction.noStandardRoom": "Aucune place de contrat standard disponible dans l'effectif.",
  "rosterAction.promoted": "{player} repasse en contrat standard : {amount} par saison.",
};

export const en: Record<RosterActionKey, string> = {
  "rosterAction.noCareer": "No career.",
  "rosterAction.contractNotFound": "Contract not found.",
  "rosterAction.onlyStandardExtendable": "Only a standard contract can be extended.",
  "rosterAction.notYetEligible": "This player is not yet eligible for an extension.",
  "rosterAction.invalidOffer": "Invalid offer.",
  "rosterAction.dataNotFound": "Data not found.",
  "rosterAction.exceedsCap": "This offer would put the team over the salary cap ({cap}).",
  "rosterAction.refusesToNegotiate": "{player} refuses to negotiate: he isn't satisfied with the team's project.",
  "rosterAction.refusesOffer": "{player} refuses this offer: he demands at least {amount} per season.",
  "rosterAction.acceptedOne": "{player} accepted the extension: {amount} over {years} year.",
  "rosterAction.acceptedMany": "{player} accepted the extension: {amount} over {years} years.",
  "rosterAction.alreadyStandard": "This contract is already standard.",
  "rosterAction.noStandardRoom": "No standard contract slot available on the roster.",
  "rosterAction.promoted": "{player} is back on a standard contract: {amount} per season.",
};
