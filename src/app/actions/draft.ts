"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { verifySession } from "@/lib/auth/dal";
import { prisma } from "@/lib/prisma";
import { generateContractTerms } from "@/lib/careers/generate-contracts";
import { getLeagueById } from "@/lib/data-access/leagues";
import { MAX_ROSTER_SIZE } from "@/lib/careers/roster-rules";

export async function draftProspect(formData: FormData): Promise<void> {
  const { userId } = await verifySession();
  const prospectId = String(formData.get("prospectId") ?? "");

  const membership = await prisma.membership.findUnique({ where: { userId } });
  if (!membership) return;

  const [prospect, teamContracts] = await Promise.all([
    prisma.prospect.findUnique({ where: { id: prospectId } }),
    prisma.contract.findMany({
      where: { careerId: membership.careerId, teamId: membership.teamId },
      select: { salary: true },
    }),
  ]);
  if (!prospect || prospect.careerId !== membership.careerId) return;
  if (teamContracts.length >= MAX_ROSTER_SIZE) return;

  // Calculée une seule fois : generateContractTerms tire un salaire aléatoire,
  // la réutiliser pour la vérification du cap ET l'insertion évite un montant
  // vérifié différent du montant réellement facturé.
  const terms = generateContractTerms(prospect.overallRating, prospect.leagueId);
  const league = await getLeagueById(prospect.leagueId);
  const currentPayroll = teamContracts.reduce((sum, c) => sum + c.salary, 0);
  const salaryCap = league?.salaryCap ?? Infinity;
  if (currentPayroll + terms.salary > salaryCap) return;

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
          ...terms,
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
