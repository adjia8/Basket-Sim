"use server";

import { revalidatePath } from "next/cache";
import { verifySession } from "@/lib/auth/dal";
import { prisma } from "@/lib/prisma";
import { answerPressConference, skipPressConference } from "@/lib/data-access/press";
import { getLocale } from "@/lib/i18n/locale";

async function currentMembership() {
  const { userId } = await verifySession();
  return prisma.membership.findUnique({ where: { userId }, include: { career: true } });
}

function revalidatePress() {
  revalidatePath("/press");
  revalidatePath("/inbox");
  revalidatePath("/");
}

// Un groupe de boutons radio par question, nommé "answer_<questionId>" — on
// parcourt le FormData plutôt que d'attendre une liste fixe de champs,
// puisque le nombre de questions varie (3 à 4).
export async function submitPressAnswers(formData: FormData): Promise<void> {
  const conferenceId = String(formData.get("conferenceId") ?? "");
  if (!conferenceId) return;
  const membership = await currentMembership();
  if (!membership) return;

  const answers: { questionId: string; optionId: string }[] = [];
  for (const [key, value] of formData.entries()) {
    if (!key.startsWith("answer_") || typeof value !== "string" || !value) continue;
    answers.push({ questionId: key.slice("answer_".length), optionId: value });
  }
  if (answers.length === 0) return;

  await answerPressConference(
    membership.careerId,
    membership.teamId,
    membership.career.leagueId,
    membership.career.season,
    conferenceId,
    answers,
    await getLocale()
  );
  revalidatePress();
}

// « Envoyer l'adjoint » : clôt la conférence sans déclaration (petite
// pénalité d'opinion publique, voir SKIP_PRESS_EFFECTS).
export async function skipPressAnswers(formData: FormData): Promise<void> {
  const conferenceId = String(formData.get("conferenceId") ?? "");
  if (!conferenceId) return;
  const membership = await currentMembership();
  if (!membership) return;

  await skipPressConference(
    membership.careerId,
    membership.teamId,
    membership.career.leagueId,
    membership.career.season,
    conferenceId,
    await getLocale()
  );
  revalidatePress();
}
