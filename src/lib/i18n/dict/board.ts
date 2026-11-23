export const keys = [
  "board.title",
  "board.empty",
  "board.actual",
  "board.status.active",
  "board.status.met",
  "board.status.failed",
  "ptime.title",
  "ptime.hint",
  "ptime.promise",
  "ptime.button",
  "ptime.active",
  "ptime.none",
  "ptime.keep",
] as const;

export type BoardKey = (typeof keys)[number];

export const fr: Record<BoardKey, string> = {
  "board.title": "Objectifs des propriétaires",
  "board.empty": "La direction fixera ses objectifs après une quinzaine de matchs de saison régulière.",
  "board.actual": "Actuellement : {value}",
  "board.status.active": "En cours",
  "board.status.met": "Tenu",
  "board.status.failed": "Manqué",
  "ptime.title": "Promesse de temps de jeu",
  "ptime.hint": "Promettre un rôle le rend plus heureux tout de suite. Sur les 15 matchs suivants, tiens-la (+ moral) ou il se sentira trahi (moral en chute et demande de départ).",
  "ptime.promise": "Lui promettre un rôle de",
  "ptime.button": "Promettre",
  "ptime.active": "Promesse en cours : {status} · {games}/15 matchs · {mpg} min par match (il en faut ≈ {needed})",
  "ptime.none": "Aucun rôle supérieur à promettre.",
  "ptime.keep": "garantir son rôle actuel",
};

export const en: Record<BoardKey, string> = {
  "board.title": "Ownership goals",
  "board.empty": "Ownership will set its goals after about fifteen regular-season games.",
  "board.actual": "Currently: {value}",
  "board.status.active": "In progress",
  "board.status.met": "Met",
  "board.status.failed": "Missed",
  "ptime.title": "Playing time promise",
  "ptime.hint": "Promising a role makes him happier right away. Over the next 15 games, keep it (+ morale) or he'll feel betrayed (morale drop and trade request).",
  "ptime.promise": "Promise him a role as",
  "ptime.button": "Promise",
  "ptime.active": "Active promise: {status} · {games}/15 games · {mpg} min per game (≈ {needed} needed)",
  "ptime.none": "No higher role to promise.",
  "ptime.keep": "guarantee his current role",
};
