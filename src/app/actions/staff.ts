"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getCurrentMembership } from "@/lib/auth/dal";
import { fireStaff, hireStaff, renewStaff, requestBudgetIncrease } from "@/lib/data-access/staff";
import { getLocale } from "@/lib/i18n/locale";

// Toutes les actions renvoient vers /staff avec un code de résultat
// (?msg=…) affiché en haut de page, en conservant le rôle filtré du marché.
function back(role: string | null, msg: string): never {
  revalidatePath("/staff");
  revalidatePath("/", "layout");
  const params = new URLSearchParams({ msg });
  if (role) params.set("role", role);
  redirect(`/staff?${params.toString()}`);
}

export async function hireStaffAction(formData: FormData): Promise<void> {
  const m = await getCurrentMembership();
  const staffId = String(formData.get("staffId") ?? "");
  const years = Number(formData.get("years") ?? 2);
  const role = (formData.get("role") as string | null) ?? null;
  const error = await hireStaff(m.careerId, m.teamId, m.leagueId, m.season, staffId, years);
  back(role, error ?? "hired");
}

export async function fireStaffAction(formData: FormData): Promise<void> {
  const m = await getCurrentMembership();
  const staffId = String(formData.get("staffId") ?? "");
  const error = await fireStaff(m.careerId, m.teamId, m.leagueId, staffId);
  back(null, error ?? "fired");
}

export async function renewStaffAction(formData: FormData): Promise<void> {
  const m = await getCurrentMembership();
  const staffId = String(formData.get("staffId") ?? "");
  const years = Number(formData.get("years") ?? 2);
  const error = await renewStaff(m.careerId, m.teamId, m.leagueId, m.season, staffId, years);
  back(null, error ?? "renewed");
}

export async function requestBudgetAction(): Promise<void> {
  const m = await getCurrentMembership();
  const { error, approved } = await requestBudgetIncrease(m.careerId, m.teamId, m.leagueId, m.season, await getLocale());
  back(null, error ?? (approved ? "budgetApproved" : "budgetDenied"));
}
