import Link from "next/link";
import { getCurrentMembership } from "@/lib/auth/dal";
import { getScheduleForCareer, getScheduleForTeam } from "@/lib/data-access/schedule";
import { getTeamsByLeague } from "@/lib/data-access/teams";
import { preseasonSeasonLabel } from "@/lib/careers/schedule-rules";
import { formatGameDate, teamFullName } from "@/lib/utils";
import type { Game, Team } from "@/lib/types";

export default async function SchedulePage({
  searchParams,
}: {
  searchParams: Promise<{ all?: string }>;
}) {
  const { all } = await searchParams;
  const showAll = all === "1";
  const membership = await getCurrentMembership();

  const [teams, preseasonGames, games] = await Promise.all([
    getTeamsByLeague(membership.leagueId),
    showAll
      ? getScheduleForCareer(membership.careerId, preseasonSeasonLabel(membership.season))
      : getScheduleForTeam(membership.careerId, membership.teamId, preseasonSeasonLabel(membership.season)),
    showAll
      ? getScheduleForCareer(membership.careerId, membership.season)
      : getScheduleForTeam(membership.careerId, membership.teamId, membership.season),
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

      {preseasonGames.length > 0 && (
        <div className="mt-6">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-black/50 dark:text-white/50">
            Pré-saison
          </h2>
          <GameList games={preseasonGames} teamById={teamById} />
        </div>
      )}

      <div className="mt-6">
        {preseasonGames.length > 0 && (
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-black/50 dark:text-white/50">
            Saison régulière
          </h2>
        )}
        <GameList games={games} teamById={teamById} />
      </div>
    </div>
  );
}

function GameList({ games, teamById }: { games: Game[]; teamById: Map<string, Team> }) {
  return (
    <div className="space-y-2">
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
  );
}
