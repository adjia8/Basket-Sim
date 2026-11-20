// Outils partagés des sujets de conférence de presse (voir press-rules.ts et
// press-event-topics.ts) — règles pures.

import type { Locale } from "@/lib/i18n/locale";
import type {
  AnswerTone,
  JournalistStyle,
  PressEffects,
  PressGameContext,
  PressTopic,
  QuestionCategory,
} from "./press-rules";

export interface TopicCandidate {
  topic: PressTopic;
  category: QuestionCategory;
  family?: "result" | "streak";
  priority: number; // plus c'est haut, plus la question a de chances d'être posée
  playerId?: string;
  preferredStyle?: JournalistStyle;
  prompts: string[];
  // Formulations propres à un style de journaliste (presse à sensation,
  // presse locale…), préférées quand ce journaliste pose la question.
  stylePrompts?: Partial<Record<JournalistStyle, string[]>>;
  // `alt` : autres façons de dire la même réponse (même attitude, mêmes
  // effets), tirées au hasard pour varier d'une conférence à l'autre.
  options: { tone: AnswerTone; label: string; alt?: string[]; effects: PressEffects }[];
}

export type TopicBuilder = (ctx: PressGameContext, locale: Locale) => TopicCandidate | null;

export const e = (
  morale: number,
  publicOpinion: number,
  frontOfficeApproval: number,
  extra: Partial<PressEffects> = {}
): PressEffects => ({ morale, publicOpinion, frontOfficeApproval, ...extra });

export function tr(locale: Locale) {
  return (fr: string, en: string) => (locale === "fr" ? fr : en);
}

// Accord masculin / féminin selon la ligue (NBA / WNBA).
export function gn(ctx: PressGameContext) {
  return (m: string, f: string) => (ctx.women ? f : m);
}

export const margin = (ctx: PressGameContext) => ctx.teamScore - ctx.opponentScore;
export const score = (ctx: PressGameContext) => `${ctx.teamScore}-${ctx.opponentScore}`;
export const winPct = (ctx: PressGameContext) => (ctx.wins + ctx.losses === 0 ? 0.5 : ctx.wins / (ctx.wins + ctx.losses));
export function streakCount(ctx: PressGameContext, kind: "W" | "L"): number {
  if (ctx.streak[0] !== kind) return 0;
  const n = Number(ctx.streak.slice(1));
  return Number.isFinite(n) ? n : 0;
}

export function pickOne<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}
