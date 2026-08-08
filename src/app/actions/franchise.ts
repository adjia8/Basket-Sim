"use server";

import { revalidatePath } from "next/cache";
import { verifySession } from "@/lib/auth/dal";
import { prisma } from "@/lib/prisma";
import { getScheduleForCareer } from "@/lib/data-access/schedule";
import { getOrAdvancePlayoffs } from "@/lib/data-access/playoffs";
import { upgradeFacility as upgradeFacilityDataAccess } from "@/lib/data-access/team-state";

// Amélioration d'infrastructures/personnel — uniquement pendant la fenêtre
// d'intersaison (saison régulière ET playoffs terminés, champion désigné,
// pas encore basculé sur la nouvelle saison), même condition que celle qui
// affiche le bouton "Passer à la saison suivante" sur le tableau de bord.
export async function upgradeFacility(formData: FormData): Promise<void> {
  const { userId } = await verifySession();
  const component = String(formData.get("component") ?? "");
  if (component !== "facilities" && component !== "trainingStaff") return;

  const membership = await prisma.membership.findUnique({
    where: { userId },
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
    component
  );

  revalidatePath("/franchise");
}
