import "server-only";
import { prisma } from "@/lib/prisma";
import { getOrCreateTeamState } from "@/lib/data-access/team-state";
import { getStandings } from "@/lib/data-access/standings";
import { createInboxMessage } from "@/lib/data-access/inbox";
import { winPctForStandings } from "@/lib/careers/player-demands";
import {
  playerReactionMessageText,
  pressMessageText,
  pressReviewMessageText,
  refereeFineMessageText,
} from "@/lib/careers/inbox-rules";
import { clampMorale } from "@/lib/careers/morale-rules";
import { calendarDay, nbaTradeDeadline } from "@/lib/careers/schedule-rules";
import { PlayerStatePatches } from "@/lib/data-access/player-state-patches";
import type { Locale } from "@/lib/i18n/locale";
import {
  generateQuestions,
  isMajorPressEvent,
  pressAnswerEffects,
  pressConferenceChance,
  pressHeadline,
  refereeFine,
  topicKey,
  PLAYOFF_PRESS_CONFERENCE_COOLDOWN_DAYS,
  PRESS_CONFERENCE_COOLDOWN_DAYS,
  SKIP_PRESS_EFFECTS,
  type AnswerTone,
  type PressEffects,
  type PressGameContext,
  type PressOption,
} from "@/lib/careers/press-rules";

// Effets réellement appliqués par une réponse (affichés après coup).
export interface PressOutcome {
  morale: number;
  publicOpinion: number;
  frontOfficeApproval: number;
  playerMorale?: number;
  playerName?: string;
  squadMorale?: number;
  refereeCriticism?: boolean;
}

export interface PressQuestionView {
  id: string;
  order: number;
  prompt: string;
  category: string;
  topic: string | null;
  journalist: string | null;
  outlet: string | null;
  playerId: string | null;
  options: PressOption[];
  chosenOptionId: string | null;
  outcome: PressOutcome | null;
}

export interface PressConferenceView {
  id: string;
  teamId: string;
  gameDate: string;
  status: string;
  kind: string;
  skipped: boolean;
  headline: string | null;
  questions: PressQuestionView[];
}

type ConferenceRow = {
  id: string;
  teamId: string;
  gameDate: Date;
  status: string;
  kind: string;
  skipped: boolean;
  headline: string | null;
  questions: {
    id: string;
    order: number;
    prompt: string;
    category: string;
    optionsJson: string;
    chosenOptionId: string | null;
    journalist: string | null;
    outlet: string | null;
    topic: string | null;
    playerId: string | null;
    outcomeJson: string | null;
  }[];
};

function toView(row: ConferenceRow): PressConferenceView {
  return {
    id: row.id,
    teamId: row.teamId,
    gameDate: row.gameDate.toISOString().slice(0, 10),
    status: row.status,
    kind: row.kind,
    skipped: row.skipped,
    headline: row.headline,
    questions: [...row.questions]
      .sort((a, b) => a.order - b.order)
      .map((q) => ({
        id: q.id,
        order: q.order,
        prompt: q.prompt,
        category: q.category,
        topic: q.topic,
        journalist: q.journalist,
        outlet: q.outlet,
        playerId: q.playerId,
        options: JSON.parse(q.optionsJson) as PressOption[],
        chosenOptionId: q.chosenOptionId,
        outcome: q.outcomeJson ? (JSON.parse(q.outcomeJson) as PressOutcome) : null,
      })),
  };
}

// Actualité de l'équipe qui ne se lit pas dans le match lui-même : joueur
// qui réclame un transfert, dernière recrue, série de playoffs, date limite
// des échanges.
async function enrichContext(
  careerId: string,
  teamId: string,
  leagueId: string,
  season: string,
  gameDate: Date,
  playoffSeriesId: string | null,
  lastConferenceAt: Date | null,
  base: PressGameContext
): Promise<PressGameContext> {
  const contracts = await prisma.contract.findMany({ where: { careerId, teamId }, select: { playerId: true } });
  const rosterIds = contracts.map((c) => c.playerId);
  const [requester, arrival, series] = await Promise.all([
    prisma.playerState.findFirst({
      where: { careerId, playerId: { in: rosterIds }, wantsTrade: true },
      include: { player: { select: { firstName: true, lastName: true } } },
    }),
    prisma.playerTeamStint.findFirst({
      where: {
        careerId,
        teamId,
        playerId: { in: rosterIds },
        reason: { in: ["traded", "signed"] },
        ...(lastConferenceAt ? { createdAt: { gt: lastConferenceAt } } : {}),
      },
      orderBy: { createdAt: "desc" },
      include: { player: { select: { firstName: true, lastName: true } } },
    }),
    playoffSeriesId ? prisma.playoffSeries.findUnique({ where: { id: playoffSeriesId } }) : null,
  ]);

  // Saison régulière NBA uniquement (les labels de playoffs/pré-saison ont
  // un suffixe : "2026-2027-playoffs").
  let tradeDeadlineDays: number | undefined;
  if (leagueId === "nba" && /^\d{4}-\d{4}$/.test(season)) {
    const days = Math.round(
      (Date.parse(calendarDay(nbaTradeDeadline(season))) - Date.parse(calendarDay(gameDate))) / 86_400_000
    );
    if (days >= 0) tradeDeadlineDays = days;
  }

  return {
    ...base,
    tradeRequester: requester
      ? { id: requester.playerId, name: `${requester.player.firstName} ${requester.player.lastName}` }
      : undefined,
    newArrival: arrival ? { id: arrival.playerId, name: `${arrival.player.firstName} ${arrival.player.lastName}` } : undefined,
    playoffSeries: series
      ? series.homeTeamId === teamId
        ? { teamWins: series.homeWins, opponentWins: series.awayWins }
        : { teamWins: series.awayWins, opponentWins: series.homeWins }
      : undefined,
    tradeDeadlineDays,
  };
}

// Appelé une fois par équipe humaine juste après la résolution d'un match :
// au plus 1 conférence en attente à la fois, un délai minimum depuis la
// dernière (raccourci en playoffs), puis tirage au sort — quasi certain
// après un événement marquant (voir pressConferenceChance).
export async function maybeCreatePressConference(
  careerId: string,
  teamId: string,
  leagueId: string,
  season: string,
  gameDate: Date,
  locale: Locale,
  gameContext: PressGameContext,
  playoffSeriesId: string | null = null
): Promise<void> {
  const state = await getOrCreateTeamState(careerId, teamId, leagueId);

  const pending = await prisma.pressConference.findFirst({
    where: { careerId, teamId, status: "pending" },
  });
  if (pending) return;

  const cooldown = playoffSeriesId ? PLAYOFF_PRESS_CONFERENCE_COOLDOWN_DAYS : PRESS_CONFERENCE_COOLDOWN_DAYS;
  if (state.lastPressConferenceDate) {
    const diffDays = (gameDate.getTime() - state.lastPressConferenceDate.getTime()) / 86_400_000;
    if (diffDays < cooldown) return;
  }

  const recent = await prisma.pressConference.findMany({
    where: { careerId, teamId },
    orderBy: { createdAt: "desc" },
    take: 2,
    include: { questions: { select: { topic: true, playerId: true } } },
  });
  const ctx = await enrichContext(
    careerId,
    teamId,
    leagueId,
    season,
    gameDate,
    playoffSeriesId,
    recent[0]?.createdAt ?? null,
    gameContext
  );
  if (Math.random() >= pressConferenceChance(ctx)) return;

  // Pas deux fois le même sujet de suite, ni le même joueur visé sur le même
  // sujet au cours des deux dernières conférences.
  const avoid = new Set<string>();
  recent.forEach((conference, i) => {
    for (const q of conference.questions) {
      if (!q.topic) continue;
      if (q.playerId) avoid.add(topicKey(q.topic, q.playerId));
      else if (i === 0) avoid.add(q.topic);
    }
  });

  const count = playoffSeriesId || isMajorPressEvent(ctx) ? 4 : Math.random() < 0.5 ? 3 : 4;
  const generated = generateQuestions(count, locale, ctx, avoid);
  if (generated.length === 0) return;

  await prisma.$transaction([
    prisma.pressConference.create({
      data: {
        careerId,
        teamId,
        gameDate,
        kind: playoffSeriesId ? "playoffs" : "postgame",
        questions: {
          create: generated.map((q, i) => ({
            order: i,
            prompt: q.prompt,
            category: q.category,
            topic: q.topic,
            playerId: q.playerId ?? null,
            journalist: q.journalist,
            outlet: q.outlet,
            optionsJson: JSON.stringify(q.options),
          })),
        },
      },
    }),
    prisma.teamState.update({
      where: { careerId_teamId: { careerId, teamId } },
      data: { lastPressConferenceDate: gameDate },
    }),
  ]);

  const { title, body } = pressMessageText(locale);
  await createInboxMessage(careerId, teamId, season, "press", title, body, "/press", { gameDate });
}

export async function getPendingPressConference(
  careerId: string,
  teamId: string
): Promise<PressConferenceView | null> {
  const row = await prisma.pressConference.findFirst({
    where: { careerId, teamId, status: "pending" },
    include: { questions: true },
  });
  return row ? toView(row) : null;
}

export async function getPressHistory(careerId: string, teamId: string, take = 20): Promise<PressConferenceView[]> {
  const rows = await prisma.pressConference.findMany({
    where: { careerId, teamId, status: "answered" },
    include: { questions: true },
    orderBy: { createdAt: "desc" },
    take,
  });
  return rows.map(toView);
}

// Résout une conférence (réponses du GM, ou adjoint envoyé à sa place) :
// applique les effets au moral de l'équipe, à l'opinion publique, à la
// relation avec la direction, au moral des joueurs visés et du vestiaire ;
// compte les critiques de l'arbitrage (amende au-delà d'une par saison) ;
// publie la revue de presse et les réactions des joueurs dans la boîte de
// réception.
async function resolveConference(
  careerId: string,
  teamId: string,
  leagueId: string,
  season: string,
  conferenceId: string,
  locale: Locale,
  answers: { questionId: string; optionId: string }[] | null
): Promise<void> {
  const conference = await prisma.pressConference.findUnique({
    where: { id: conferenceId },
    include: { questions: true },
  });
  if (!conference || conference.careerId !== careerId || conference.teamId !== teamId) return;
  if (conference.status !== "pending") return;
  const skipped = answers === null;

  const [state, standings, membership, team, contracts] = await Promise.all([
    getOrCreateTeamState(careerId, teamId, leagueId),
    getStandings(careerId, leagueId, season),
    prisma.membership.findUnique({
      where: { careerId_teamId: { careerId, teamId } },
      include: { gmProfile: true },
    }),
    prisma.team.findUnique({ where: { id: teamId }, select: { name: true } }),
    prisma.contract.findMany({ where: { careerId, teamId }, select: { playerId: true } }),
  ]);
  const playerStates = await prisma.playerState.findMany({
    where: { careerId, playerId: { in: contracts.map((c) => c.playerId) } },
    include: { player: { select: { firstName: true, lastName: true } } },
  });
  const moraleById = new Map(playerStates.map((s) => [s.playerId, s.morale]));
  const nameById = new Map(playerStates.map((s) => [s.playerId, `${s.player.firstName} ${s.player.lastName}`]));

  const standingsRow = standings.find((s) => s.teamId === teamId);
  const teamWinPct = winPctForStandings(standingsRow?.wins ?? 0, standingsRow?.losses ?? 0);
  const answerByQuestionId = new Map((answers ?? []).map((a) => [a.questionId, a.optionId]));

  const totals = { morale: 0, publicOpinion: 0, frontOfficeApproval: 0 };
  let squadDelta = 0;
  let refereeCriticisms = 0;
  const playerDeltas = new Map<string, number>();
  const chosenOptions: PressOption[] = [];
  const questionUpdates: { id: string; chosenOptionId: string | null; outcome: PressOutcome | null }[] = [];

  for (const question of conference.questions) {
    const optionId = answerByQuestionId.get(question.id);
    const options = JSON.parse(question.optionsJson) as PressOption[];
    const chosen = optionId ? options.find((o) => o.id === optionId) : undefined;
    if (!chosen) {
      questionUpdates.push({ id: question.id, chosenOptionId: null, outcome: null });
      continue;
    }
    const fx: PressEffects = chosen.effects ?? pressAnswerEffects(chosen.tone as AnswerTone, teamWinPct);
    totals.morale += fx.morale;
    totals.publicOpinion += fx.publicOpinion;
    totals.frontOfficeApproval += fx.frontOfficeApproval;
    squadDelta += fx.squadMorale ?? 0;
    if (fx.refereeCriticism) refereeCriticisms++;
    const targetId = question.playerId && moraleById.has(question.playerId) ? question.playerId : null;
    if (targetId && fx.playerMorale) {
      playerDeltas.set(targetId, (playerDeltas.get(targetId) ?? 0) + fx.playerMorale);
    }
    chosenOptions.push(chosen);
    questionUpdates.push({
      id: question.id,
      chosenOptionId: chosen.id,
      outcome: {
        morale: fx.morale,
        publicOpinion: fx.publicOpinion,
        frontOfficeApproval: fx.frontOfficeApproval,
        ...(targetId && fx.playerMorale ? { playerMorale: fx.playerMorale, playerName: nameById.get(targetId) } : {}),
        ...(fx.squadMorale ? { squadMorale: fx.squadMorale } : {}),
        ...(fx.refereeCriticism ? { refereeCriticism: true } : {}),
      },
    });
  }
  if (skipped) {
    totals.morale += SKIP_PRESS_EFFECTS.morale;
    totals.publicOpinion += SKIP_PRESS_EFFECTS.publicOpinion;
    totals.frontOfficeApproval += SKIP_PRESS_EFFECTS.frontOfficeApproval;
  }

  const teamShortName = team?.name ?? teamId;
  const headline = pressHeadline(locale, teamShortName, chosenOptions, skipped);

  // Moral individuel : le vestiaire entier, puis le joueur visé en plus.
  const moraleWrites: { playerId: string; morale: number }[] = [];
  for (const [playerId, current] of moraleById) {
    const delta = squadDelta + (playerDeltas.get(playerId) ?? 0);
    if (delta !== 0) moraleWrites.push({ playerId, morale: clampMorale(current + delta) });
  }

  const newCriticisms = state.refereeCriticisms + refereeCriticisms;
  const fine = refereeCriticisms > 0 ? refereeFine(leagueId, newCriticisms) : 0;

  // Verrou : on « prend » la conférence encore en attente avant d'appliquer
  // quoi que ce soit — deux envois simultanés (double clic, réponse puis
  // adjoint) ne peuvent jamais l'appliquer deux fois.
  const claimed = await prisma.pressConference.updateMany({
    where: { id: conferenceId, status: "pending" },
    data: { status: "answered", skipped, headline, answeredAt: new Date() },
  });
  if (claimed.count === 0) return;

  // Moral des joueurs en une seule requête (voir player-state-patches.ts).
  const patches = new PlayerStatePatches();
  for (const w of moraleWrites) patches.set(w.playerId, { morale: w.morale });

  await prisma.$transaction([
    ...questionUpdates.map((q) =>
      prisma.pressQuestion.update({
        where: { id: q.id },
        data: { chosenOptionId: q.chosenOptionId, outcomeJson: q.outcome ? JSON.stringify(q.outcome) : null },
      })
    ),
    prisma.teamState.update({
      where: { id: state.id },
      data: {
        morale: Math.max(0, Math.min(99, state.morale + totals.morale)),
        publicOpinion: Math.max(0, Math.min(99, state.publicOpinion + totals.publicOpinion)),
        refereeCriticisms: newCriticisms,
        ...(fine > 0 ? { finances: state.finances - fine } : {}),
      },
    }),
    ...(membership?.gmProfile
      ? [
          prisma.gmProfile.update({
            where: { id: membership.gmProfile.id },
            data: {
              frontOfficeApproval: Math.max(
                0,
                Math.min(99, membership.gmProfile.frontOfficeApproval + totals.frontOfficeApproval)
              ),
            },
          }),
        ]
      : []),
  ]);
  await patches.apply(careerId);

  const gameDate = conference.gameDate;
  const review = pressReviewMessageText(locale, headline, totals, skipped);
  await createInboxMessage(careerId, teamId, season, "press_review", review.title, review.body, "/press", { gameDate });
  for (const [playerId, delta] of playerDeltas) {
    if (Math.abs(delta) < 6) continue;
    const reaction = playerReactionMessageText(locale, nameById.get(playerId) ?? playerId, delta > 0, leagueId === "wnba");
    await createInboxMessage(
      careerId,
      teamId,
      season,
      "player_reaction",
      reaction.title,
      reaction.body,
      `/teams/${teamId}/players/${playerId}`,
      { gameDate, playerId }
    );
  }
  if (fine > 0) {
    const msg = refereeFineMessageText(locale, fine);
    await createInboxMessage(careerId, teamId, season, "fine", msg.title, msg.body, null, { gameDate });
  }
}

export async function answerPressConference(
  careerId: string,
  teamId: string,
  leagueId: string,
  season: string,
  conferenceId: string,
  answers: { questionId: string; optionId: string }[],
  locale: Locale
): Promise<void> {
  await resolveConference(careerId, teamId, leagueId, season, conferenceId, locale, answers);
}

// « Envoyer l'adjoint » : la conférence est close sans déclaration du GM.
export async function skipPressConference(
  careerId: string,
  teamId: string,
  leagueId: string,
  season: string,
  conferenceId: string,
  locale: Locale
): Promise<void> {
  await resolveConference(careerId, teamId, leagueId, season, conferenceId, locale, null);
}

// Moral individuel de l'effectif, du plus bas au plus haut (vestiaire).
export async function getSquadMorale(
  careerId: string,
  teamId: string
): Promise<{ playerId: string; name: string; morale: number; wantsTrade: boolean }[]> {
  const contracts = await prisma.contract.findMany({ where: { careerId, teamId }, select: { playerId: true } });
  const states = await prisma.playerState.findMany({
    where: { careerId, playerId: { in: contracts.map((c) => c.playerId) } },
    include: { player: { select: { firstName: true, lastName: true } } },
  });
  return states
    .map((s) => ({
      playerId: s.playerId,
      name: `${s.player.firstName} ${s.player.lastName}`,
      morale: s.morale,
      wantsTrade: s.wantsTrade,
    }))
    .sort((a, b) => a.morale - b.morale);
}
