import "server-only";
import { prisma } from "@/lib/prisma";
import { getStaffProfiles } from "@/lib/data-access/staff";
import { NEUTRAL_STAFF_PROFILE } from "@/lib/careers/staff-rules";
import { estimateRating } from "@/lib/careers/potential-rules";
import { matchesFilters, sortCandidates, type ScoutCandidate, type ScoutFilters } from "@/lib/careers/scouting-rules";

// Scouting : tous les joueurs de la ligue (sous contrat ou agents libres)
// qui correspondent aux critères. Le potentiel est celui qu'estiment MES
// recruteurs (plus ils sont bons, plus l'estimation est juste).

export interface ScoutResult extends ScoutCandidate {
  name: string;
  teamAbbr: string | null;
  contractType: string | null;
  onTradeBlock: boolean;
  buyout: number;
  rightsTeamId: string | null;
}

export const SCOUT_LIMIT = 60;

export async function searchPlayers(
  careerId: string,
  leagueId: string,
  myTeamId: string,
  filters: ScoutFilters
): Promise<{ results: ScoutResult[]; total: number; scoutingLevel: number }> {
  const [players, contracts, teams, profiles] = await Promise.all([
    prisma.player.findMany({
      where: { leagueId, OR: [{ careerId: null }, { careerId }] },
      select: { id: true, firstName: true, lastName: true, position: true, age: true, overallRating: true, playerStates: { where: { careerId } } },
    }),
    prisma.contract.findMany({ where: { careerId }, select: { playerId: true, teamId: true, salary: true, yearsRemaining: true, contractType: true } }),
    prisma.team.findMany({ where: { leagueId }, select: { id: true, abbreviation: true } }),
    getStaffProfiles(careerId, [myTeamId], leagueId),
  ]);
  const scouting = (profiles.get(myTeamId) ?? NEUTRAL_STAFF_PROFILE).scouting;
  const contractOf = new Map(contracts.map((c) => [c.playerId, c]));
  const abbr = new Map(teams.map((t) => [t.id, t.abbreviation]));
  const all: ScoutResult[] = [];
  for (const p of players) {
    const st = p.playerStates[0];
    if (!st || st.retired) continue;
    const c = contractOf.get(p.id) ?? null;
    const potential = estimateRating(st.potential || st.overallRating, c?.teamId === myTeamId ? 99 : scouting, `${careerId}:${myTeamId}:${p.id}:pot`).mid;
    all.push({
      id: p.id,
      name: `${p.firstName} ${p.lastName}`,
      teamId: c?.teamId ?? null,
      teamAbbr: c ? abbr.get(c.teamId) ?? c.teamId : null,
      position: p.position,
      age: st.age,
      overall: st.overallRating,
      potential: Math.max(st.overallRating, potential),
      ratings: {
        scoringInside: st.scoringInside,
        scoringOutside: st.scoringOutside,
        playmaking: st.playmaking,
        defenseInside: st.defenseInside,
        defenseOutside: st.defenseOutside,
        rebounding: st.rebounding,
        athleticism: st.athleticism,
      },
      salary: c?.salary ?? 0,
      yearsRemaining: c?.yearsRemaining ?? 0,
      contractType: c?.contractType ?? null,
      onTradeBlock: st.onTradeBlock,
      abroadClub: c ? null : st.abroadClub,
      buyout: st.buyout,
      rightsTeamId: c ? null : st.rightsTeamId,
    });
  }
  const matching = sortCandidates(all.filter((c) => matchesFilters(c, filters)), filters);
  return { results: matching.slice(0, SCOUT_LIMIT), total: matching.length, scoutingLevel: scouting };
}
