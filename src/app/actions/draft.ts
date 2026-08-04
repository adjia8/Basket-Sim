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

  const career = await prisma.career.findUnique({ where: { userId } });
  if (!career) return;

  const [prospect, rosterSize] = await Promise.all([
    prisma.prospect.findUnique({ where: { id: prospectId } }),
    prisma.contract.count({
      where: { careerId: career.id, teamId: career.teamId },
    }),
  ]);
  if (!prospect || prospect.careerId !== career.id) return;
  if (rosterSize >= MAX_ROSTER_SIZE) return;

  const newPlayerId = randomUUID();

  await prisma.$transaction([
    prisma.player.create({
      data: {
        id: newPlayerId,
        teamId: career.teamId,
        leagueId: career.leagueId,
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
        careerId: career.id,
        playerId: newPlayerId,
        teamId: career.teamId,
        ...generateContractTerms(prospect.overallRating, career.leagueId),
      },
    }),
    prisma.playerState.create({
      data: {
        careerId: career.id,
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

  revalidatePath("/");
  revalidatePath(`/teams/${career.teamId}`);
  revalidatePath("/draft");
}
