"use server";

import { revalidatePath } from "next/cache";
import { verifySession } from "@/lib/auth/dal";
import { activeMembershipWhere } from "@/lib/auth/active-membership";
import { prisma } from "@/lib/prisma";
import { payBuyout } from "@/lib/data-access/europe";
import { getTranslator } from "@/lib/i18n/translate";
import { formatSalary } from "@/lib/utils";

export interface BuyoutFormState {
  error?: string;
  success?: string;
}

// Racheter le contrat européen d'un joueur (ou faire venir un joueur
// drafté resté en Europe) : droits exclusifs, puis négociation du contrat.
export async function buyoutPlayer(_prev: BuyoutFormState | undefined, formData: FormData): Promise<BuyoutFormState> {
  const { userId } = await verifySession();
  const { t, locale } = await getTranslator();
  const playerId = String(formData.get("playerId") ?? "");
  const membership = await prisma.membership.findFirst({ where: await activeMembershipWhere(userId), include: { career: true } });
  if (!membership) return { error: t("europe.error.unknown") };
  const res = await payBuyout(membership.careerId, membership.teamId, playerId, membership.career.season);
  revalidatePath("/teams/[teamId]/players/[playerId]", "page");
  revalidatePath("/scouting");
  revalidatePath("/draft");
  if (!res.ok) return { error: t(`europe.error.${res.error}`) };
  return { success: t("europe.bought", { amount: formatSalary(res.amount, locale) }) };
}
