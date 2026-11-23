"use server";

import { activeMembershipWhere } from "@/lib/auth/active-membership";
import { revalidatePath } from "next/cache";
import { verifySession } from "@/lib/auth/dal";
import { prisma } from "@/lib/prisma";
import { getOrAdvancePlayoffs } from "@/lib/data-access/playoffs";
import { computeSeasonReview } from "@/lib/data-access/offseason";
import { SEASON_PLANS, parseSeasonReview, planEffects, type SeasonPlan } from "@/lib/careers/offseason-rules";

async function currentGm() {
  const { userId } = await verifySession();
  const membership = await prisma.membership.findFirst({
    where: await activeMembershipWhere(userId),
    include: { career: true, gmProfile: true },
  });
  if (!membership?.gmProfile) return null;
  return membership;
}

// Réunion de fin de saison : le verdict est calculé et figé (la fin de
// saison le reprend tel quel, voir advanceSeason).
export async function holdBoardMeeting(): Promise<void> {
  const m = await currentGm();
  if (!m?.gmProfile) return;
  const playoffs = await getOrAdvancePlayoffs(m.careerId, m.career.season, m.career.leagueId);
  if (!playoffs?.champion) return;
  const review = await computeSeasonReview(m.careerId, m.career.leagueId, m.career.season, m.teamId, m.gmProfile);
  await prisma.gmProfile.update({ where: { id: m.gmProfile.id }, data: { seasonReviewJson: JSON.stringify(review) } });
  revalidatePath("/offseason");
}

export async function chooseSeasonPlan(formData: FormData): Promise<void> {
  const plan = String(formData.get("plan")) as SeasonPlan;
  if (!SEASON_PLANS.includes(plan)) return;
  const m = await currentGm();
  if (!m?.gmProfile) return;
  const review = parseSeasonReview(m.gmProfile.seasonReviewJson);
  if (!review || review.season !== m.career.season || review.plan || review.outcome === "fired") return;
  const { approval } = planEffects(plan, review.outcome);
  // Garde contre le double clic : n'écrit que si la revue n'a pas changé.
  await prisma.gmProfile.updateMany({
    where: { id: m.gmProfile.id, seasonReviewJson: m.gmProfile.seasonReviewJson },
    data: {
      seasonReviewJson: JSON.stringify({ ...review, plan }),
      frontOfficeApproval: Math.max(0, Math.min(99, m.gmProfile.frontOfficeApproval + approval)),
    },
  });
  revalidatePath("/offseason");
}
