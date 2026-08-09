// Règles pures des conférences de presse — aucun accès base de données ici,
// tout est piloté par src/lib/data-access/press.ts.
//
// Le prompt et les libellés de ton choisis sont écrits tels quels dans la DB
// (PressQuestion.prompt / optionsJson) au moment de la génération, dans la
// langue de la requête qui déclenche la conférence (voir generateQuestions,
// appelé depuis simulate-game/route.ts avec la locale du manager qui vient
// de jouer) — un peu comme un article de presse réel, figé à sa publication.
// Cas limite accepté : en multijoueur avec deux managers dans des langues
// différentes, la conférence de CHAQUE équipe est dans la langue de la
// requête qui l'a déclenchée plutôt que dans celle du manager qui la lira.

import type { Locale } from "@/lib/i18n/locale";

export type AnswerTone = "diplomatic" | "confident" | "critical" | "humble";
export type QuestionCategory = "results" | "roster" | "management" | "future";

export interface PressOption {
  id: string;
  label: string;
  tone: AnswerTone;
}

export interface GeneratedQuestion {
  prompt: string;
  category: QuestionCategory;
  options: PressOption[];
}

// Toujours les 4 mêmes tons, quelle que soit la question — simplifie
// l'interface (un seul jeu d'options à afficher) et laisse le prompt porter
// toute la variété.
const TONE_LABELS: Record<Locale, Record<AnswerTone, string>> = {
  fr: {
    diplomatic: "Réponse mesurée, sans vague",
    confident: "Réponse offensive, pleine de confiance",
    critical: "Réponse critique envers l'effectif/l'arbitrage",
    humble: "Réponse humble, reconnaît les difficultés",
  },
  en: {
    diplomatic: "A measured, cautious answer",
    confident: "A bold, confident answer",
    critical: "A critical answer toward the roster/officiating",
    humble: "A humble answer, acknowledging the struggles",
  },
};
const TONES: AnswerTone[] = ["diplomatic", "confident", "critical", "humble"];

const QUESTION_BANK: Record<Locale, Record<QuestionCategory, string[]>> = {
  fr: {
    results: [
      "Comment expliquez-vous les résultats de l'équipe ces derniers matchs ?",
      "Le groupe a-t-il le niveau pour viser les objectifs fixés cette saison ?",
      "Certains observateurs jugent la dynamique inquiétante — qu'en pensez-vous ?",
      "Quel est le principal point à corriger après ce dernier match ?",
      "Le calendrier à venir s'annonce difficile : comment l'abordez-vous ?",
    ],
    roster: [
      "Êtes-vous satisfait de l'implication de votre effectif en ce moment ?",
      "Certains joueurs semblent frustrés de leur temps de jeu — un commentaire ?",
      "Le vestiaire traverse-t-il des tensions selon vous ?",
      "Peut-on s'attendre à des changements dans la rotation prochainement ?",
      "Comment jugez-vous l'alchimie sur le terrain cette saison ?",
    ],
    management: [
      "La direction vous soutient-elle pleinement dans vos choix ?",
      "Votre poste est-il remis en question en interne selon vous ?",
      "Les investissements dans les infrastructures sont-ils suffisants ?",
      "Comment décririez-vous votre relation avec les dirigeants du club ?",
      "Sentez-vous une pression particulière de la part de la franchise ?",
    ],
    future: [
      "Quels sont vos objectifs pour la suite de la saison ?",
      "Envisagez-vous des mouvements sur le marché des transferts ?",
      "Où voyez-vous cette équipe dans les prochaines saisons ?",
      "Les supporters peuvent-ils garder espoir cette année ?",
      "Quel message souhaitez-vous adresser aux fans après cette période ?",
    ],
  },
  en: {
    results: [
      "How do you explain the team's results over the last few games?",
      "Does this group have what it takes to reach this season's goals?",
      "Some observers see the recent momentum as worrying — your thoughts?",
      "What's the main thing to fix after that last game?",
      "The upcoming schedule looks tough — how are you approaching it?",
    ],
    roster: [
      "Are you satisfied with your roster's effort level right now?",
      "Some players seem frustrated with their playing time — any comment?",
      "Is there tension in the locker room, in your view?",
      "Should we expect changes to the rotation soon?",
      "How would you rate the on-court chemistry this season?",
    ],
    management: [
      "Does the front office fully support your decisions?",
      "Is your job under scrutiny internally, in your opinion?",
      "Are the investments in facilities sufficient?",
      "How would you describe your relationship with the club's leadership?",
      "Do you feel particular pressure from the franchise?",
    ],
    future: [
      "What are your goals for the rest of the season?",
      "Are you considering any moves on the trade market?",
      "Where do you see this team in the coming seasons?",
      "Can the fans stay hopeful this year?",
      "What message would you like to send to the fans right now?",
    ],
  },
};

function shuffledCategories(): QuestionCategory[] {
  const categories: QuestionCategory[] = ["results", "roster", "management", "future"];
  for (let i = categories.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [categories[i], categories[j]] = [categories[j], categories[i]];
  }
  return categories;
}

function buildOptions(locale: Locale): PressOption[] {
  return TONES.map((tone) => ({ id: tone, label: TONE_LABELS[locale][tone], tone }));
}

// Tire `count` questions (3 ou 4) réparties sur des catégories différentes
// quand c'est possible, chacune avec les 4 tons de réponse disponibles.
export function generateQuestions(count: number, locale: Locale): GeneratedQuestion[] {
  const categories = shuffledCategories();
  const questions: GeneratedQuestion[] = [];
  for (let i = 0; i < count; i++) {
    const category = categories[i % categories.length];
    const bank = QUESTION_BANK[locale][category];
    const prompt = bank[Math.floor(Math.random() * bank.length)];
    questions.push({ prompt, category, options: buildOptions(locale) });
  }
  return questions;
}

export interface PressEffects {
  morale: number;
  publicOpinion: number;
  frontOfficeApproval: number;
}

// winPct au moment de la conférence : une réponse "confiante" n'est pas
// reçue pareil après une série de victoires ou de défaites, une réponse
// "humble" après une défaite rassure plus qu'après une victoire (où elle
// paraît juste polie, sans grand effet).
export function pressAnswerEffects(tone: AnswerTone, teamWinPct: number): PressEffects {
  const winning = teamWinPct >= 0.5;
  switch (tone) {
    case "diplomatic":
      return { morale: 1, publicOpinion: 2, frontOfficeApproval: 1 };
    case "confident":
      return winning
        ? { morale: 3, publicOpinion: 3, frontOfficeApproval: 1 }
        : { morale: 1, publicOpinion: -2, frontOfficeApproval: -2 };
    case "critical":
      return { morale: -2, publicOpinion: -1, frontOfficeApproval: 2 };
    case "humble":
      return winning
        ? { morale: 1, publicOpinion: 1, frontOfficeApproval: 1 }
        : { morale: 2, publicOpinion: 2, frontOfficeApproval: 2 };
  }
}

// Petit modificateur de force d'équipe dérivé du moral, ajouté à la chimie
// transmise au moteur de simulation — même échelle que gmChemistryBonus
// (±3 autour de 50), aucune dénormalisation sur Player nécessaire.
export function moraleBonus(morale: number): number {
  return Math.round(((Math.max(0, Math.min(99, morale)) - 50) / 49) * 3);
}

export const PRESS_CONFERENCE_COOLDOWN_DAYS = 7;
export const PRESS_CONFERENCE_CHANCE = 0.25; // par match joué, une fois le cooldown passé
