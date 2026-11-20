// Calendrier d'entraînement (façon Football Manager) — règles pures, sans
// accès base de données.
//
// Chaque jour sans match reçoit une séance. Par défaut, un modèle remplit le
// calendrier en tenant compte des matchs (récupération le lendemain d'un
// match, séance tactique légère la veille) ; le GM peut ensuite modifier
// n'importe quel jour. Au moment d'un match, les séances des jours écoulés
// depuis le précédent sont résumées en un axe et une intensité, qui pilotent
// les effets existants (progression, fatigue, usure, risque de blessure,
// voir training-rules.ts).

import type { TrainingFocus, TrainingIntensity } from "./training-rules";

export type SessionType = "recovery" | "rest" | "tactical" | "shooting" | "defense" | "physical" | "chemistry";
export const SESSION_TYPES: SessionType[] = ["recovery", "rest", "tactical", "shooting", "defense", "physical", "chemistry"];

// Axe travaillé et charge (0 = repos) de chaque séance.
export const SESSION_META: Record<SessionType, { focus: TrainingFocus; load: number }> = {
  recovery: { focus: "rest", load: 0 },
  rest: { focus: "rest", load: 0 },
  tactical: { focus: "tactical", load: 1 },
  shooting: { focus: "offensive", load: 1 },
  defense: { focus: "defensive", load: 1 },
  chemistry: { focus: "chemistry", load: 0.8 },
  physical: { focus: "physical", load: 2 },
};

export type CalendarTemplate = "balanced" | "heavy" | "light";
export const CALENDAR_TEMPLATES: CalendarTemplate[] = ["balanced", "heavy", "light"];

export interface TrainingCalendar {
  template: CalendarTemplate;
  overrides: Record<string, SessionType>; // date AAAA-MM-JJ → séance choisie
}

export function parseCalendar(json: string | null | undefined): TrainingCalendar | null {
  if (!json) return null;
  try {
    const c = JSON.parse(json) as TrainingCalendar;
    return CALENDAR_TEMPLATES.includes(c.template) ? { template: c.template, overrides: c.overrides ?? {} } : null;
  } catch {
    return null;
  }
}

// Séances « de fond » selon le modèle, en rotation sur les jours libres.
const TEMPLATE_ROTATION: Record<CalendarTemplate, SessionType[]> = {
  balanced: ["shooting", "defense", "physical", "chemistry"],
  heavy: ["recovery", "tactical", "rest"], // semaine chargée : on ménage les organismes
  light: ["physical", "shooting", "defense", "physical"], // semaine légère : on travaille
};

// Séance automatique d'un jour libre, selon sa place entre deux matchs :
// `dayIndex` = 1 le lendemain d'un match ; `gapDays` = jours libres entre les
// deux matchs.
export function autoSession(template: CalendarTemplate, dayIndex: number, gapDays: number, dayOfYear = 0): SessionType {
  if (dayIndex === 1) return "recovery";
  if (dayIndex === gapDays) return "tactical"; // veille de match : léger
  const rotation = TEMPLATE_ROTATION[template];
  return rotation[(dayOfYear + dayIndex) % rotation.length];
}

export interface TrainingLoad {
  focus: TrainingFocus | null;
  intensity: TrainingIntensity;
}

// Résume les séances entre deux matchs en un axe et une intensité. Aucun
// jour libre (back-to-back) = repos.
export function summarizeSessions(sessions: SessionType[], baseIntensity: TrainingIntensity): TrainingLoad {
  const worked = sessions.filter((s) => SESSION_META[s].load > 0);
  if (worked.length === 0) return { focus: "rest", intensity: "low" };
  const counts = new Map<TrainingFocus, number>();
  for (const s of worked) counts.set(SESSION_META[s].focus, (counts.get(SESSION_META[s].focus) ?? 0) + SESSION_META[s].load);
  const focus = [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
  // Charge moyenne par jour, modulée par l'intensité choisie par le GM.
  const perDay = sessions.reduce((s, x) => s + SESSION_META[x].load, 0) / sessions.length;
  const scale = baseIntensity === "high" ? 1.3 : baseIntensity === "low" ? 0.7 : 1;
  const load = perDay * scale;
  const intensity: TrainingIntensity = load >= 1.3 ? "high" : load >= 0.7 ? "medium" : "low";
  return { focus, intensity };
}

const isoDay = (d: Date) => d.toISOString().slice(0, 10);
const DAY_MS = 86_400_000;

// Séances des jours libres entre le match précédent et ce match (exclus),
// d'après le calendrier : choix du GM s'il y en a un, sinon le modèle.
export function sessionsBetween(calendar: TrainingCalendar, gameDate: Date, restDays: number): SessionType[] {
  const gap = Math.max(0, restDays - 1);
  const sessions: SessionType[] = [];
  for (let i = 1; i <= gap; i++) {
    const day = new Date(gameDate.getTime() - (gap - i + 1) * DAY_MS);
    const key = isoDay(day);
    const dayOfYear = Math.floor(day.getTime() / DAY_MS);
    sessions.push(calendar.overrides[key] ?? autoSession(calendar.template, i, gap, dayOfYear));
  }
  return sessions;
}

export interface CalendarDay {
  date: string; // AAAA-MM-JJ
  game: boolean;
  session: SessionType | null; // null les jours de match
  custom: boolean; // séance choisie par le GM (sinon modèle)
}

// Jours à afficher (à partir de `from`, sur `count` jours) : match ou séance,
// avec la séance du modèle calculée selon la place du jour entre deux matchs.
export function planDays(from: Date, count: number, gameDays: string[], calendar: TrainingCalendar): CalendarDay[] {
  const games = [...new Set(gameDays)].sort();
  const days: CalendarDay[] = [];
  for (let i = 0; i < count; i++) {
    const d = new Date(from.getTime() + i * DAY_MS);
    const key = isoDay(d);
    if (games.includes(key)) {
      days.push({ date: key, game: true, session: null, custom: false });
      continue;
    }
    const prev = [...games].reverse().find((g) => g < key);
    const next = games.find((g) => g > key);
    const prevTime = prev ? Date.parse(prev) : d.getTime() - DAY_MS;
    const nextTime = next ? Date.parse(next) : d.getTime() + 3 * DAY_MS;
    const dayIndex = Math.round((Date.parse(key) - prevTime) / DAY_MS);
    const gap = Math.round((nextTime - prevTime) / DAY_MS) - 1;
    const custom = calendar.overrides[key];
    days.push({
      date: key,
      game: false,
      session: custom ?? autoSession(calendar.template, dayIndex, gap, Math.floor(d.getTime() / DAY_MS)),
      custom: !!custom,
    });
  }
  return days;
}
