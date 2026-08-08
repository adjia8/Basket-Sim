import "server-only";
import { prisma } from "@/lib/prisma";
import type { Player } from "@/lib/types";
import { getFreeAgents, getPayrollForTeam } from "./contracts";
import { getLeagueById } from "./leagues";
import { getStandings } from "./standings";
import { getTeamsByLeague } from "./teams";
import { getOrCreateTeamState } from "./team-state";
import {
  minAcceptableSalary,
  teamMeetsPlayerDemands,
  wantsAttractiveMarket,
  wantsCompetitiveTeam,
  wantsGoodFacilities,
  winPctForStandings,
} from "@/lib/careers/player-demands";
import { MAX_ROSTER_SIZE } from "@/lib/careers/roster-rules";

export interface FreeAgentReportEntry {
  player: Player;
  desiredContract: number;
  wantsCompetitiveTeam: boolean;
  wantsAttractiveMarket: boolean;
  wantsGoodFacilities: boolean;
  interestedTeamIds: string[];
}

// Bilan de fin de saison : pour chaque agent libre, le contrat qu'il vise,
// ses préférences d'équipe (si "star", renommé >= STAR_RENOWN_THRESHOLD), et
// la liste des équipes qui le signeraient (marge salariale suffisante,
// effectif non complet, exigences satisfaites) — calculé une fois pour
// toutes les équipes de la ligue, pas de requête par paire.
export async function getFreeAgentReport(
  careerId: string,
  leagueId: string,
  season: string
): Promise<FreeAgentReportEntry[]> {
  const [freeAgents, teams, standings, league] = await Promise.all([
    getFreeAgents(careerId, leagueId),
    getTeamsByLeague(leagueId),
    getStandings(careerId, leagueId, season),
    getLeagueById(leagueId),
  ]);
  const salaryCap = league?.salaryCap ?? Infinity;

  const teamContext = await Promise.all(
    teams.map(async (team) => {
      const [payroll, rosterSize, teamState] = await Promise.all([
        getPayrollForTeam(careerId, team.id),
        prisma.contract.count({ where: { careerId, teamId: team.id } }),
        getOrCreateTeamState(careerId, team.id, leagueId),
      ]);
      const standingsRow = standings.find((s) => s.teamId === team.id);
      const winPct = winPctForStandings(standingsRow?.wins ?? 0, standingsRow?.losses ?? 0);
      return {
        teamId: team.id,
        payroll,
        rosterSize,
        winPct,
        marketAppeal: team.marketAppeal,
        facilitiesLevel: teamState.facilitiesLevel,
      };
    })
  );

  return freeAgents.map((player) => {
    const desiredContract = minAcceptableSalary(player.renown, player.overallRating, leagueId);
    const interestedTeamIds = teamContext
      .filter(
        (t) =>
          t.rosterSize < MAX_ROSTER_SIZE &&
          t.payroll + desiredContract <= salaryCap &&
          teamMeetsPlayerDemands({
            renown: player.renown,
            teamWinPct: t.winPct,
            teamMarketAppeal: t.marketAppeal,
            teamFacilitiesLevel: t.facilitiesLevel,
          })
      )
      .map((t) => t.teamId);

    return {
      player,
      desiredContract,
      wantsCompetitiveTeam: wantsCompetitiveTeam(player.renown),
      wantsAttractiveMarket: wantsAttractiveMarket(player.renown),
      wantsGoodFacilities: wantsGoodFacilities(player.renown),
      interestedTeamIds,
    };
  });
}
