import { prisma } from "@/lib/prisma";
import type { Contract, Player } from "@/lib/types";
import { toDomainContract, toDomainPlayerWithState } from "./mappers";

export async function getContractsByCareer(careerId: string): Promise<Contract[]> {
  const rows = await prisma.contract.findMany({ where: { careerId } });
  return rows.map(toDomainContract);
}

export async function getContractsForTeam(
  careerId: string,
  teamId: string
): Promise<Contract[]> {
  const rows = await prisma.contract.findMany({
    where: { careerId, teamId },
  });
  return rows.map(toDomainContract);
}

export async function getContractForPlayer(
  careerId: string,
  playerId: string
): Promise<Contract | undefined> {
  const row = await prisma.contract.findUnique({
    where: { careerId_playerId: { careerId, playerId } },
  });
  return row ? toDomainContract(row) : undefined;
}

// Masse salariale réelle d'une équipe : contrats actifs + argent mort restant
// des contrats garantis coupés avant terme (DeadCap.yearsRemaining > 0).
export async function getPayrollForTeam(
  careerId: string,
  teamId: string
): Promise<number> {
  const [contracts, deadCap] = await Promise.all([
    prisma.contract.findMany({
      where: { careerId, teamId },
      select: { salary: true },
    }),
    prisma.deadCap.findMany({
      where: { careerId, teamId },
      select: { salary: true },
    }),
  ]);
  return (
    contracts.reduce((sum, c) => sum + c.salary, 0) +
    deadCap.reduce((sum, d) => sum + d.salary, 0)
  );
}

// Agent libre = joueur de la ligue sans Contract dans cette Career (et pas retraité).
export async function getFreeAgents(
  careerId: string,
  leagueId: string
): Promise<Player[]> {
  const contracted = await prisma.contract.findMany({
    where: { careerId },
    select: { playerId: true },
  });
  const rows = await prisma.player.findMany({
    where: {
      leagueId,
      id: { notIn: contracted.map((c) => c.playerId) },
    },
    include: { playerStates: { where: { careerId } } },
  });
  return rows
    .filter((row) => !row.playerStates[0]?.retired)
    .map((row) => toDomainPlayerWithState(row, row.playerStates[0]))
    .sort((a, b) => b.overallRating - a.overallRating);
}
