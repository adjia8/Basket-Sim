export const keys = [
  "loadplan.title",
  "loadplan.hint",
  "loadplan.b2b",
  "loadplan.minutes",
  "loadplan.wear",
  "loadplan.none",
  "loadplan.minutesValue",
  "loadplan.save",
  "loadplan.active",
  "loadplan.summary.b2b",
  "loadplan.summary.minutes",
  "loadplan.summary.wear",
] as const;

export type LoadPlanKey = (typeof keys)[number];

export const fr: Record<LoadPlanKey, string> = {
  "loadplan.title": "Gestion de la charge (toute la saison)",
  "loadplan.hint": "Des règles automatiques plutôt qu'un repos match par match. Le jeu garde toujours au moins 9 joueurs disponibles.",
  "loadplan.b2b": "Repos sur le 2e match des back-to-backs",
  "loadplan.minutes": "Limite de minutes",
  "loadplan.wear": "Repos automatique dès une usure de",
  "loadplan.none": "Aucune",
  "loadplan.minutesValue": "{count} min",
  "loadplan.save": "Enregistrer le plan",
  "loadplan.active": "Plan actif : {summary}",
  "loadplan.summary.b2b": "repos en back-to-back",
  "loadplan.summary.minutes": "{count} min max",
  "loadplan.summary.wear": "repos dès {count} d'usure",
};

export const en: Record<LoadPlanKey, string> = {
  "loadplan.title": "Load management (whole season)",
  "loadplan.hint": "Automatic rules instead of resting game by game. The game always keeps at least 9 players available.",
  "loadplan.b2b": "Rest on the 2nd game of back-to-backs",
  "loadplan.minutes": "Minutes limit",
  "loadplan.wear": "Auto-rest from a wear of",
  "loadplan.none": "None",
  "loadplan.minutesValue": "{count} min",
  "loadplan.save": "Save the plan",
  "loadplan.active": "Active plan: {summary}",
  "loadplan.summary.b2b": "rest on back-to-backs",
  "loadplan.summary.minutes": "{count} min max",
  "loadplan.summary.wear": "rest from {count} wear",
};
