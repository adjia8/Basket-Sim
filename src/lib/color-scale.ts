// Échelle de couleurs partagée pour les "notes" (attributs, overall) et les
// bilans financiers — vert = bon, orange = moyen, rouge = mauvais. Purement
// visuel, aucune règle de jeu ici.

export type ScaleTone = "good" | "average" | "bad";

export const TONE_CLASSES: Record<ScaleTone, string> = {
  good: "text-green-600 dark:text-green-400",
  average: "text-orange-500 dark:text-orange-400",
  bad: "text-red-600 dark:text-red-400",
};

// Échelle générique 0-99 (overall, attributs techniques, infrastructures...).
export function ratingTone(value: number): ScaleTone {
  if (value >= 80) return "good";
  if (value >= 60) return "average";
  return "bad";
}

// Échelle inversée : une valeur haute est mauvaise (risque de blessure,
// fatigue).
export function inverseRatingTone(value: number): ScaleTone {
  if (value <= 30) return "good";
  if (value <= 60) return "average";
  return "bad";
}

// Échelle centrée sur 50 (valeur neutre de départ) — pour les jauges qui
// démarrent au milieu plutôt qu'au minimum (moral, opinion publique,
// perception des dirigeants), contrairement à ratingTone où 50 est déjà une
// note médiocre sur une échelle de compétence 0-99.
export function neutralTone(value: number): ScaleTone {
  if (value >= 65) return "good";
  if (value >= 35) return "average";
  return "bad";
}

// Trésorerie : négative = mauvaise, positive mais sous le seuil "sain" =
// moyenne, au-dessus = bonne (voir healthyFinancesThreshold, finance-rules.ts).
export function financeTone(finances: number, healthyThreshold: number): ScaleTone {
  if (finances < 0) return "bad";
  if (finances < healthyThreshold) return "average";
  return "good";
}

export function toneClass(tone: ScaleTone): string {
  return TONE_CLASSES[tone];
}
