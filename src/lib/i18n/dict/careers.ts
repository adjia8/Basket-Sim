export const keys = [
  "careers.title",
  "careers.subtitle",
  "careers.new",
  "careers.limit",
  "careers.active",
  "careers.resume",
  "careers.season",
  "careers.record",
  "careers.lastPlayed",
  "careers.notStarted",
  "careers.gm",
  "careers.shared",
  "careers.backToList",
  "careers.nav",
] as const;

export type CareersKey = (typeof keys)[number];

export const fr: Record<CareersKey, string> = {
  "careers.title": "Mes carrières",
  "careers.subtitle":
    "Chaque carrière est une sauvegarde à part : tu peux en mener plusieurs en parallèle et passer de l'une à l'autre sans rien perdre.",
  "careers.new": "Nouvelle carrière",
  "careers.limit": "Limite de {max} carrières atteinte : supprime-en une pour en créer une nouvelle.",
  "careers.active": "En cours",
  "careers.resume": "Reprendre",
  "careers.season": "Saison {season}",
  "careers.record": "Bilan {wins}-{losses}",
  "careers.lastPlayed": "Dernier match : {date}",
  "careers.notStarted": "Pas encore de match joué",
  "careers.gm": "GM : {name}",
  "careers.shared": "Partagée avec {count} autre(s) manager(s)",
  "careers.backToList": "Mes carrières ({count})",
  "careers.nav": "Mes carrières",
};

export const en: Record<CareersKey, string> = {
  "careers.title": "My careers",
  "careers.subtitle":
    "Each career is a separate save: you can run several at once and switch between them without losing anything.",
  "careers.new": "New career",
  "careers.limit": "You've reached the {max}-career limit: delete one to start a new one.",
  "careers.active": "Current",
  "careers.resume": "Resume",
  "careers.season": "{season} season",
  "careers.record": "Record {wins}-{losses}",
  "careers.lastPlayed": "Last game: {date}",
  "careers.notStarted": "No games played yet",
  "careers.gm": "GM: {name}",
  "careers.shared": "Shared with {count} other manager(s)",
  "careers.backToList": "My careers ({count})",
  "careers.nav": "My careers",
};
