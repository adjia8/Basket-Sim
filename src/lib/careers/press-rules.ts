// Règles pures des conférences de presse, façon Football Manager — aucun
// accès base de données ici, tout est piloté par src/lib/data-access/press.ts.
//
// Principe :
// - les questions partent de l'ACTUALITÉ de l'équipe (dernier match, joueur
//   en feu ou en difficulté, blessure, demande de transfert, recrue, série,
//   playoffs, date limite des échanges…) plutôt que d'une banque générique ;
// - chaque question est posée par un journaliste (fictif) d'un média au
//   style marqué : les médias à sensation amplifient l'écho dans l'opinion ;
// - chaque réponse a une attitude (calme, affirmée, agressive, passionnée,
//   réservée) et des effets PROPRES à la question : moral de l'équipe,
//   opinion publique, relation avec la direction, moral du joueur visé ou de
//   tout le vestiaire, et critique de l'arbitrage (amendes de la ligue) ;
// - après la conférence, la presse retient un gros titre.
//
// Le texte (questions, réponses) est écrit dans la DB au moment de la
// génération, dans la langue de la requête qui déclenche la conférence — un
// peu comme un article de presse réel, figé à sa publication.

import type { Locale } from "@/lib/i18n/locale";
import { ordinalSuffix } from "@/lib/utils";

// Attitudes façon FM. Les 4 dernières sont celles de l'ancien système,
// conservées pour relire les conférences déjà en base.
export type AnswerTone =
  | "calm"
  | "assertive"
  | "aggressive"
  | "passionate"
  | "reserved"
  | "diplomatic"
  | "confident"
  | "critical"
  | "humble";
export type QuestionCategory = "results" | "roster" | "management" | "future";

export type PressTopic =
  | "result"
  | "blowout_win"
  | "blowout_loss"
  | "close_game"
  | "win_streak"
  | "losing_streak"
  | "star_performance"
  | "star_struggle"
  | "injury"
  | "trade_request"
  | "new_arrival"
  | "young_player"
  | "load_management"
  | "referees"
  | "opponent"
  | "standings"
  | "job_security"
  | "trade_deadline"
  | "playoff_series"
  | "fans"
  | "leader"
  | "rotation"
  | "locker_room"
  | "front_office";

export interface PressEffects {
  morale: number; // moral de l'équipe (TeamState.morale)
  publicOpinion: number;
  frontOfficeApproval: number;
  playerMorale?: number; // joueur visé par la question (PressQuestion.playerId)
  squadMorale?: number; // tout l'effectif
  refereeCriticism?: boolean; // critique publique de l'arbitrage
}

export interface PressOption {
  id: string;
  label: string;
  tone: AnswerTone;
  effects?: PressEffects; // absent sur les conférences de l'ancien système
}

export type JournalistStyle = "neutral" | "analyst" | "tabloid" | "local";

export interface GeneratedQuestion {
  prompt: string;
  category: QuestionCategory;
  topic: PressTopic;
  playerId?: string;
  journalist: string;
  outlet: string;
  options: PressOption[];
}

export interface PressPlayerRef {
  id: string;
  name: string;
}

// Contexte du dernier match + actualité de l'équipe. La partie « match »
// vient de simulate.ts (déjà en mémoire), la partie « actualité » (demande
// de transfert, recrue, série de playoffs, date limite) est ajoutée par
// data-access/press.ts.
export interface PressGameContext {
  teamName: string; // "Milwaukee Bucks"
  teamShortName: string; // "Bucks"
  teamCity: string; // "Milwaukee"
  women?: boolean; // WNBA : accords au féminin (joueuses, elle/she)
  opponentName: string;
  won: boolean;
  teamScore: number;
  opponentScore: number;
  wins: number;
  losses: number;
  streak: string; // "W3" / "L2" / "-", voir computeStreak dans standings.ts
  rank: number; // 1-based
  leagueSize: number;
  topPerformer?: PressPlayerRef & { points: number; rebounds: number; assists: number };
  strugglingStar?: PressPlayerRef & { points: number };
  injury?: PressPlayerRef & { label: string; gamesOut: number; severity: "minor" | "moderate" | "severe" };
  youngPlayer?: PressPlayerRef & { age: number; points: number };
  wornPlayer?: PressPlayerRef;
  tradeRequester?: PressPlayerRef;
  newArrival?: PressPlayerRef;
  playoffSeries?: { teamWins: number; opponentWins: number };
  tradeDeadlineDays?: number;
}

// ---------------------------------------------------------------------------
// Journalistes (fictifs)

interface Journalist {
  name: string;
  outlet: string;
  style: JournalistStyle;
}

const JOURNALISTS: Journalist[] = [
  { name: "Claire Morin", outlet: "Courtside Daily", style: "analyst" },
  { name: "Sofia Reyes", outlet: "Baseline Wire", style: "analyst" },
  { name: "Dave Kessler", outlet: "The Hoop Report", style: "neutral" },
  { name: "Marcus Bell", outlet: "Full Court Press", style: "neutral" },
  { name: "Julien Lefort", outlet: "Panier Plus", style: "neutral" },
  { name: "Tony Vance", outlet: "Hot Take Radio", style: "tabloid" },
  { name: "Eddie Grant", outlet: "Buzzer Beat", style: "tabloid" },
];

function localJournalist(city: string): Journalist {
  return { name: "Rachel Owens", outlet: `${city} Tribune`, style: "local" };
}

// Les médias à sensation font plus de bruit : l'effet sur l'opinion publique
// (en bien comme en mal) est amplifié de 50 %.
function withStyle(effects: PressEffects, style: JournalistStyle): PressEffects {
  if (style !== "tabloid" || effects.publicOpinion === 0) return effects;
  const amplified = Math.sign(effects.publicOpinion) * Math.ceil(Math.abs(effects.publicOpinion) * 1.5);
  return { ...effects, publicOpinion: amplified };
}

// ---------------------------------------------------------------------------
// Sujets

interface TopicCandidate {
  topic: PressTopic;
  category: QuestionCategory;
  family?: "result" | "streak";
  priority: number; // plus c'est haut, plus la question a de chances d'être posée
  playerId?: string;
  preferredStyle?: JournalistStyle;
  prompts: string[];
  options: { tone: AnswerTone; label: string; effects: PressEffects }[];
}

type TopicBuilder = (ctx: PressGameContext, locale: Locale) => TopicCandidate | null;

const e = (
  morale: number,
  publicOpinion: number,
  frontOfficeApproval: number,
  extra: Partial<PressEffects> = {}
): PressEffects => ({ morale, publicOpinion, frontOfficeApproval, ...extra });

function tr(locale: Locale) {
  return (fr: string, en: string) => (locale === "fr" ? fr : en);
}

// Accord masculin / féminin selon la ligue (NBA / WNBA).
function gn(ctx: PressGameContext) {
  return (m: string, f: string) => (ctx.women ? f : m);
}

const margin = (ctx: PressGameContext) => ctx.teamScore - ctx.opponentScore;
const score = (ctx: PressGameContext) => `${ctx.teamScore}-${ctx.opponentScore}`;
const winPct = (ctx: PressGameContext) => (ctx.wins + ctx.losses === 0 ? 0.5 : ctx.wins / (ctx.wins + ctx.losses));
const rankLabel = (ctx: PressGameContext, locale: Locale) =>
  locale === "fr" ? `${ctx.rank}e` : `${ctx.rank}${ordinalSuffix(ctx.rank, locale)}`;

function streakCount(ctx: PressGameContext, kind: "W" | "L"): number {
  if (ctx.streak[0] !== kind) return 0;
  const n = Number(ctx.streak.slice(1));
  return Number.isFinite(n) ? n : 0;
}

const result: TopicBuilder = (ctx, locale) => {
  const t = tr(locale);
  const g = gn(ctx);
  return {
    topic: "result",
    category: "results",
    family: "result",
    priority: 35,
    preferredStyle: "analyst",
    prompts: [
      t(
        `Vous venez de ${ctx.won ? "battre" : "vous incliner face à"} ${ctx.opponentName} ${score(ctx)} : comment expliquez-vous ce résultat ?`,
        `You just ${ctx.won ? "beat" : "lost to"} ${ctx.opponentName} ${score(ctx)}: how do you explain that result?`
      ),
      t(
        `Quel est le principal enseignement de ce match contre ${ctx.opponentName} ?`,
        `What's the main takeaway from that game against ${ctx.opponentName}?`
      ),
    ],
    options: ctx.won
      ? [
          {
            tone: "calm",
            label: t(
              "« Le groupe a fait ce qu'on lui demandait. On reste concentrés sur le prochain match. »",
              `"The group did what we asked. We stay focused on the next game."`
            ),
            effects: e(1, 1, 1),
          },
          {
            tone: "assertive",
            label: t(
              `« On a montré ce dont on est capables face à ${ctx.opponentName}, et ce n'est qu'un début. »`,
              `"We showed what we're capable of against ${ctx.opponentName}, and this is only the beginning."`
            ),
            effects: e(2, 2, 0),
          },
          {
            tone: "passionate",
            label: t(
              "« Je suis fier de ce groupe, il s'est battu sur chaque possession ! »",
              `"I'm proud of this group — they fought on every possession!"`
            ),
            effects: e(2, 1, 0, { squadMorale: 2 }),
          },
          {
            tone: "reserved",
            label: t("« Une victoire, rien de plus. Il reste beaucoup de travail. »", `"It's a win, nothing more. There's a lot of work left."`),
            effects: e(0, 0, 1),
          },
        ]
      : [
          {
            tone: "calm",
            label: t(
              `« ${ctx.opponentName} a mieux joué ce soir. On va analyser la vidéo et corriger. »`,
              `"${ctx.opponentName} played better tonight. We'll watch the film and fix it."`
            ),
            effects: e(1, 1, 1),
          },
          {
            tone: "assertive",
            label: t(
              "« Cette défaite ne reflète pas notre niveau. On va réagir très vite. »",
              `"That loss doesn't reflect our level. We'll respond very quickly."`
            ),
            effects: winPct(ctx) < 0.4 ? e(1, -1, -1) : e(1, 1, 0),
          },
          {
            tone: "aggressive",
            label: t(
              `« C'est inacceptable. ${g("Certains joueurs", "Certaines joueuses")} doivent se regarder dans le miroir. »`,
              `"That's unacceptable. Some players need to take a long look in the mirror."`
            ),
            effects: e(-2, 1, 2, { squadMorale: -3 }),
          },
          {
            tone: "reserved",
            label: t("« Pas grand-chose à dire. On doit être meilleurs. »", `"Not much to say. We have to be better."`),
            effects: e(0, -1, 0),
          },
        ],
  };
};

const blowout: TopicBuilder = (ctx, locale) => {
  const m = margin(ctx);
  if (Math.abs(m) < 20) return null;
  const t = tr(locale);
  const g = gn(ctx);
  if (m > 0) {
    return {
      topic: "blowout_win",
      category: "results",
      family: "result",
      priority: 65,
      prompts: [
        t(
          `Victoire de ${m} points contre ${ctx.opponentName} : votre équipe vient-elle d'envoyer un message à toute la ligue ?`,
          `A ${m}-point win over ${ctx.opponentName}: did your team just send a message to the whole league?`
        ),
      ],
      options: [
        {
          tone: "assertive",
          label: t(
            "« Oui. On veut que tout le monde sache qu'il faudra compter avec nous. »",
            `"Yes. We want everyone to know they'll have to reckon with us."`
          ),
          effects: e(2, 3, 1),
        },
        {
          tone: "calm",
          label: t("« C'est un match. On ne s'enflamme pas. »", `"It's one game. We're not getting carried away."`),
          effects: e(1, 1, 1),
        },
        {
          tone: "passionate",
          label: t(
            "« Ce soir, on a joué notre basket. Les fans méritaient ça ! »",
            `"Tonight we played our brand of basketball. The fans deserved that!"`
          ),
          effects: e(2, 3, 0, { squadMorale: 1 }),
        },
        {
          tone: "reserved",
          label: t(
            `« ${ctx.opponentName} n'était pas dans un grand soir. Ne tirons pas de conclusions. »`,
            `"${ctx.opponentName} had an off night. Let's not draw conclusions."`
          ),
          effects: e(0, 0, 1),
        },
      ],
    };
  }
  return {
    topic: "blowout_loss",
    category: "results",
    family: "result",
    priority: 70,
    preferredStyle: "tabloid",
    prompts: [
      t(
        `Défaite de ${-m} points face à ${ctx.opponentName} : est-ce le pire match de votre équipe cette saison ?`,
        `A ${-m}-point loss to ${ctx.opponentName}: is that your team's worst game this season?`
      ),
      t(`Comment expliquer une telle correction (${score(ctx)}) ?`, `How do you explain a beating like that (${score(ctx)})?`),
    ],
    options: [
      {
        tone: "calm",
        label: t(
          "« Une soirée sans. On assume, on analyse et on passe à autre chose. »",
          `"An off night. We own it, we analyze it and we move on."`
        ),
        effects: e(1, 0, 1),
      },
      {
        tone: "aggressive",
        label: t(
          "« C'était indigne de ce maillot. Il y aura des conséquences. »",
          `"That was unworthy of this jersey. There will be consequences."`
        ),
        effects: e(-2, 2, 2, { squadMorale: -3 }),
      },
      {
        tone: "assertive",
        label: t(
          `« Je prends la responsabilité. ${g("Mes joueurs n'ont", "Mes joueuses n'ont")} rien à se reprocher. »`,
          `"I take responsibility. My players have nothing to blame themselves for."`
        ),
        effects: e(3, 1, -2, { squadMorale: 2 }),
      },
      {
        tone: "reserved",
        label: t("« Je n'ai pas d'explication pour l'instant. »", `"I don't have an explanation right now."`),
        effects: e(-1, -2, -1),
      },
    ],
  };
};

const closeGame: TopicBuilder = (ctx, locale) => {
  if (Math.abs(margin(ctx)) > 3) return null;
  const t = tr(locale);
  const g = gn(ctx);
  const top = ctx.topPerformer;
  if (ctx.won) {
    return {
      topic: "close_game",
      category: "results",
      family: "result",
      priority: 60,
      playerId: top?.id,
      prompts: [
        t(
          `Victoire arrachée face à ${ctx.opponentName} (${score(ctx)}) : qu'est-ce qui a fait la différence dans le money time ?`,
          `A hard-fought win over ${ctx.opponentName} (${score(ctx)}): what made the difference down the stretch?`
        ),
      ],
      options: [
        ...(top
          ? [
              {
                tone: "passionate" as const,
                label: t(
                  `« ${top.name} a été énorme dans les moments chauds. C'est ${g("un vrai compétiteur", "une vraie compétitrice")}. »`,
                  `"${top.name} was huge in the big moments. ${g("He", "She")}'s a real competitor."`
                ),
                effects: e(1, 1, 0, { playerMorale: 6 }),
              },
            ]
          : []),
        {
          tone: "calm",
          label: t(
            "« Notre défense sur les dernières possessions. On a été solides collectivement. »",
            `"Our defense on the last possessions. We were solid as a group."`
          ),
          effects: e(2, 1, 1, { squadMorale: 1 }),
        },
        {
          tone: "assertive",
          label: t("« Notre sang-froid. Cette équipe sait gagner les matchs serrés. »", `"Our composure. This team knows how to win close games."`),
          effects: e(2, 2, 0),
        },
        {
          tone: "reserved",
          label: t("« Un peu de chance aussi. Ça aurait pu basculer de l'autre côté. »", `"Some luck too. It could have gone the other way."`),
          effects: e(0, 0, 1),
        },
      ],
    };
  }
  return {
    topic: "close_game",
    category: "results",
    family: "result",
    priority: 60,
    prompts: [
      t(
        `Défaite d'un rien face à ${ctx.opponentName} (${score(ctx)}) : quel sentiment domine ce soir ?`,
        `A narrow loss to ${ctx.opponentName} (${score(ctx)}): what's the main feeling tonight?`
      ),
    ],
    options: [
      {
        tone: "calm",
        label: t("« De la frustration, mais il y a beaucoup de positif à retenir. »", `"Frustration, but there's a lot of positives to take."`),
        effects: e(1, 1, 1),
      },
      {
        tone: "aggressive",
        label: t(
          "« De la colère. Certaines décisions arbitrales en fin de match étaient incompréhensibles. »",
          `"Anger. Some of the officiating calls at the end were baffling."`
        ),
        effects: e(2, 1, -1, { refereeCriticism: true }),
      },
      {
        tone: "passionate",
        label: t(
          "« On a tout donné. Ce groupe a du cœur, les victoires vont venir. »",
          `"We gave everything. This group has heart — the wins will come."`
        ),
        effects: e(2, 2, 0, { squadMorale: 1 }),
      },
      {
        tone: "reserved",
        label: t("« On a manqué les tirs qu'il fallait mettre. C'est tout. »", `"We missed the shots we needed to make. That's it."`),
        effects: e(0, 0, 1),
      },
    ],
  };
};

const winStreak: TopicBuilder = (ctx, locale) => {
  const n = streakCount(ctx, "W");
  if (n < 4) return null;
  const t = tr(locale);
  const contender = winPct(ctx) >= 0.6;
  return {
    topic: "win_streak",
    category: "future",
    family: "streak",
    priority: 55 + n * 2,
    prompts: [t(`${n} victoires de suite : jusqu'où peut aller cette équipe ?`, `${n} straight wins: how far can this team go?`)],
    options: [
      {
        tone: "assertive",
        label: t("« Aussi loin qu'on le décidera. On joue pour le titre. »", `"As far as we decide. We're playing for the title."`),
        effects: contender ? e(2, 3, 1) : e(2, 1, -2),
      },
      {
        tone: "calm",
        label: t("« On prend match après match. La série ne veut rien dire en soi. »", `"We take it game by game. The streak doesn't mean anything by itself."`),
        effects: e(1, 1, 1),
      },
      {
        tone: "passionate",
        label: t("« Le vestiaire vit quelque chose de spécial en ce moment. »", `"The locker room is living something special right now."`),
        effects: e(2, 1, 0, { squadMorale: 2 }),
      },
      {
        tone: "reserved",
        label: t(
          "« Il faut rester humbles. Tout peut aller très vite dans l'autre sens. »",
          `"We have to stay humble. Things can turn the other way very quickly."`
        ),
        effects: e(0, 0, 1),
      },
    ],
  };
};

const losingStreak: TopicBuilder = (ctx, locale) => {
  const n = streakCount(ctx, "L");
  if (n < 3) return null;
  const t = tr(locale);
  const g = gn(ctx);
  return {
    topic: "losing_streak",
    category: "results",
    family: "streak",
    priority: 60 + n * 3,
    preferredStyle: "tabloid",
    prompts: [
      t(`${n} défaites de suite : la crise est-elle ouverte ?`, `${n} straight losses: is this a crisis?`),
      t(`Le vestiaire vous a-t-il lâché après ${n} défaites de suite ?`, `Has the locker room turned on you after ${n} straight losses?`),
    ],
    options: [
      {
        tone: "calm",
        label: t(
          "« Ce n'est pas une crise, c'est une mauvaise passe. On travaille pour en sortir. »",
          `"It's not a crisis, it's a rough patch. We're working our way out of it."`
        ),
        effects: e(1, 0, 1),
      },
      {
        tone: "assertive",
        label: t(
          "« Je garde toute ma confiance en ce groupe. On va s'en sortir ensemble. »",
          `"I keep my full trust in this group. We'll get out of this together."`
        ),
        effects: e(2, 1, -1, { squadMorale: 2 }),
      },
      {
        tone: "aggressive",
        label: t(
          `« Si ça continue, ${g("certains", "certaines")} vont perdre leur place. Personne n'est intouchable. »`,
          `"If this continues, some guys will lose their spot. Nobody is untouchable."`
        ),
        effects: e(-2, 1, 2, { squadMorale: -2 }),
      },
      {
        tone: "reserved",
        label: t("« Je ne vais pas épiloguer. Les réponses se donnent sur le terrain. »", `"I won't dwell on it. The answers come on the court."`),
        effects: e(0, -1, 0),
      },
    ],
  };
};

const starPerformance: TopicBuilder = (ctx, locale) => {
  const top = ctx.topPerformer;
  if (!top || top.points < 30) return null;
  const t = tr(locale);
  const g = gn(ctx);
  const line = t(
    `${top.points} points, ${top.rebounds} rebonds et ${top.assists} passes`,
    `${top.points} points, ${top.rebounds} rebounds and ${top.assists} assists`
  );
  return {
    topic: "star_performance",
    category: "roster",
    priority: 55 + (top.points - 30) * 2,
    playerId: top.id,
    prompts: [
      t(
        `${top.name} a terminé avec ${line} : est-ce ${g("le meilleur joueur", "la meilleure joueuse")} de la ligue en ce moment ?`,
        `${top.name} finished with ${line}: is ${g("he", "she")} the best player in the league right now?`
      ),
      t(
        `${line} pour ${top.name} ce soir. Que vous inspire une telle performance ?`,
        `${line} for ${top.name} tonight. What do you make of a performance like that?`
      ),
    ],
    options: [
      {
        tone: "passionate",
        label: t(
          `« Pour moi, c'est ${g("le meilleur joueur", "la meilleure joueuse")} de la ligue en ce moment. Personne ne joue à ce niveau. »`,
          `"For me, ${g("he", "she")}'s the best player in the league right now. Nobody is playing at this level."`
        ),
        effects: e(1, 2, 0, { playerMorale: 8 }),
      },
      {
        tone: "calm",
        label: t(
          `« ${g("Il", "Elle")} a fait un grand match, mais c'est le collectif qui gagne. »`,
          `"${g("He", "She")} had a great game, but it's the team that wins."`
        ),
        effects: e(2, 1, 0, { playerMorale: 3, squadMorale: 1 }),
      },
      {
        tone: "assertive",
        label: t(
          `« ${g("Il", "Elle")} mérite d'être All-Star, et je le dirai à qui veut l'entendre. »`,
          `"${g("He", "She")} deserves to be an All-Star, and I'll tell anyone who listens."`
        ),
        effects: e(1, 1, 0, { playerMorale: 10 }),
      },
      {
        tone: "reserved",
        label: t(
          `« C'est son travail. On attend ça ${g("de lui", "d'elle")} tous les soirs. »`,
          `"That's ${g("his", "her")} job. We expect that from ${g("him", "her")} every night."`
        ),
        effects: e(0, 0, 1, { playerMorale: -3 }),
      },
    ],
  };
};

const starStruggle: TopicBuilder = (ctx, locale) => {
  const star = ctx.strugglingStar;
  if (!star) return null;
  const t = tr(locale);
  const g = gn(ctx);
  return {
    topic: "star_struggle",
    category: "roster",
    priority: 62,
    playerId: star.id,
    preferredStyle: "tabloid",
    prompts: [
      t(
        `${star.name} a été ${g("discret", "discrète")} ce soir (${star.points} points). Est-${g("il", "elle")} en méforme ?`,
        `${star.name} was quiet tonight (${star.points} points). Is ${g("he", "she")} out of form?`
      ),
    ],
    options: [
      {
        tone: "calm",
        label: t(
          `« Je n'ai aucun doute sur ${g("lui", "elle")}. ${g("Il", "Elle")} a tout mon soutien. »`,
          `"I have no doubts about ${g("him", "her")}. ${g("He", "She")} has my full support."`
        ),
        effects: e(1, 0, 0, { playerMorale: 6 }),
      },
      {
        tone: "assertive",
        label: t(
          `« ${g("Il", "Elle")} répondra présent au prochain match, j'en suis certain. »`,
          `"${g("He", "She")}'ll answer the bell next game, I'm certain of it."`
        ),
        effects: e(0, 1, 0, { playerMorale: 4 }),
      },
      {
        tone: "aggressive",
        label: t(
          `« ${g("Il", "Elle")} doit en faire plus. On attend beaucoup plus ${g("de lui", "d'elle")}. »`,
          `"${g("He", "She")} has to do more. We expect a lot more from ${g("him", "her")}."`
        ),
        effects: e(-1, 1, 1, { playerMorale: -10 }),
      },
      {
        tone: "reserved",
        label: t("« Tout le monde peut avoir un soir sans. On passe à la suite. »", `"Everyone can have an off night. We move on."`),
        effects: e(0, 0, 0, { playerMorale: 1 }),
      },
    ],
  };
};

const injury: TopicBuilder = (ctx, locale) => {
  const inj = ctx.injury;
  if (!inj || inj.severity === "minor") return null;
  const t = tr(locale);
  const g = gn(ctx);
  const longTerm = inj.gamesOut >= 30;
  return {
    topic: "injury",
    category: "roster",
    priority: inj.severity === "severe" ? 90 : 75,
    playerId: inj.id,
    prompts: [
      longTerm
        ? t(
            `${inj.name} souffre d'une ${inj.label.toLowerCase()} et pourrait manquer une grande partie de la saison. Comment l'équipe va-t-elle s'en remettre ?`,
            `${inj.name} has a ${inj.label.toLowerCase()} and could miss much of the season. How will the team recover?`
          )
        : t(
            `${inj.name} est ${g("sorti blessé", "sortie blessée")} (${inj.label.toLowerCase()}, environ ${inj.gamesOut} matchs d'absence). Quel impact pour l'équipe ?`,
            `${inj.name} got hurt (${inj.label.toLowerCase()}, about ${inj.gamesOut} games out). What's the impact for the team?`
          ),
    ],
    options: [
      {
        tone: "calm",
        label: t(
          "« C'est un coup dur, mais l'effectif est profond. D'autres vont saisir leur chance. »",
          `"It's a blow, but the roster is deep. Others will seize their chance."`
        ),
        effects: e(1, 1, 1, { squadMorale: 1 }),
      },
      {
        tone: "passionate",
        label: t(
          `« On va gagner pour ${g("lui", "elle")}. Ce groupe va se resserrer. »`,
          `"We'll win for ${g("him", "her")}. This group will pull together."`
        ),
        effects: e(3, 2, 0, { playerMorale: 4 }),
      },
      {
        tone: "aggressive",
        label: t(
          `« Avec ce calendrier, ce n'est pas une surprise. La ligue doit mieux protéger ${g("les joueurs", "les joueuses")}. »`,
          `"With this schedule, it's no surprise. The league has to protect players better."`
        ),
        effects: e(1, 1, -1),
      },
      {
        tone: "reserved",
        label: t("« On attend les examens complémentaires avant de s'exprimer. »", `"We'll wait for further tests before saying more."`),
        effects: e(0, 0, 1),
      },
    ],
  };
};

const tradeRequest: TopicBuilder = (ctx, locale) => {
  const p = ctx.tradeRequester;
  if (!p) return null;
  const t = tr(locale);
  const g = gn(ctx);
  return {
    topic: "trade_request",
    category: "management",
    priority: 80,
    playerId: p.id,
    preferredStyle: "tabloid",
    prompts: [
      t(
        `${p.name} a demandé à être ${g("transféré", "transférée")}. Va-t-${g("il", "elle")} partir ?`,
        `${p.name} has asked to be traded. Is ${g("he", "she")} leaving?`
      ),
      t(
        `On dit ${p.name} ${g("malheureux et désireux", "malheureuse et désireuse")} de partir. Que lui répondez-vous ?`,
        `${p.name} is said to be unhappy and wanting out. What's your response?`
      ),
    ],
    options: [
      {
        tone: "calm",
        label: t(
          `« On en discute en interne. Ça restera entre ${g("lui", "elle")} et nous. »`,
          `"We're discussing it internally. It stays between ${g("him", "her")} and us."`
        ),
        effects: e(1, 0, 1, { playerMorale: 3 }),
      },
      {
        tone: "assertive",
        label: t(
          `« ${g("Il", "Elle")} est sous contrat et ${g("il", "elle")} restera ici. Point final. »`,
          `"${g("He", "She")}'s under contract and ${g("he", "she")}'s staying. Period."`
        ),
        effects: e(1, 1, 1, { playerMorale: -6 }),
      },
      {
        tone: "reserved",
        label: t(
          `« Nous écouterons les offres, comme pour ${g("n'importe quel joueur", "n'importe quelle joueuse")}. »`,
          `"We'll listen to offers, like for any player."`
        ),
        effects: e(-2, -1, 0, { playerMorale: 5, squadMorale: -1 }),
      },
      {
        tone: "aggressive",
        label: t(
          `« Personne n'est plus grand que le club. ${g("S'il veut partir, qu'il vienne", "Si elle veut partir, qu'elle vienne")} me le dire en face. »`,
          `"Nobody is bigger than the club. If ${g("he", "she")} wants out, ${g("he", "she")} can tell me to my face."`
        ),
        effects: e(-1, 2, 1, { playerMorale: -12 }),
      },
    ],
  };
};

const newArrival: TopicBuilder = (ctx, locale) => {
  const p = ctx.newArrival;
  if (!p) return null;
  const t = tr(locale);
  const g = gn(ctx);
  return {
    topic: "new_arrival",
    category: "roster",
    priority: 58,
    playerId: p.id,
    preferredStyle: "local",
    prompts: [t(`Que va apporter ${p.name} à votre équipe ?`, `What will ${p.name} bring to your team?`)],
    options: [
      {
        tone: "passionate",
        label: t(
          "« Exactement le profil qu'on cherchait. Je suis ravi de l'avoir avec nous. »",
          `"Exactly the profile we were looking for. I'm thrilled to have ${g("him", "her")}."`
        ),
        effects: e(1, 1, 0, { playerMorale: 8 }),
      },
      {
        tone: "assertive",
        label: t(
          `« Avec ${g("lui", "elle")}, on a désormais l'effectif pour viser haut. »`,
          `"With ${g("him", "her")}, we now have the roster to aim high."`
        ),
        effects: e(1, 2, -1, { playerMorale: 5 }),
      },
      {
        tone: "calm",
        label: t(
          `« ${g("Il", "Elle")} va devoir trouver sa place, comme tout le monde. »`,
          `"${g("He", "She")}'ll have to find ${g("his", "her")} place, like everyone else."`
        ),
        effects: e(1, 0, 1),
      },
      {
        tone: "reserved",
        label: t("« On verra sur le terrain. »", `"We'll see on the court."`),
        effects: e(0, 0, 0, { playerMorale: -2 }),
      },
    ],
  };
};

const youngPlayer: TopicBuilder = (ctx, locale) => {
  const p = ctx.youngPlayer;
  if (!p) return null;
  const t = tr(locale);
  const g = gn(ctx);
  return {
    topic: "young_player",
    category: "roster",
    priority: 50,
    playerId: p.id,
    prompts: [
      t(
        `${p.name}, ${p.age} ans, a marqué ${p.points} points. Est-${g("il prêt", "elle prête")} pour un plus grand rôle ?`,
        `${p.name}, ${p.age}, scored ${p.points} points. Is ${g("he", "she")} ready for a bigger role?`
      ),
    ],
    options: [
      {
        tone: "passionate",
        label: t(
          `« ${g("Ce gamin", "Cette gamine")} a un avenir énorme. ${g("Il va devenir un grand joueur", "Elle va devenir une grande joueuse")}. »`,
          `"This kid has a huge future. ${g("He", "She")}'s going to be a great player."`
        ),
        effects: e(0, 2, 0, { playerMorale: 8 }),
      },
      {
        tone: "assertive",
        label: t("« Oui. Son temps de jeu va augmenter. »", `"Yes. ${g("His", "Her")} minutes are going up."`),
        effects: e(0, 1, 0, { playerMorale: 6, squadMorale: -1 }),
      },
      {
        tone: "calm",
        label: t(
          `« ${g("Il", "Elle")} progresse bien. On va continuer à ${g("le", "la")} faire grandir à son rythme. »`,
          `"${g("He", "She")}'s progressing well. We'll keep developing ${g("him", "her")} at ${g("his", "her")} own pace."`
        ),
        effects: e(1, 0, 1, { playerMorale: 3 }),
      },
      {
        tone: "reserved",
        label: t(
          `« ${g("Il", "Elle")} doit encore beaucoup travailler. Ne lui mettons pas trop de pression. »`,
          `"${g("He", "She")} still has a lot of work to do. Let's not put too much pressure on ${g("him", "her")}."`
        ),
        effects: e(0, 0, 1, { playerMorale: -2 }),
      },
    ],
  };
};

const loadManagement: TopicBuilder = (ctx, locale) => {
  const p = ctx.wornPlayer;
  if (!p) return null;
  const t = tr(locale);
  const g = gn(ctx);
  return {
    topic: "load_management",
    category: "roster",
    priority: 48,
    playerId: p.id,
    preferredStyle: "analyst",
    prompts: [
      t(
        `${p.name} semble ${g("émoussé", "émoussée")}. Allez-vous ${g("le", "la")} ménager ?`,
        `${p.name} looks worn down. Will you rest ${g("him", "her")}?`
      ),
    ],
    options: [
      {
        tone: "calm",
        label: t(
          "« On gère sa charge avec le staff médical. La saison est longue. »",
          `"We manage ${g("his", "her")} workload with the medical staff. It's a long season."`
        ),
        effects: e(0, 0, 1, { playerMorale: 2 }),
      },
      {
        tone: "passionate",
        label: t("« Sa santé passe avant tout. Je ne prendrai aucun risque. »", `"${g("His", "Her")} health comes first. I won't take any risks."`),
        effects: e(0, -1, 1, { playerMorale: 4 }),
      },
      {
        tone: "assertive",
        label: t(
          `« ${g("Il jouera. Les grands joueurs", "Elle jouera. Les grandes joueuses")} jouent les grands matchs. »`,
          `"${g("He", "She")}'ll play. Great players play the big games."`
        ),
        effects: e(0, 2, 0, { playerMorale: 1 }),
      },
      {
        tone: "reserved",
        label: t("« On verra au jour le jour. »", `"We'll take it day by day."`),
        effects: e(0, 0, 0),
      },
    ],
  };
};

const referees: TopicBuilder = (ctx, locale) => {
  if (ctx.won || margin(ctx) < -10) return null;
  const t = tr(locale);
  const g = gn(ctx);
  return {
    topic: "referees",
    category: "results",
    priority: 40,
    preferredStyle: "tabloid",
    prompts: [
      t("Certaines décisions arbitrales vous ont-elles coûté ce match ?", "Did some officiating decisions cost you this game?"),
    ],
    options: [
      {
        tone: "aggressive",
        label: t(
          "« Clairement. L'arbitrage a été catastrophique ce soir, tout le monde l'a vu. »",
          `"Clearly. The officiating was a disaster tonight, everyone saw it."`
        ),
        effects: e(2, 2, -2, { squadMorale: 1, refereeCriticism: true }),
      },
      {
        tone: "passionate",
        label: t(
          `« ${g("Mes joueurs", "Mes joueuses")} méritaient plus de respect sur certaines actions. »`,
          `"My players deserved more respect on some plays."`
        ),
        effects: e(2, 1, -1, { refereeCriticism: true }),
      },
      {
        tone: "calm",
        label: t(
          "« Les arbitres ont un métier difficile. On ne perd pas à cause d'eux. »",
          `"Referees have a hard job. We didn't lose because of them."`
        ),
        effects: e(0, 1, 2),
      },
      {
        tone: "reserved",
        label: t("« Je ne commenterai pas l'arbitrage. »", `"I won't comment on the officiating."`),
        effects: e(0, 0, 1),
      },
    ],
  };
};

const opponent: TopicBuilder = (ctx, locale) => {
  const t = tr(locale);
  return {
    topic: "opponent",
    category: "results",
    priority: 28,
    prompts: [
      t(
        `Que pensez-vous de ${ctx.opponentName} ? Peuvent-ils jouer les premiers rôles ?`,
        `What do you make of ${ctx.opponentName}? Can they contend?`
      ),
    ],
    options: [
      {
        tone: "calm",
        label: t("« C'est une très bonne équipe, bien coachée. Respect à eux. »", `"They're a very good, well-coached team. Respect to them."`),
        effects: e(0, 1, 1),
      },
      {
        tone: "aggressive",
        label: ctx.won
          ? t("« Ils sont surcotés. On l'a montré ce soir. »", `"They're overrated. We showed it tonight."`)
          : t("« On les reverra. Et ce sera une autre histoire. »", `"We'll see them again. And it'll be a different story."`),
        effects: ctx.won ? e(2, 1, -1) : e(2, -1, -1),
      },
      {
        tone: "assertive",
        label: t(
          "« Ils sont bons, mais nous sommes meilleurs quand on joue notre basket. »",
          `"They're good, but we're better when we play our game."`
        ),
        effects: e(1, 1, 0),
      },
      {
        tone: "reserved",
        label: t("« Je me concentre sur mon équipe. »", `"I'm focused on my own team."`),
        effects: e(0, 0, 0),
      },
    ],
  };
};

const standings: TopicBuilder = (ctx, locale) => {
  if (ctx.wins + ctx.losses < 5) return null;
  const t = tr(locale);
  const top = ctx.rank <= Math.ceil(ctx.leagueSize / 6);
  return {
    topic: "standings",
    category: "future",
    priority: 30,
    preferredStyle: "analyst",
    prompts: [
      t(
        `${ctx.teamName} pointe à la ${rankLabel(ctx, locale)} place sur ${ctx.leagueSize}, avec ${ctx.wins}-${ctx.losses}. Quel est votre objectif cette saison ?`,
        `${ctx.teamName} sit ${rankLabel(ctx, locale)} out of ${ctx.leagueSize} at ${ctx.wins}-${ctx.losses}. What's your goal this season?`
      ),
    ],
    options: [
      {
        tone: "assertive",
        label: t("« Le titre. Rien d'autre ne m'intéresse. »", `"The title. Nothing else interests me."`),
        effects: top ? e(1, 2, 1) : e(1, 1, -2),
      },
      {
        tone: "calm",
        label: t("« Les playoffs, puis on verra. Chaque chose en son temps. »", `"The playoffs, then we'll see. One thing at a time."`),
        effects: e(0, 1, 1),
      },
      {
        tone: "passionate",
        label: t("« Rendre ces fans fiers. Ils le méritent. »", `"Making these fans proud. They deserve it."`),
        effects: e(1, 3, 0),
      },
      {
        tone: "reserved",
        label: t("« Progresser chaque semaine. Le classement suivra. »", `"Getting better every week. The standings will follow."`),
        effects: e(0, -1, 1),
      },
    ],
  };
};

const jobSecurity: TopicBuilder = (ctx, locale) => {
  if (ctx.wins + ctx.losses < 10 || winPct(ctx) >= 0.4) return null;
  const t = tr(locale);
  return {
    topic: "job_security",
    category: "management",
    priority: 55,
    preferredStyle: "tabloid",
    prompts: [
      t(`Avec un bilan de ${ctx.wins}-${ctx.losses}, craignez-vous pour votre poste ?`, `With a ${ctx.wins}-${ctx.losses} record, do you fear for your job?`),
    ],
    options: [
      {
        tone: "calm",
        label: t("« Je fais mon travail. La direction sait où on va. »", `"I do my job. The front office knows where we're headed."`),
        effects: e(0, 0, 1),
      },
      {
        tone: "assertive",
        label: t("« Non. J'ai un plan et je vais le mener au bout. »", `"No. I have a plan and I'll see it through."`),
        effects: e(1, 1, 1),
      },
      {
        tone: "aggressive",
        label: t(
          "« Je n'ai pas eu les moyens de mes ambitions. Je l'ai dit en interne. »",
          `"I haven't been given the means to match my ambitions. I've said so internally."`
        ),
        effects: e(-1, 1, -3),
      },
      {
        tone: "reserved",
        label: t("« Ce n'est pas à moi d'en décider. »", `"That's not for me to decide."`),
        effects: e(0, -1, 0),
      },
    ],
  };
};

const tradeDeadline: TopicBuilder = (ctx, locale) => {
  const days = ctx.tradeDeadlineDays;
  if (days === undefined || days < 0 || days > 10) return null;
  const t = tr(locale);
  const g = gn(ctx);
  return {
    topic: "trade_deadline",
    category: "future",
    priority: 57,
    preferredStyle: "analyst",
    prompts: [
      t(
        `La date limite des échanges approche (${days} jour${days > 1 ? "s" : ""}). Allez-vous bouger ?`,
        `The trade deadline is near (${days} day${days > 1 ? "s" : ""}). Will you make a move?`
      ),
    ],
    options: [
      {
        tone: "assertive",
        label: t(
          "« On est actifs. Si une opportunité se présente, on la saisira. »",
          `"We're active. If an opportunity comes up, we'll take it."`
        ),
        effects: e(-1, 2, 1, { squadMorale: -1 }),
      },
      {
        tone: "passionate",
        label: t(
          `« J'ai confiance en ${g("ces joueurs. Ce sont eux", "ces joueuses. Ce sont elles")} qui vont nous emmener loin. »`,
          `"I believe in these players. They're the ones who'll take us far."`
        ),
        effects: e(2, 0, -1, { squadMorale: 2 }),
      },
      {
        tone: "calm",
        label: t(
          "« On est satisfaits de notre groupe, mais on reste attentifs. »",
          `"We're happy with our group, but we're keeping our eyes open."`
        ),
        effects: e(1, 0, 1),
      },
      {
        tone: "reserved",
        label: t("« Je ne parle jamais du marché en public. »", `"I never talk about the market in public."`),
        effects: e(0, 0, 1),
      },
    ],
  };
};

const playoffSeries: TopicBuilder = (ctx, locale) => {
  const s = ctx.playoffSeries;
  if (!s) return null;
  const t = tr(locale);
  const state =
    s.teamWins > s.opponentWins
      ? t(`Vous menez ${s.teamWins}-${s.opponentWins}`, `You lead ${s.teamWins}-${s.opponentWins}`)
      : s.teamWins < s.opponentWins
        ? t(`Vous êtes menés ${s.teamWins}-${s.opponentWins}`, `You trail ${s.teamWins}-${s.opponentWins}`)
        : t(`Égalité ${s.teamWins}-${s.opponentWins}`, `Tied ${s.teamWins}-${s.opponentWins}`);
  const behind = s.teamWins < s.opponentWins;
  return {
    topic: "playoff_series",
    category: "future",
    priority: 85,
    prompts: [
      t(
        `${state} dans la série face à ${ctx.opponentName}. Comment abordez-vous la suite ?`,
        `${state} in the series against ${ctx.opponentName}. How are you approaching what's next?`
      ),
    ],
    options: [
      {
        tone: "assertive",
        label: behind
          ? t("« Ce n'est pas fini. On va revenir dans cette série. »", `"It's not over. We'll come back in this series."`)
          : t("« On va finir le travail. »", `"We're going to finish the job."`),
        effects: e(2, 2, 0),
      },
      {
        tone: "passionate",
        label: t(
          "« Ce groupe ne lâchera rien. Nos fans vont nous pousser ! »",
          `"This group won't give an inch. Our fans will carry us!"`
        ),
        effects: e(2, 2, 0, { squadMorale: 2 }),
      },
      {
        tone: "calm",
        label: t(
          "« Un match à la fois. Les playoffs, c'est une affaire d'ajustements. »",
          `"One game at a time. The playoffs are all about adjustments."`
        ),
        effects: e(1, 1, 1),
      },
      {
        tone: "aggressive",
        label: t(`« ${ctx.opponentName} commence à douter. On le sent. »`, `"${ctx.opponentName} are starting to doubt. We can feel it."`),
        effects: behind ? e(1, -1, -1) : e(1, 1, -1),
      },
    ],
  };
};

const fans: TopicBuilder = (ctx, locale) => {
  const t = tr(locale);
  return {
    topic: "fans",
    category: "future",
    priority: 20,
    preferredStyle: "local",
    prompts: [
      t(`Quel message souhaitez-vous adresser aux fans de ${ctx.teamCity} ?`, `What message would you like to send to the fans in ${ctx.teamCity}?`),
    ],
    options: [
      {
        tone: "passionate",
        label: t(
          "« Merci. Votre énergie nous porte, continuez à remplir la salle ! »",
          `"Thank you. Your energy carries us — keep filling the arena!"`
        ),
        effects: e(1, 3, 0),
      },
      {
        tone: "calm",
        label: t("« Restez derrière nous. On travaille dur pour vous. »", `"Stay with us. We're working hard for you."`),
        effects: e(0, 2, 0),
      },
      {
        tone: "assertive",
        label: t("« Préparez-vous à de grandes soirées. »", `"Get ready for some big nights."`),
        effects: winPct(ctx) >= 0.5 ? e(1, 2, 0) : e(0, 1, -1),
      },
      {
        tone: "reserved",
        label: t("« Le terrain parlera pour nous. »", `"The court will speak for us."`),
        effects: e(0, 0, 0),
      },
    ],
  };
};


// Meilleur marqueur d'un match ordinaire (20-29 points) : un mot sur lui
// suffit à le motiver… ou à le vexer.
const leader: TopicBuilder = (ctx, locale) => {
  const top = ctx.topPerformer;
  if (!top || top.points < 20 || top.points >= 30) return null;
  const t = tr(locale);
  const g = gn(ctx);
  return {
    topic: "leader",
    category: "roster",
    priority: 32,
    playerId: top.id,
    prompts: [
      t(
        `${top.name} a terminé ${g("meilleur marqueur", "meilleure marqueuse")} avec ${top.points} points. Que pensez-vous de sa saison ?`,
        `${top.name} led the team with ${top.points} points. What do you make of ${g("his", "her")} season?`
      ),
    ],
    options: [
      {
        tone: "passionate",
        label: t(
          `« ${g("Il", "Elle")} est le cœur de cette équipe. Je ne l'échangerais contre personne. »`,
          `"${g("He", "She")}'s the heart of this team. I wouldn't trade ${g("him", "her")} for anyone."`
        ),
        effects: e(0, 1, 0, { playerMorale: 7 }),
      },
      {
        tone: "calm",
        label: t(
          `« ${g("Il", "Elle")} est régulier et fait les bons choix. C'est précieux. »`,
          `"${g("He", "She")}'s consistent and makes the right decisions. That's valuable."`
        ),
        effects: e(1, 0, 1, { playerMorale: 3 }),
      },
      {
        tone: "assertive",
        label: t(
          `« ${g("Il", "Elle")} peut encore passer un cap. Je vais ${g("le", "la")} pousser pour ça. »`,
          `"${g("He", "She")} can still take another step. I'll push ${g("him", "her")} to get there."`
        ),
        effects: e(0, 1, 1, { playerMorale: -2 }),
      },
      {
        tone: "reserved",
        label: t("« Je ne parle pas des individualités. »", `"I don't talk about individuals."`),
        effects: e(0, 0, 0, { playerMorale: -1 }),
      },
    ],
  };
};

const rotation: TopicBuilder = (ctx, locale) => {
  const t = tr(locale);
  const g = gn(ctx);
  return {
    topic: "rotation",
    category: "roster",
    priority: 26,
    prompts: [
      t(
        "Peut-on s'attendre à des changements dans la rotation prochainement ?",
        "Should we expect changes to the rotation soon?"
      ),
      t(
        `Certain${g("s joueurs", "es joueuses")} semblent frustré${g("s", "es")} de leur temps de jeu. Un commentaire ?`,
        "Some players seem frustrated with their playing time. Any comment?"
      ),
    ],
    options: [
      {
        tone: "calm",
        label: t(
          "« Chacun connaît son rôle. Le temps de jeu se gagne à l'entraînement. »",
          `"Everyone knows their role. Minutes are earned in practice."`
        ),
        effects: e(1, 0, 1),
      },
      {
        tone: "assertive",
        label: t(
          "« Oui. Ceux qui ne répondent pas présent laisseront leur place. »",
          `"Yes. Those who don't step up will lose their spot."`
        ),
        effects: e(-1, 1, 2, { squadMorale: -1 }),
      },
      {
        tone: "passionate",
        label: t(
          "« Tout le monde aura sa chance. J'ai besoin de chacun pour aller loin. »",
          `"Everyone will get their chance. I need every single one of them to go far."`
        ),
        effects: e(2, 0, 0, { squadMorale: 2 }),
      },
      {
        tone: "reserved",
        label: t("« Ces décisions se prennent en interne. »", `"Those decisions are made internally."`),
        effects: e(0, 0, 0),
      },
    ],
  };
};

const lockerRoom: TopicBuilder = (ctx, locale) => {
  const t = tr(locale);
  return {
    topic: "locker_room",
    category: "roster",
    priority: 24,
    preferredStyle: "tabloid",
    prompts: [
      t(
        `Comment décririez-vous l'ambiance dans le vestiaire, avec ce bilan de ${ctx.wins}-${ctx.losses} ?`,
        `How would you describe the mood in the locker room, at ${ctx.wins}-${ctx.losses}?`
      ),
    ],
    options: [
      {
        tone: "passionate",
        label: t(
          "« C'est une famille. Ce groupe vit bien, et ça se voit sur le terrain. »",
          `"It's a family. This group gets along, and it shows on the court."`
        ),
        effects: e(1, 1, 0, { squadMorale: 2 }),
      },
      {
        tone: "calm",
        label: t("« Studieuse. Tout le monde est concentré sur le travail. »", `"Focused. Everyone is locked in on the work."`),
        effects: e(1, 0, 1),
      },
      {
        tone: "aggressive",
        label: t(
          "« Trop confortable à mon goût. J'attends plus d'exigence de la part de tous. »",
          `"Too comfortable for my liking. I expect more from everyone."`
        ),
        effects: e(-1, 1, 2, { squadMorale: -2 }),
      },
      {
        tone: "reserved",
        label: t("« Ce qui se passe dans le vestiaire reste dans le vestiaire. »", `"What happens in the locker room stays in the locker room."`),
        effects: e(0, -1, 1),
      },
    ],
  };
};

const frontOffice: TopicBuilder = (ctx, locale) => {
  const t = tr(locale);
  return {
    topic: "front_office",
    category: "management",
    priority: 24,
    prompts: [
      t(
        `La direction vous soutient-elle pleinement, alors que ${ctx.teamName} pointe à la ${rankLabel(ctx, locale)} place ?`,
        `Does the front office fully back you, with ${ctx.teamName} sitting ${rankLabel(ctx, locale)}?`
      ),
      t(
        "Les investissements dans les infrastructures et le staff sont-ils suffisants ?",
        "Is the investment in facilities and staff enough?"
      ),
    ],
    options: [
      {
        tone: "calm",
        label: t(
          "« J'ai une relation professionnelle et respectueuse avec la direction. On avance dans le même sens. »",
          `"I have a professional, respectful relationship with the front office. We're moving in the same direction."`
        ),
        effects: e(0, 0, 2),
      },
      {
        tone: "assertive",
        label: t(
          "« La direction me fait confiance et je le leur rends bien. On construit quelque chose de solide. »",
          `"The front office trusts me and I trust them back. We're building something solid."`
        ),
        effects: e(1, 1, 1),
      },
      {
        tone: "aggressive",
        label: t(
          "« Il faudra investir davantage si le club veut vraiment jouer les premiers rôles. »",
          `"The club will have to invest more if it really wants to contend."`
        ),
        effects: e(1, 2, -3),
      },
      {
        tone: "reserved",
        label: t("« Ces discussions restent internes. »", `"Those discussions stay internal."`),
        effects: e(0, 0, 1),
      },
    ],
  };
};

const TOPIC_BUILDERS: TopicBuilder[] = [
  result,
  blowout,
  closeGame,
  winStreak,
  losingStreak,
  starPerformance,
  starStruggle,
  injury,
  tradeRequest,
  newArrival,
  youngPlayer,
  loadManagement,
  referees,
  opponent,
  standings,
  jobSecurity,
  tradeDeadline,
  playoffSeries,
  fans,
  leader,
  rotation,
  lockerRoom,
  frontOffice,
];

// Clé d'un sujet, pour éviter de reposer la même question d'une conférence à
// l'autre (sujet + joueur visé).
export function topicKey(topic: string, playerId?: string | null): string {
  return playerId ? `${topic}:${playerId}` : topic;
}

// Gros événement : la presse veut une réaction (conférence quasi certaine).
export function isMajorPressEvent(ctx: PressGameContext): boolean {
  return Boolean(
    (ctx.injury && ctx.injury.severity !== "minor") ||
      (ctx.topPerformer && ctx.topPerformer.points >= 35) ||
      Math.abs(margin(ctx)) >= 25 ||
      streakCount(ctx, "W") >= 5 ||
      streakCount(ctx, "L") >= 4 ||
      ctx.tradeRequester
  );
}

export const PRESS_CONFERENCE_COOLDOWN_DAYS = 6;
export const PLAYOFF_PRESS_CONFERENCE_COOLDOWN_DAYS = 2;
export const PRESS_CONFERENCE_CHANCE = 0.25; // par match joué, une fois le cooldown passé
export const MAJOR_EVENT_PRESS_CONFERENCE_CHANCE = 0.75;
export const PLAYOFF_PRESS_CONFERENCE_CHANCE = 0.6;

export function pressConferenceChance(ctx: PressGameContext): number {
  if (ctx.playoffSeries) return PLAYOFF_PRESS_CONFERENCE_CHANCE;
  return isMajorPressEvent(ctx) ? MAJOR_EVENT_PRESS_CONFERENCE_CHANCE : PRESS_CONFERENCE_CHANCE;
}

function pickJournalist(preferred: JournalistStyle | undefined, used: Set<string>, city: string): Journalist {
  const pool = [...JOURNALISTS, localJournalist(city)].filter((j) => !used.has(j.name));
  const matching = preferred ? pool.filter((j) => j.style === preferred) : [];
  const source = matching.length > 0 && Math.random() < 0.75 ? matching : pool;
  const chosen = source[Math.floor(Math.random() * source.length)] ?? localJournalist(city);
  used.add(chosen.name);
  return chosen;
}

// Choisit `count` sujets dans l'actualité de l'équipe : les événements
// marquants passent en priorité (avec un peu d'aléa pour varier), au plus
// une question « résultat » et une question « série », jamais un sujet
// déjà traité récemment (`avoid`, voir topicKey). La question sur le
// résultat du match ouvre toujours la conférence quand il y en a une.
export function generateQuestions(
  count: number,
  locale: Locale,
  ctx: PressGameContext,
  avoid: Set<string> = new Set()
): GeneratedQuestion[] {
  const candidates = TOPIC_BUILDERS.map((build) => build(ctx, locale))
    .filter((c): c is TopicCandidate => c !== null)
    .filter((c) => !avoid.has(topicKey(c.topic, c.playerId)))
    .map((c) => ({ c, score: c.priority + Math.random() * 25 }))
    .sort((a, b) => b.score - a.score);

  const picked: TopicCandidate[] = [];
  const families = new Set<string>();
  for (const { c } of candidates) {
    if (picked.length >= count) break;
    if (c.family && families.has(c.family)) continue;
    if (c.family) families.add(c.family);
    picked.push(c);
  }
  picked.sort((a, b) => (a.family === "result" ? -1 : b.family === "result" ? 1 : 0));

  const used = new Set<string>();
  return picked.map((c) => {
    const journalist = pickJournalist(c.preferredStyle, used, ctx.teamCity);
    return {
      prompt: c.prompts[Math.floor(Math.random() * c.prompts.length)],
      category: c.category,
      topic: c.topic,
      playerId: c.options.some((o) => o.effects.playerMorale) ? c.playerId : undefined,
      journalist: journalist.name,
      outlet: journalist.outlet,
      options: c.options.map((o, i) => ({
        id: `o${i}`,
        label: o.label,
        tone: o.tone,
        effects: withStyle(o.effects, journalist.style),
      })),
    };
  });
}

// ---------------------------------------------------------------------------
// Effets

// Ancien système (conférences générées avant la refonte, sans effets
// enregistrés sur les options) : effet dérivé du seul ton.
export function pressAnswerEffects(tone: AnswerTone, teamWinPct: number): PressEffects {
  const winning = teamWinPct >= 0.5;
  switch (tone) {
    case "diplomatic":
    case "calm":
      return e(1, 2, 1);
    case "confident":
    case "assertive":
      return winning ? e(3, 3, 1) : e(1, -2, -2);
    case "critical":
    case "aggressive":
      return e(-2, -1, 2);
    case "humble":
    case "reserved":
    case "passionate":
      return winning ? e(1, 1, 1) : e(2, 2, 2);
  }
}

// Envoyer son adjoint plutôt que de se présenter : aucune déclaration, mais
// les médias et les fans le remarquent.
export const SKIP_PRESS_EFFECTS: PressEffects = e(0, -2, 0);

// Amende de la ligue pour critiques répétées de l'arbitrage : la première
// critique de la saison passe, ensuite chaque nouvelle coûte plus cher.
export function refereeFine(leagueId: string, criticismsThisSeason: number): number {
  if (criticismsThisSeason < 2) return 0;
  const step = leagueId === "wnba" ? 5_000 : 25_000;
  const cap = leagueId === "wnba" ? 20_000 : 100_000;
  return Math.min(cap, step * (criticismsThisSeason - 1));
}

// ---------------------------------------------------------------------------
// Gros titre

const NEWSWORTHY_TONE: Partial<Record<AnswerTone, number>> = { aggressive: 4, passionate: 1, assertive: 1, critical: 3 };

function newsworthiness(option: PressOption): number {
  const fx = option.effects;
  const base = fx
    ? Math.abs(fx.morale) +
      Math.abs(fx.publicOpinion) +
      Math.abs(fx.frontOfficeApproval) +
      Math.abs(fx.playerMorale ?? 0) / 2 +
      Math.abs(fx.squadMorale ?? 0) +
      (fx.refereeCriticism ? 4 : 0)
    : 0;
  return base + (NEWSWORTHY_TONE[option.tone] ?? 0);
}

function shortQuote(label: string): string {
  const text = label.replace(/^[«"“\s]+|[»"”\s]+$/g, "").trim();
  // Première phrase, prolongée tant qu'elle est trop courte pour dire
  // quelque chose (« Clairement. » seul ne fait pas un titre).
  const sentences = text.split(/(?<=[.!?])\s+/);
  let quote = sentences[0] ?? text;
  for (let i = 1; i < sentences.length && quote.length < 30; i++) quote = `${quote} ${sentences[i]}`;
  return quote.length > 90 ? `${quote.slice(0, 87).trimEnd()}…` : quote;
}

// La presse retient la déclaration la plus forte de la conférence.
export function pressHeadline(locale: Locale, teamShortName: string, answers: PressOption[], skipped: boolean): string {
  if (skipped || answers.length === 0) {
    return locale === "fr"
      ? `${teamShortName} : le GM envoie son adjoint face aux médias`
      : `${teamShortName} GM sends an assistant to face the media`;
  }
  const best = answers.reduce((a, b) => (newsworthiness(b) > newsworthiness(a) ? b : a));
  const quote = shortQuote(best.label);
  return locale === "fr" ? `Le GM des ${teamShortName} : « ${quote} »` : `${teamShortName} GM: "${quote}"`;
}

// Petit modificateur de force d'équipe dérivé du moral, ajouté à la chimie
// transmise au moteur de simulation — même échelle que gmChemistryBonus
// (±3 autour de 50), aucune dénormalisation sur Player nécessaire.
export function moraleBonus(morale: number): number {
  return Math.round(((Math.max(0, Math.min(99, morale)) - 50) / 49) * 3);
}
