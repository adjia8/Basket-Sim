"use server";

import { revalidatePath } from "next/cache";
import { verifySession } from "@/lib/auth/dal";
import { activeMembershipWhere } from "@/lib/auth/active-membership";
import { prisma } from "@/lib/prisma";
import { getStaffProfiles } from "@/lib/data-access/staff";
import { NEUTRAL_STAFF_PROFILE } from "@/lib/careers/staff-rules";
import { personalityFor } from "@/lib/careers/personality-rules";
import {
  INTERVIEWS_PER_DRAFT,
  INTERVIEW_QUESTIONS,
  QUESTIONS_PER_INTERVIEW,
  answerQuestion,
  type InterviewQuestion,
} from "@/lib/careers/draft-interview-rules";
import { getTranslator } from "@/lib/i18n/translate";

export interface InterviewFormState {
  error?: string;
  ok?: boolean;
}

// Entretien d'avant-draft : au plus QUESTIONS_PER_INTERVIEW questions, et
// INTERVIEWS_PER_DRAFT entretiens par équipe et par draft.
export async function interviewProspect(
  _prev: InterviewFormState | undefined,
  formData: FormData
): Promise<InterviewFormState> {
  const { userId } = await verifySession();
  const { t } = await getTranslator();
  const prospectId = String(formData.get("prospectId") ?? "");
  const questions = [...new Set(formData.getAll("questions").map(String))].filter((q): q is InterviewQuestion =>
    INTERVIEW_QUESTIONS.includes(q as InterviewQuestion)
  );
  if (questions.length === 0 || questions.length > QUESTIONS_PER_INTERVIEW) {
    return { error: t("interview.error.questions", { count: QUESTIONS_PER_INTERVIEW }) };
  }
  const membership = await prisma.membership.findFirst({ where: await activeMembershipWhere(userId), include: { career: true } });
  if (!membership) return { error: t("rosterAction.noCareer") };
  const { careerId, teamId } = membership;
  const season = membership.career.season;

  const [prospect, pendingPicks, used, already] = await Promise.all([
    prisma.prospect.findFirst({ where: { id: prospectId, careerId } }),
    prisma.draftPick.count({ where: { careerId, season, status: "pending" } }),
    prisma.prospectInterview.count({ where: { careerId, teamId, season } }),
    prisma.prospectInterview.count({ where: { careerId, teamId, prospectId } }),
  ]);
  if (!prospect || pendingPicks === 0) return { error: t("interview.error.unavailable") };
  if (already > 0) return { error: t("interview.error.already") };
  if (used >= INTERVIEWS_PER_DRAFT) return { error: t("interview.error.limit", { count: INTERVIEWS_PER_DRAFT }) };

  const scouting =
    (await getStaffProfiles(careerId, [teamId], membership.career.leagueId)).get(teamId)?.scouting ??
    NEUTRAL_STAFF_PROFILE.scouting;
  const personality = personalityFor(prospect.id, prospect.age);
  const answers = questions.map((q) => answerQuestion(q, personality, scouting, `${careerId}:${teamId}:${prospect.id}`));
  try {
    await prisma.prospectInterview.create({
      data: { careerId, teamId, season, prospectId, answersJson: JSON.stringify(answers) },
    });
  } catch {
    return { error: t("interview.error.already") };
  }
  revalidatePath("/draft");
  return { ok: true };
}
