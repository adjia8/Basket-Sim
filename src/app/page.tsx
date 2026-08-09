import { DashboardClient } from "@/components/dashboard/DashboardClient";
import { getCurrentMembership } from "@/lib/auth/dal";
import { getPayrollForTeam } from "@/lib/data-access/contracts";
import { getLeagueById } from "@/lib/data-access/leagues";
import { getOrAdvancePlayoffs } from "@/lib/data-access/playoffs";
import { getRosterForTeam } from "@/lib/data-access/players";
import { getScheduleForCareer } from "@/lib/data-access/schedule";
import { getStandings } from "@/lib/data-access/standings";
import { getTeamsByLeague } from "@/lib/data-access/teams";
import { getPendingPressConference } from "@/lib/data-access/press";
import { preseasonSeasonLabel } from "@/lib/careers/schedule-rules";
import { teamFullName } from "@/lib/utils";

export default async function DashboardPage() {
  const membership = await getCurrentMembership();

  const [teams, players, standings, games, preseasonGames, payroll, league, pendingPressConference] =
    await Promise.all([
      getTeamsByLeague(membership.leagueId),
      getRosterForTeam(membership.careerId, membership.teamId),
      getStandings(membership.careerId, membership.leagueId, membership.season),
      getScheduleForCareer(membership.careerId, membership.season),
      getScheduleForCareer(membership.careerId, preseasonSeasonLabel(membership.season)),
      getPayrollForTeam(membership.careerId, membership.teamId),
      getLeagueById(membership.leagueId),
      getPendingPressConference(membership.careerId, membership.teamId),
    ]);

  const seasonComplete = games.length > 0 && games.every((g) => g.status === "final");
  const playoffs = seasonComplete
    ? await getOrAdvancePlayoffs(membership.careerId, membership.season, membership.leagueId)
    : null;
  const championTeam = playoffs?.champion
    ? teams.find((t) => t.id === playoffs.champion)
    : undefined;

  return (
    <DashboardClient
      teamId={membership.teamId}
      teams={teams}
      players={players}
      standings={standings}
      games={games}
      preseasonGames={preseasonGames}
      payroll={payroll}
      salaryCap={league?.salaryCap ?? 0}
      seasonComplete={seasonComplete}
      playoffsInProgress={seasonComplete && !playoffs?.champion}
      championTeamName={championTeam ? teamFullName(championTeam) : undefined}
      inviteCode={membership.inviteCode}
      hasPendingPressConference={pendingPressConference !== null}
    />
  );
}
