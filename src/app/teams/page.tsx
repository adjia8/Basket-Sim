import Link from "next/link";
import { getCurrentMembership } from "@/lib/auth/dal";
import { getConferencesByLeague } from "@/lib/data-access/leagues";
import { getMembershipsForCareer } from "@/lib/data-access/memberships";
import { getTeamsByLeague } from "@/lib/data-access/teams";
import { teamFullName } from "@/lib/utils";

export default async function TeamsPage() {
  const membership = await getCurrentMembership();

  const [teams, conferences, managers] = await Promise.all([
    getTeamsByLeague(membership.leagueId),
    getConferencesByLeague(membership.leagueId),
    getMembershipsForCareer(membership.careerId),
  ]);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="text-2xl font-bold">Équipes</h1>

      <div className="mt-6 space-y-8">
        {conferences.map((conference) => (
          <div key={conference.id}>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-black/50 dark:text-white/50">
              {conference.name}
            </h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {teams
                .filter((t) => t.conferenceId === conference.id)
                .map((team) => {
                  const manager = managers[team.id];
                  const managedByMe = manager?.userId === membership.userId;
                  return (
                    <Link
                      key={team.id}
                      href={`/teams/${team.id}`}
                      className="flex items-center justify-between rounded-lg border border-black/10 px-4 py-3 transition hover:bg-black/5 dark:border-white/10 dark:hover:bg-white/5"
                      style={{ borderLeftColor: team.primaryColor, borderLeftWidth: 4 }}
                    >
                      <div className="flex flex-col">
                        <span>{teamFullName(team)}</span>
                        <span className="text-xs text-black/40 dark:text-white/40">
                          {managedByMe ? "Géré par toi" : manager ? `Géré par ${manager.email}` : "Géré par l'IA"}
                        </span>
                      </div>
                      <span className="text-xs text-black/40 dark:text-white/40">
                        {team.abbreviation}
                      </span>
                    </Link>
                  );
                })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
