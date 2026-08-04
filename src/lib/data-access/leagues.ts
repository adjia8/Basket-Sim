import { prisma } from "@/lib/prisma";
import type { Conference, League } from "@/lib/types";
import { toDomainLeague } from "./mappers";

export async function getLeagues(): Promise<League[]> {
  const rows = await prisma.league.findMany({ include: { conferences: true } });
  return rows.map(toDomainLeague);
}

export async function getLeagueById(leagueId: string): Promise<League | undefined> {
  const row = await prisma.league.findUnique({
    where: { id: leagueId },
    include: { conferences: true },
  });
  return row ? toDomainLeague(row) : undefined;
}

export async function getConferencesByLeague(leagueId: string): Promise<Conference[]> {
  return prisma.conference.findMany({ where: { leagueId } });
}
