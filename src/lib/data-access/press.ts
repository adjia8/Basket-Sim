import "server-only";
import { prisma } from "@/lib/prisma";
import { getOrCreateTeamState } from "@/lib/data-access/team-state";
import { getStandings } from "@/lib/data-access/standings";
import { winPctForStandings } from "@/lib/careers/player-demands";
import type { Locale } from "@/lib/i18n/locale";
import {
  generateQuestions,
  pressAnswerEffects,
  PRESS_CONFERENCE_CHANCE,
  PRESS_CONFERENCE_COOLDOWN_DAYS,
  type AnswerTone,
  type PressOption,
} from "@/lib/careers/press-rules";

export interface PressQuestionView {
  id: string;
  order: number;
  prompt: string;
  category: string;
  options: PressOption[];
  chosenOptionId: string | null;
}

export interface PressConferenceView {
  id: string;
  teamId: string;
  gameDate: string;
  status: string;
  questions: PressQuestionView[];
}

function toView(row: {
  id: string;
  teamId: string;
  gameDate: Date;
  status: string;
  questions: { id: string; order: number; prompt: string; category: string; optionsJson: string; chosenOptionId: string | null }[];
}): PressConferenceView {
  return {
    id: row.id,
    teamId: row.teamId,
    gameDate: row.gameDate.toISOString().slice(0, 10),
    status: row.status,
    questions: [...row.questions]
      .sort((a, b) => a.order - b.order)
      .map((q) => ({
        id: q.id,
        order: q.order,
        prompt: q.prompt,
        category: q.category,
        options: JSON.parse(q.optionsJson) as PressOption[],
        chosenOptionId: q.chosenOptionId,
      })),
  };
}

// Appelé une fois par équipe humaine juste après la résolution d'un match :
// au plus 1 conférence en attente à la fois, et un délai minimum de
// PRESS_CONFERENCE_COOLDOWN_DAYS (jours réels du calendrier, pas de tick
// calendaire dans ce jeu — même principe que getRestDays) depuis la
// dernière, puis tirage au sort.
export async function maybeCreatePressConference(
  careerId: string,
  teamId: string,
  leagueId: string,
  gameDate: Date,
  locale: Locale
): Promise<void> {
  const state = await getOrCreateTeamState(careerId, teamId, leagueId);

  const pending = await prisma.pressConference.findFirst({
    where: { careerId, teamId, status: "pending" },
  });
  if (pending) return;

  if (state.lastPressConferenceDate) {
    const diffDays = (gameDate.getTime() - state.lastPressConferenceDate.getTime()) / 86_400_000;
    if (diffDays < PRESS_CONFERENCE_COOLDOWN_DAYS) return;
  }
  if (Math.random() >= PRESS_CONFERENCE_CHANCE) return;

  const count = Math.random() < 0.5 ? 3 : 4;
  const generated = generateQuestions(count, locale);

  await prisma.$transaction([
    prisma.pressConference.create({
      data: {
        careerId,
        teamId,
        gameDate,
        questions: {
          create: generated.map((q, i) => ({
            order: i,
            prompt: q.prompt,
            category: q.category,
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

export async function getPressHistory(careerId: string, teamId: string): Promise<PressConferenceView[]> {
  const rows = await prisma.pressConference.findMany({
    where: { careerId, teamId, status: "answered" },
    include: { questions: true },
    orderBy: { createdAt: "desc" },
  });
  return rows.map(toView);
}

// Applique l'effet cumulé des tons choisis à TeamState.morale/publicOpinion
// et, si un GmProfile existe pour ce Membership, à
// GmProfile.frontOfficeApproval — puis marque la conférence "answered".
export async function answerPressConference(
  careerId: string,
  teamId: string,
  leagueId: string,
  season: string,
  conferenceId: string,
  answers: { questionId: string; optionId: string }[]
): Promise<void> {
  const conference = await prisma.pressConference.findUnique({
    where: { id: conferenceId },
    include: { questions: true },
  });
  if (!conference || conference.careerId !== careerId || conference.teamId !== teamId) return;
  if (conference.status !== "pending") return;

  const [state, standings, membership] = await Promise.all([
    getOrCreateTeamState(careerId, teamId, leagueId),
    getStandings(careerId, leagueId, season),
    prisma.membership.findUnique({
      where: { careerId_teamId: { careerId, teamId } },
      include: { gmProfile: true },
    }),
  ]);

  let moraleDelta = 0;
  let publicOpinionDelta = 0;
  let frontOfficeApprovalDelta = 0;
  const answerByQuestionId = new Map(answers.map((a) => [a.questionId, a.optionId]));

  const standingsRow = standings.find((s) => s.teamId === teamId);
  const teamWinPct = winPctForStandings(standingsRow?.wins ?? 0, standingsRow?.losses ?? 0);

  for (const question of conference.questions) {
    const optionId = answerByQuestionId.get(question.id);
    if (!optionId) continue;
    const options = JSON.parse(question.optionsJson) as PressOption[];
    const chosen = options.find((o) => o.id === optionId);
    if (!chosen) continue;

    const effects = pressAnswerEffects(chosen.tone as AnswerTone, teamWinPct);
    moraleDelta += effects.morale;
    publicOpinionDelta += effects.publicOpinion;
    frontOfficeApprovalDelta += effects.frontOfficeApproval;

    await prisma.pressQuestion.update({
      where: { id: question.id },
      data: { chosenOptionId: optionId },
    });
  }

  await prisma.pressConference.update({
    where: { id: conferenceId },
    data: { status: "answered" },
  });

  await prisma.teamState.update({
    where: { id: state.id },
    data: {
      morale: Math.max(0, Math.min(99, state.morale + moraleDelta)),
      publicOpinion: Math.max(0, Math.min(99, state.publicOpinion + publicOpinionDelta)),
    },
  });

  if (membership?.gmProfile) {
    await prisma.gmProfile.update({
      where: { id: membership.gmProfile.id },
      data: {
        frontOfficeApproval: Math.max(
          0,
          Math.min(99, membership.gmProfile.frontOfficeApproval + frontOfficeApprovalDelta)
        ),
      },
    });
  }
}
