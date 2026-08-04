import { getCurrentCareer } from "@/lib/auth/dal";
import { getConferencesByLeague } from "@/lib/data-access/leagues";
import { getStandings } from "@/lib/data-access/standings";
import { getTeamsByLeague } from "@/lib/data-access/teams";
import { teamFullName } from "@/lib/utils";

export default async function StandingsPage() {
  const career = await getCurrentCareer();

  const [conferences, teams, standings] = await Promise.all([
    getConferencesByLeague(career.leagueId),
    getTeamsByLeague(career.leagueId),
    getStandings(career.id, career.leagueId, career.season),
  ]);

  const teamById = new Map(teams.map((t) => [t.id, t]));

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="text-2xl font-bold">Classement</h1>

      <div className="mt-6 space-y-8">
        {conferences.map((conference) => {
          const rows = standings
            .filter((row) => teamById.get(row.teamId)?.conferenceId === conference.id)
            .sort((a, b) => b.wins - a.wins || a.losses - b.losses);

          return (
            <div key={conference.id}>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-black/50 dark:text-white/50">
                {conference.name}
              </h2>
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-black/10 text-black/50 dark:border-white/10 dark:text-white/50">
                    <th className="py-2 pr-4">#</th>
                    <th className="py-2 pr-4">Équipe</th>
                    <th className="py-2 pr-4">V</th>
                    <th className="py-2 pr-4">D</th>
                    <th className="py-2 pr-4">Diff.</th>
                    <th className="py-2">Série</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, index) => {
                    const team = teamById.get(row.teamId);
                    if (!team) return null;
                    const diff = row.pointsFor - row.pointsAgainst;
                    return (
                      <tr key={row.teamId} className="border-b border-black/5 dark:border-white/5">
                        <td className="py-2 pr-4">{index + 1}</td>
                        <td className="py-2 pr-4 font-medium">{teamFullName(team)}</td>
                        <td className="py-2 pr-4">{row.wins}</td>
                        <td className="py-2 pr-4">{row.losses}</td>
                        <td className="py-2 pr-4">
                          {diff >= 0 ? "+" : ""}
                          {diff}
                        </td>
                        <td className="py-2">{row.streak}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          );
        })}
      </div>
    </div>
  );
}
