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
import { ordinalSuffix } from "@/lib/utils";

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

// Contexte du dernier match joué, injecté dans les questions/réponses pour
// qu'elles parlent du vrai résultat plutôt que de rester génériques (voir
// simulate-game/route.ts pour comment il est construit : tout est déjà en
// mémoire à cet endroit, aucune requête supplémentaire).
export interface PressGameContext {
  teamName: string;
  opponentName: string;
  won: boolean;
  teamScore: number;
  opponentScore: number;
  wins: number;
  losses: number;
  streak: string; // "W3" / "L2" / "-", voir computeStreak dans standings.ts
  rank: number; // 1-based
  leagueSize: number;
  topPerformerName?: string;
  topPerformerPoints?: number;
}

function describeStreak(streak: string, locale: Locale): string {
  const kind = streak[0];
  const count = Number(streak.slice(1));
  if (!kind || !Number.isFinite(count) || count <= 0) {
    return locale === "fr" ? "ce début de saison" : "this start to the season";
  }
  if (locale === "fr") {
    return kind === "W" ? `${count} victoire${count > 1 ? "s" : ""} de suite` : `${count} défaite${count > 1 ? "s" : ""} de suite`;
  }
  return kind === "W" ? `${count} straight win${count > 1 ? "s" : ""}` : `${count} straight loss${count > 1 ? "es" : ""}`;
}

type QuestionTemplate = (ctx: PressGameContext, locale: Locale) => string;

const QUESTION_BANK: Record<QuestionCategory, QuestionTemplate[]> = {
  results: [
    (ctx, locale) =>
      locale === "fr"
        ? `Vous venez de ${ctx.won ? "battre" : "vous incliner face à"} ${ctx.opponentName} ${ctx.teamScore}-${ctx.opponentScore} : comment expliquez-vous ce résultat ?`
        : `You just ${ctx.won ? "beat" : "lost to"} ${ctx.opponentName} ${ctx.teamScore}-${ctx.opponentScore}: how do you explain that result?`,
    (ctx, locale) =>
      locale === "fr"
        ? `Avec un bilan de ${ctx.wins}-${ctx.losses}, le groupe a-t-il le niveau pour viser les objectifs fixés cette saison ?`
        : `With a ${ctx.wins}-${ctx.losses} record, does this group have what it takes to reach this season's goals?`,
    (ctx, locale) =>
      locale === "fr"
        ? `Cette série de ${describeStreak(ctx.streak, locale)} inquiète certains observateurs — qu'en pensez-vous ?`
        : `This stretch of ${describeStreak(ctx.streak, locale)} worries some observers — your thoughts?`,
    (ctx, locale) =>
      locale === "fr"
        ? `Quel est le principal point à corriger après cette rencontre contre ${ctx.opponentName} ?`
        : `What's the main thing to fix after that game against ${ctx.opponentName}?`,
    (ctx, locale) =>
      locale === "fr"
        ? `Le calendrier à venir s'annonce difficile après ce ${ctx.won ? "succès" : "revers"} : comment l'abordez-vous ?`
        : `The upcoming schedule looks tough after that ${ctx.won ? "win" : "loss"} — how are you approaching it?`,
  ],
  roster: [
    (ctx, locale) =>
      ctx.topPerformerName
        ? locale === "fr"
          ? `${ctx.topPerformerName} a terminé avec ${ctx.topPerformerPoints} points face à ${ctx.opponentName} — êtes-vous satisfait de l'implication du reste de l'effectif ?`
          : `${ctx.topPerformerName} finished with ${ctx.topPerformerPoints} points against ${ctx.opponentName} — are you satisfied with the rest of the roster's effort?`
        : locale === "fr"
          ? `Êtes-vous satisfait de l'implication de votre effectif en ce moment ?`
          : `Are you satisfied with your roster's effort level right now?`,
    (_ctx, locale) =>
      locale === "fr"
        ? "Certains joueurs semblent frustrés de leur temps de jeu — un commentaire ?"
        : "Some players seem frustrated with their playing time — any comment?",
    (ctx, locale) =>
      locale === "fr"
        ? `Le vestiaire traverse-t-il des tensions, après ce passage à ${ctx.wins}-${ctx.losses} ?`
        : `Is there tension in the locker room, after this stretch to ${ctx.wins}-${ctx.losses}?`,
    (_ctx, locale) =>
      locale === "fr"
        ? "Peut-on s'attendre à des changements dans la rotation prochainement ?"
        : "Should we expect changes to the rotation soon?",
    (ctx, locale) =>
      locale === "fr"
        ? `Comment jugez-vous l'alchimie sur le terrain, avec ${ctx.teamName} désormais ${ctx.rank}e sur ${ctx.leagueSize} ?`
        : `How would you rate the on-court chemistry, with ${ctx.teamName} now ${ctx.rank}${ordinalSuffix(ctx.rank, locale)} out of ${ctx.leagueSize}?`,
  ],
  management: [
    (ctx, locale) =>
      locale === "fr"
        ? `La direction vous soutient-elle pleinement, alors que ${ctx.teamName} pointe à la ${ctx.rank}e place sur ${ctx.leagueSize} ?`
        : `Does the front office fully support you, with ${ctx.teamName} sitting ${ctx.rank}${ordinalSuffix(ctx.rank, locale)} out of ${ctx.leagueSize}?`,
    (ctx, locale) =>
      locale === "fr"
        ? `Votre poste est-il remis en question en interne après ce ${ctx.won ? "succès" : "revers"} face à ${ctx.opponentName} ?`
        : `Is your job under scrutiny internally after that ${ctx.won ? "win" : "loss"} against ${ctx.opponentName}?`,
    (_ctx, locale) =>
      locale === "fr"
        ? "Les investissements dans les infrastructures sont-ils suffisants ?"
        : "Are the investments in facilities sufficient?",
    (_ctx, locale) =>
      locale === "fr"
        ? "Comment décririez-vous votre relation avec les dirigeants du club ?"
        : "How would you describe your relationship with the club's leadership?",
    (ctx, locale) =>
      locale === "fr"
        ? `Sentez-vous une pression particulière de la franchise avec ce bilan de ${ctx.wins}-${ctx.losses} ?`
        : `Do you feel particular pressure from the franchise with a ${ctx.wins}-${ctx.losses} record?`,
  ],
  future: [
    (ctx, locale) =>
      locale === "fr"
        ? `Quels sont vos objectifs pour la suite de la saison, avec ${ctx.teamName} à la ${ctx.rank}e place ?`
        : `What are your goals for the rest of the season, with ${ctx.teamName} in ${ctx.rank}${ordinalSuffix(ctx.rank, locale)} place?`,
    (ctx, locale) =>
      locale === "fr"
        ? `Envisagez-vous des mouvements sur le marché des transferts après ce ${ctx.won ? "succès" : "revers"} ?`
        : `Are you considering any moves on the trade market after that ${ctx.won ? "win" : "loss"}?`,
    (_ctx, locale) =>
      locale === "fr"
        ? "Où voyez-vous cette équipe dans les prochaines saisons ?"
        : "Where do you see this team in the coming seasons?",
    (ctx, locale) =>
      locale === "fr"
        ? `Les supporters peuvent-ils garder espoir avec ce bilan de ${ctx.wins}-${ctx.losses} ?`
        : `Can the fans stay hopeful with a ${ctx.wins}-${ctx.losses} record?`,
    (ctx, locale) =>
      locale === "fr"
        ? `Quel message souhaitez-vous adresser aux fans après ce match contre ${ctx.opponentName} ?`
        : `What message would you like to send to the fans after that game against ${ctx.opponentName}?`,
  ],
};

function shuffledCategories(): QuestionCategory[] {
  const categories: QuestionCategory[] = ["results", "roster", "management", "future"];
  for (let i = categories.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [categories[i], categories[j]] = [categories[j], categories[i]];
  }
  return categories;
}

// Réponses proposées : toujours les 4 mêmes postures (tons), mais formulées
// comme une citation qui reprend le SUJET de la question posée (résultat,
// effectif, direction, avenir) — avant, les 4 options étaient calculées à
// partir du seul contexte de match, identiques quelle que soit la question,
// ce qui les faisait paraître recyclées sur toute la conférence.
type ToneAnswerBank = Record<AnswerTone, (ctx: PressGameContext, locale: Locale) => string>;

const ANSWER_BANK: Record<QuestionCategory, ToneAnswerBank> = {
  results: {
    diplomatic: (ctx, locale) =>
      locale === "fr"
        ? ctx.won
          ? `« On reste concentrées sur le travail, cette victoire ${ctx.teamScore}-${ctx.opponentScore} contre ${ctx.opponentName} ne change rien à notre approche. »`
          : `« On reste concentrées sur le travail, cette défaite contre ${ctx.opponentName} ne change rien à notre approche. »`
        : ctx.won
          ? `"We stay focused on the work — this ${ctx.teamScore}-${ctx.opponentScore} win over ${ctx.opponentName} doesn't change our approach."`
          : `"We stay focused on the work — this loss to ${ctx.opponentName} doesn't change our approach."`,
    confident: (ctx, locale) =>
      locale === "fr"
        ? ctx.won
          ? `« On savait qu'on pouvait battre ${ctx.opponentName} — ce n'est qu'un début, on vise mieux que la ${ctx.rank}e place. »`
          : `« Cette défaite contre ${ctx.opponentName} ne représente pas notre vrai niveau, on va le prouver très vite. »`
        : ctx.won
          ? `"We knew we could beat ${ctx.opponentName} — this is just the start, we're aiming higher than ${ctx.rank}${ordinalSuffix(ctx.rank, locale)} place."`
          : `"That loss to ${ctx.opponentName} doesn't reflect our real level, and we'll prove it soon."`,
    critical: (ctx, locale) =>
      locale === "fr"
        ? `« Il y a eu des détails, des choix d'arbitrage aussi, qui nous ont coûté cher face à ${ctx.opponentName} — on doit en reparler en interne. »`
        : `"There were some details, and some officiating calls too, that cost us against ${ctx.opponentName} — we need to talk about that internally."`,
    humble: (ctx, locale) =>
      locale === "fr"
        ? ctx.won
          ? `« On a eu de la réussite ce soir contre ${ctx.opponentName}, il reste beaucoup de travail. »`
          : `« ${ctx.opponentName} était meilleure que nous ce soir, on doit apprendre de cette défaite. »`
        : ctx.won
          ? `"We caught some breaks tonight against ${ctx.opponentName}, there's still plenty of work to do."`
          : `"${ctx.opponentName} was the better team tonight — we need to learn from this loss."`,
  },
  roster: {
    diplomatic: (ctx, locale) =>
      locale === "fr"
        ? `« Le groupe travaille dur pour ${ctx.teamName}, je ne vais pas pointer une joueuse en particulier, on avance ensemble. »`
        : `"The group is working hard for ${ctx.teamName} — I'm not calling anyone out, we move forward together."`,
    confident: (ctx, locale) =>
      locale === "fr"
        ? ctx.topPerformerName
          ? `« Avec des joueuses comme ${ctx.topPerformerName}, j'ai une confiance totale dans cet effectif. »`
          : `« J'ai une confiance totale dans cet effectif, il a le niveau pour nous emmener loin. »`
        : ctx.topPerformerName
          ? `"With players like ${ctx.topPerformerName} on this roster, I have total confidence in this group."`
          : `"I have total confidence in this roster — it has what it takes to take us far."`,
    critical: (_ctx, locale) =>
      locale === "fr"
        ? "« Il y a des ajustements à faire dans la rotation, tout le monde doit encore progresser dans son rôle. »"
        : `"There are adjustments to make in the rotation — everyone still needs to grow into their role."`,
    humble: (_ctx, locale) =>
      locale === "fr"
        ? "« Chaque joueuse doit encore progresser, moi le premier dans la gestion du groupe. »"
        : `"Every player still has room to grow — starting with how I manage this group."`,
  },
  management: {
    diplomatic: (_ctx, locale) =>
      locale === "fr"
        ? "« J'ai une relation professionnelle et respectueuse avec la direction, on avance dans le même sens. »"
        : `"I have a professional, respectful relationship with the front office — we're moving in the same direction."`,
    confident: (_ctx, locale) =>
      locale === "fr"
        ? "« La direction me fait confiance et je le leur rends bien — on construit quelque chose de solide ensemble. »"
        : `"The front office trusts me and I trust them right back — we're building something solid together."`,
    critical: (_ctx, locale) =>
      locale === "fr"
        ? "« Il y a des décisions de la direction que je ne partage pas forcément, mais ça reste entre nous. »"
        : `"There are front-office decisions I don't necessarily agree with, but that stays internal."`,
    humble: (_ctx, locale) =>
      locale === "fr"
        ? "« Je dois encore gagner la confiance de la direction, c'est un travail de tous les jours. »"
        : `"I still have work to do to earn the front office's full trust — it's a day-to-day effort."`,
  },
  future: {
    diplomatic: (ctx, locale) =>
      locale === "fr"
        ? `« On avance match après match avec ${ctx.teamName}, sans se projeter trop loin pour l'instant. »`
        : `"We're taking it game by game with ${ctx.teamName}, without looking too far ahead for now."`,
    confident: (ctx, locale) =>
      locale === "fr"
        ? `« On vise clairement mieux que la ${ctx.rank}e place, cette équipe a de l'ambition. »`
        : `"We're clearly aiming higher than ${ctx.rank}${ordinalSuffix(ctx.rank, locale)} place — this team has ambition."`,
    critical: (_ctx, locale) =>
      locale === "fr"
        ? "« Il faudra sans doute du mouvement sur le marché des transferts si on veut vraiment avancer. »"
        : `"We'll probably need some moves on the trade market if we want to really move forward."`,
    humble: (_ctx, locale) =>
      locale === "fr"
        ? "« On préfère rester prudentes sur nos objectifs et avancer étape par étape. »"
        : `"We'd rather stay cautious about our goals and take it step by step."`,
  },
};

function buildOptions(locale: Locale, ctx: PressGameContext, category: QuestionCategory): PressOption[] {
  const tones: AnswerTone[] = ["diplomatic", "confident", "critical", "humble"];
  return tones.map((tone) => ({ id: tone, label: ANSWER_BANK[category][tone](ctx, locale), tone }));
}

// Tire `count` questions (3 ou 4) réparties sur des catégories différentes
// quand c'est possible, chacune avec les 4 tons de réponse disponibles,
// toutes injectées avec le contexte du dernier match joué.
export function generateQuestions(count: number, locale: Locale, ctx: PressGameContext): GeneratedQuestion[] {
  const categories = shuffledCategories();
  const questions: GeneratedQuestion[] = [];
  for (let i = 0; i < count; i++) {
    const category = categories[i % categories.length];
    const bank = QUESTION_BANK[category];
    const template = bank[Math.floor(Math.random() * bank.length)];
    questions.push({ prompt: template(ctx, locale), category, options: buildOptions(locale, ctx, category) });
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
