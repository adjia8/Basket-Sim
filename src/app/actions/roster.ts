"use server";

import { revalidatePath } from "next/cache";
import { verifySession } from "@/lib/auth/dal";
import { prisma } from "@/lib/prisma";
import { generateContractTerms } from "@/lib/careers/generate-contracts";
import { MAX_ROSTER_SIZE, MIN_ROSTER_SIZE } from "@/lib/careers/roster-rules";

function revalidateRosterPaths(teamId: string) {
  revalidatePath("/");
  revalidatePath(`/teams/${teamId}`);
  revalidatePath("/free-agents");
}

export async function releasePlayer(formData: FormData): Promise<void> {
  const { userId } = await verifySession();
  const playerId = String(formData.get("playerId") ?? "");

  const career = await prisma.career.findUnique({ where: { userId } });
  if (!career) return;

  const contract = await prisma.contract.findUnique({
    where: { careerId_playerId: { careerId: career.id, playerId } },
  });
  // On ne peut libérer qu'un joueur sous contrat avec SON PROPRE effectif.
  if (!contract || contract.teamId !== career.teamId) return;

  const rosterSize = await prisma.contract.count({
    where: { careerId: career.id, teamId: career.teamId },
  });
  if (rosterSize <= MIN_ROSTER_SIZE) return;

  await prisma.contract.delete({
    where: { careerId_playerId: { careerId: career.id, playerId } },
  });

  revalidateRosterPaths(career.teamId);
}

export async function signFreeAgent(formData: FormData): Promise<void> {
  const { userId } = await verifySession();
  const playerId = String(formData.get("playerId") ?? "");

  const career = await prisma.career.findUnique({ where: { userId } });
  if (!career) return;

  const [player, existingContract, rosterSize] = await Promise.all([
    prisma.player.findUnique({ where: { id: playerId } }),
    prisma.contract.findUnique({
      where: { careerId_playerId: { careerId: career.id, playerId } },
    }),
    prisma.contract.count({
      where: { careerId: career.id, teamId: career.teamId },
    }),
  ]);

  if (!player || player.leagueId !== career.leagueId) return;
  if (existingContract) return; // déjà sous contrat dans cette Career
  if (rosterSize >= MAX_ROSTER_SIZE) return;

  await prisma.contract.create({
    data: {
      careerId: career.id,
      playerId,
      teamId: career.teamId,
      ...generateContractTerms(player.overallRating, career.leagueId),
    },
  });

  revalidateRosterPaths(career.teamId);
}
