"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import type { Prospect } from "@prisma/client";
import { verifySession } from "@/lib/auth/dal";
import { prisma } from "@/lib/prisma";
import { getCurrentDraftPick, type ResolvedDraftPick } from "@/lib/data-access/draft-picks";
import { getLeagueById } from "@/lib/data-access/leagues";
import { getMembershipForTeam } from "@/lib/data-access/memberships";
import { getTeamsByLeague } from "@/lib/data-access/teams";
import { rookieScaleContract } from "@/lib/careers/rookie-scale";
import { initialRenown } from "@/lib/careers/renown-rules";

async function performDraftPick(
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
        },
      });
      await tx.contract.create({
        data: {
          careerId: currentPick.careerId,
          playerId: newPlayerId,
          teamId: currentPick.teamId,
          ...terms,
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

export async function draftProspect(formData: FormData): Promise<void> {
  const { userId } = await verifySession();
  const prospectId = String(formData.get("prospectId") ?? "");

  const membership = await prisma.membership.findUnique({
    where: { userId },
    include: { career: true },
  });
  if (!membership) return;

  const [league, teams, prospect] = await Promise.all([
    getLeagueById(membership.career.leagueId),
    getTeamsByLeague(membership.career.leagueId),
    prisma.prospect.findUnique({ where: { id: prospectId } }),
  ]);
  if (!league || !prospect || prospect.careerId !== membership.careerId) return;

  const currentPick = await getCurrentDraftPick(
    membership.careerId,
    membership.career.season,
    league.salaryCap,
    teams.length,
    membership.career.leagueId
  );
  if (!currentPick || currentPick.teamId !== membership.teamId) return; // pas mon tour

  await performDraftPick(currentPick, prospect, teams.length, membership.career.leagueId);
}

// Fait drafter une équipe gérée par l'IA — n'importe quel membre humain de la
// ligue peut déclencher ce pick (comme pour un match IA-vs-IA), sinon le
// draft resterait bloqué en l'absence de manager pour cette équipe.
export async function draftForAiTeam(): Promise<void> {
  const { userId } = await verifySession();

  const membership = await prisma.membership.findUnique({
    where: { userId },
    include: { career: true },
  });
  if (!membership) return;

  const [league, teams] = await Promise.all([
    getLeagueById(membership.career.leagueId),
    getTeamsByLeague(membership.career.leagueId),
  ]);
  if (!league) return;

  const currentPick = await getCurrentDraftPick(
    membership.careerId,
    membership.career.season,
    league.salaryCap,
    teams.length,
    membership.career.leagueId
  );
  if (!currentPick) return;

  const manager = await getMembershipForTeam(membership.careerId, currentPick.teamId);
  if (manager) return; // équipe gérée par un autre humain, pas à toi de jouer pour elle

  const prospects = await prisma.prospect.findMany({ where: { careerId: membership.careerId } });
  const best = [...prospects].sort((a, b) => b.overallRating - a.overallRating)[0];
  if (!best) return;

  await performDraftPick(currentPick, best, teams.length, membership.career.leagueId);
}
