import { DashboardClient } from "@/components/dashboard/DashboardClient";
import { getCurrentCareer } from "@/lib/auth/dal";
import { getContractsForTeam } from "@/lib/data-access/contracts";
import { getLeagueById } from "@/lib/data-access/leagues";
import { getRosterForTeam } from "@/lib/data-access/players";
import { getScheduleForCareer } from "@/lib/data-access/schedule";
import { getStandings } from "@/lib/data-access/standings";
import { getTeamsByLeague } from "@/lib/data-access/teams";

export default async function DashboardPage() {
  const career = await getCurrentCareer();

  const [teams, players, standings, games, contracts, league] = await Promise.all([
    getTeamsByLeague(career.leagueId),
    getRosterForTeam(career.id, career.teamId),
    getStandings(career.id, career.leagueId, career.season),
    getScheduleForCareer(career.id, career.season),
    getContractsForTeam(career.id, career.teamId),
    getLeagueById(career.leagueId),
  ]);

  const payroll = contracts.reduce((sum, c) => sum + c.salary, 0);
  const seasonComplete = games.length > 0 && games.every((g) => g.status === "final");

  return (
    <DashboardClient
      teamId={career.teamId}
      teams={teams}
      players={players}
      standings={standings}
      games={games}
      payroll={payroll}
      salaryCap={league?.salaryCap ?? 0}
      seasonComplete={seasonComplete}
    />
  );
}
