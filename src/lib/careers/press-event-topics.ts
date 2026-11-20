// Sujets de conférence de presse liés aux ÉVÉNEMENTS de la saison — règles
// pures (voir press-rules.ts pour le principe général).
//
// Chaque sujet ne sort que si l'événement a réellement eu lieu : prolongation,
// remontée, triple-double, star adverse en feu, back-to-back, retour de
// blessure, NBA Cup, ouverture de saison, course aux playoffs, saison perdue
// (loterie), course au MVP, joueur en fin de contrat, joueur mécontent qui a
// demandé à voir le coach, All-Star (sélection ou oubli), salle qui se vide ou
// billets trop chers, taxe de luxe, objectifs des propriétaires, retrouvailles
// avec un ancien joueur, fin d'une série de playoffs.

import type { PressGameContext } from "./press-rules";
import { e, gn, score, tr, winPct, type TopicBuilder, type TopicCandidate } from "./press-helpers";

const gamesPlayed = (ctx: PressGameContext) => ctx.wins + ctx.losses;
const plural = (n: number, fr: string, frs: string) => (n > 1 ? frs : fr);

// ---------------------------------------------------------------------------
// Le match lui-même

const overtime: TopicBuilder = (ctx, locale) => {
  const ot = ctx.overtimes ?? 0;
  if (ot < 1) return null;
  const t = tr(locale);
  const g = gn(ctx);
  const otFr = ot === 1 ? "après prolongation" : `après ${ot} prolongations`;
  const otEn = ot === 1 ? "in overtime" : `in ${ot} overtimes`;
  return {
    topic: "overtime",
    category: "results",
    family: "result",
    priority: 62 + ot * 5,
    prompts: ctx.won
      ? [
          t(`Victoire ${otFr} face à ${ctx.opponentName} (${score(ctx)}) : d'où est venue l'énergie ?`, `A win ${otEn} over ${ctx.opponentName} (${score(ctx)}): where did the energy come from?`),
          t(`Un match à rallonge, et c'est vous qui l'emportez. Qu'avez-vous dit au groupe avant la prolongation ?`, `An extra-long game, and you came out on top. What did you tell the group before overtime?`),
          t(`${ctx.teamScore} points ${otFr} : vos jambes vont-elles le payer au prochain match ?`, `${ctx.teamScore} points ${otEn}: will your legs pay for it next game?`),
        ]
      : [
          t(`Défaite ${otFr} contre ${ctx.opponentName} : c'est la plus cruelle de la saison ?`, `A loss ${otEn} to ${ctx.opponentName}: is that the cruelest of the season?`),
          t(`Vous avez arraché la prolongation mais pas la victoire. Que retenez-vous ?`, `You forced overtime but couldn't get the win. What do you take from it?`),
          t(`Qu'est-ce qui a manqué dans les minutes supplémentaires ?`, `What was missing in the extra minutes?`),
        ],
    stylePrompts: {
      tabloid: [t(`Prolongation ${ctx.won ? "gagnée" : "perdue"} : ${ctx.won ? "un groupe qui ne meurt jamais ?" : `${g("vos joueurs ont-ils", "vos joueuses ont-elles")} craqué physiquement ?`}`, `${ctx.won ? "Won" : "Lost"} in overtime: ${ctx.won ? "a group that never dies?" : "did your players crack physically?"}`)],
    },
    options: ctx.won
      ? [
          { tone: "passionate", label: t("« Ce groupe a un cœur énorme. Personne n'a lâché. »", `"This group has a huge heart. Nobody quit."`), alt: [t("« Je n'oublierai pas ce match. Ils ont tout donné. »", `"I won't forget this game. They gave everything."`)], effects: e(3, 2, 0, { squadMorale: 2 }) },
          { tone: "calm", label: t("« On a su rester lucides. C'est ce que je retiens. »", `"We stayed clear-headed. That's what I take from it."`), alt: [t("« Du sang-froid sur les dernières possessions. Bien joué. »", `"Composure on the last possessions. Well played."`)], effects: e(1, 1, 1) },
          { tone: "assertive", label: t("« Notre condition physique a fait la différence. Le travail paie. »", `"Our conditioning made the difference. The work pays off."`), effects: e(2, 1, 1) },
          { tone: "reserved", label: t("« On n'aurait jamais dû aller en prolongation. On s'est compliqué la vie. »", `"We never should have gone to overtime. We made it hard on ourselves."`), effects: e(-1, 0, 1) },
        ]
      : [
          { tone: "calm", label: t("« Ça s'est joué à rien. On ne va pas tout jeter. »", `"It came down to nothing. We won't throw everything away."`), alt: [t("« Une possession de plus et c'était pour nous. On garde le positif. »", `"One more possession and it was ours. We keep the positives."`)], effects: e(1, 1, 1) },
          { tone: "passionate", label: t("« Je suis fier de la réaction, pas du résultat. »", `"I'm proud of the fight, not the result."`), effects: e(2, 1, 0, { squadMorale: 1 }) },
          { tone: "aggressive", label: t("« On a gaspillé trop de lancers francs. C'est impardonnable à ce niveau. »", `"We wasted too many free throws. That's unforgivable at this level."`), effects: e(-2, 1, 1, { squadMorale: -2 }) },
          { tone: "reserved", label: t("« Fatigue, quelques mauvais choix. On passe à autre chose. »", `"Fatigue, a few bad decisions. We move on."`), effects: e(0, 0, 0) },
        ],
  };
};

const comeback: TopicBuilder = (ctx, locale) => {
  const from = ctx.comebackFrom ?? 0;
  if (!ctx.won || from < 12) return null;
  const t = tr(locale);
  const g = gn(ctx);
  return {
    topic: "comeback",
    category: "results",
    family: "result",
    priority: 64 + from,
    prompts: [
      t(`Vous étiez menés de ${from} points et vous gagnez ${score(ctx)}. Qu'est-ce qui a changé ?`, `You were down ${from} points and won ${score(ctx)}. What changed?`),
      t(`Remontée de ${from} points face à ${ctx.opponentName} : à quel moment y avez-vous cru ?`, `A ${from}-point comeback against ${ctx.opponentName}: when did you start to believe?`),
      t(`Que s'est-il dit dans le vestiaire quand vous étiez à -${from} ?`, `What was said in the locker room when you were down ${from}?`),
    ],
    stylePrompts: {
      tabloid: [t(`-${from} puis victoire : ${g("vos joueurs", "vos joueuses")} ont-${g("ils", "elles")} attendu d'être au bord du gouffre pour se réveiller ?`, `Down ${from} then a win: did your players wait until the brink to wake up?`)],
    },
    options: [
      { tone: "passionate", label: t("« Ce groupe ne baisse jamais les bras. C'est notre identité. »", `"This group never gives up. That's our identity."`), alt: [t("« Voilà le caractère de cette équipe. Je n'ai jamais douté. »", `"That's this team's character. I never doubted."`)], effects: e(3, 2, 0, { squadMorale: 2 }) },
      { tone: "calm", label: t("« On a resserré la défense et retrouvé de l'adresse. Rien de magique. »", `"We tightened up the defense and found our shot. Nothing magic."`), effects: e(1, 1, 1) },
      { tone: "aggressive", label: t(`« Ce début de match était inacceptable. ${g("Ils le savent", "Elles le savent")}. »`, `"That start was unacceptable. They know it."`), effects: e(-1, 1, 2, { squadMorale: -1 }) },
      { tone: "assertive", label: t("« On sait qu'on peut revenir de n'importe où. Personne n'est à l'abri face à nous. »", `"We know we can come back from anywhere. Nobody is safe against us."`), effects: e(2, 2, 0) },
    ],
  };
};

const tripleDouble: TopicBuilder = (ctx, locale) => {
  const p = ctx.tripleDouble;
  if (!p) return null;
  const t = tr(locale);
  const g = gn(ctx);
  const line = `${p.points}-${p.rebounds}-${p.assists}`;
  return {
    topic: "triple_double",
    category: "roster",
    priority: 63,
    playerId: p.id,
    prompts: [
      t(`Triple-double pour ${p.name} (${line}). Est-ce ${g("le joueur le plus complet", "la joueuse la plus complète")} de la ligue ?`, `A triple-double for ${p.name} (${line}). Is ${g("he", "she")} the most complete player in the league?`),
      t(`${p.name} a rempli toutes les colonnes ce soir. Que représente-t-${g("il", "elle")} pour votre système ?`, `${p.name} filled the stat sheet tonight. What does ${g("he", "she")} mean to your system?`),
      t(`${line} : faut-il donner encore plus le ballon à ${p.name} ?`, `${line}: should you put the ball in ${p.name}'s hands even more?`),
    ],
    options: [
      { tone: "passionate", label: t(`« ${g("Il", "Elle")} fait tout sur le terrain. Un régal à coacher. »`, `"${g("He", "She")} does everything out there. A joy to coach."`), alt: [t(`« Des soirs comme ça, je m'assois et je ${g("le", "la")} regarde jouer. »`, `"On nights like this, I just sit back and watch ${g("him", "her")} play."`)], effects: e(1, 2, 0, { playerMorale: 8 }) },
      { tone: "calm", label: t(`« Les stats sont belles, mais ce qui compte, c'est qu'${g("il", "elle")} fait jouer les autres. »`, `"The numbers are nice, but what matters is ${g("he", "she")} makes others better."`), effects: e(2, 1, 1, { playerMorale: 4, squadMorale: 1 }) },
      { tone: "assertive", label: t("« Notre système passe par ses mains. On va continuer comme ça. »", `"Our system runs through ${g("his", "her")} hands. We'll keep it that way."`), effects: e(1, 1, 0, { playerMorale: 6, squadMorale: -1 }) },
      { tone: "reserved", label: t("« Un triple-double ne gagne pas un match tout seul. »", `"A triple-double doesn't win a game on its own."`), effects: e(0, 0, 1, { playerMorale: -3 }) },
    ],
  };
};

const opponentStar: TopicBuilder = (ctx, locale) => {
  const star = ctx.opponentStar;
  if (!star || star.points < 35) return null;
  const t = tr(locale);
  return {
    topic: "opponent_star",
    category: "results",
    priority: ctx.won ? 38 : 52,
    preferredStyle: "analyst",
    prompts: ctx.won
      ? [
          t(`${star.name} vous a mis ${star.points} points mais vous gagnez. Était-ce le plan : ${ctx.opponentName} à un seul joueur ?`, `${star.name} dropped ${star.points} on you but you won. Was that the plan: make ${ctx.opponentName} a one-man team?`),
          t(`Peut-on vraiment arrêter ${star.name} ?`, `Can anyone really stop ${star.name}?`),
        ]
      : [
          t(`${star.name} a marqué ${star.points} points. Pourquoi n'avez-vous pas trouvé de solution ?`, `${star.name} scored ${star.points} points. Why couldn't you find an answer?`),
          t(`Fallait-il prendre ${star.name} à deux plus tôt ?`, `Should you have doubled ${star.name} sooner?`),
          t(`${star.points} points encaissés par un seul joueur : votre défense est-elle à la hauteur ?`, `${star.points} points from one player: is your defense good enough?`),
        ],
    stylePrompts: {
      tabloid: [t(`${star.name} s'est promené dans votre défense. Humiliant ?`, `${star.name} strolled through your defense. Humiliating?`)],
    },
    options: [
      { tone: "calm", label: t("« C'est un immense joueur. Parfois, il faut saluer le talent. »", `"That's a great player. Sometimes you tip your cap to talent."`), alt: [t("« On a fait ce qu'on pouvait. Certains soirs, ces joueurs-là sont inarrêtables. »", `"We did what we could. Some nights those players are unstoppable."`)], effects: e(1, 1, 1) },
      { tone: "assertive", label: t("« On a choisi de laisser la star marquer et d'éteindre les autres. Assumé. »", `"We chose to let the star score and shut down the rest. That was the plan."`), effects: ctx.won ? e(2, 2, 1) : e(0, -1, 0) },
      { tone: "aggressive", label: t("« On a été trop gentils en défense. Ça ne se reproduira pas. »", `"We were too soft on defense. It won't happen again."`), effects: e(1, 1, -1, { squadMorale: -1 }) },
      { tone: "reserved", label: t("« Je préfère parler de mon équipe. »", `"I'd rather talk about my team."`), effects: e(0, 0, 0) },
    ],
  };
};

const backToBack: TopicBuilder = (ctx, locale) => {
  if (!ctx.backToBack || ctx.won) return null;
  const t = tr(locale);
  const g = gn(ctx);
  return {
    topic: "back_to_back",
    category: "roster",
    priority: 42,
    preferredStyle: "analyst",
    prompts: [
      t("Deuxième match en deux soirs : la fatigue explique-t-elle cette défaite ?", "Second game in two nights: does fatigue explain this loss?"),
      t(`${g("Vos joueurs", "Vos joueuses")} semblaient ${g("lourds", "lourdes")} ce soir. Le calendrier vous a-t-il piégés ?`, "Your players looked heavy tonight. Did the schedule catch up with you?"),
      t("Auriez-vous dû faire tourner davantage sur ce back-to-back ?", "Should you have rotated more on this back-to-back?"),
    ],
    options: [
      { tone: "calm", label: t("« Ça fait partie de la saison. Tout le monde a des back-to-back. »", `"It's part of the season. Everyone has back-to-backs."`), effects: e(1, 0, 1) },
      { tone: "assertive", label: t("« Je ne cherche pas d'excuse. On devait être meilleurs. »", `"I'm not looking for excuses. We had to be better."`), effects: e(0, 1, 1) },
      { tone: "aggressive", label: t(`« Ce calendrier est absurde. La ligue doit penser à la santé ${g("des joueurs", "des joueuses")}. »`, `"This schedule is absurd. The league has to think about players' health."`), effects: e(1, 1, -1) },
      { tone: "passionate", label: t("« Ils ont tout donné sur deux soirs. Je ne leur reprocherai rien. »", `"They gave everything over two nights. I won't blame them."`), effects: e(2, 0, 0, { squadMorale: 2 }) },
    ],
  };
};

const injuryReturn: TopicBuilder = (ctx, locale) => {
  const p = ctx.returningPlayer;
  if (!p) return null;
  const t = tr(locale);
  const g = gn(ctx);
  return {
    topic: "injury_return",
    category: "roster",
    priority: 56,
    playerId: p.id,
    preferredStyle: "local",
    prompts: [
      t(`${p.name} est de retour. Comment ${g("l'avez-vous trouvé", "l'avez-vous trouvée")} ?`, `${p.name} is back. How did ${g("he", "she")} look?`),
      t(`Combien de minutes allez-vous donner à ${p.name} dans les prochains matchs ?`, `How many minutes will you give ${p.name} in the next few games?`),
      t(`Le retour de ${p.name} change-t-il les ambitions de l'équipe ?`, `Does ${p.name}'s return change the team's ambitions?`),
    ],
    options: [
      { tone: "calm", label: t("« On augmente son temps de jeu progressivement. Aucun risque. »", `"We're ramping up ${g("his", "her")} minutes gradually. No risks."`), alt: [t("« Le staff médical décide. On ne brûle aucune étape. »", `"The medical staff decides. We're not skipping steps."`)], effects: e(1, 0, 1, { playerMorale: 2 }) },
      { tone: "passionate", label: t(`« Ça fait du bien de ${g("le", "la")} revoir. Tout le vestiaire l'attendait. »`, `"It feels good to have ${g("him", "her")} back. The whole locker room was waiting."`), effects: e(2, 1, 0, { playerMorale: 6, squadMorale: 1 }) },
      { tone: "assertive", label: t(`« Avec ${g("lui", "elle")}, on redevient une équipe à craindre. »`, `"With ${g("him", "her")}, we're a team to fear again."`), effects: e(2, 2, 0, { playerMorale: 4 }) },
      { tone: "reserved", label: t(`« ${g("Il", "Elle")} manque encore de rythme. Il faudra être patients. »`, `"${g("He", "She")}'s still lacking rhythm. We'll need to be patient."`), effects: e(0, 0, 1, { playerMorale: -2 }) },
    ],
  };
};

// ---------------------------------------------------------------------------
// Compétition et calendrier

const CUP_STAGE_LABEL: Record<string, [string, string]> = {
  group: ["phase de groupes", "group stage"],
  qf: ["quart de finale", "quarterfinal"],
  sf: ["demi-finale", "semifinal"],
  final: ["finale", "final"],
};

const nbaCup: TopicBuilder = (ctx, locale) => {
  const stage = ctx.cupStage;
  if (!stage) return null;
  const t = tr(locale);
  const [fr, en] = CUP_STAGE_LABEL[stage];
  const knockout = stage !== "group";
  const base: Omit<TopicCandidate, "prompts" | "options" | "stylePrompts"> = {
    topic: "nba_cup",
    category: knockout ? "results" : "future",
    family: knockout ? "result" : undefined,
    priority: stage === "final" ? 95 : knockout ? 78 : 36,
  };
  if (stage === "final" && ctx.won) {
    return {
      ...base,
      prompts: [
        t("Vous remportez la NBA Cup ! Que représente ce trophée ?", "You've won the NBA Cup! What does this trophy mean?"),
        t(`Champions de la NBA Cup face à ${ctx.opponentName} : est-ce un tremplin pour le titre ?`, `NBA Cup champions over ${ctx.opponentName}: is it a springboard to the title?`),
      ],
      options: [
        { tone: "passionate", label: t("« C'est pour nos fans. Un trophée, ça ne se refuse jamais ! »", `"This is for our fans. You never turn down a trophy!"`), effects: e(4, 4, 1, { squadMorale: 3 }) },
        { tone: "calm", label: t("« Une belle récompense, mais le vrai objectif est en juin. »", `"A nice reward, but the real goal is in June."`), effects: e(2, 1, 2) },
        { tone: "assertive", label: t("« Ça prouve qu'on peut battre tout le monde quand ça compte. »", `"It proves we can beat anyone when it counts."`), effects: e(3, 2, 1) },
        { tone: "reserved", label: t("« On savoure ce soir, et demain on retourne au travail. »", `"We enjoy tonight, and tomorrow we go back to work."`), effects: e(1, 1, 1) },
      ],
    };
  }
  if (knockout && !ctx.won) {
    return {
      ...base,
      preferredStyle: "tabloid",
      prompts: [
        t(`Éliminés en ${fr} de la NBA Cup. Une déception ?`, `Knocked out of the NBA Cup in the ${en}. A disappointment?`),
        t(`Avez-vous pris cette ${fr} de NBA Cup assez au sérieux ?`, `Did you take this NBA Cup ${en} seriously enough?`),
        t(`Qu'est-ce qui vous a manqué face à ${ctx.opponentName} dans ce match à élimination directe ?`, `What did you lack against ${ctx.opponentName} in this win-or-go-home game?`),
      ],
      options: [
        { tone: "calm", label: t("« C'est frustrant, mais la saison régulière reste notre priorité. »", `"It's frustrating, but the regular season remains our priority."`), effects: e(0, -1, 1) },
        { tone: "passionate", label: t("« On voulait ce trophée. Ça fait mal, et ça doit faire mal. »", `"We wanted this trophy. It hurts, and it should hurt."`), effects: e(1, 2, 0, { squadMorale: 1 }) },
        { tone: "aggressive", label: t("« On n'a pas été au niveau d'un match à élimination. Il faudra s'en souvenir en avril. »", `"We weren't at the level of an elimination game. We'll need to remember that in April."`), effects: e(-1, 1, 1, { squadMorale: -2 }) },
        { tone: "reserved", label: t("« Bravo à eux. On passe à la suite. »", `"Credit to them. We move on."`), effects: e(0, 0, 0) },
      ],
    };
  }
  if (knockout) {
    return {
      ...base,
      prompts: [
        t(`Qualifiés après cette ${fr} de NBA Cup. Vous visez le trophée ?`, `Through after this NBA Cup ${en}. Are you going for the trophy?`),
        t(`Victoire en ${fr} face à ${ctx.opponentName} : que change cette Coupe pour votre saison ?`, `A ${en} win over ${ctx.opponentName}: what does this Cup change for your season?`),
      ],
      options: [
        { tone: "assertive", label: t("« On est là pour la gagner. Point. »", `"We're here to win it. Period."`), effects: e(2, 2, 1) },
        { tone: "passionate", label: t("« Le vestiaire adore ces matchs couperets. Quelle ambiance ce soir ! »", `"The locker room loves these knockout games. What an atmosphere tonight!"`), effects: e(2, 2, 0, { squadMorale: 2 }) },
        { tone: "calm", label: t("« Un match à la fois, même en Coupe. »", `"One game at a time, even in the Cup."`), effects: e(1, 1, 1) },
        { tone: "reserved", label: t("« C'est une compétition parmi d'autres. »", `"It's one competition among others."`), effects: e(0, -1, 1) },
      ],
    };
  }
  return {
    ...base,
    prompts: [
      t(`Match de groupe de NBA Cup ${ctx.won ? "gagné" : "perdu"} : où en êtes-vous dans la course aux quarts ?`, `NBA Cup group game ${ctx.won ? "won" : "lost"}: where are you in the race for the quarterfinals?`),
      t("Quelle importance accordez-vous à la NBA Cup cette saison ?", "How much importance are you giving the NBA Cup this season?"),
      t("La différence de points compte en phase de groupes. Y pensez-vous en fin de match ?", "Point differential counts in the group stage. Do you think about it late in games?"),
    ],
    options: [
      { tone: "assertive", label: t("« On joue chaque match de Coupe pour le gagner. On veut Las Vegas. »", `"We play every Cup game to win it. We want Las Vegas."`), effects: e(1, 2, 0) },
      { tone: "calm", label: t("« C'est un bonus. Le plus important reste le bilan de saison. »", `"It's a bonus. The record is still what matters most."`), effects: e(0, 0, 1) },
      { tone: "passionate", label: t("« Les fans adorent ce format, et nous aussi. »", `"The fans love this format, and so do we."`), effects: e(1, 2, 0) },
      { tone: "reserved", label: t("« On fera les comptes à la fin des groupes. »", `"We'll do the math at the end of the group stage."`), effects: e(0, 0, 0) },
    ],
  };
};

const seasonOpener: TopicBuilder = (ctx, locale) => {
  if (gamesPlayed(ctx) !== 1 || ctx.cupStage || ctx.playoffSeries) return null;
  const t = tr(locale);
  return {
    topic: "season_opener",
    category: "results",
    family: "result",
    priority: 76,
    preferredStyle: "local",
    prompts: ctx.won
      ? [
          t(`Premier match, première victoire face à ${ctx.opponentName}. Le ton est donné ?`, `First game, first win over ${ctx.opponentName}. Is the tone set?`),
          t("Une entrée en matière réussie. Qu'avez-vous aimé chez votre équipe ce soir ?", "A successful start. What did you like about your team tonight?"),
        ]
      : [
          t(`La saison commence par une défaite face à ${ctx.opponentName}. Inquiet ?`, `The season starts with a loss to ${ctx.opponentName}. Worried?`),
          t("Faux départ ce soir. Qu'est-ce qui n'a pas fonctionné ?", "A false start tonight. What didn't work?"),
        ],
    options: ctx.won
      ? [
          { tone: "assertive", label: t("« Oui. On veut que ce soit le début de quelque chose de grand. »", `"Yes. We want this to be the start of something big."`), effects: e(2, 2, 0) },
          { tone: "calm", label: t("« Une victoire sur 82 matchs. On garde les pieds sur terre. »", `"One win in 82 games. We keep our feet on the ground."`), effects: e(1, 1, 1) },
          { tone: "passionate", label: t("« Quelle ambiance dans la salle ! Merci aux fans. »", `"What an atmosphere in the building! Thanks to the fans."`), effects: e(1, 3, 0) },
          { tone: "reserved", label: t("« Beaucoup de choses à corriger malgré tout. »", `"A lot to fix despite everything."`), effects: e(0, 0, 1) },
        ]
      : [
          { tone: "calm", label: t("« C'est un match sur une longue saison. Aucune panique. »", `"It's one game in a long season. No panic."`), effects: e(1, 1, 1) },
          { tone: "assertive", label: t("« On va vite rectifier le tir. Ce n'est pas notre vrai visage. »", `"We'll fix it quickly. That's not who we are."`), effects: e(1, 1, 0) },
          { tone: "aggressive", label: t("« Ce n'est pas acceptable, même pour un premier match. »", `"That's not acceptable, even for an opener."`), effects: e(-1, 1, 1, { squadMorale: -2 }) },
          { tone: "reserved", label: t("« On avait des automatismes à trouver. On les trouvera. »", `"We had chemistry to find. We'll find it."`), effects: e(0, 0, 0) },
        ],
  };
};

const playoffRace: TopicBuilder = (ctx, locale) => {
  const total = ctx.gamesInSeason;
  if (!total || ctx.playoffSeries || ctx.cupStage) return null;
  const left = total - gamesPlayed(ctx);
  const ratio = ctx.rank / Math.max(1, ctx.leagueSize);
  if (left > 20 || left < 0 || ratio < 0.4 || ratio > 0.8) return null;
  const t = tr(locale);
  return {
    topic: "playoff_race",
    category: "future",
    priority: 50 + (20 - left),
    preferredStyle: "analyst",
    prompts: [
      t(`Plus que ${left} ${plural(left, "match", "matchs")} et vous êtes ${ctx.rank}e : allez-vous accrocher les playoffs ?`, `${left} game${left > 1 ? "s" : ""} left and you're ${ctx.rank}th: will you hold on to a playoff spot?`),
      t("Le play-in vous fait-il peur ?", "Does the play-in scare you?"),
      t(`À ${ctx.wins}-${ctx.losses}, chaque match est-il désormais une finale ?`, `At ${ctx.wins}-${ctx.losses}, is every game a final now?`),
    ],
    options: [
      { tone: "assertive", label: t("« On sera en playoffs. Je n'ai aucun doute. »", `"We'll be in the playoffs. I have no doubt."`), effects: winPct(ctx) >= 0.5 ? e(2, 2, 1) : e(2, 1, -1) },
      { tone: "calm", label: t("« On ne regarde pas le classement. On gagne nos matchs, le reste suivra. »", `"We don't look at the standings. We win our games, the rest will follow."`), effects: e(1, 1, 1) },
      { tone: "passionate", label: t("« Ce sont les matchs qu'on rêve de jouer. Les fans vont pousser ! »", `"These are the games you dream of playing. The fans will push us!"`), effects: e(2, 2, 0, { squadMorale: 1 }) },
      { tone: "reserved", label: t("« On fera les comptes à la fin. »", `"We'll count at the end."`), effects: e(0, 0, 0) },
    ],
  };
};

const tanking: TopicBuilder = (ctx, locale) => {
  const total = ctx.gamesInSeason;
  if (!total || ctx.playoffSeries || ctx.cupStage) return null;
  if (gamesPlayed(ctx) < total * 0.55 || winPct(ctx) >= 0.33) return null;
  const t = tr(locale);
  const g = gn(ctx);
  return {
    topic: "tanking",
    category: "management",
    priority: 50,
    preferredStyle: "tabloid",
    prompts: [
      t(`À ${ctx.wins}-${ctx.losses}, pensez-vous déjà à la loterie de la draft ?`, `At ${ctx.wins}-${ctx.losses}, are you already thinking about the draft lottery?`),
      t(`Certains fans souhaitent que l'équipe perde pour mieux drafter. Que leur répondez-vous ?`, `Some fans want the team to lose for a better pick. What do you tell them?`),
      t("Allez-vous donner plus de minutes aux jeunes pour la fin de saison ?", "Will you give the young players more minutes for the rest of the season?"),
    ],
    options: [
      { tone: "aggressive", label: t("« Perdre exprès ? Jamais. Pas sous mes ordres. »", `"Lose on purpose? Never. Not on my watch."`), effects: e(2, 2, -1, { squadMorale: 1 }) },
      { tone: "calm", label: t("« On construit pour l'avenir. Les jeunes vont avoir des responsabilités. »", `"We're building for the future. The young players will get responsibility."`), effects: e(0, 1, 2) },
      { tone: "assertive", label: t(`« Cette saison sert à préparer la suivante. Chaque choix a un sens. »`, `"This season is about preparing the next one. Every decision has a purpose."`), effects: e(-1, 0, 2, { squadMorale: -1 }) },
      { tone: "passionate", label: t(`« ${g("Mes joueurs", "Mes joueuses")} se battent tous les soirs. Je leur dois du respect. »`, `"My players fight every night. I owe them respect."`), effects: e(2, 1, 0, { squadMorale: 2 }) },
    ],
  };
};

// ---------------------------------------------------------------------------
// Joueurs

const mvpRace: TopicBuilder = (ctx, locale) => {
  const p = ctx.mvpCandidate;
  if (!p || gamesPlayed(ctx) < 20 || winPct(ctx) < 0.6) return null;
  const t = tr(locale);
  const g = gn(ctx);
  return {
    topic: "mvp_race",
    category: "roster",
    priority: 44,
    playerId: p.id,
    prompts: [
      t(`${p.name} doit-${g("il", "elle")} être MVP cette saison ?`, `Should ${p.name} be MVP this season?`),
      t(`On parle beaucoup de ${p.name} dans la course au MVP. Ça peut ${g("le", "la")} déconcentrer ?`, `There's a lot of MVP talk around ${p.name}. Could it distract ${g("him", "her")}?`),
      t(`Votre bilan doit-il beaucoup à ${p.name} ?`, `Does your record owe a lot to ${p.name}?`),
    ],
    options: [
      { tone: "passionate", label: t(`« Pour moi, il n'y a pas de débat. C'est ${g("le MVP", "la MVP")}. »`, `"For me there's no debate. ${g("He", "She")}'s the MVP."`), effects: e(1, 2, 0, { playerMorale: 8 }) },
      { tone: "calm", label: t("« Les trophées individuels viennent quand l'équipe gagne. Concentrons-nous là-dessus. »", `"Individual awards come when the team wins. Let's focus on that."`), effects: e(2, 1, 1, { playerMorale: 2, squadMorale: 1 }) },
      { tone: "assertive", label: t(`« Regardez notre bilan, regardez ses chiffres. Les votants sauront quoi faire. »`, `"Look at our record, look at ${g("his", "her")} numbers. The voters will know what to do."`), effects: e(1, 2, 0, { playerMorale: 6 }) },
      { tone: "reserved", label: t("« Ce n'est pas mon rôle de faire campagne. »", `"It's not my job to campaign."`), effects: e(0, 0, 1, { playerMorale: -2 }) },
    ],
  };
};

const contractYear: TopicBuilder = (ctx, locale) => {
  const p = ctx.expiringStar;
  if (!p || gamesPlayed(ctx) < 10) return null;
  const t = tr(locale);
  const g = gn(ctx);
  return {
    topic: "contract_year",
    category: "management",
    priority: 44,
    playerId: p.id,
    preferredStyle: "tabloid",
    prompts: [
      t(`${p.name} arrive en fin de contrat. Allez-vous ${g("le", "la")} prolonger ?`, `${p.name} is in the last year of ${g("his", "her")} deal. Will you extend ${g("him", "her")}?`),
      t(`Craignez-vous de perdre ${p.name} cet été ?`, `Are you worried about losing ${p.name} this summer?`),
      t(`Les négociations avec ${p.name} avancent-elles ?`, `Are negotiations with ${p.name} moving forward?`),
    ],
    stylePrompts: {
      tabloid: [t(`On dit que ${p.name} écoute déjà les autres franchises. Info ou intox ?`, `Word is ${p.name} is already listening to other teams. True or false?`)],
    },
    options: [
      { tone: "assertive", label: t(`« ${g("Il", "Elle")} fait partie de notre avenir. On trouvera un accord. »`, `"${g("He", "She")}'s part of our future. We'll find a deal."`), effects: e(1, 1, -1, { playerMorale: 7 }) },
      { tone: "calm", label: t("« Les discussions se font en interne, dans le respect. »", `"Talks happen internally, respectfully."`), alt: [t("« On en parle avec son agent. Je n'en dirai pas plus. »", `"We're talking with ${g("his", "her")} agent. I won't say more."`)], effects: e(0, 0, 1, { playerMorale: 2 }) },
      { tone: "reserved", label: t("« Chaque chose en son temps. On pense d'abord à la saison. »", `"One thing at a time. The season comes first."`), effects: e(0, 0, 1, { playerMorale: -2 }) },
      { tone: "aggressive", label: t("« Personne n'est indispensable. On ne fera pas n'importe quoi financièrement. »", `"Nobody is indispensable. We won't do anything reckless financially."`), effects: e(-1, 0, 2, { playerMorale: -8 }) },
    ],
  };
};

const unhappyPlayer: TopicBuilder = (ctx, locale) => {
  const p = ctx.unhappyPlayer;
  if (!p) return null;
  const t = tr(locale);
  const g = gn(ctx);
  const prompts =
    p.request === "minutes"
      ? [
          t(`On dit ${p.name} ${g("mécontent", "mécontente")} de son temps de jeu. ${g("Il", "Elle")} est venu${g("", "e")} vous voir ?`, `${p.name} is said to be unhappy with ${g("his", "her")} minutes. Did ${g("he", "she")} come to see you?`),
          t(`${p.name} réclame plus de minutes. Allez-vous lui en donner ?`, `${p.name} wants more minutes. Will you give ${g("him", "her")} more?`),
        ]
      : p.request === "contract"
        ? [
            t(`${p.name} voudrait parler de son contrat. Le dossier est-il ouvert ?`, `${p.name} wants to talk about ${g("his", "her")} contract. Is it on the table?`),
            t(`${p.name} s'estime sous-${g("payé", "payée")}. Que lui répondez-vous ?`, `${p.name} feels underpaid. What's your answer?`),
          ]
        : [
            t(`${p.name} traverse une période difficile, on ${g("le", "la")} dit en manque de confiance. Comment l'aidez-vous ?`, `${p.name} is going through a rough patch and is said to lack confidence. How are you helping?`),
            t(`${p.name} a-t-${g("il", "elle")} besoin d'un mot de son coach ?`, `Does ${p.name} need a word from ${g("his", "her")} coach?`),
          ];
  return {
    topic: "unhappy_player",
    category: "roster",
    priority: 63,
    playerId: p.id,
    preferredStyle: "tabloid",
    prompts,
    options: [
      { tone: "calm", label: t("« Ma porte est toujours ouverte. On en parle entre nous. »", `"My door is always open. We talk about it privately."`), alt: [t("« Ces discussions restent dans le bureau. Elles ont lieu, c'est l'essentiel. »", `"Those conversations stay in the office. They happen, that's what matters."`)], effects: e(1, 0, 1, { playerMorale: 4 }) },
      { tone: "passionate", label: t(`« ${g("Il", "Elle")} compte énormément pour nous. Je ${g("le", "la")} soutiens à 100 %. »`, `"${g("He", "She")} matters a lot to us. I back ${g("him", "her")} 100%."`), effects: e(1, 1, 0, { playerMorale: 7 }) },
      { tone: "aggressive", label: t("« Les réclamations se règlent sur le terrain, pas dans les journaux. »", `"Complaints are settled on the court, not in the papers."`), effects: e(-1, 1, 1, { playerMorale: -9, squadMorale: -1 }) },
      { tone: "reserved", label: t("« Je ne commente pas ce genre de rumeur. »", `"I don't comment on that kind of rumor."`), effects: e(0, -1, 0, { playerMorale: -1 }) },
    ],
  };
};

const allStar: TopicBuilder = (ctx, locale) => {
  const selected = ctx.allStars?.selected ?? [];
  if (selected.length === 0) return null;
  const t = tr(locale);
  const g = gn(ctx);
  const p = selected[0];
  const several = selected.length > 1;
  const names = selected.map((s) => s.name).join(t(" et ", " and "));
  return {
    topic: "all_star",
    category: "roster",
    priority: 70,
    playerId: several ? undefined : p.id,
    preferredStyle: "local",
    prompts: several
      ? [
          t(`${names} sont All-Stars. Une fierté pour la franchise ?`, `${names} are All-Stars. A source of pride for the franchise?`),
          t(`${selected.length} All-Stars dans votre effectif : est-ce la preuve que vous êtes candidats au titre ?`, `${selected.length} All-Stars on your roster: proof you're a title contender?`),
        ]
      : [
          t(`${p.name} est sélectionné${g("", "e")} au All-Star Game. Que vous inspire cette sélection ?`, `${p.name} made the All-Star Game. What does that selection mean to you?`),
          t(`${p.name} All-Star : récompense méritée ?`, `${p.name} an All-Star: a deserved reward?`),
          t(`Que représente cette sélection All-Star de ${p.name} pour la ville de ${ctx.teamCity} ?`, `What does ${p.name}'s All-Star nod mean for ${ctx.teamCity}?`),
        ],
    options: [
      { tone: "passionate", label: t("« Amplement mérité. Le travail finit toujours par payer ! »", `"Fully deserved. Hard work always pays off!"`), effects: e(2, 2, 0, { playerMorale: 8 }) },
      { tone: "calm", label: t("« Une belle reconnaissance, qui rejaillit sur tout le groupe. »", `"A great recognition that reflects on the whole group."`), effects: e(2, 1, 1, { playerMorale: 4, squadMorale: 1 }) },
      { tone: "assertive", label: t("« Et ce n'est que le début. On en aura d'autres. »", `"And it's only the beginning. We'll have more."`), effects: e(1, 2, 0, { playerMorale: 5 }) },
      { tone: "reserved", label: t("« Ça fait plaisir, mais c'est la deuxième partie de saison qui compte. »", `"It's nice, but the second half of the season is what counts."`), effects: e(0, 0, 1, { playerMorale: 1 }) },
    ],
  };
};

const allStarSnub: TopicBuilder = (ctx, locale) => {
  const p = ctx.allStars?.snub;
  if (!p) return null;
  const t = tr(locale);
  const g = gn(ctx);
  return {
    topic: "all_star_snub",
    category: "roster",
    priority: 66,
    playerId: p.id,
    preferredStyle: "tabloid",
    prompts: [
      t(`${p.name} n'a pas été ${g("retenu", "retenue")} pour le All-Star Game. Une injustice ?`, `${p.name} was left out of the All-Star Game. An injustice?`),
      t(`Comment ${p.name} a-t-${g("il", "elle")} réagi à cet oubli ?`, `How did ${p.name} react to the snub?`),
      t(`Pas de All-Star pour ${ctx.teamShortName} cette année : un manque de reconnaissance ?`, `No All-Star for the ${ctx.teamShortName} this year: a lack of respect?`),
    ],
    options: [
      { tone: "aggressive", label: t(`« C'est un scandale. ${g("Il", "Elle")} mérite sa place plus que quiconque. »`, `"It's a disgrace. ${g("He", "She")} deserves it more than anyone."`), effects: e(2, 2, -1, { playerMorale: 8 }) },
      { tone: "calm", label: t(`« Le niveau est très élevé. ${g("Il", "Elle")} utilisera ça comme motivation. »`, `"The bar is very high. ${g("He", "She")}'ll use it as motivation."`), effects: e(1, 1, 1, { playerMorale: 3 }) },
      { tone: "passionate", label: t(`« Pour nous, ${g("il", "elle")} est All-Star. C'est tout ce qui compte. »`, `"To us, ${g("he", "she")}'s an All-Star. That's all that matters."`), effects: e(1, 1, 0, { playerMorale: 6 }) },
      { tone: "reserved", label: t("« Les votes sont ce qu'ils sont. »", `"The votes are what they are."`), effects: e(0, 0, 0, { playerMorale: -3 }) },
    ],
  };
};

const formerPlayer: TopicBuilder = (ctx, locale) => {
  const p = ctx.formerPlayer;
  if (!p) return null;
  const t = tr(locale);
  const g = gn(ctx);
  return {
    topic: "former_player",
    category: "results",
    priority: 40,
    preferredStyle: "local",
    prompts: [
      t(`Vous retrouviez ${p.name}, ${g("passé", "passée")} par ${ctx.teamCity}. Des émotions particulières ?`, `You faced ${p.name}, who used to play in ${ctx.teamCity}. Any special emotions?`),
      t(`Regrettez-vous d'avoir laissé partir ${p.name} ?`, `Do you regret letting ${p.name} go?`),
      t(`Comment le public a-t-il accueilli ${p.name} ce soir ?`, `How did the crowd welcome ${p.name} tonight?`),
    ],
    options: [
      { tone: "calm", label: t(`« Beaucoup de respect pour ce qu'${g("il", "elle")} a fait ici. Les chemins se séparent parfois. »`, `"A lot of respect for what ${g("he", "she")} did here. Paths sometimes split."`), effects: e(1, 1, 1) },
      { tone: "passionate", label: t(`« ${g("Il", "Elle")} fera toujours partie de la famille. Les fans s'en souviennent. »`, `"${g("He", "She")}'ll always be part of the family. The fans remember."`), effects: e(0, 2, 0) },
      { tone: "assertive", label: t("« Aucun regret. On a fait les bons choix pour l'équipe. »", `"No regrets. We made the right choices for the team."`), effects: e(1, 0, 2) },
      { tone: "reserved", label: t("« Un adversaire comme un autre ce soir. »", `"An opponent like any other tonight."`), effects: e(0, -1, 0) },
    ],
  };
};

// ---------------------------------------------------------------------------
// Club et finances

const attendance: TopicBuilder = (ctx, locale) => {
  const a = ctx.arena;
  if (!a) return null;
  const pricey = a.ticketLevel >= 125;
  const empty = a.attendance < 45;
  if (!pricey && !empty) return null;
  const t = tr(locale);
  return {
    topic: "attendance",
    category: "future",
    priority: empty ? 46 : 40,
    preferredStyle: "local",
    prompts: empty
      ? [
          t("Il y avait beaucoup de sièges vides ce soir. Comment reconquérir le public ?", "There were a lot of empty seats tonight. How do you win the fans back?"),
          t(`Les fans de ${ctx.teamCity} se détournent-ils de l'équipe ?`, `Are ${ctx.teamCity} fans turning away from the team?`),
        ]
      : [
          t("Le prix des billets a fortement augmenté. Les fans en ont-ils pour leur argent ?", "Ticket prices have gone up a lot. Are fans getting their money's worth?"),
          t("Des supporters se plaignent du prix des places. Que leur répondez-vous ?", "Some supporters complain about ticket prices. What do you say to them?"),
        ],
    options: [
      { tone: "passionate", label: t("« Revenez nous voir. On va vous donner des raisons d'être fiers. »", `"Come back and see us. We'll give you reasons to be proud."`), effects: e(1, 3, 0) },
      { tone: "calm", label: t("« Ça se gagne avec des résultats. À nous de faire notre part. »", `"You earn that with results. It's on us to do our part."`), effects: e(1, 1, 1) },
      { tone: "aggressive", label: pricey ? t("« Les prix, ce n'est pas mon rayon. Parlez-en à la direction. »", `"Pricing isn't my department. Talk to the front office."`) : t("« On a besoin de nos fans, même quand c'est difficile. »", `"We need our fans, even when it's tough."`), effects: pricey ? e(0, 1, -3) : e(1, 1, 0) },
      { tone: "reserved", label: t("« Je me concentre sur le basket. »", `"I focus on basketball."`), effects: e(0, -1, 0) },
    ],
  };
};

const luxuryTax: TopicBuilder = (ctx, locale) => {
  if (!ctx.luxuryTax || gamesPlayed(ctx) < 5) return null;
  const t = tr(locale);
  const losing = winPct(ctx) < 0.5;
  return {
    topic: "luxury_tax",
    category: "management",
    priority: losing ? 46 : 34,
    preferredStyle: "analyst",
    prompts: [
      t("Vous payez la taxe de luxe. Cette masse salariale est-elle justifiée ?", "You're paying the luxury tax. Is this payroll justified?"),
      t(`Une masse salariale au-dessus de la taxe pour un bilan de ${ctx.wins}-${ctx.losses} : les propriétaires s'impatientent-ils ?`, `A payroll above the tax line for a ${ctx.wins}-${ctx.losses} record: are the owners getting impatient?`),
      t("Faudra-t-il alléger la masse salariale avant la date limite ?", "Will you need to cut payroll before the deadline?"),
    ],
    options: [
      { tone: "assertive", label: t("« Gagner a un prix. Les propriétaires veulent un titre, on se donne les moyens. »", `"Winning has a price. The owners want a title, we're giving ourselves the means."`), effects: losing ? e(0, -1, -1) : e(1, 1, 1) },
      { tone: "calm", label: t("« On suit la situation avec la direction. Rien d'urgent. »", `"We're monitoring it with the front office. Nothing urgent."`), effects: e(0, 0, 1) },
      { tone: "aggressive", label: t("« Ce n'est pas aux joueurs de payer les choix financiers. »", `"It's not up to the players to pay for financial decisions."`), effects: e(1, 1, -2, { squadMorale: 1 }) },
      { tone: "reserved", label: t("« Les chiffres, ce sont les affaires de la direction. »", `"The numbers are the front office's business."`), effects: e(0, 0, 0) },
    ],
  };
};

const OWNER_GOAL_FR: Record<string, string> = {
  win_pct: "le bilan demandé",
  develop_youth: "le développement des jeunes",
  attendance: "le remplissage de la salle",
};
const OWNER_GOAL_EN: Record<string, string> = {
  win_pct: "the required record",
  develop_youth: "developing young players",
  attendance: "filling the arena",
};

const ownerGoals: TopicBuilder = (ctx, locale) => {
  const goal = ctx.ownerGoal;
  if (!goal?.behind || gamesPlayed(ctx) < 20) return null;
  const t = tr(locale);
  const fr = OWNER_GOAL_FR[goal.type];
  const en = OWNER_GOAL_EN[goal.type];
  return {
    topic: "owner_goals",
    category: "management",
    priority: 48,
    prompts: [
      t(`Les propriétaires vous ont fixé un objectif sur ${fr}. Vous êtes en retard : inquiet ?`, `The owners set you a goal on ${en}. You're behind: worried?`),
      t(`Pouvez-vous encore atteindre l'objectif fixé par la direction sur ${fr} ?`, `Can you still reach the front office's goal on ${en}?`),
    ],
    options: [
      { tone: "assertive", label: t("« Oui. Il reste du temps, et je tiens toujours mes engagements. »", `"Yes. There's time left, and I always keep my commitments."`), effects: e(1, 1, 1) },
      { tone: "calm", label: t("« On en parle régulièrement avec la direction. Elle connaît le contexte. »", `"We discuss it regularly with the front office. They know the context."`), effects: e(0, 0, 2) },
      { tone: "aggressive", label: t("« Ces objectifs ne tiennent pas compte des blessures et de l'effectif. »", `"Those goals don't account for injuries and the roster."`), effects: e(1, 0, -3) },
      { tone: "reserved", label: t("« Je ne commente pas les discussions internes. »", `"I don't comment on internal discussions."`), effects: e(0, -1, 0) },
    ],
  };
};

// ---------------------------------------------------------------------------
// Playoffs

const seriesOver: TopicBuilder = (ctx, locale) => {
  const s = ctx.playoffSeries;
  if (!s) return null;
  const need = Math.ceil((s.bestOf ?? 7) / 2);
  const won = s.teamWins >= need;
  if (!won && s.opponentWins < need) return null;
  const t = tr(locale);
  const g = gn(ctx);
  const record = `${s.teamWins}-${s.opponentWins}`;
  return {
    topic: "series_over",
    category: "future",
    priority: 96,
    prompts: won
      ? [
          t(`Série remportée ${record} face à ${ctx.opponentName}. Jusqu'où pouvez-vous aller ?`, `Series won ${record} over ${ctx.opponentName}. How far can you go?`),
          t(`Qualifiés ! Qu'est-ce qui a fait la différence dans cette série ?`, `You're through! What made the difference in this series?`),
        ]
      : [
          t(`Éliminés ${record} par ${ctx.opponentName}. Quel bilan tirez-vous de la saison ?`, `Eliminated ${record} by ${ctx.opponentName}. How do you assess the season?`),
          t("C'est la fin de la saison. Que faut-il changer pour aller plus loin ?", "The season is over. What needs to change to go further?"),
          t(`Serez-vous encore sur ce banc la saison prochaine ?`, `Will you still be on this bench next season?`),
        ],
    options: won
      ? [
          { tone: "assertive", label: t("« Jusqu'au bout. On n'est pas là pour faire de la figuration. »", `"All the way. We're not here to make up the numbers."`), effects: e(2, 3, 1) },
          { tone: "passionate", label: t(`« Ce groupe est incroyable. Je suis fier de ${g("chacun d'eux", "chacune d'elles")} ! »`, `"This group is incredible. I'm proud of every one of them!"`), effects: e(3, 2, 0, { squadMorale: 2 }) },
          { tone: "calm", label: t("« On savoure, et on prépare déjà le prochain tour. »", `"We enjoy it, and we're already preparing for the next round."`), effects: e(1, 1, 1) },
          { tone: "reserved", label: t("« Le plus dur reste à faire. »", `"The hardest part is still ahead."`), effects: e(0, 0, 1) },
        ]
      : [
          { tone: "calm", label: t("« Une saison avec du positif. On va analyser et revenir plus forts. »", `"A season with positives. We'll analyze and come back stronger."`), effects: e(1, 1, 1) },
          { tone: "passionate", label: t("« Merci aux fans. Ce groupe a tout donné jusqu'au bout. »", `"Thank you to the fans. This group gave everything until the end."`), effects: e(2, 3, 0, { squadMorale: 1 }) },
          { tone: "aggressive", label: t("« Il faudra des changements. Ce groupe a atteint ses limites. »", `"There will have to be changes. This group has hit its ceiling."`), effects: e(-2, 1, 2, { squadMorale: -3 }) },
          { tone: "reserved", label: t("« Trop tôt pour en parler. Laissez-nous digérer. »", `"Too soon to talk about it. Let us digest it."`), effects: e(0, -1, 0) },
        ],
  };
};

export const EVENT_TOPIC_BUILDERS: TopicBuilder[] = [
  overtime,
  comeback,
  tripleDouble,
  opponentStar,
  backToBack,
  injuryReturn,
  nbaCup,
  seasonOpener,
  playoffRace,
  tanking,
  mvpRace,
  contractYear,
  unhappyPlayer,
  allStar,
  allStarSnub,
  formerPlayer,
  attendance,
  luxuryTax,
  ownerGoals,
  seriesOver,
];
