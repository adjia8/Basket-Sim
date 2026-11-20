"use server";

import {
  CALENDAR_TEMPLATES,
  SESSION_TYPES,
  parseCalendar,
  type CalendarTemplate,
  type SessionType,
  type TrainingCalendar,
} from "@/lib/careers/training-calendar-rules";
import { activeMembershipWhere } from "@/lib/auth/active-membership";
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

  const membership = await prisma.membership.findFirst({
    where: await activeMembershipWhere(userId),
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

export interface TrainingCalendarFormState {
  error?: string;
  success?: string;
}

// Calendrier d'entraînement (voir training-calendar-rules.ts) : modèle et
// séances choisies jour par jour (« auto » = revenir au modèle ce jour-là).
// mode = "save" | "reset" (efface les choix) | "off" (retour au programme fixe).
export async function saveTrainingCalendar(
  _prev: TrainingCalendarFormState | undefined,
  formData: FormData
): Promise<TrainingCalendarFormState> {
  const { userId } = await verifySession();
  const { t } = await getTranslator();
  const mode = String(formData.get("mode") ?? "save");
  const template = String(formData.get("template") ?? "balanced") as CalendarTemplate;
  if (!CALENDAR_TEMPLATES.includes(template)) return { error: t("calendar.error") };

  const membership = await prisma.membership.findFirst({ where: await activeMembershipWhere(userId), include: { career: true } });
  if (!membership) return { error: t("rosterAction.noCareer") };
  const state = await getOrCreateTeamState(membership.careerId, membership.teamId, membership.career.leagueId);

  if (mode === "off") {
    await prisma.teamState.update({ where: { id: state.id }, data: { trainingCalendarJson: null } });
    revalidatePath(`/teams/${membership.teamId}`);
    return { success: t("calendar.off") };
  }
  const current = parseCalendar(state.trainingCalendarJson);
  const overrides: Record<string, SessionType> = mode === "reset" ? {} : { ...(current?.overrides ?? {}) };
  if (mode === "save") {
    for (const [key, value] of formData.entries()) {
      if (!key.startsWith("day:")) continue;
      const date = key.slice(4);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
      const v = String(value);
      if (v === "auto") delete overrides[date];
      else if (SESSION_TYPES.includes(v as SessionType)) overrides[date] = v as SessionType;
    }
  }
  // Les jours passés ne servent plus : on ne garde que les 60 derniers jours.
  const cutoff = new Date(Date.now() - 60 * 86_400_000).toISOString().slice(0, 10);
  for (const d of Object.keys(overrides)) if (d < cutoff) delete overrides[d];
  const calendar: TrainingCalendar = { template, overrides };
  await prisma.teamState.update({ where: { id: state.id }, data: { trainingCalendarJson: JSON.stringify(calendar) } });
  revalidatePath(`/teams/${membership.teamId}`);
  return { success: t("calendar.saved") };
}
