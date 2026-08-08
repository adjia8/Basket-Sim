import "server-only";
import { prisma } from "@/lib/prisma";
import type { Team } from "@/lib/types";
import { toDomainTeam } from "./mappers";
import { initialFinances } from "@/lib/careers/finance-rules";
import { expectationForRoster, type ExpectationTier } from "@/lib/careers/gm-rules";

export interface FranchiseTopPlayer {
  firstName: string;
  lastName: string;
  overallRating: number;
  position: string;
}

export interface FranchiseDraftPick {
  season: string;
  round: number;
  pickNumber: number | null;
}

export interface FranchiseSummary {
  team: Team;
  finances: number;
  facilitiesLevel: number;
  trainingStaffLevel: number;
  rosterSize: number;
  averageOverall: number;
  topPlayers: FranchiseTopPlayer[];
  draftPicks: FranchiseDraftPick[];
  expectationTier: ExpectationTier;
  managedByEmail?: string;
}

function topPlayersOf(
  players: { firstName: string; lastName: string; overallRating: number; position: string }[]
): FranchiseTopPlayer[] {
  return [...players]
    .sort((a, b) => b.overallRating - a.overallRating)
    .slice(0, 5)
    .map((p) => ({ firstName: p.firstName, lastName: p.lastName, overallRating: p.overallRating, position: p.position }));
}

function averageOverallOf(players: { overallRating: number }[]): number {
  if (players.length === 0) return 50;
  return players.reduce((sum, p) => sum + p.overallRating, 0) / players.length;
}

// Nouvelle Career : ni TeamState ni Contract n'existent encore — tout vient
// du catalogue Player (roster réel de la ligue) + Team.marketAppeal. Pas de
// picks de draft à afficher (rien n'est encore généré pour cette Career).
export async function getFranchiseSummariesForNewCareer(leagueId: string): Promise<FranchiseSummary[]> {
  const [teamRows, playerRows] = await Promise.all([
    prisma.team.findMany({ where: { leagueId } }),
    prisma.player.findMany({ where: { leagueId } }),
  ]);
  const playersByTeam = new Map<string, typeof playerRows>();
  for (const player of playerRows) {
    const list = playersByTeam.get(player.teamId) ?? [];
    list.push(player);
    playersByTeam.set(player.teamId, list);
  }

  return teamRows.map((row) => {
    const team = toDomainTeam(row);
    const players = playersByTeam.get(row.id) ?? [];
    const averageOverall = averageOverallOf(players);
    return {
      team,
      finances: initialFinances(leagueId, row.marketAppeal),
      facilitiesLevel: 50,
      trainingStaffLevel: 50,
      rosterSize: players.length,
      averageOverall,
      topPlayers: topPlayersOf(players),
      draftPicks: [],
      expectationTier: expectationForRoster(averageOverall, row.marketAppeal),
    };
  });
}

// Career existante : données vivantes (TeamState, Contract, DraftPick réels).
// onlyAvailable=true → uniquement les équipes SANS Membership (rejoindre/réassignation).
export async function getFranchiseSummariesForCareer(
  careerId: string,
  leagueId: string,
  onlyAvailable: boolean
): Promise<FranchiseSummary[]> {
  const [teamRows, memberships, teamStates, draftPicks] = await Promise.all([
    prisma.team.findMany({ where: { leagueId } }),
    prisma.membership.findMany({
      where: { careerId },
      include: { user: { select: { email: true } } },
    }),
    prisma.teamState.findMany({ where: { careerId } }),
    prisma.draftPick.findMany({
      where: { careerId, status: "pending" },
      orderBy: [{ season: "asc" }, { round: "asc" }],
    }),
  ]);

  const membershipByTeam = new Map(memberships.map((m) => [m.teamId, m]));
  const teamStateByTeam = new Map(teamStates.map((s) => [s.teamId, s]));
  const picksByTeam = new Map<string, FranchiseDraftPick[]>();
  for (const pick of draftPicks) {
    const list = picksByTeam.get(pick.teamId) ?? [];
    list.push({ season: pick.season, round: pick.round, pickNumber: pick.pickNumber });
    picksByTeam.set(pick.teamId, list);
  }

  const availableTeamRows = onlyAvailable
    ? teamRows.filter((row) => !membershipByTeam.has(row.id))
    : teamRows;

  const contracts = await prisma.contract.findMany({
    where: { careerId, teamId: { in: availableTeamRows.map((t) => t.id) } },
    include: { player: true },
  });
  const rosterByTeam = new Map<string, typeof contracts>();
  for (const contract of contracts) {
    const list = rosterByTeam.get(contract.teamId) ?? [];
    list.push(contract);
    rosterByTeam.set(contract.teamId, list);
  }

  return availableTeamRows.map((row) => {
    const team = toDomainTeam(row);
    const roster = (rosterByTeam.get(row.id) ?? []).map((c) => c.player);
    const averageOverall = averageOverallOf(roster);
    const teamState = teamStateByTeam.get(row.id);
    const membership = membershipByTeam.get(row.id);
    return {
      team,
      finances: teamState?.finances ?? initialFinances(leagueId, row.marketAppeal),
      facilitiesLevel: teamState?.facilitiesLevel ?? 50,
      trainingStaffLevel: teamState?.trainingStaffLevel ?? 50,
      rosterSize: roster.length,
      averageOverall,
      topPlayers: topPlayersOf(roster),
      draftPicks: picksByTeam.get(row.id) ?? [],
      expectationTier: expectationForRoster(averageOverall, row.marketAppeal),
      managedByEmail: membership?.user.email,
    };
  });
}
