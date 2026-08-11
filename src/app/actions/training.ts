"use server";

import { revalidatePath } from "next/cache";
import { verifySession } from "@/lib/auth/dal";
import { prisma } from "@/lib/prisma";
import { getOrCreateTeamState } from "@/lib/data-access/team-state";
import { TRAINING_FOCUS_ATTRIBUTES, type TrainingFocus, type TrainingIntensity } from "@/lib/careers/training-rules";
import { getTranslator } from "@/lib/i18n/translate";

const VALID_FOCUSES = new Set<TrainingFocus>(Object.keys(TRAINING_FOCUS_ATTRIBUTES) as TrainingFocus[]);
const VALID_INTENSITIES = new Set<TrainingIntensity>(["low", "medium", "high"]);

export interface TrainingPlanFormState {
  error?: string;
  success?: string;
}

// Réglage du programme d'entraînement de mon équipe — contrairement aux
// infrastructures, se change à tout moment pendant la saison (pas de fenêtre
// d'intersaison à respecter) : effets appliqués au prochain match joué, voir
// advanceRosterTraining dans src/app/api/simulate-game/route.ts. Retourne un
// état (au lieu d'un simple `return` silencieux) car le formulaire ne change
// rien visuellement par lui-même (les <select> affichent déjà la valeur que
// l'utilisateur vient de choisir) — sans confirmation explicite, un clic qui
// réussit est indiscernable d'un clic qui échoue.
export async function setTrainingPlan(
  _prevState: TrainingPlanFormState | undefined,
  formData: FormData
): Promise<TrainingPlanFormState> {
  const { userId } = await verifySession();
  const { t } = await getTranslator();
  const focusRaw = String(formData.get("focus") ?? "");
  const intensityRaw = String(formData.get("intensity") ?? "");
  if (!VALID_FOCUSES.has(focusRaw as TrainingFocus)) return { error: t("training.invalidFocus") };
  if (!VALID_INTENSITIES.has(intensityRaw as TrainingIntensity)) return { error: t("training.invalidIntensity") };

  const membership = await prisma.membership.findUnique({
    where: { userId },
    include: { career: true },
  });
  if (!membership) return { error: t("rosterAction.noCareer") };

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
  return { success: t("training.applied") };
}
