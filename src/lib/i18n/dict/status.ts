export const keys = [
  "status.franchise",
  "status.star",
  "status.starter",
  "status.rotation",
  "status.prospect",
  "status.bench",
  "status.demands",
  "status.contender",
  "status.basis",
  "status.basisNoStats",
  "status.playerLine",
  "status.playerLineNoGames",
  "status.label",
] as const;

export type StatusKey = (typeof keys)[number];

export const fr: Record<StatusKey, string> = {
  "status.franchise": "Joueur franchise",
  "status.star": "Star",
  "status.starter": "Titulaire",
  "status.rotation": "Joueur de rotation",
  "status.prospect": "Espoir",
  "status.bench": "Fin de banc",
  "status.demands": "Exigences : statut {status} (≈ {minutes} min par match)",
  "status.contender": "veut un projet qui gagne",
  "status.basis": "Valeur marchande {value} : note {overall}, production {production} ({ppg} pts, {rpg} reb, {apg} pd en {season})",
  "status.basisNoStats": "Valeur marchande {value} : sa note seule (moins de 10 matchs joués)",
  "status.label": "Statut",
  "status.playerLine": "{status} : attend ≈ {expected} min par match, en joue {actual}",
  "status.playerLineNoGames": "{status} : attend ≈ {expected} min par match",
};

export const en: Record<StatusKey, string> = {
  "status.franchise": "Franchise player",
  "status.star": "Star",
  "status.starter": "Starter",
  "status.rotation": "Rotation player",
  "status.prospect": "Prospect",
  "status.bench": "End of bench",
  "status.demands": "Demands: {status} role (≈ {minutes} min per game)",
  "status.contender": "wants a winning team",
  "status.basis": "Market value {value}: rating {overall}, production {production} ({ppg} pts, {rpg} reb, {apg} ast in {season})",
  "status.basisNoStats": "Market value {value}: rating only (fewer than 10 games played)",
  "status.label": "Role",
  "status.playerLine": "{status}: expects ≈ {expected} min per game, gets {actual}",
  "status.playerLineNoGames": "{status}: expects ≈ {expected} min per game",
};
