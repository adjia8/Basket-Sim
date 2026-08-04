import { prisma } from "@/lib/prisma";
import type { Team } from "@/lib/types";
import { toDomainTeam } from "./mappers";

export async function getAllTeams(): Promise<Team[]> {
  const rows = await prisma.team.findMany();
  return rows.map(toDomainTeam);
}

export async function getTeamsByLeague(leagueId: string): Promise<Team[]> {
  const rows = await prisma.team.findMany({ where: { leagueId } });
  return rows.map(toDomainTeam);
}

export async function getTeamById(teamId: string): Promise<Team | undefined> {
  const row = await prisma.team.findUnique({ where: { id: teamId } });
  return row ? toDomainTeam(row) : undefined;
}
