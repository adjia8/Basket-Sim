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

  const membership = await prisma.membership.findUnique({ where: { userId } });
  if (!membership) return;

  const contract = await prisma.contract.findUnique({
    where: { careerId_playerId: { careerId: membership.careerId, playerId } },
  });
  // On ne peut libérer qu'un joueur sous contrat avec SON PROPRE effectif.
  if (!contract || contract.teamId !== membership.teamId) return;

  const rosterSize = await prisma.contract.count({
    where: { careerId: membership.careerId, teamId: membership.teamId },
  });
  if (rosterSize <= MIN_ROSTER_SIZE) return;

  await prisma.contract.delete({
    where: { careerId_playerId: { careerId: membership.careerId, playerId } },
  });

  revalidateRosterPaths(membership.teamId);
}

export async function signFreeAgent(formData: FormData): Promise<void> {
  const { userId } = await verifySession();
  const playerId = String(formData.get("playerId") ?? "");

  const membership = await prisma.membership.findUnique({
    where: { userId },
    include: { career: true },
  });
  if (!membership) return;

  const [player, existingContract, rosterSize] = await Promise.all([
    prisma.player.findUnique({ where: { id: playerId } }),
    prisma.contract.findUnique({
      where: { careerId_playerId: { careerId: membership.careerId, playerId } },
    }),
    prisma.contract.count({
      where: { careerId: membership.careerId, teamId: membership.teamId },
    }),
  ]);

  if (!player || player.leagueId !== membership.career.leagueId) return;
  if (existingContract) return; // déjà sous contrat dans cette Career
  if (rosterSize >= MAX_ROSTER_SIZE) return;

  try {
    await prisma.contract.create({
      data: {
        careerId: membership.careerId,
        playerId,
        teamId: membership.teamId,
        ...generateContractTerms(player.overallRating, membership.career.leagueId),
      },
    });
  } catch (err) {
    // P2002 : un autre manager a signé ce joueur entre-temps (@@unique([careerId, playerId])).
    if (err instanceof Error && "code" in err && err.code === "P2002") return;
    throw err;
  }

  revalidateRosterPaths(membership.teamId);
}
