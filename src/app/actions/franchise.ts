"use server";

import { activeMembershipWhere } from "@/lib/auth/active-membership";
import { revalidatePath } from "next/cache";
import { verifySession } from "@/lib/auth/dal";
import { prisma } from "@/lib/prisma";
import { getGameClock } from "@/lib/data-access/game-clock";
import { startFacilityProject } from "@/lib/data-access/facility-projects";
import { projectDef, type Financing, type ProjectKey } from "@/lib/careers/facility-projects-rules";
import { getTranslator } from "@/lib/i18n/translate";
import { formatLongDate, formatSalary } from "@/lib/utils";
import { clampPriceLevel } from "@/lib/careers/finance-rules";

export interface FacilityFormState {
  error?: string;
  success?: string;
}

// Lancer un projet d'infrastructure (voir facility-projects-rules.ts) :
// possible toute l'année ; le chantier avance avec le calendrier du jeu.
export async function startProject(_prev: FacilityFormState | undefined, formData: FormData): Promise<FacilityFormState> {
  const { userId } = await verifySession();
  const { t, locale } = await getTranslator();
  const key = String(formData.get("projectKey") ?? "") as ProjectKey;
  const financingRaw = String(formData.get("financing") ?? "cash");
  const financing: Financing = financingRaw === "loan" || financingRaw === "owners" ? financingRaw : "cash";
  if (!projectDef(key)) return { error: t("facility.error.unknown") };

  const membership = await prisma.membership.findFirst({
    where: await activeMembershipWhere(userId),
    include: { career: true, gmProfile: { select: { frontOfficeApproval: true } } },
  });
  if (!membership) return { error: t("facility.error.unknown") };
  const clock = await getGameClock(membership.careerId, membership.teamId);
  const today = clock.today ?? new Date();
  const res = await startFacilityProject({
    careerId: membership.careerId,
    teamId: membership.teamId,
    leagueId: membership.career.leagueId,
    season: membership.career.season,
    key,
    financing,
    today,
    approval: membership.gmProfile?.frontOfficeApproval ?? 50,
  });
  revalidatePath("/franchise");
  if (!res.ok) return { error: t(`facility.error.${res.error}`) };
  const date = formatLongDate(new Date(res.completesOn), locale);
  return {
    success: res.ownersPaid > 0 ? t("facility.okOwners", { amount: formatSalary(res.ownersPaid, locale), date }) : t("facility.ok", { date }),
  };
}

// Prix des billets et de la restauration (en % du prix « marché »),
// modifiables à tout moment : effet dès le prochain match à domicile.
export async function setPricing(formData: FormData): Promise<void> {
  const { userId } = await verifySession();
  const membership = await prisma.membership.findFirst({ where: await activeMembershipWhere(userId) });
  if (!membership) return;
  const ticket = clampPriceLevel(Number(formData.get("ticketPriceLevel")));
  const concession = clampPriceLevel(Number(formData.get("concessionPriceLevel")));
  await prisma.teamState.updateMany({
    where: { careerId: membership.careerId, teamId: membership.teamId },
    data: { ticketPriceLevel: ticket, concessionPriceLevel: concession },
  });
  revalidatePath("/franchise");
}
