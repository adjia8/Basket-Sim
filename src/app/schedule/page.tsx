import Link from "next/link";
import { getCurrentCareer } from "@/lib/auth/dal";
import { getScheduleForCareer, getScheduleForTeam } from "@/lib/data-access/schedule";
import { getTeamsByLeague } from "@/lib/data-access/teams";
import { formatGameDate, teamFullName } from "@/lib/utils";

export default async function SchedulePage({
  searchParams,
}: {
  searchParams: Promise<{ all?: string }>;
}) {
  const { all } = await searchParams;
  const showAll = all === "1";
  const career = await getCurrentCareer();

  const [teams, games] = await Promise.all([
    getTeamsByLeague(career.leagueId),
    showAll
      ? getScheduleForCareer(career.id, career.season)
      : getScheduleForTeam(career.id, career.teamId, career.season),
  ]);

  const teamById = new Map(teams.map((t) => [t.id, t]));

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Calendrier</h1>
        <Link
          href={showAll ? "/schedule" : "/schedule?all=1"}
          className="rounded-full bg-black/5 px-3 py-1 text-sm dark:bg-white/10"
        >
          {showAll ? "Mon équipe" : "Toute la ligue"}
        </Link>
      </div>

      <div className="mt-6 space-y-2">
        {games.map((game) => {
          const home = teamById.get(game.homeTeamId);
          const away = teamById.get(game.awayTeamId);
          return (
            <Link
              key={game.id}
              href={`/game/${game.id}`}
              className="flex items-center justify-between rounded-lg border border-black/10 px-4 py-3 text-sm transition hover:bg-black/5 dark:border-white/10 dark:hover:bg-white/5"
            >
              <span>
                {away ? teamFullName(away) : "?"} @ {home ? teamFullName(home) : "?"}
              </span>
              <span className="flex items-center gap-3 text-black/50 dark:text-white/50">
                <span>{formatGameDate(game.gameDate)}</span>
                {game.status === "final" ? (
                  <span className="font-medium text-black dark:text-white">
                    {game.awayScore}-{game.homeScore}
                  </span>
                ) : (
                  <span className="rounded-full bg-black/5 px-2 py-0.5 text-xs dark:bg-white/10">
                    À venir
                  </span>
                )}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
