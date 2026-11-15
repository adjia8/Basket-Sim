export const keys = [
  "scout.title",
  "scout.watch",
  "scout.line",
  "scout.noStats",
  "scout.injured",
  "scout.provoke",
  "scout.strengths",
  "scout.weaknesses",
  "scout.noStrengths",
  "scout.noWeaknesses",
  "scout.hint",
] as const;

export type ScoutKey = (typeof keys)[number];

export const fr: Record<ScoutKey, string> = {
  "scout.title": "Rapport de scouting · {team}",
  "scout.watch": "À surveiller",
  "scout.line": "{pts} pts · {reb} reb · {ast} pd",
  "scout.noStats": "Pas encore de stats cette saison",
  "scout.injured": "blessé",
  "scout.provoke": "peut perdre ses nerfs",
  "scout.strengths": "Où ils te dominent",
  "scout.weaknesses": "Où tu les domines",
  "scout.noStrengths": "Aucun secteur nettement en leur faveur.",
  "scout.noWeaknesses": "Aucun secteur nettement en ta faveur.",
  "scout.hint":
    "Écarts de note moyenne entre les 8 meilleurs joueurs disponibles de chaque équipe. Ajuste ta tactique en conséquence dans l'onglet Tactique de ton équipe.",
};

export const en: Record<ScoutKey, string> = {
  "scout.title": "Scouting report · {team}",
  "scout.watch": "Players to watch",
  "scout.line": "{pts} pts · {reb} reb · {ast} ast",
  "scout.noStats": "No stats yet this season",
  "scout.injured": "injured",
  "scout.provoke": "can lose his cool",
  "scout.strengths": "Where they beat you",
  "scout.weaknesses": "Where you beat them",
  "scout.noStrengths": "No area clearly in their favor.",
  "scout.noWeaknesses": "No area clearly in your favor.",
  "scout.hint":
    "Average rating gaps between each team's top 8 available players. Adjust your plan in your team's Tactics tab.",
};
