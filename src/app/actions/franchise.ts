"use server";

import { activeMembershipWhere } from "@/lib/auth/active-membership";
import { revalidatePath } from "next/cache";
import { verifySession } from "@/lib/auth/dal";
import { prisma } from "@/lib/prisma";
import { getScheduleForCareer } from "@/lib/data-access/schedule";
import { getOrAdvancePlayoffs } from "@/lib/data-access/playoffs";
import { upgradeFacility as upgradeFacilityDataAccess } from "@/lib/data-access/team-state";
import { clampPriceLevel } from "@/lib/careers/finance-rules";

// Amélioration d'infrastructures/personnel — uniquement pendant la fenêtre
// d'intersaison (saison régulière ET playoffs terminés, champion désigné,
// pas encore basculé sur la nouvelle saison), même condition que celle qui
// affiche le bouton "Passer à la saison suivante" sur le tableau de bord.
export async function upgradeFacility(formData: FormData): Promise<void> {
  const { userId } = await verifySession();
  const component = String(formData.get("component") ?? "");
  // Le staff ne s'achète plus par paliers : il se recrute (page Staff).
  if (component !== "facilities" && component !== "arena") return;

  const membership = await prisma.membership.findFirst({
    where: await activeMembershipWhere(userId),
    include: { career: true },
  });
  if (!membership) return;

  const games = await getScheduleForCareer(membership.careerId, membership.career.season);
  const seasonComplete = games.length > 0 && games.every((g) => g.status === "final");
  if (!seasonComplete) return;

  const playoffs = await getOrAdvancePlayoffs(
    membership.careerId,
    membership.career.season,
    membership.career.leagueId
  );
  if (!playoffs?.champion) return;

  await upgradeFacilityDataAccess(
    membership.careerId,
    membership.teamId,
    membership.career.leagueId,
    component,
    membership.career.season
  );

  revalidatePath("/franchise");
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
