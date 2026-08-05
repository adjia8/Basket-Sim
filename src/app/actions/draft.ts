"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { verifySession } from "@/lib/auth/dal";
import { prisma } from "@/lib/prisma";
import { generateContractTerms } from "@/lib/careers/generate-contracts";
import { MAX_ROSTER_SIZE } from "@/lib/careers/roster-rules";

export async function draftProspect(formData: FormData): Promise<void> {
  const { userId } = await verifySession();
  const prospectId = String(formData.get("prospectId") ?? "");

  const membership = await prisma.membership.findUnique({ where: { userId } });
  if (!membership) return;

  const [prospect, rosterSize] = await Promise.all([
    prisma.prospect.findUnique({ where: { id: prospectId } }),
    prisma.contract.count({
      where: { careerId: membership.careerId, teamId: membership.teamId },
    }),
  ]);
  if (!prospect || prospect.careerId !== membership.careerId) return;
  if (rosterSize >= MAX_ROSTER_SIZE) return;

  const newPlayerId = randomUUID();

  try {
    await prisma.$transaction([
      prisma.player.create({
        data: {
          id: newPlayerId,
          teamId: membership.teamId,
          leagueId: prospect.leagueId,
          firstName: prospect.firstName,
          lastName: prospect.lastName,
          position: prospect.position,
          jerseyNumber: Math.floor(Math.random() * 100),
          heightCm: prospect.heightCm,
          age: prospect.age,
          overallRating: prospect.overallRating,
          scoring: prospect.scoring,
          playmaking: prospect.playmaking,
          rebounding: prospect.rebounding,
          defense: prospect.defense,
          athleticism: prospect.athleticism,
        },
      }),
      prisma.contract.create({
        data: {
          careerId: membership.careerId,
          playerId: newPlayerId,
          teamId: membership.teamId,
          ...generateContractTerms(prospect.overallRating, prospect.leagueId),
        },
      }),
      prisma.playerState.create({
        data: {
          careerId: membership.careerId,
          playerId: newPlayerId,
          age: prospect.age,
          overallRating: prospect.overallRating,
          scoring: prospect.scoring,
          playmaking: prospect.playmaking,
          rebounding: prospect.rebounding,
          defense: prospect.defense,
          athleticism: prospect.athleticism,
          retired: false,
        },
      }),
      prisma.prospect.delete({ where: { id: prospect.id } }),
    ]);
  } catch (err) {
    // P2025 : un autre manager a déjà drafté ce prospect entre-temps.
    if (err instanceof Error && "code" in err && err.code === "P2025") return;
    throw err;
  }

  revalidatePath("/");
  revalidatePath(`/teams/${membership.teamId}`);
  revalidatePath("/draft");
}
