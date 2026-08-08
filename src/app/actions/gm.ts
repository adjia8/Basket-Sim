"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { verifySession } from "@/lib/auth/dal";
import { prisma } from "@/lib/prisma";
import { expectationForRoster } from "@/lib/careers/gm-rules";

async function averageOverallForTeam(careerId: string, teamId: string): Promise<number> {
  const roster = await prisma.contract.findMany({
    where: { careerId, teamId },
    include: { player: { select: { overallRating: true } } },
  });
  if (roster.length === 0) return 50;
  return roster.reduce((sum, c) => sum + c.player.overallRating, 0) / roster.length;
}

async function switchTeam(membershipId: string, careerId: string, newTeamId: string): Promise<void> {
  const [team, averageOverall] = await Promise.all([
    prisma.team.findUnique({ where: { id: newTeamId } }),
    averageOverallForTeam(careerId, newTeamId),
  ]);
  if (!team) return;

  const career = await prisma.career.findUnique({ where: { id: careerId } });
  if (!career) return;

  await prisma.$transaction([
    prisma.membership.update({ where: { id: membershipId }, data: { teamId: newTeamId } }),
    prisma.gmProfile.update({
      where: { membershipId },
      data: {
        pendingReassignment: false,
        pendingOfferTeamId: null,
        warningsAtCurrentTeam: 0,
        hiredSeason: career.season,
        currentExpectationTier: expectationForRoster(averageOverall, team.marketAppeal),
      },
    }),
  ]);
}

// Un GM viré (GmProfile.pendingReassignment) choisit une nouvelle franchise
// parmi les équipes actuellement gérées par l'IA de la même Career.
export async function reassignFranchise(formData: FormData): Promise<void> {
  const { userId } = await verifySession();
  const teamId = String(formData.get("teamId") ?? "");

  const membership = await prisma.membership.findUnique({
    where: { userId },
    include: { gmProfile: true },
  });
  if (!membership?.gmProfile?.pendingReassignment) return;

  const alreadyTaken = await prisma.membership.findUnique({
    where: { careerId_teamId: { careerId: membership.careerId, teamId } },
  });
  if (alreadyTaken) return;

  const career = await prisma.career.findUnique({ where: { id: membership.careerId } });
  const team = await prisma.team.findFirst({ where: { id: teamId, leagueId: career?.leagueId } });
  if (!career || !team) return;

  await switchTeam(membership.id, membership.careerId, teamId);
  revalidatePath("/", "layout");
  redirect("/");
}

// Offre de dépeçage acceptée : même mécanique de changement d'équipe,
// déclenchée par l'offre enregistrée par advanceSeason (pas par le client).
export async function acceptPoachOffer(): Promise<void> {
  const { userId } = await verifySession();

  const membership = await prisma.membership.findUnique({
    where: { userId },
    include: { gmProfile: true },
  });
  const offerTeamId = membership?.gmProfile?.pendingOfferTeamId;
  if (!membership || !offerTeamId) return;

  const alreadyTaken = await prisma.membership.findUnique({
    where: { careerId_teamId: { careerId: membership.careerId, teamId: offerTeamId } },
  });
  if (alreadyTaken) return;

  await switchTeam(membership.id, membership.careerId, offerTeamId);
  revalidatePath("/", "layout");
}

export async function declinePoachOffer(): Promise<void> {
  const { userId } = await verifySession();

  const membership = await prisma.membership.findUnique({
    where: { userId },
    include: { gmProfile: true },
  });
  if (!membership?.gmProfile) return;

  await prisma.gmProfile.update({
    where: { membershipId: membership.id },
    data: { pendingOfferTeamId: null },
  });
  revalidatePath("/gm");
}
