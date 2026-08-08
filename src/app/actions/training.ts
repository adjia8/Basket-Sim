"use server";

import { revalidatePath } from "next/cache";
import { verifySession } from "@/lib/auth/dal";
import { prisma } from "@/lib/prisma";
import { getOrCreateTeamState } from "@/lib/data-access/team-state";
import { TRAINING_FOCUS_ATTRIBUTES, type TrainingFocus, type TrainingIntensity } from "@/lib/careers/training-rules";

const VALID_FOCUSES = new Set<TrainingFocus>(Object.keys(TRAINING_FOCUS_ATTRIBUTES) as TrainingFocus[]);
const VALID_INTENSITIES = new Set<TrainingIntensity>(["low", "medium", "high"]);

// Réglage du programme d'entraînement de mon équipe — contrairement aux
// infrastructures, se change à tout moment pendant la saison (pas de fenêtre
// d'intersaison à respecter) : effets appliqués au prochain match joué, voir
// advanceRosterTraining dans src/app/api/simulate-game/route.ts.
export async function setTrainingPlan(formData: FormData): Promise<void> {
  const { userId } = await verifySession();
  const focusRaw = String(formData.get("focus") ?? "");
  const intensityRaw = String(formData.get("intensity") ?? "");
  if (!VALID_FOCUSES.has(focusRaw as TrainingFocus)) return;
  if (!VALID_INTENSITIES.has(intensityRaw as TrainingIntensity)) return;

  const membership = await prisma.membership.findUnique({
    where: { userId },
    include: { career: true },
  });
  if (!membership) return;

  const state = await getOrCreateTeamState(
    membership.careerId,
    membership.teamId,
    membership.career.leagueId
  );

  await prisma.teamState.update({
    where: { id: state.id },
    data: { trainingFocus: focusRaw, trainingIntensity: intensityRaw },
  });

  revalidatePath(`/teams/${membership.teamId}`);
}
