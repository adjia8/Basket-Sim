// Règles pures des causeries d'équipe, façon Football Manager — aucun accès
// base de données ici (voir data-access/simulate.ts et la page de match).
//
// Deux moments : avant le coup d'envoi, et à la mi-temps (selon le score).
// Le ton choisi est plus ou moins adapté à la situation (favori, outsider,
// large avance, retard…). La réaction des joueurs dépend de cette
// adéquation, de la motivation de l'entraîneur principal, du moral de
// l'équipe et d'une part d'imprévu. Elle donne un regain (ou une baisse) de
// concentration pour la mi-temps qui suit, et fait bouger un peu le moral.

export type TalkTone = "calm" | "encourage" | "demand" | "angry" | "praise" | "relaxed";

export const PREGAME_TONES: TalkTone[] = ["calm", "encourage", "demand", "relaxed"];
export const HALFTIME_TONES: TalkTone[] = ["calm", "encourage", "praise", "demand", "angry"];

export type PregameSituation = "favorite" | "even" | "underdog";
export type HalftimeSituation = "leading_big" | "leading" | "close" | "trailing" | "trailing_big";
export type TalkSituation = PregameSituation | HalftimeSituation;

export type TalkReaction = "fired_up" | "focused" | "indifferent" | "complacent" | "nervous" | "rebellious";

// Adéquation ton / situation (-2 à +2).
const AFFINITY: Record<TalkSituation, Partial<Record<TalkTone, number>>> = {
  // Avant-match
  favorite: { calm: 1, encourage: 0.5, demand: 1, relaxed: -1.5 }, // le piège : la suffisance
  even: { calm: 0.5, encourage: 1, demand: 0.5, relaxed: 0 },
  underdog: { calm: 0, encourage: 1.5, demand: -1, relaxed: 1 }, // pas de pression inutile
  // Mi-temps
  leading_big: { calm: 1, encourage: 0.5, praise: 0, demand: 1, angry: -1.5 },
  leading: { calm: 1, encourage: 1, praise: 0.5, demand: 0.5, angry: -1 },
  close: { calm: 0.5, encourage: 1, praise: -0.5, demand: 0.5, angry: -0.5 },
  trailing: { calm: 0, encourage: 0.5, praise: -1.5, demand: 1, angry: 0 },
  trailing_big: { calm: 0, encourage: 0.5, praise: -2, demand: 0.5, angry: 0.5 }, // la colère peut réveiller… ou braquer
};

// Une colère est un pari : plus de variance que les autres tons.
const TONE_VARIANCE: Partial<Record<TalkTone, number>> = { angry: 2.4, demand: 1.6 };
const DEFAULT_VARIANCE = 1.3;

export function pregameSituation(myStrength: number, theirStrength: number, isHome: boolean): PregameSituation {
  const diff = myStrength - theirStrength + (isHome ? 1.5 : -1.5);
  return diff >= 3 ? "favorite" : diff <= -3 ? "underdog" : "even";
}

export function halftimeSituation(myScore: number, theirScore: number): HalftimeSituation {
  const diff = myScore - theirScore;
  if (diff >= 10) return "leading_big";
  if (diff >= 4) return "leading";
  if (diff > -4) return "close";
  if (diff > -10) return "trailing";
  return "trailing_big";
}

export interface TalkOutcome {
  tone: TalkTone;
  situation: TalkSituation;
  reaction: TalkReaction;
  focus: number; // points sur la mi-temps qui suit (moteur de match)
  moraleDelta: number; // moral des joueurs de la rotation
}

const REACTION_EFFECTS: Record<TalkReaction, { focus: number; morale: number }> = {
  fired_up: { focus: 1.2, morale: 2 },
  focused: { focus: 0.6, morale: 1 },
  indifferent: { focus: 0, morale: 0 },
  complacent: { focus: -0.6, morale: 0 },
  nervous: { focus: -0.6, morale: -1 },
  rebellious: { focus: -1.2, morale: -2 },
};

// Réaction des joueurs : adéquation + motivation de l'entraîneur (±0,6) +
// moral de l'équipe (±0,4) + imprévu.
export function talkOutcome(
  tone: TalkTone,
  situation: TalkSituation,
  coachMotivation: number,
  teamMorale: number,
  random: () => number = Math.random
): TalkOutcome {
  const affinity = AFFINITY[situation][tone] ?? 0;
  const motivation = ((Math.max(0, Math.min(99, coachMotivation)) - 50) / 50) * 0.6;
  const morale = ((Math.max(0, Math.min(99, teamMorale)) - 50) / 50) * 0.4;
  const spread = TONE_VARIANCE[tone] ?? DEFAULT_VARIANCE;
  const luck = (random() + random() - 1) * spread;
  const score = affinity + motivation + morale + luck;
  const ahead = situation === "favorite" || situation === "leading" || situation === "leading_big";
  const reaction: TalkReaction =
    score >= 1.4
      ? "fired_up"
      : score >= 0.5
        ? "focused"
        : score > -0.5
          ? "indifferent"
          : score > -1.4
            ? ahead
              ? "complacent"
              : "nervous"
            : "rebellious";
  const effect = REACTION_EFFECTS[reaction];
  return { tone, situation, reaction, focus: effect.focus, moraleDelta: effect.morale };
}

// Causeries d'un match, enregistrées sur le match (Game.talksJson) pour
// l'équipe du GM qui l'a jouée.
export interface GameTalks {
  side: "home" | "away";
  pregame?: TalkOutcome;
  halftime?: TalkOutcome;
}

export function parseTalks(json: string | null | undefined): GameTalks | null {
  if (!json) return null;
  try {
    return JSON.parse(json) as GameTalks;
  } catch {
    return null;
  }
}

// Concentration appliquée par mi-temps : la causerie d'avant-match pèse sur
// la 1re mi-temps (et à moitié sur la 2e), celle de la mi-temps sur la 2e.
export function focusByHalf(talks: GameTalks | null): { first: number; second: number } {
  if (!talks) return { first: 0, second: 0 };
  const pre = talks.pregame?.focus ?? 0;
  const half = talks.halftime?.focus ?? 0;
  return { first: pre, second: pre / 2 + half };
}
