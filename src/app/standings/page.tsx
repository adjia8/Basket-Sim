import Link from "next/link";
import { getCurrentMembership } from "@/lib/auth/dal";
import { getConferencesByLeague } from "@/lib/data-access/leagues";
import { getStandings } from "@/lib/data-access/standings";
import { getTeamsByLeague } from "@/lib/data-access/teams";
import { getTranslator } from "@/lib/i18n/translate";
import { teamFullName } from "@/lib/utils";

export default async function StandingsPage() {
  const membership = await getCurrentMembership();
  const { t } = await getTranslator();

  const [conferences, teams, standings] = await Promise.all([
    getConferencesByLeague(membership.leagueId),
    getTeamsByLeague(membership.leagueId),
    getStandings(membership.careerId, membership.leagueId, membership.season),
  ]);

  const teamById = new Map(teams.map((t) => [t.id, t]));

  return (
    <div className="mx-auto max-w-6xl px-4 lg:px-8 py-8">
      <h1 className="text-2xl font-bold tracking-tight">{t("standingsPage.title")}</h1>

      <div className="mt-6 space-y-8">
        {conferences.map((conference) => {
          const rows = standings
            .filter((row) => teamById.get(row.teamId)?.conferenceId === conference.id)
            .sort((a, b) => b.wins - a.wins || a.losses - b.losses);

          return (
            <div key={conference.id}>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">
                {conference.name}
              </h2>
              <div className="card overflow-x-auto px-4">
                <table className="data-table w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-line text-muted">
                      <th className="py-2 pr-4">{t("standingsPage.colRank")}</th>
                      <th className="py-2 pr-4">{t("standingsPage.colTeam")}</th>
                      <th className="py-2 pr-4">{t("standingsPage.colWins")}</th>
                      <th className="py-2 pr-4">{t("standingsPage.colLosses")}</th>
                      <th className="py-2 pr-4">{t("standingsPage.colDiff")}</th>
                      <th className="py-2">{t("standingsPage.colStreak")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, index) => {
                      const team = teamById.get(row.teamId);
                      if (!team) return null;
                      const diff = row.pointsFor - row.pointsAgainst;
                      const isMine = team.id === membership.teamId;
                      return (
                        <tr
                          key={row.teamId}
                          className={`border-b border-line-soft ${isMine ? "bg-accent/10" : ""}`}
                        >
                          <td className="py-2 pr-4 text-muted">{index + 1}</td>
                          <td className="py-2 pr-4 font-medium">
                            <Link href={`/teams/${team.id}`} className="flex items-center gap-2 hover:underline">
                              <span
                                className="h-2.5 w-2.5 shrink-0 rounded-full"
                                style={{ backgroundColor: team.primaryColor }}
                                aria-hidden
                              />
                              {teamFullName(team)}
                            </Link>
                          </td>
                          <td className="py-2 pr-4">{row.wins}</td>
                          <td className="py-2 pr-4">{row.losses}</td>
                          <td className={`py-2 pr-4 ${diff > 0 ? "text-good" : diff < 0 ? "text-bad" : "text-muted"}`}>
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
            </div>
          );
        })}
      </div>
    </div>
  );
}
