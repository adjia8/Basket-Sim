// Réactions aux déclarations du GM en conférence de presse — règles pures,
// sans accès base de données (voir data-access/press.ts).
//
// Après chaque conférence, trois publics réagissent à ce qui a été dit :
// - les JOUEURS : celui dont on a parlé réagit selon sa personnalité (le
//   sanguin répond dans les médias, le professionnel prend la critique comme
//   un défi, le susceptible demande à voir le coach) ; le leader du vestiaire
//   soutient le coach ou défend ses coéquipiers quand le groupe est visé ;
// - les MÉDIAS : chaque déclaration marquante est reprise et commentée selon
//   le style du journal (sensation, analyse, presse locale) ; la presse se
//   souvient aussi de tes conférences passées (coach fermé, sulfureux ou
//   respecté) ;
// - les FANS : ils réagissent sur les réseaux selon le contexte (promettre
//   le titre avec un bilan négatif fait rire, s'en prendre à la star du club
//   fâche, défendre l'équipe ou les remercier les touche) — ce qui pèse un
//   peu sur l'affluence.

import type { Locale } from "@/lib/i18n/locale";
import { lockerRoom, type Personality } from "./personality-rules";
import type { AnswerTone, JournalistStyle, PressEffects } from "./press-rules";

export interface AnsweredQuestion {
  topic: string | null;
  tone: AnswerTone;
  label: string;
  effects: PressEffects;
  playerId: string | null;
  outlet: string | null;
}

export interface ReactionPlayer {
  id: string;
  name: string;
  renown: number;
  overall?: number;
  age?: number;
  personality: Personality;
  hasPendingRequest: boolean;
}

export interface ReactionInput {
  locale: Locale;
  women: boolean;
  teamShortName: string;
  teamCity: string;
  winPct: number;
  gamesPlayed: number;
  answers: AnsweredQuestion[];
  skipped: boolean;
  roster: ReactionPlayer[];
  recentTones: AnswerTone[]; // attitudes choisies lors des conférences précédentes (plus récente d'abord)
  random?: () => number;
}

export type PlayerReactionKind =
  | "grateful"
  | "fired_up"
  | "public_reply"
  | "takes_it_well"
  | "wants_meeting"
  | "leader_backs_coach"
  | "leader_defends_group"
  | "leader_thanks";

export interface PlayerReaction {
  playerId: string;
  name: string;
  kind: PlayerReactionKind;
  quote: string;
  moraleDelta: number; // en plus de l'effet direct de la réponse
  squadMorale: number;
  publicOpinion: number;
  requestMeeting: boolean; // le joueur demande à parler au coach (voir player-requests.ts)
}

export type Stance = "praise" | "neutral" | "critical";

export interface MediaReaction {
  outlet: string;
  style: JournalistStyle;
  headline: string;
  stance: Stance;
}

export type FanMood = "love" | "support" | "mixed" | "angry" | "mock";

export interface FanReaction {
  handle: string;
  text: string;
  mood: FanMood;
}

export interface PressReactions {
  players: PlayerReaction[];
  media: MediaReaction[];
  fans: FanReaction[];
  mediaReputation: "closed" | "fiery" | "respected" | null; // ce que la presse retient de toi sur la durée
  fanMood: number; // -3 à +3
  effects: { publicOpinion: number; squadMorale: number; attendance: number };
}

const pick = <T>(items: T[], rnd: () => number): T => items[Math.floor(rnd() * items.length) % items.length];
const quoteOf = (label: string) => label.replace(/^[«"“\s]+|[»"”\s]+$/g, "").trim();

// ---------------------------------------------------------------------------
// Joueurs

function targetReaction(
  q: AnsweredQuestion,
  p: ReactionPlayer,
  input: ReactionInput,
  rnd: () => number
): PlayerReaction | null {
  const delta = q.effects.playerMorale ?? 0;
  if (Math.abs(delta) < 4) return null;
  const fr = input.locale === "fr";
  const base = { playerId: p.id, name: p.name, moraleDelta: 0, squadMorale: 0, publicOpinion: 0, requestMeeting: false };
  const pers = p.personality;
  if (delta > 0) {
    if (pers.ambition >= 14) {
      return {
        ...base,
        kind: "fired_up",
        quote: pick(
          fr
            ? ["Le coach croit en moi, je vais lui donner raison sur le terrain.", "Ce genre de mots, ça te donne envie d'en faire encore plus.", "Je veux aller chercher plus haut. Merci pour la confiance."]
            : ["Coach believes in me, I'll prove it right on the court.", "Words like that make you want to do even more.", "I want to reach higher. Thanks for the trust."],
          rnd
        ),
        moraleDelta: 1,
      };
    }
    return {
      ...base,
      kind: "grateful",
      quote: pick(
        fr
          ? ["Ça fait plaisir d'entendre ça. Je me sens bien ici.", "Merci au coach. On est une famille.", "C'est touchant. Je vais continuer à bosser."]
          : ["It feels good to hear that. I feel good here.", "Thanks to coach. We're a family.", "That means a lot. I'll keep working."],
        rnd
      ),
      moraleDelta: pers.loyalty >= 14 ? 1 : 0,
    };
  }
  // Critique publique.
  if (pers.temperament <= 6) {
    return {
      ...base,
      kind: "public_reply",
      quote: pick(
        fr
          ? ["Je n'ai pas de leçon à recevoir. Si le coach a un problème, qu'il vienne me le dire.", "Ce genre de choses se dit dans le vestiaire, pas devant les caméras.", "Je sais ce que je vaux. Je ne suis pas le problème de cette équipe."]
          : ["I don't need lessons. If coach has a problem, come tell me face to face.", "That kind of thing gets said in the locker room, not in front of cameras.", "I know what I'm worth. I'm not this team's problem."],
        rnd
      ),
      moraleDelta: -2,
      squadMorale: -1,
      publicOpinion: -1,
      requestMeeting: !p.hasPendingRequest,
    };
  }
  if (pers.professionalism >= 14) {
    return {
      ...base,
      kind: "takes_it_well",
      quote: pick(
        fr
          ? ["Le coach a raison, je dois être meilleur. Je vais répondre sur le terrain.", "Critique méritée. Je l'accepte et je travaille.", "Il attend beaucoup de moi, c'est normal."]
          : ["Coach is right, I have to be better. I'll answer on the court.", "Fair criticism. I accept it and I work.", "Coach expects a lot from me, that's normal."],
        rnd
      ),
      moraleDelta: 3,
      squadMorale: 1,
    };
  }
  return {
    ...base,
    kind: "wants_meeting",
    quote: fr ? "Je préfère ne rien dire. J'aimerais en parler avec le coach." : "I'd rather not say anything. I'd like to talk to coach about it.",
    requestMeeting: !p.hasPendingRequest,
  };
}

function leaderReaction(input: ReactionInput, squadDelta: number, refereeCriticism: boolean, exclude: Set<string>, rnd: () => number): PlayerReaction | null {
  // Le leader du vestiaire (voir lockerRoom) : une star, un des meilleurs
  // joueurs ou un vétéran reconnu, qui a aussi le tempérament d'un meneur.
  const room = lockerRoom(
    input.roster.map((p) => ({ id: p.id, age: p.age ?? 27, personality: p.personality, overall: p.overall, renown: p.renown }))
  );
  const leader = room.leaders.map((id) => input.roster.find((p) => p.id === id)!).find((p) => p && !exclude.has(p.id));
  if (!leader) return null;
  const fr = input.locale === "fr";
  const base = { playerId: leader.id, name: leader.name, moraleDelta: 0, squadMorale: 0, publicOpinion: 0, requestMeeting: false };
  if (squadDelta < 0) {
    if (leader.personality.professionalism >= 12) {
      return {
        ...base,
        kind: "leader_backs_coach",
        quote: pick(
          fr
            ? ["Le coach a dit ce qu'il fallait dire. À nous de réagir.", "Il a raison. On doit tous se regarder dans le miroir, moi le premier."]
            : ["Coach said what needed saying. It's on us to respond.", "He's right. We all need to look in the mirror, me first."],
          rnd
        ),
        squadMorale: 2,
      };
    }
    return {
      ...base,
      kind: "leader_defends_group",
      quote: pick(
        fr
          ? ["On se bat tous les soirs. Je défendrai toujours mes coéquipiers.", "Ce vestiaire ne mérite pas ça. On reste soudés."]
          : ["We fight every night. I'll always defend my teammates.", "This locker room doesn't deserve that. We stick together."],
        rnd
      ),
      publicOpinion: -1,
    };
  }
  if (squadDelta >= 2 || refereeCriticism) {
    return {
      ...base,
      kind: "leader_thanks",
      quote: refereeCriticism
        ? fr
          ? "Le coach nous a défendus. Ça, le vestiaire ne l'oublie pas."
          : "Coach stood up for us. The locker room won't forget that."
        : pick(fr ? ["On sent que le coach est avec nous. Ça compte.", "Le coach croit en ce groupe, et nous aussi."] : ["You can feel coach is with us. That matters.", "Coach believes in this group, and so do we."], rnd),
      squadMorale: 1,
    };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Médias

const OUTLETS: Record<JournalistStyle, string[]> = {
  tabloid: ["Hot Take Radio", "Buzzer Beat"],
  analyst: ["Courtside Daily", "Baseline Wire"],
  neutral: ["The Hoop Report", "Full Court Press", "Panier Plus"],
  local: [],
};

function styleOf(outlet: string | null, city: string): JournalistStyle {
  if (!outlet) return "neutral";
  if (outlet === `${city} Tribune`) return "local";
  for (const style of ["tabloid", "analyst", "neutral"] as JournalistStyle[]) if (OUTLETS[style].includes(outlet)) return style;
  return "neutral";
}

function mediaReaction(
  q: AnsweredQuestion,
  input: ReactionInput,
  name: string | null,
  rnd: () => number,
  used: Set<string>
): MediaReaction {
  const fr = input.locale === "fr";
  const team = input.teamShortName;
  const fx = q.effects;
  const quote = quoteOf(q.label);
  const short = quote.length > 70 ? `${quote.slice(0, 67).trimEnd()}…` : quote;
  // Le journal qui a posé la question reprend en général la déclaration ;
  // les déclarations fortes sont aussi relayées par la presse à sensation.
  const loud = q.tone === "aggressive" || fx.refereeCriticism || (fx.playerMorale ?? 0) <= -6;
  const style: JournalistStyle = loud && rnd() < 0.5 ? "tabloid" : styleOf(q.outlet, input.teamCity);
  // Un journal différent par article : le journal qui a posé la question
  // d'abord, puis un autre du même style, puis n'importe quel autre média.
  const sameStyle = [...OUTLETS[style]].sort(() => rnd() - 0.5);
  const preferred =
    style === "local" ? [`${input.teamCity} Tribune`] : q.outlet && styleOf(q.outlet, input.teamCity) === style ? [q.outlet, ...sameStyle] : sameStyle;
  const outlet =
    [...preferred, ...OUTLETS.neutral, ...OUTLETS.analyst, ...OUTLETS.tabloid].find((o) => !used.has(o)) ?? preferred[0];
  used.add(outlet);
  const record = input.winPct;

  let headline: string;
  let stance: Stance = fx.publicOpinion > 0 ? "praise" : fx.publicOpinion < 0 ? "critical" : "neutral";

  if (fx.refereeCriticism) {
    headline =
      style === "tabloid"
        ? fr ? `Le coach des ${team} déclare la guerre aux arbitres` : `${team} coach declares war on the refs`
        : fr ? `Critiques de l'arbitrage : les ${team} s'exposent à une amende` : `Officiating criticism could cost the ${team} a fine`;
    stance = style === "tabloid" ? "praise" : "critical";
  } else if (name && (fx.playerMorale ?? 0) <= -6) {
    headline =
      style === "tabloid"
        ? fr ? `Clash en vue : le coach des ${team} recadre ${name} en public` : `Trouble brewing: ${team} coach calls out ${name} in public`
        : fr ? `${name} recadré : un message fort, mais risqué` : `${name} called out: a strong message, but a risky one`;
    stance = "critical";
  } else if (name && (fx.playerMorale ?? 0) >= 6) {
    headline =
      style === "local"
        ? fr ? `Le coach encense ${name} : « ${short} »` : `Coach raves about ${name}: "${short}"`
        : fr ? `${name}, chouchou du coach des ${team}` : `${name}, the ${team} coach's favorite`;
    stance = "praise";
  } else if ((fx.squadMorale ?? 0) < 0) {
    headline = fr ? `Le coach des ${team} hausse le ton face à son vestiaire` : `${team} coach turns up the heat on the locker room`;
    stance = style === "tabloid" ? "praise" : "neutral";
  } else if (q.tone === "assertive" && (q.topic === "standings" || q.topic === "win_streak" || q.topic === "playoff_race") && record < 0.45) {
    headline = fr ? `Les ${team} visent haut… avec un bilan négatif` : `The ${team} aim high… with a losing record`;
    stance = "critical";
  } else if (q.topic === "tanking" && q.tone === "aggressive") {
    headline = fr ? `« Perdre exprès ? Jamais » : le coach des ${team} refuse de tanker` : `"Lose on purpose? Never": ${team} coach refuses to tank`;
    stance = "praise";
  } else if (q.topic === "trade_deadline" && q.tone === "assertive") {
    headline = fr ? `Date limite : les ${team} annoncent du mouvement` : `Deadline: the ${team} signal they're active`;
  } else if (q.topic === "contract_year" && name) {
    headline = fr ? `Avenir de ${name} : « ${short} »` : `${name}'s future: "${short}"`;
  } else if (q.topic === "attendance" && q.tone === "aggressive") {
    headline = fr ? `Prix des billets : le coach renvoie la balle à la direction` : `Ticket prices: coach passes the buck to the front office`;
    stance = "critical";
  } else if (q.tone === "reserved") {
    headline = fr ? `Langue de bois chez les ${team}` : `Stonewalling from the ${team}`;
    stance = "critical";
  } else if (q.tone === "passionate") {
    headline = style === "local" ? (fr ? `Le coach fait vibrer ${input.teamCity} : « ${short} »` : `Coach fires up ${input.teamCity}: "${short}"`) : fr ? `Les ${team} font bloc : « ${short} »` : `The ${team} close ranks: "${short}"`;
    stance = "praise";
  } else if (q.tone === "assertive") {
    headline = fr ? `Les ${team} affichent leurs ambitions : « ${short} »` : `The ${team} show their ambition: "${short}"`;
  } else {
    headline = fr ? `Un discours mesuré chez les ${team}` : `A measured message from the ${team}`;
  }
  return { outlet, style, headline, stance };
}

function reputation(tones: AnswerTone[]): PressReactions["mediaReputation"] {
  const window = tones.slice(0, 10);
  if (window.length < 6) return null;
  const share = (t: AnswerTone) => window.filter((x) => x === t).length / window.length;
  if (share("reserved") >= 0.5) return "closed";
  if (share("aggressive") >= 0.4) return "fiery";
  if (share("calm") + share("assertive") >= 0.7) return "respected";
  return null;
}

// ---------------------------------------------------------------------------
// Fans

function fanHandles(city: string, team: string): string[] {
  const c = city.replace(/[^A-Za-z]/g, "");
  const t = team.replace(/[^A-Za-z]/g, "");
  return [`@${t}Nation`, `@${c}Hoops`, `@AbonneSection112`, `@${t}Forever`, `@VieuxFan${c}`, `@CourtsideCritic`];
}

function fanReactions(input: ReactionInput, rnd: () => number): { fans: FanReaction[]; mood: number } {
  const fr = input.locale === "fr";
  const handles = fanHandles(input.teamCity, input.teamShortName);
  const posts: FanReaction[] = [];
  let mood = 0;
  const add = (m: FanMood, frText: string, enText: string, delta: number) => {
    posts.push({ handle: handles[posts.length % handles.length], text: fr ? frText : enText, mood: m });
    mood += delta;
  };
  if (input.skipped) {
    add("angry", "Même pas le courage de venir parler… On veut des réponses !", "Didn't even have the guts to show up… We want answers!", -1);
  }
  const star = [...input.roster].sort((a, b) => b.renown - a.renown)[0];
  for (const q of input.answers) {
    const fx = q.effects;
    const target = q.playerId ? input.roster.find((p) => p.id === q.playerId) : undefined;
    if (q.tone === "assertive" && (q.topic === "standings" || q.topic === "playoff_race" || q.topic === "win_streak") && input.winPct < 0.45 && input.gamesPlayed >= 10) {
      add("mock", `Le titre ? À ${Math.round(input.winPct * 100)} % de victoires ? 😂`, `The title? At a ${Math.round(input.winPct * 100)}% win rate? 😂`, -1);
    } else if (target && star && target.id === star.id && (fx.playerMorale ?? 0) <= -6) {
      add("angry", `On ne touche pas à ${target.name}. ${input.women ? "Elle" : "Il"} est le cœur de cette franchise.`, `Hands off ${target.name}. ${input.women ? "She's" : "He's"} the heart of this franchise.`, -2);
    } else if (target && (fx.playerMorale ?? 0) >= 6) {
      add("love", `Le coach qui défend ${target.name} 🙌`, `Coach backing ${target.name} 🙌`, 1);
    } else if (fx.refereeCriticism) {
      add("support", "ENFIN quelqu'un qui le dit ! Les arbitres nous ont volés.", "FINALLY someone says it! The refs robbed us.", 1);
    } else if (q.topic === "tanking" && q.tone === "aggressive") {
      add("mixed", "Respect pour l'état d'esprit… mais un top 3 à la draft, ça m'aurait pas dérangé.", "Respect the mindset… but a top-3 pick wouldn't have bothered me.", 0);
    } else if (q.topic === "attendance" && q.tone === "aggressive") {
      add("angry", "On paie nos places une fortune et on nous répond « pas mon rayon » ?", "We pay a fortune for seats and get told \"not my department\"?", -2);
    } else if (q.tone === "passionate" && (q.topic === "fans" || q.topic === "result" || q.topic === "season_opener" || q.topic === "series_over" || q.topic === "nba_cup")) {
      add("love", `${input.teamCity} est derrière vous ! 💜`, `${input.teamCity} is behind you! 💜`, 1);
    } else if ((fx.squadMorale ?? 0) <= -2 && input.winPct < 0.45 && input.gamesPlayed >= 5) {
      add("support", "Il était temps que quelqu'un secoue ce vestiaire.", "About time someone shook up that locker room.", 1);
    } else if ((fx.squadMorale ?? 0) <= -2 && input.winPct >= 0.55 && input.gamesPlayed >= 5) {
      add("mixed", "Pourquoi s'en prendre au groupe alors qu'on gagne ?", "Why go after the group when we're winning?", -1);
    }
  }
  const reserved = input.answers.filter((q) => q.tone === "reserved").length;
  if (!input.skipped && input.answers.length > 0 && reserved >= Math.ceil(input.answers.length / 2)) {
    add("mixed", "Encore une conférence pour rien dire…", "Another press conference saying nothing…", -1);
  }
  if (posts.length === 0 && !input.skipped) {
    add(
      input.winPct >= 0.5 ? "support" : "mixed",
      input.winPct >= 0.5 ? "Discours propre. Continuez comme ça." : "Des mots, c'est bien. Des victoires, c'est mieux.",
      input.winPct >= 0.5 ? "Solid message. Keep it up." : "Words are nice. Wins are better.",
      0
    );
  }
  // Mélange léger pour varier l'ordre, au plus 3 messages affichés.
  const shuffled = posts.map((p) => ({ p, k: rnd() })).sort((a, b) => a.k - b.k).map((x) => x.p);
  return { fans: shuffled.slice(0, 3), mood: Math.max(-3, Math.min(3, mood)) };
}

// ---------------------------------------------------------------------------

export function pressReactions(input: ReactionInput): PressReactions {
  const rnd = input.random ?? Math.random;
  const byId = new Map(input.roster.map((p) => [p.id, p]));

  const players: PlayerReaction[] = [];
  const reacted = new Set<string>();
  for (const q of input.answers) {
    const p = q.playerId ? byId.get(q.playerId) : undefined;
    if (!p || reacted.has(p.id)) continue;
    const r = targetReaction(q, p, input, rnd);
    if (r) {
      players.push(r);
      reacted.add(p.id);
    }
  }
  const squadDelta = input.answers.reduce((s, q) => s + (q.effects.squadMorale ?? 0), 0);
  const refs = input.answers.some((q) => q.effects.refereeCriticism);
  const leader = input.skipped ? null : leaderReaction(input, squadDelta, refs, reacted, rnd);
  if (leader) players.push(leader);

  // Les déclarations les plus fortes sont reprises (au plus 3 journaux).
  const strength = (q: AnsweredQuestion) =>
    Math.abs(q.effects.publicOpinion) + Math.abs(q.effects.playerMorale ?? 0) / 2 + Math.abs(q.effects.squadMorale ?? 0) + (q.effects.refereeCriticism ? 5 : 0) + (q.tone === "aggressive" ? 2 : 0);
  const usedOutlets = new Set<string>();
  const media = input.skipped
    ? [
        {
          outlet: "Buzzer Beat",
          style: "tabloid" as JournalistStyle,
          headline:
            input.locale === "fr"
              ? `Le GM des ${input.teamShortName} fuit les micros`
              : `${input.teamShortName} GM dodges the microphones`,
          stance: "critical" as Stance,
        },
      ]
    : [...input.answers]
        .sort((a, b) => strength(b) - strength(a))
        .slice(0, 3)
        .map((q) => mediaReaction(q, input, q.playerId ? byId.get(q.playerId)?.name ?? null : null, rnd, usedOutlets));

  const mediaReputation = reputation([...input.answers.map((q) => q.tone), ...input.recentTones]);
  const { fans, mood } = fanReactions(input, rnd);

  const publicOpinion =
    players.reduce((s, r) => s + r.publicOpinion, 0) +
    (mediaReputation === "closed" ? -2 : mediaReputation === "respected" ? 1 : 0) +
    Math.sign(mood);
  return {
    players,
    media,
    fans,
    mediaReputation,
    fanMood: mood,
    effects: {
      publicOpinion,
      squadMorale: players.reduce((s, r) => s + r.squadMorale, 0),
      attendance: mood,
    },
  };
}
