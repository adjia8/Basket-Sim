// Entretiens d'avant-draft — règles pures, sans accès base de données (voir
// draft-interviews.ts).
//
// Comme les vraies séances d'avant-draft, le GM n'a droit qu'à quelques
// entretiens. Chaque question sonde un trait de personnalité du prospect
// (voir personality-rules.ts) ; la réponse le révèle sous forme de niveau
// (faible / moyen / élevé), plus ou moins fiable selon le niveau de
// recrutement : un prospect habile peut « dire ce qu'on veut entendre » face
// à des recruteurs moyens.

import type { Personality } from "./personality-rules";

export type InterviewQuestion = "motivation" | "criticism" | "work" | "team" | "leadership";
export const INTERVIEW_QUESTIONS: InterviewQuestion[] = ["motivation", "criticism", "work", "team", "leadership"];

export const QUESTION_TRAIT: Record<InterviewQuestion, keyof Personality> = {
  motivation: "ambition",
  criticism: "temperament",
  work: "professionalism",
  team: "loyalty",
  leadership: "leadership",
};

export const INTERVIEWS_PER_DRAFT = 5;
export const QUESTIONS_PER_INTERVIEW = 2;

export type TraitBand = "low" | "mid" | "high";

export function bandOf(value: number): TraitBand {
  return value <= 7 ? "low" : value >= 14 ? "high" : "mid";
}

// Erreur d'estimation (points sur 1-20) selon le niveau de recrutement :
// ±1 avec d'excellents recruteurs, jusqu'à ±5 avec un recrutement faible.
export function interviewError(scouting: number): number {
  return 1 + (1 - Math.max(0, Math.min(99, scouting)) / 99) * 4;
}

function seeded(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 2001) / 1000 - 1; // [-1, 1]
}

export interface InterviewAnswer {
  question: InterviewQuestion;
  band: TraitBand; // ce que le GM en retient
  estimate: number; // estimation sur 1-20
}

// Réponse à une question : une estimation stable (même entretien, même
// réponse) du trait sondé, biaisée selon le niveau de recrutement.
export function answerQuestion(
  question: InterviewQuestion,
  personality: Personality,
  scouting: number,
  seed: string
): InterviewAnswer {
  const trueValue = personality[QUESTION_TRAIT[question]];
  const estimate = Math.max(1, Math.min(20, Math.round(trueValue + seeded(`${seed}:${question}`) * interviewError(scouting))));
  return { question, band: bandOf(estimate), estimate };
}
