import "server-only";
import { prisma } from "@/lib/prisma";
import { expectationsByStrength, teamStrengthScore, type ExpectationTier } from "@/lib/careers/gm-rules";
import { initialFreeAgentIds } from "@/lib/mock-data/initial-free-agents";

// Les objectifs sont relatifs (rang de force dans la ligue, voir
// expectationsByStrength) : il faut donc toujours évaluer toutes les
// équipes de la ligue d'un coup, jamais une seule isolément.

function scoresFrom(
  teams: { id: string; marketAppeal: number }[],
  ratingsByTeam: Map<string, number[]>
): Map<string, number> {
  return new Map(teams.map((t) => [t.id, teamStrengthScore(ratingsByTeam.get(t.id) ?? [], t.marketAppeal)]));
}

// Nouvelle Career : effectifs du catalogue (hors agents libres de départ).
export async function getCatalogExpectations(leagueId: string): Promise<Map<string, ExpectationTier>> {
  const [teams, players] = await Promise.all([
    prisma.team.findMany({ where: { leagueId }, select: { id: true, marketAppeal: true } }),
    prisma.player.findMany({
      where: { leagueId, careerId: null },
      select: { id: true, teamId: true, overallRating: true },
    }),
  ]);
  const freeAgentIds = initialFreeAgentIds(leagueId);
  const ratingsByTeam = new Map<string, number[]>();
  for (const player of players) {
    if (freeAgentIds.has(player.id)) continue;
    ratingsByTeam.set(player.teamId, [...(ratingsByTeam.get(player.teamId) ?? []), player.overallRating]);
  }
  return expectationsByStrength(scoresFrom(teams, ratingsByTeam), leagueId);
}

// Career en cours : effectifs réels de la Career (Contract), quelle que
// soit l'affectation d'origine du catalogue, avec les notes de la Career
// (PlayerState : progression/vieillissement) — catalogue en repli.
export async function getCareerExpectations(
  careerId: string,
  leagueId: string
): Promise<Map<string, ExpectationTier>> {
  const [teams, contracts] = await Promise.all([
    prisma.team.findMany({ where: { leagueId }, select: { id: true, marketAppeal: true } }),
    prisma.contract.findMany({
      where: { careerId },
      select: {
        teamId: true,
        player: {
          select: { overallRating: true, playerStates: { where: { careerId }, select: { overallRating: true } } },
        },
      },
    }),
  ]);
  const ratingsByTeam = new Map<string, number[]>();
  for (const contract of contracts) {
    const rating = contract.player.playerStates[0]?.overallRating ?? contract.player.overallRating;
    ratingsByTeam.set(contract.teamId, [...(ratingsByTeam.get(contract.teamId) ?? []), rating]);
  }
  return expectationsByStrength(scoresFrom(teams, ratingsByTeam), leagueId);
}
