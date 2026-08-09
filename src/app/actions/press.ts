"use server";

import { revalidatePath } from "next/cache";
import { verifySession } from "@/lib/auth/dal";
import { prisma } from "@/lib/prisma";
import { answerPressConference } from "@/lib/data-access/press";

// Un champ <select>/radio par question, nommé "answer_<questionId>" — on
// parcourt le FormData plutôt que d'attendre une liste fixe de champs,
// puisque le nombre de questions varie (3 ou 4).
export async function submitPressAnswers(formData: FormData): Promise<void> {
  const { userId } = await verifySession();
  const conferenceId = String(formData.get("conferenceId") ?? "");
  if (!conferenceId) return;

  const membership = await prisma.membership.findUnique({
    where: { userId },
    include: { career: true },
  });
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
    answers
  );

  revalidatePath("/press");
  revalidatePath("/");
}
