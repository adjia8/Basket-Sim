// Variété des conférences de presse — règles pures.
//
// Chaque sujet de press-rules.ts garde ses questions d'origine ; on y ajoute
// ici d'autres façons de les poser (dont certaines propres à la presse à
// sensation ou à la presse locale) et d'autres façons de formuler chaque
// réponse (même attitude, mêmes effets). Le tirage se fait dans
// generateQuestions : la même actualité ne donne plus deux fois de suite
// exactement la même conférence.

import type { Locale } from "@/lib/i18n/locale";
import type { AnswerTone, JournalistStyle, PressGameContext, PressTopic } from "./press-rules";
import { gn, margin, score, streakCount, tr, type TopicCandidate } from "./press-helpers";

interface Variants {
  prompts?: string[];
  stylePrompts?: Partial<Record<JournalistStyle, string[]>>;
  alt?: Partial<Record<AnswerTone, string[]>>;
}

type VariantBuilder = (ctx: PressGameContext, locale: Locale) => Variants;

const VARIANTS: Partial<Record<PressTopic, VariantBuilder>> = {
  result: (ctx, locale) => {
    const t = tr(locale);
    const g = gn(ctx);
    return ctx.won
      ? {
          prompts: [
            t(`${score(ctx)} contre ${ctx.opponentName} : qu'avez-vous le plus aimé ce soir ?`, `${score(ctx)} over ${ctx.opponentName}: what did you like most tonight?`),
            t("Victoire ce soir. Où ce match a-t-il basculé ?", "A win tonight. Where did this game turn?"),
            t(`Que retenez-vous de cette victoire face à ${ctx.opponentName} ?`, `What do you take from this win over ${ctx.opponentName}?`),
          ],
          stylePrompts: {
            local: [t(`La salle a vibré ce soir contre ${ctx.opponentName}. Un mot pour le public ?`, `The building was rocking tonight against ${ctx.opponentName}. A word for the crowd?`)],
            tabloid: [t("Victoire, mais était-ce vraiment convaincant ?", "A win, but was it really convincing?")],
          },
          alt: {
            calm: [t("« Du sérieux du début à la fin. C'est ce que je voulais voir. »", `"Focused from start to finish. That's what I wanted to see."`)],
            assertive: [t("« On a imposé notre rythme. Quand on joue comme ça, peu d'équipes suivent. »", `"We imposed our pace. When we play like that, few teams can keep up."`)],
            passionate: [t(`« ${g("Ces gars", "Ces filles")} ont tout laissé sur le parquet. Bravo à ${g("eux", "elles")} ! »`, `"They left everything on the floor. Hats off to them!"`)],
            reserved: [t("« On prend la victoire. On en reparlera après la vidéo. »", `"We'll take the win. We'll talk more after the film."`)],
          },
        }
      : {
          prompts: [
            t(`Défaite ${score(ctx)} face à ${ctx.opponentName} : qu'est-ce qui a manqué ?`, `A ${score(ctx)} loss to ${ctx.opponentName}: what was missing?`),
            t("À quel moment avez-vous perdu le fil de ce match ?", "When did you lose the thread of this game?"),
            t("Qu'allez-vous dire à votre groupe après cette défaite ?", "What will you tell your group after this loss?"),
          ],
          stylePrompts: {
            tabloid: [t("Encore une soirée à oublier. Vos joueurs étaient-ils concernés ?", "Another night to forget. Were your players even engaged?")],
            local: [t(`Les fans de ${ctx.teamCity} sont repartis déçus. Que leur dites-vous ?`, `${ctx.teamCity} fans went home disappointed. What do you tell them?`)],
          },
          alt: {
            calm: [t("« Il y a des choses à corriger, on le fera à froid, à la vidéo. »", `"There are things to fix; we'll do it calmly, on film."`)],
            assertive: [t("« On vaut mieux que ça et on va le montrer dès le prochain match. »", `"We're better than that and we'll show it next game."`)],
            aggressive: [t("« Trop d'erreurs, trop de laisser-aller. Ça ne passera pas deux fois. »", `"Too many mistakes, too much slack. That won't fly twice."`)],
            reserved: [t("« Une mauvaise soirée. Je n'ai rien à ajouter. »", `"A bad night. I have nothing to add."`)],
          },
        };
  },
  blowout_win: (ctx, locale) => {
    const t = tr(locale);
    const m = margin(ctx);
    return {
      prompts: [
        t(`+${m} ce soir : votre meilleur match de la saison ?`, `+${m} tonight: your best game of the season?`),
        t(`${ctx.opponentName} n'a jamais existé ce soir. Comment l'expliquez-vous ?`, `${ctx.opponentName} never showed up tonight. How do you explain it?`),
        t("Avez-vous pu faire tourner tout l'effectif grâce à l'écart ?", "Were you able to use the whole roster thanks to the margin?"),
      ],
      stylePrompts: { tabloid: [t(`Une correction de ${m} points : ${ctx.opponentName} doit-il avoir honte ?`, `A ${m}-point beatdown: should ${ctx.opponentName} be ashamed?`)] },
      alt: {
        calm: [t("« Belle soirée, mais on ne s'emballe pas. Demain, tout recommence. »", `"A nice night, but we won't get carried away. Tomorrow it starts over."`)],
        reserved: [t("« Les écarts comme ça arrivent. Ça ne dit pas grand-chose. »", `"Margins like that happen. It doesn't say much."`)],
      },
    };
  },
  blowout_loss: (ctx, locale) => {
    const t = tr(locale);
    const m = -margin(ctx);
    return {
      prompts: [
        t(`-${m} : votre équipe a-t-elle abandonné en cours de match ?`, `Down ${m}: did your team quit during the game?`),
        t("Que se passe-t-il quand votre équipe décroche comme ça ?", "What happens when your team falls apart like that?"),
      ],
      stylePrompts: { tabloid: [t("Humiliation ce soir. Les joueurs ont-ils lâché leur coach ?", "Humiliation tonight. Have the players quit on their coach?")] },
      alt: {
        calm: [t("« Un accident. On ne le transformera pas en habitude. »", `"An accident. We won't let it become a habit."`)],
        aggressive: [t("« Je ne veux plus jamais revoir ça. Plus jamais. »", `"I never want to see that again. Ever."`)],
      },
    };
  },
  close_game: (ctx, locale) => {
    const t = tr(locale);
    return {
      prompts: ctx.won
        ? [
            t("Encore un final à suspense. Vos nerfs tiennent le coup ?", "Another nail-biter. Are your nerves holding up?"),
            t(`Qui vouliez-vous avec le ballon sur la dernière possession ?`, `Who did you want with the ball on the last possession?`),
          ]
        : [
            t("Perdre d'un panier, c'est la pire façon de perdre ?", "Losing by a bucket: is that the worst way to lose?"),
            t("Referiez-vous le même choix sur la dernière possession ?", "Would you make the same call on the last possession?"),
          ],
      alt: {
        calm: ctx.won
          ? [t("« On a fait les bons choix au bon moment. Collectivement. »", `"We made the right decisions at the right time. As a group."`)]
          : [t("« Un ou deux détails. On les travaillera. »", `"One or two details. We'll work on them."`)],
        reserved: [t("« Ces matchs-là se jouent à pile ou face. »", `"Those games are coin flips."`)],
      },
    };
  },
  win_streak: (ctx, locale) => {
    const t = tr(locale);
    const n = streakCount(ctx, "W");
    return {
      prompts: [
        t(`${n} succès d'affilée : quel est le secret ?`, `${n} wins in a row: what's the secret?`),
        t("Cette série change-t-elle vos ambitions pour la saison ?", "Does this streak change your ambitions for the season?"),
        t(`Comment éviter le relâchement après ${n} victoires ?`, `How do you avoid complacency after ${n} wins?`),
      ],
      stylePrompts: { local: [t(`${ctx.teamCity} s'enflamme pour son équipe. Vous sentez l'engouement ?`, `${ctx.teamCity} is catching fire for this team. Do you feel the buzz?`)] },
      alt: {
        calm: [t("« On n'en parle pas dans le vestiaire. On prépare juste le prochain. »", `"We don't talk about it in the locker room. We just prepare for the next one."`)],
        passionate: [t("« Il y a une énergie folle dans ce groupe. Ça fait plaisir à voir. »", `"There's crazy energy in this group. It's a joy to see."`)],
      },
    };
  },
  losing_streak: (ctx, locale) => {
    const t = tr(locale);
    const n = streakCount(ctx, "L");
    return {
      prompts: [
        t(`Comment sortir de cette spirale de ${n} défaites ?`, `How do you break out of this ${n}-game slide?`),
        t("Allez-vous changer quelque chose dans le cinq de départ ?", "Will you change something in the starting lineup?"),
        t("Le moral est-il atteint après cette série ?", "Is morale hit after this run?"),
      ],
      stylePrompts: { tabloid: [t(`${n} revers de rang : votre place est-elle menacée ?`, `${n} straight defeats: is your job on the line?`)] },
      alt: {
        calm: [t("« On reste soudés et on travaille. La série s'arrêtera. »", `"We stay together and work. The streak will end."`)],
        reserved: [t("« Pas de grands discours. Du travail. »", `"No big speeches. Work."`)],
      },
    };
  },
  star_performance: (ctx, locale) => {
    const t = tr(locale);
    const g = gn(ctx);
    const p = ctx.topPerformer!;
    return {
      prompts: [
        t(`${p.points} points pour ${p.name}. ${g("L'aviez-vous déjà vu", "L'aviez-vous déjà vue")} aussi ${g("chaud", "chaude")} ?`, `${p.points} points for ${p.name}. Have you ever seen ${g("him", "her")} this hot?`),
        t(`À quel moment avez-vous compris que ${p.name} allait faire un grand match ?`, `When did you realize ${p.name} was going to have a big night?`),
      ],
      stylePrompts: { tabloid: [t(`${p.name} porte-t-${g("il", "elle")} cette équipe à ${g("lui", "elle")} ${g("seul", "seule")} ?`, `Is ${p.name} carrying this team alone?`)] },
      alt: {
        calm: [t("« Ses coéquipiers l'ont bien trouvé. C'est une performance collective aussi. »", `"Teammates found ${g("him", "her")} well. It's a team performance too."`)],
        reserved: [t(`« Bien. Maintenant, ${g("il", "elle")} doit le refaire. »`, `"Good. Now ${g("he", "she")} has to do it again."`)],
      },
    };
  },
  star_struggle: (ctx, locale) => {
    const t = tr(locale);
    const g = gn(ctx);
    const p = ctx.strugglingStar!;
    return {
      prompts: [
        t(`Qu'est-il arrivé à ${p.name} ce soir ?`, `What happened to ${p.name} tonight?`),
        t(`${p.points} points seulement pour ${p.name}. Un souci physique ?`, `Only ${p.points} points for ${p.name}. A physical issue?`),
      ],
      stylePrompts: { tabloid: [t(`${p.name} est-${g("il", "elle")} encore ${g("le patron", "la patronne")} de cette équipe ?`, `Is ${p.name} still the leader of this team?`)] },
      alt: {
        calm: [t(`« ${g("Il", "Elle")} a été très ${g("surveillé", "surveillée")}. Ça ouvre des espaces pour les autres. »`, `"${g("He", "She")} drew a lot of attention. That opens space for others."`)],
        aggressive: [t("« Ce n'était pas acceptable, et je le lui ai dit. »", `"That wasn't acceptable, and I told ${g("him", "her")}."`)],
      },
    };
  },
  injury: (ctx, locale) => {
    const t = tr(locale);
    const g = gn(ctx);
    const p = ctx.injury!;
    return {
      prompts: [
        t(`Avez-vous des nouvelles de ${p.name} ?`, `Any update on ${p.name}?`),
        t(`Qui va compenser l'absence de ${p.name} ?`, `Who will make up for ${p.name}'s absence?`),
        t(`L'absence de ${p.name} change-t-elle vos plans pour la saison ?`, `Does ${p.name}'s absence change your plans for the season?`),
      ],
      stylePrompts: { tabloid: [t(`${p.name} encore ${g("blessé", "blessée")} : ${g("est-il", "est-elle")} trop fragile ?`, `${p.name} hurt again: is ${g("he", "she")} too fragile?`)] },
      alt: {
        calm: [t("« L'effectif doit répondre présent. Chacun va devoir en faire un peu plus. »", `"The roster has to step up. Everyone will need to do a little more."`)],
        reserved: [t("« Laissons les médecins travailler. »", `"Let the doctors do their work."`)],
      },
    };
  },
  trade_request: (ctx, locale) => {
    const t = tr(locale);
    const p = ctx.tradeRequester!;
    return {
      prompts: [t(`La situation de ${p.name} perturbe-t-elle le vestiaire ?`, `Is ${p.name}'s situation disrupting the locker room?`)],
      alt: {
        calm: [t("« On gère ça calmement, en interne. Le groupe reste concentré. »", `"We're handling it calmly, internally. The group stays focused."`)],
      },
    };
  },
  new_arrival: (ctx, locale) => {
    const t = tr(locale);
    const g = gn(ctx);
    const p = ctx.newArrival!;
    return {
      prompts: [
        t(`Pourquoi avoir fait venir ${p.name} ?`, `Why did you bring in ${p.name}?`),
        t(`Quel rôle aura ${p.name} dans la rotation ?`, `What role will ${p.name} have in the rotation?`),
        t(`Comment ${p.name} s'intègre-t-${g("il", "elle")} au groupe ?`, `How is ${p.name} fitting in with the group?`),
      ],
      stylePrompts: { local: [t(`Un mot de bienvenue pour ${p.name} de la part de ${ctx.teamCity} ?`, `A welcome message for ${p.name} from ${ctx.teamCity}?`)] },
      alt: {
        calm: [t(`« ${g("Il", "Elle")} apprend nos systèmes. Ça prendra quelques matchs. »`, `"${g("He", "She")}'s learning our sets. It'll take a few games."`)],
      },
    };
  },
  young_player: (ctx, locale) => {
    const t = tr(locale);
    const g = gn(ctx);
    const p = ctx.youngPlayer!;
    return {
      prompts: [
        t(`${p.name} a impressionné ce soir. Jusqu'où peut-${g("il", "elle")} aller ?`, `${p.name} impressed tonight. How far can ${g("he", "she")} go?`),
        t(`${p.points} points à ${p.age} ans : faut-il en faire ${g("un titulaire", "une titulaire")} ?`, `${p.points} points at ${p.age}: should ${g("he", "she")} start?`),
      ],
      stylePrompts: { local: [t(`Les fans adorent déjà ${p.name}. Vous comprenez pourquoi ?`, `Fans already love ${p.name}. Do you see why?`)] },
      alt: {
        calm: [t(`« On ${g("le", "la")} protège. Chaque chose en son temps. »`, `"We're protecting ${g("him", "her")}. One step at a time."`)],
      },
    };
  },
  load_management: (ctx, locale) => {
    const t = tr(locale);
    const p = ctx.wornPlayer!;
    return {
      prompts: [
        t(`${p.name} enchaîne beaucoup de minutes. Craignez-vous la blessure ?`, `${p.name} is logging heavy minutes. Are you worried about an injury?`),
        t(`Faut-il mettre ${p.name} au repos sur le prochain match ?`, `Should ${p.name} sit the next game?`),
      ],
      alt: {
        reserved: [t("« On décidera avec le staff médical, au dernier moment. »", `"We'll decide with the medical staff, at the last minute."`)],
      },
    };
  },
  referees: (ctx, locale) => {
    const t = tr(locale);
    return {
      prompts: [
        t("Que pensez-vous de l'arbitrage ce soir ?", "What did you think of the officiating tonight?"),
        t("Le différentiel de lancers francs vous a-t-il surpris ?", "Did the free-throw differential surprise you?"),
      ],
      stylePrompts: { tabloid: [t("Volés par les arbitres ce soir ?", "Robbed by the refs tonight?")] },
      alt: {
        reserved: [t("« Je ne veux pas payer d'amende. Pas de commentaire. »", `"I don't want to pay a fine. No comment."`)],
        calm: [t("« Il y a eu des erreurs des deux côtés. Ça s'équilibre. »", `"There were mistakes both ways. It evens out."`)],
      },
    };
  },
  opponent: (ctx, locale) => {
    const t = tr(locale);
    return {
      prompts: [
        t(`${ctx.opponentName} vous a-t-il surpris ce soir ?`, `Did ${ctx.opponentName} surprise you tonight?`),
        t(`Comment aviez-vous préparé ce match contre ${ctx.opponentName} ?`, `How did you prepare for ${ctx.opponentName}?`),
        t(`Où situez-vous ${ctx.opponentName} dans la hiérarchie de la ligue ?`, `Where do you rank ${ctx.opponentName} in the league pecking order?`),
      ],
      alt: {
        calm: [t("« Une équipe solide, qui nous a posé des problèmes. »", `"A solid team that gave us problems."`)],
        reserved: [t("« Je ne parle pas des autres équipes. »", `"I don't talk about other teams."`)],
      },
    };
  },
  standings: (ctx, locale) => {
    const t = tr(locale);
    return {
      prompts: [
        t(`${ctx.rank}e de la ligue : est-ce votre vraie place ?`, `${ctx.rank}th in the league: is that where you belong?`),
        t(`Regardez-vous le classement, à ${ctx.wins}-${ctx.losses} ?`, `Do you look at the standings, at ${ctx.wins}-${ctx.losses}?`),
      ],
      alt: {
        calm: [t("« On veut être en playoffs en bonne santé. Le reste viendra. »", `"We want to be in the playoffs and healthy. The rest will come."`)],
        reserved: [t("« Le classement ne veut rien dire avant avril. »", `"The standings mean nothing before April."`)],
      },
    };
  },
  job_security: (ctx, locale) => {
    const t = tr(locale);
    return {
      prompts: [
        t("Avez-vous toujours la confiance des propriétaires ?", "Do you still have the owners' trust?"),
        t("Avez-vous eu une discussion avec la direction ces derniers jours ?", "Have you talked with the front office in the last few days?"),
      ],
      stylePrompts: { tabloid: [t("On dit votre successeur déjà contacté. Un commentaire ?", "Word is your successor has already been contacted. Any comment?")] },
      alt: {
        assertive: [t("« Je suis là pour longtemps. Le projet avance. »", `"I'm here for the long run. The project is moving forward."`)],
      },
    };
  },
  trade_deadline: (ctx, locale) => {
    const t = tr(locale);
    return {
      prompts: [
        t("Cherchez-vous un renfort avant la date limite ?", "Are you looking for reinforcements before the deadline?"),
        t("Votre téléphone sonne-t-il beaucoup en ce moment ?", "Is your phone ringing a lot these days?"),
      ],
      stylePrompts: { tabloid: [t("Qui va partir avant la date limite ?", "Who's leaving before the deadline?")] },
      alt: {
        reserved: [t("« Pas de commentaire sur les rumeurs. »", `"No comment on rumors."`)],
      },
    };
  },
  playoff_series: (ctx, locale) => {
    const t = tr(locale);
    return {
      prompts: [
        t(`Quels ajustements pour le prochain match contre ${ctx.opponentName} ?`, `What adjustments for the next game against ${ctx.opponentName}?`),
        t("Où se joue cette série selon vous ?", "Where is this series being decided, in your view?"),
      ],
      alt: {
        calm: [t("« On va regarder la vidéo et corriger deux ou trois choses. »", `"We'll watch the film and fix two or three things."`)],
      },
    };
  },
  fans: (ctx, locale) => {
    const t = tr(locale);
    return {
      prompts: [
        t("Ressentez-vous le soutien du public en ce moment ?", "Are you feeling the crowd's support these days?"),
        t(`Que représente ${ctx.teamCity} pour vous ?`, `What does ${ctx.teamCity} mean to you?`),
      ],
      alt: {
        passionate: [t(`« ${ctx.teamCity} mérite une équipe qui se bat. On sera cette équipe. »`, `"${ctx.teamCity} deserves a team that fights. We'll be that team."`)],
        calm: [t("« Merci pour la patience. On construit quelque chose. »", `"Thank you for your patience. We're building something."`)],
      },
    };
  },
  leader: (ctx, locale) => {
    const t = tr(locale);
    const g = gn(ctx);
    const p = ctx.topPerformer!;
    return {
      prompts: [
        t(`${p.name} est-${g("il", "elle")} ${g("le leader", "la leader")} de ce groupe ?`, `Is ${p.name} the leader of this group?`),
        t(`Que vous apporte ${p.name} au quotidien ?`, `What does ${p.name} bring you day to day?`),
      ],
      alt: {
        passionate: [t(`« ${g("Il", "Elle")} montre l'exemple tous les jours à l'entraînement. »`, `"${g("He", "She")} sets the example every day in practice."`)],
      },
    };
  },
  rotation: (ctx, locale) => {
    const t = tr(locale);
    return {
      prompts: [
        t("Votre cinq de départ est-il figé ?", "Is your starting five set in stone?"),
        t("Combien de joueurs comptez-vous utiliser en fin de saison ?", "How many players do you plan to use late in the season?"),
      ],
      alt: {
        calm: [t("« La rotation bouge selon les adversaires. C'est normal. »", `"The rotation shifts depending on the opponent. That's normal."`)],
      },
    };
  },
  locker_room: (ctx, locale) => {
    const t = tr(locale);
    return {
      prompts: [
        t("Y a-t-il des tensions dans le vestiaire ?", "Is there tension in the locker room?"),
        t("Qui sont les leaders de votre vestiaire ?", "Who are the leaders in your locker room?"),
      ],
      stylePrompts: { tabloid: [t("On parle d'une dispute à l'entraînement. Vrai ?", "There's talk of a fight at practice. True?")] },
      alt: {
        calm: [t("« Un groupe sain, qui se dit les choses. »", `"A healthy group that tells each other the truth."`)],
      },
    };
  },
  front_office: (ctx, locale) => {
    const t = tr(locale);
    return {
      prompts: [t("Êtes-vous en phase avec la direction sur le projet ?", "Are you aligned with the front office on the project?")],
      alt: {
        reserved: [t("« Je ne commente pas les affaires internes. »", `"I don't comment on internal matters."`)],
      },
    };
  },
};

// Autres formulations des réponses (mêmes attitude et effets que l'original).
type AltBuilder = (ctx: PressGameContext, locale: Locale) => Partial<Record<AnswerTone, string[]>>;

const MORE_ALTS: Partial<Record<PressTopic, AltBuilder>> = {
  blowout_win: (ctx, locale) => {
    const t = tr(locale);
    return {
      assertive: [t("« Ce soir, on a montré notre vrai niveau. Les autres sont prévenus. »", `"Tonight we showed our real level. Everyone's been warned."`)],
      passionate: [t("« Quel plaisir de jouer comme ça devant notre public ! »", `"What a joy to play like that in front of our crowd!"`)],
    };
  },
  blowout_loss: (ctx, locale) => {
    const t = tr(locale);
    const g = gn(ctx);
    return {
      assertive: [t(`« C'est ma faute, pas la leur. Je n'ai pas bien ${g("préparé mes joueurs", "préparé mes joueuses")}. »`, `"That's on me, not them. I didn't prepare my players well."`)],
      reserved: [t("« Il faut d'abord que je revoie le match. »", `"I need to watch the game again first."`)],
    };
  },
  close_game: (ctx, locale) => {
    const t = tr(locale);
    return {
      aggressive: [t("« Des coups de sifflet décisifs nous ont coûté cher. Tout le monde l'a vu. »", `"Key whistles cost us dearly. Everyone saw it."`)],
      passionate: ctx.won ? [] : [t("« Ce groupe ne lâche rien. Ça finira par tourner. »", `"This group never quits. It'll turn our way."`)],
    };
  },
  win_streak: (ctx, locale) => {
    const t = tr(locale);
    return {
      assertive: [t("« On se sent capables de battre n'importe qui. On vise tout en haut. »", `"We feel we can beat anyone. We're aiming for the top."`)],
      reserved: [t("« Rien n'est acquis. On a déjà vu des séries s'arrêter net. »", `"Nothing is guaranteed. We've seen streaks stop dead."`)],
    };
  },
  losing_streak: (ctx, locale) => {
    const t = tr(locale);
    const g = gn(ctx);
    return {
      assertive: [t("« Je crois en ce groupe plus que jamais. On va s'en sortir. »", `"I believe in this group more than ever. We'll get out of it."`)],
      aggressive: [t(`« Il va y avoir des changements. ${g("Ceux qui ne se battent pas", "Celles qui ne se battent pas")} ne joueront plus. »`, `"There will be changes. Those who don't fight won't play."`)],
    };
  },
  star_performance: (ctx, locale) => {
    const t = tr(locale);
    const g = gn(ctx);
    return {
      passionate: [t(`« Je n'ai jamais coaché ${g("un joueur pareil", "une joueuse pareille")}. Un talent rare. »`, `"I've never coached a player like that. A rare talent."`)],
      assertive: [t("« Je veux voir son nom sur la liste des All-Stars, et je vais le répéter. »", `"I want to see ${g("his", "her")} name on the All-Star list, and I'll keep saying it."`)],
    };
  },
  star_struggle: (ctx, locale) => {
    const t = tr(locale);
    const g = gn(ctx);
    return {
      assertive: [t(`« ${g("Il", "Elle")} va rebondir dès le prochain match. Je le connais. »`, `"${g("He", "She")}'ll bounce back next game. I know ${g("him", "her")}."`)],
      reserved: [t("« Un soir sans, ça arrive à tout le monde. »", `"An off night happens to everyone."`)],
    };
  },
  injury: (ctx, locale) => {
    const t = tr(locale);
    const g = gn(ctx);
    return {
      passionate: [t(`« Le groupe va se battre pour ${g("lui", "elle")}. On l'attend. »`, `"The group will fight for ${g("him", "her")}. We'll be waiting."`)],
      aggressive: [t(`« Avec autant de matchs rapprochés, les blessures étaient prévisibles. Il faut protéger ${g("les joueurs", "les joueuses")}. »`, `"With so many games packed together, injuries were predictable. Players need protecting."`)],
    };
  },
  trade_request: (ctx, locale) => {
    const t = tr(locale);
    const g = gn(ctx);
    return {
      assertive: [t(`« ${g("Il", "Elle")} a un contrat et on compte ${g("sur lui", "sur elle")}. Fin de l'histoire. »`, `"${g("He", "She")} has a contract and we're counting on ${g("him", "her")}. End of story."`)],
      reserved: [t("« Si une offre sérieuse arrive, on l'étudiera. »", `"If a serious offer comes in, we'll study it."`)],
      aggressive: [t("« Le club passe avant les états d'âme. Qu'on se parle en face. »", `"The club comes before moods. Let's talk face to face."`)],
    };
  },
  new_arrival: (ctx, locale) => {
    const t = tr(locale);
    const g = gn(ctx);
    return {
      passionate: [t(`« Je ${g("le", "la")} voulais depuis longtemps. Très heureux de l'accueillir. »`, `"I've wanted ${g("him", "her")} for a long time. Very happy to welcome ${g("him", "her")}."`)],
      assertive: [t(`« Son arrivée change notre dimension. On vise plus haut. »`, `"This arrival changes our level. We're aiming higher."`)],
      reserved: [t("« Laissons-lui le temps. »", `"Let's give ${g("him", "her")} time."`)],
    };
  },
  young_player: (ctx, locale) => {
    const t = tr(locale);
    const g = gn(ctx);
    return {
      passionate: [t(`« On tient ${g("un futur grand", "une future grande")}. Souvenez-vous de ce nom. »`, `"We've got a future star. Remember the name."`)],
      assertive: [t(`« ${g("Il", "Elle")} a gagné sa place dans la rotation. »`, `"${g("He", "She")}'s earned a spot in the rotation."`)],
      reserved: [t(`« Un bon match ne fait pas une carrière. ${g("Il", "Elle")} doit confirmer. »`, `"One good game doesn't make a career. ${g("He", "She")} has to back it up."`)],
    };
  },
  load_management: (ctx, locale) => {
    const t = tr(locale);
    const g = gn(ctx);
    return {
      calm: [t("« On surveille ses données tous les jours avec le staff. »", `"We monitor ${g("his", "her")} data every day with the staff."`)],
      passionate: [t(`« ${g("Je préfère le perdre", "Je préfère la perdre")} un match que trois mois. »`, `"I'd rather lose ${g("him", "her")} for a game than for three months."`)],
      assertive: [t(`« ${g("Il", "Elle")} veut jouer, et ${g("il", "elle")} jouera. »`, `"${g("He", "She")} wants to play, and ${g("he", "she")} will."`)],
    };
  },
  referees: (ctx, locale) => {
    const t = tr(locale);
    const g = gn(ctx);
    return {
      aggressive: [t("« On s'est fait voler. Je le dis et j'assume l'amende. »", `"We got robbed. I'll say it and take the fine."`)],
      passionate: [t(`« ${g("Mes joueurs", "Mes joueuses")} se font taper dessus sans coup de sifflet. Ça suffit. »`, `"My players are getting hit with no whistle. Enough."`)],
    };
  },
  opponent: (ctx, locale) => {
    const t = tr(locale);
    return { assertive: [t("« Respect à eux, mais à notre meilleur niveau, on est au-dessus. »", `"Respect to them, but at our best, we're above them."`)] };
  },
  standings: (ctx, locale) => {
    const t = tr(locale);
    return {
      assertive: [t("« On joue pour la bague. Le reste ne m'intéresse pas. »", `"We're playing for the ring. Nothing else interests me."`)],
      passionate: [t("« Offrir à cette ville une saison dont elle se souviendra. »", `"Giving this city a season it will remember."`)],
    };
  },
  job_security: (ctx, locale) => {
    const t = tr(locale);
    return {
      calm: [t("« Je me concentre sur ce que je contrôle : le travail. »", `"I focus on what I control: the work."`)],
      aggressive: [t("« Avec cet effectif, on ne pouvait pas faire de miracles. »", `"With this roster, we couldn't work miracles."`)],
      reserved: [t("« La direction décidera. »", `"The front office will decide."`)],
    };
  },
  trade_deadline: (ctx, locale) => {
    const t = tr(locale);
    return {
      assertive: [t("« On regarde toutes les options. Si ça peut nous rendre meilleurs, on fonce. »", `"We're looking at every option. If it makes us better, we'll go for it."`)],
      passionate: [t("« Ce groupe mérite qu'on lui fasse confiance jusqu'au bout. »", `"This group deserves our trust all the way."`)],
      calm: [t("« On écoute, sans précipitation. »", `"We're listening, without rushing."`)],
    };
  },
  playoff_series: (ctx, locale) => {
    const t = tr(locale);
    return {
      assertive: [t("« On sait ce qu'on doit faire. On va le faire. »", `"We know what we have to do. We'll do it."`)],
      passionate: [t("« Les playoffs, c'est pour ces soirées-là. On est prêts ! »", `"Playoffs are about nights like these. We're ready!"`)],
      aggressive: [t(`« On a trouvé leurs failles. ${ctx.opponentName} va le sentir. »`, `"We've found their weak spots. ${ctx.opponentName} will feel it."`)],
    };
  },
  fans: (ctx, locale) => {
    const t = tr(locale);
    return {
      assertive: [t("« Les beaux jours arrivent. Soyez là. »", `"Better days are coming. Be there."`)],
      reserved: [t("« On répondra par nos performances. »", `"We'll answer with our performances."`)],
    };
  },
  leader: (ctx, locale) => {
    const t = tr(locale);
    const g = gn(ctx);
    return {
      calm: [t(`« ${g("Un joueur fiable", "Une joueuse fiable")}, sur qui on peut compter chaque soir. »`, `"A reliable player we can count on every night."`)],
      assertive: [t(`« ${g("Il", "Elle")} a encore une marche à franchir, et je vais l'y aider. »`, `"${g("He", "She")} still has a step to climb, and I'll help ${g("him", "her")}."`)],
      reserved: [t("« C'est l'équipe qui m'intéresse. »", `"The team is what interests me."`)],
    };
  },
  rotation: (ctx, locale) => {
    const t = tr(locale);
    return {
      assertive: [t("« Personne n'a sa place garantie. Les minutes se méritent. »", `"Nobody's spot is guaranteed. Minutes are earned."`)],
      passionate: [t("« J'ai besoin de tout le monde. Chacun aura son moment. »", `"I need everyone. Each one will have their moment."`)],
      reserved: [t("« On en parlera en interne. »", `"We'll discuss it internally."`)],
    };
  },
  locker_room: (ctx, locale) => {
    const t = tr(locale);
    return {
      passionate: [t("« Un groupe uni, qui vit bien ensemble. Ça se sent. »", `"A tight group that gets along. You can feel it."`)],
      aggressive: [t("« Certains se contentent de trop peu. Ça doit changer. »", `"Some are settling for too little. That has to change."`)],
      reserved: [t("« Je ne parle pas du vestiaire. »", `"I don't talk about the locker room."`)],
    };
  },
  front_office: (ctx, locale) => {
    const t = tr(locale);
    return {
      calm: [t("« On se parle souvent, et on est alignés. »", `"We talk often, and we're aligned."`)],
      assertive: [t("« On construit ensemble, et ça va payer. »", `"We're building together, and it will pay off."`)],
      aggressive: [t("« Pour viser le titre, il faudra mettre les moyens. »", `"To aim for the title, they'll need to invest."`)],
    };
  },
};

// Ajoute aux questions d'un sujet ses formulations supplémentaires.
export function withVariants(c: TopicCandidate, ctx: PressGameContext, locale: Locale): TopicCandidate {
  const build = VARIANTS[c.topic];
  if (!build) return c;
  const v = build(ctx, locale);
  const more = MORE_ALTS[c.topic]?.(ctx, locale) ?? {};
  const stylePrompts = { ...(c.stylePrompts ?? {}) };
  for (const [style, prompts] of Object.entries(v.stylePrompts ?? {}) as [JournalistStyle, string[]][]) {
    stylePrompts[style] = [...(stylePrompts[style] ?? []), ...prompts];
  }
  return {
    ...c,
    prompts: [...c.prompts, ...(v.prompts ?? [])],
    stylePrompts,
    options: c.options.map((o) => ({ ...o, alt: [...(o.alt ?? []), ...(v.alt?.[o.tone] ?? []), ...(more[o.tone] ?? [])] })),
  };
}
