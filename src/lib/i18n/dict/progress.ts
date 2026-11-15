export const keys = [
  "progress.title",
  "progress.hint",
  "progress.potential",
  "progress.today",
  "progress.bySeason",
  "progress.col.season",
  "progress.col.gp",
  "progress.col.mpg",
  "progress.col.ppg",
  "progress.col.rpg",
  "progress.col.apg",
] as const;

export type ProgressKey = (typeof keys)[number];

export const fr: Record<ProgressKey, string> = {
  "progress.title": "Progression",
  "progress.hint": "Note relevée chaque mois de jeu. La courbe s'enrichit au fil des saisons.",
  "progress.potential": "Potentiel estimé",
  "progress.today": "Aujourd'hui",
  "progress.bySeason": "Saison par saison",
  "progress.col.season": "Saison",
  "progress.col.gp": "MJ",
  "progress.col.mpg": "Min",
  "progress.col.ppg": "Pts",
  "progress.col.rpg": "Reb",
  "progress.col.apg": "Pd",
};

export const en: Record<ProgressKey, string> = {
  "progress.title": "Development",
  "progress.hint": "Rating recorded every game month. The curve grows season after season.",
  "progress.potential": "Estimated potential",
  "progress.today": "Today",
  "progress.bySeason": "Season by season",
  "progress.col.season": "Season",
  "progress.col.gp": "GP",
  "progress.col.mpg": "Min",
  "progress.col.ppg": "Pts",
  "progress.col.rpg": "Reb",
  "progress.col.apg": "Ast",
};
