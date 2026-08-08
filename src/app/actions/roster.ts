"use server";

import { revalidatePath } from "next/cache";
import { verifySession } from "@/lib/auth/dal";
import { prisma } from "@/lib/prisma";
import { generateContractTerms } from "@/lib/careers/generate-contracts";
import { getLeagueById } from "@/lib/data-access/leagues";
import { getPayrollForTeam } from "@/lib/data-access/contracts";
import { getStandings } from "@/lib/data-access/standings";
import { getTeamById } from "@/lib/data-access/teams";
import { isFreeAgencyOpen } from "@/lib/data-access/season-windows";
import { MAX_ROSTER_SIZE, MIN_ROSTER_SIZE } from "@/lib/careers/roster-rules";
import { initialRenown } from "@/lib/careers/renown-rules";
import {
  minAcceptableSalary,
  teamMeetsPlayerDemands,
  winPctForStandings,
} from "@/lib/careers/player-demands";

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

  await prisma.$transaction([
    prisma.contract.delete({
      where: { careerId_playerId: { careerId: membership.careerId, playerId } },
    }),
    // Un contrat garanti coupé avant terme laisse de l'argent mort qui
    // continue de compter dans le plafond de l'équipe — un contrat de 2e
    // tour de draft (non garanti) n'en laisse aucun.
    ...(contract.guaranteed
      ? [
          prisma.deadCap.create({
            data: {
              careerId: membership.careerId,
              teamId: membership.teamId,
              playerId,
              salary: contract.salary,
              yearsRemaining: contract.yearsRemaining,
            },
          }),
        ]
      : []),
  ]);

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

  const [player, playerState, existingContract, rosterSize, currentPayroll, league, standings, myTeam] =
    await Promise.all([
      prisma.player.findUnique({ where: { id: playerId } }),
      prisma.playerState.findUnique({
        where: { careerId_playerId: { careerId: membership.careerId, playerId } },
      }),
      prisma.contract.findUnique({
        where: { careerId_playerId: { careerId: membership.careerId, playerId } },
      }),
      prisma.contract.count({
        where: { careerId: membership.careerId, teamId: membership.teamId },
      }),
      getPayrollForTeam(membership.careerId, membership.teamId),
      getLeagueById(membership.career.leagueId),
      getStandings(membership.careerId, membership.career.leagueId, membership.career.season),
      getTeamById(membership.teamId),
    ]);

  if (!player || player.leagueId !== membership.career.leagueId) return;
  if (existingContract) return; // déjà sous contrat dans cette Career
  if (rosterSize >= MAX_ROSTER_SIZE) return;
  if (!(await isFreeAgencyOpen(membership.careerId, membership.career.season))) return;
  if (!myTeam) return;

  const renown = playerState?.renown ?? initialRenown(player.overallRating);
  const myStandingsRow = standings.find((row) => row.teamId === membership.teamId);
  const teamWinPct = winPctForStandings(myStandingsRow?.wins ?? 0, myStandingsRow?.losses ?? 0);
  if (
    !teamMeetsPlayerDemands({
      renown,
      teamWinPct,
      teamMarketAppeal: myTeam.marketAppeal,
    })
  ) {
    return; // refuse : équipe pas assez compétitive et/ou marché pas assez attractif
  }

  // Calculée une seule fois : generateContractTerms tire un salaire aléatoire,
  // la réutiliser pour la vérification du cap ET l'insertion évite un montant
  // vérifié différent du montant réellement facturé. Le renommé impose un
  // plancher salarial en plus de ce que suggérerait le seul overall.
  const terms = generateContractTerms(player.overallRating, membership.career.leagueId);
  const salary = Math.max(
    terms.salary,
    minAcceptableSalary(renown, player.overallRating, membership.career.leagueId)
  );
  const salaryCap = league?.salaryCap ?? Infinity;
  if (currentPayroll + salary > salaryCap) return;

  try {
    await prisma.contract.create({
      data: {
        careerId: membership.careerId,
        playerId,
        teamId: membership.teamId,
        ...terms,
        salary,
      },
    });
  } catch (err) {
    // P2002 : un autre manager a signé ce joueur entre-temps (@@unique([careerId, playerId])).
    if (err instanceof Error && "code" in err && err.code === "P2002") return;
    throw err;
  }

  revalidateRosterPaths(membership.teamId);
}

// Choix explicite du manager de faire jouer un joueur malgré une blessure
// mineure (au risque d'une récupération de conditionnement plus lente,
// d'une aggravation ou d'une nouvelle blessure — voir advanceRosterInjuries).
// Seulement valable pour SON PROPRE effectif et une blessure "minor" active.
export async function setPlayingThroughInjury(formData: FormData): Promise<void> {
  const { userId } = await verifySession();
  const playerId = String(formData.get("playerId") ?? "");
  const value = formData.get("value") === "true";

  const membership = await prisma.membership.findUnique({ where: { userId } });
  if (!membership) return;

  const contract = await prisma.contract.findUnique({
    where: { careerId_playerId: { careerId: membership.careerId, playerId } },
  });
  if (!contract || contract.teamId !== membership.teamId) return;

  const state = await prisma.playerState.findUnique({
    where: { careerId_playerId: { careerId: membership.careerId, playerId } },
  });
  if (!state || !state.injured || state.injurySeverity !== "minor") return;

  await prisma.playerState.update({
    where: { id: state.id },
    data: { playingThroughInjury: value },
  });

  revalidateRosterPaths(membership.teamId);
}
