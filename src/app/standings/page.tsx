import Link from "next/link";
import { getCurrentMembership } from "@/lib/auth/dal";
import { getConferencesByLeague } from "@/lib/data-access/leagues";
import { getStandings } from "@/lib/data-access/standings";
import { getTeamsByLeague } from "@/lib/data-access/teams";
import { getTranslator } from "@/lib/i18n/translate";
import { teamFullName } from "@/lib/utils";
import { SortableTable } from "@/components/ui/SortableTable";

// Série ("V3", "D2", "W3", "L2"...) en valeur triable : victoires
// positives, défaites négatives.
function streakValue(streak: string): number | null {
  const match = /^([A-Za-z])(\d+)$/.exec(streak);
  if (!match) return null;
  const n = Number(match[2]);
  return "VW".includes(match[1].toUpperCase()) ? n : -n;
}

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
                <SortableTable
                  columns={[
                    { label: t("standingsPage.colRank") },
                    { label: t("standingsPage.colTeam") },
                    { label: t("standingsPage.colWins"), align: "right", descendingFirst: true },
                    { label: t("standingsPage.colLosses"), align: "right", descendingFirst: true },
                    { label: t("standingsPage.colDiff"), align: "right", descendingFirst: true },
                    { label: t("standingsPage.colStreak"), align: "right", descendingFirst: true },
                  ]}
                  rows={rows.flatMap((row, index) => {
                    const team = teamById.get(row.teamId);
                    if (!team) return [];
                    const diff = row.pointsFor - row.pointsAgainst;
                    return [
                      {
                        key: row.teamId,
                        highlight: team.id === membership.teamId,
                        sortValues: [index + 1, teamFullName(team), row.wins, row.losses, diff, streakValue(row.streak)],
                        cells: [
                          <span key="rank" className="text-muted">{index + 1}</span>,
                          <Link key="team" href={`/teams/${team.id}`} className="flex items-center gap-2 font-medium hover:underline">
                            <span
                              className="h-2.5 w-2.5 shrink-0 rounded-full"
                              style={{ backgroundColor: team.primaryColor }}
                              aria-hidden
                            />
                            {teamFullName(team)}
                          </Link>,
                          row.wins,
                          row.losses,
                          <span key="diff" className={diff > 0 ? "text-good" : diff < 0 ? "text-bad" : "text-muted"}>
                            {diff >= 0 ? "+" : ""}
                            {diff}
                          </span>,
                          row.streak,
                        ],
                      },
                    ];
                  })}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
