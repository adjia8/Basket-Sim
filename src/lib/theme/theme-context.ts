import "server-only";
import { prisma } from "@/lib/prisma";
import { getOptionalCurrentMembership } from "@/lib/auth/dal";
import { getTeamById } from "@/lib/data-access/teams";
import { teamAccentCss } from "./team-accent";

export interface ThemeContext {
  phase: "regular" | "playoffs";
  teamAccentCss: string | null;
}

// Phase visuelle : thème « Trophée » tant que les playoffs de la saison sont
// en cours (séries créées, finale pas encore gagnée), « Arena Night » sinon.
export async function getThemeContext(): Promise<ThemeContext> {
  const membership = await getOptionalCurrentMembership();
  if (!membership) return { phase: "regular", teamAccentCss: null };
  const playoffSeason = `${membership.season}-playoffs`;
  const [seriesCount, finalsWon, team] = await Promise.all([
    prisma.playoffSeries.count({ where: { careerId: membership.careerId, season: playoffSeason } }),
    prisma.playoffSeries.count({
      where: { careerId: membership.careerId, season: playoffSeason, round: "finals", winnerTeamId: { not: null } },
    }),
    getTeamById(membership.teamId),
  ]);
  const phase = seriesCount > 0 && finalsWon === 0 ? "playoffs" : "regular";
  return {
    phase,
    teamAccentCss: team ? teamAccentCss(team.primaryColor, team.secondaryColor, phase) : null,
  };
}
