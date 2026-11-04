import "server-only";
import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import type { Prospect } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { ResolvedDraftPick } from "@/lib/data-access/draft-picks";
import { rookieScaleContract } from "@/lib/careers/rookie-scale";
import { initialRenown } from "@/lib/careers/renown-rules";

// Exécute un choix de draft (joueur créé à partir du prospect, contrat
// rookie, historique, état de Career) — partagé entre les actions de la page
// Draft et la draft automatique de l'IA (voir ai-offseason.ts).
export async function performDraftPick(
  currentPick: ResolvedDraftPick,
  prospect: Prospect,
  picksPerRound: number,
  leagueId: string
): Promise<boolean> {
  const terms = rookieScaleContract(currentPick.pickNumber, picksPerRound, leagueId);
  const newPlayerId = randomUUID();

  try {
    await prisma.$transaction(async (tx) => {
      const claimed = await tx.draftPick.updateMany({
        where: { id: currentPick.id, status: "pending" },
        data: { status: "completed", draftedPlayerId: newPlayerId },
      });
      if (claimed.count === 0) throw new Error("PICK_ALREADY_TAKEN");

      await tx.player.create({
        data: {
          id: newPlayerId,
          // Propre à cette Career (voir Player.careerId) : jamais visible
          // dans les autres carrières.
          careerId: currentPick.careerId,
          teamId: currentPick.teamId,
          leagueId: prospect.leagueId,
          firstName: prospect.firstName,
          lastName: prospect.lastName,
          position: prospect.position,
          jerseyNumber: Math.floor(Math.random() * 100),
          heightCm: prospect.heightCm,
          age: prospect.age,
          overallRating: prospect.overallRating,
          scoringInside: prospect.scoringInside,
          scoringOutside: prospect.scoringOutside,
          playmaking: prospect.playmaking,
          defenseInside: prospect.defenseInside,
          defenseOutside: prospect.defenseOutside,
          rebounding: prospect.rebounding,
          athleticism: prospect.athleticism,
          basketballIQ: prospect.basketballIQ,
          clutch: prospect.clutch,
          stamina: prospect.stamina,
          nationality: prospect.nationality,
        },
      });
      await tx.contract.create({
        data: {
          careerId: currentPick.careerId,
          playerId: newPlayerId,
          teamId: currentPick.teamId,
          ...terms,
          isRookieScale: true,
        },
      });
      await tx.playerTeamStint.create({
        data: {
          careerId: currentPick.careerId,
          playerId: newPlayerId,
          teamId: currentPick.teamId,
          season: currentPick.season,
          reason: "drafted",
        },
      });
      await tx.playerState.create({
        data: {
          careerId: currentPick.careerId,
          playerId: newPlayerId,
          age: prospect.age,
          overallRating: prospect.overallRating,
          scoringInside: prospect.scoringInside,
          scoringOutside: prospect.scoringOutside,
          playmaking: prospect.playmaking,
          defenseInside: prospect.defenseInside,
          defenseOutside: prospect.defenseOutside,
          rebounding: prospect.rebounding,
          athleticism: prospect.athleticism,
          basketballIQ: prospect.basketballIQ,
          clutch: prospect.clutch,
          stamina: prospect.stamina,
          retired: false,
          // Bug latent corrigé au passage : sans ceci, un rookie draftée en
          // cours de carrière retombait sur le défaut plat de PlayerState.renown
          // (50) plutôt que la valeur dérivée de son overall.
          renown: initialRenown(prospect.overallRating),
          peakOverallRating: prospect.overallRating,
          peakRenown: initialRenown(prospect.overallRating),
        },
      });

      const deleted = await tx.prospect.deleteMany({ where: { id: prospect.id } });
      if (deleted.count === 0) throw new Error("PROSPECT_ALREADY_TAKEN");
    });
  } catch (err) {
    if (err instanceof Error && (err.message === "PICK_ALREADY_TAKEN" || err.message === "PROSPECT_ALREADY_TAKEN")) {
      return false;
    }
    throw err;
  }

  revalidatePath("/");
  revalidatePath(`/teams/${currentPick.teamId}`);
  revalidatePath("/draft");
  return true;
}
