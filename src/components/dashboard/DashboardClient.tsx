import Link from "next/link";
import { advanceSeason } from "@/app/actions/season";
import { formatGameDate, formatSalary, teamFullName } from "@/lib/utils";
import { TeamColorSwatch } from "@/components/team/TeamColorSwatch";
import type { Game, Player, StandingsRow, Team } from "@/lib/types";

export function DashboardClient({
  teamId,
  teams,
  players,
  standings,
  games,
  payroll,
  salaryCap,
  seasonComplete,
  playoffsInProgress,
  championTeamName,
  inviteCode,
}: {
  teamId: string;
  teams: Team[];
  players: Player[];
  standings: StandingsRow[];
  games: Game[];
  payroll: number;
  salaryCap: number;
  seasonComplete: boolean;
  playoffsInProgress: boolean;
  championTeamName?: string;
  inviteCode: string;
}) {
  const myTeam = teams.find((t) => t.id === teamId);
  if (!myTeam) return null;

  const myTeamGames = games
    .filter((g) => g.homeTeamId === teamId || g.awayTeamId === teamId)
    .sort((a, b) => a.gameDate.localeCompare(b.gameDate));

  const nextGame = myTeamGames.find((g) => g.status === "scheduled");
  const recentGames = myTeamGames
    .filter((g) => g.status === "final")
    .slice(-5)
    .reverse();

  const conferenceStandings = standings
    .filter(
      (row) => teams.find((t) => t.id === row.teamId)?.conferenceId === myTeam.conferenceId
    )
    .sort((a, b) => b.wins - a.wins || a.losses - b.losses);
  const myRank = conferenceStandings.findIndex((row) => row.teamId === teamId) + 1;
  const myStandingsRow = standings.find((row) => row.teamId === teamId);

  // `players` est déjà le roster de mon équipe pour cette Career (via
  // getRosterForTeam) — pas besoin de refiltrer sur Player.teamId (catalogue),
  // qui serait faux pour un joueur signé venant d'une autre équipe.
  const topPlayers = [...players]
    .sort((a, b) => b.overallRating - a.overallRating)
    .slice(0, 3);

  const injuredPlayers = players.filter((p) => p.injured);

  return (
    <div className="mx-auto max-w-5xl space-y-8 px-4 py-8">
      {seasonComplete && playoffsInProgress && (
        <div className="flex items-center justify-between rounded-lg border border-black/10 bg-black/5 px-4 py-3 dark:border-white/10 dark:bg-white/10">
          <p className="text-sm font-medium">Saison régulière terminée — playoffs en cours.</p>
          <Link
            href="/playoffs"
            className="rounded-full bg-black px-4 py-1.5 text-sm font-medium text-white transition hover:bg-black/80 dark:bg-white dark:text-black dark:hover:bg-white/80"
          >
            Voir les playoffs
          </Link>
        </div>
      )}

      {seasonComplete && !playoffsInProgress && (
        <div className="flex items-center justify-between rounded-lg border border-black/10 bg-black/5 px-4 py-3 dark:border-white/10 dark:bg-white/10">
          <p className="text-sm font-medium">
            Saison terminée ! Champion : {championTeamName ?? "-"}
          </p>
          <form action={advanceSeason}>
            <button
              type="submit"
              className="rounded-full bg-black px-4 py-1.5 text-sm font-medium text-white transition hover:bg-black/80 dark:bg-white dark:text-black dark:hover:bg-white/80"
            >
              Passer à la saison suivante
            </button>
          </form>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <TeamColorSwatch primaryColor={myTeam.primaryColor} secondaryColor={myTeam.secondaryColor} size="lg" />
          <h1 className="text-2xl font-bold">{teamFullName(myTeam)}</h1>
        </div>
        <p className="text-sm text-black/50 dark:text-white/50">
          Code d&apos;invitation :{" "}
          <span className="font-mono font-semibold tracking-widest text-black dark:text-white">
            {inviteCode}
          </span>
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        <StatCard label="Classement conférence" value={myRank ? `#${myRank}` : "-"} />
        <StatCard
          label="Bilan"
          value={myStandingsRow ? `${myStandingsRow.wins}-${myStandingsRow.losses}` : "0-0"}
        />
        <StatCard label="Série" value={myStandingsRow?.streak ?? "-"} />
        <StatCard
          label="Masse salariale"
          value={formatSalary(payroll)}
          warning={payroll > salaryCap}
        />
      </div>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Prochain match</h2>
        {nextGame ? (
          <GameLine game={nextGame} teams={teams} myTeamId={teamId} />
        ) : (
          <p className="text-sm text-black/50 dark:text-white/50">
            Aucun match programmé pour le moment.
          </p>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Forme récente</h2>
        {recentGames.length > 0 ? (
          <div className="space-y-2">
            {recentGames.map((game) => (
              <GameLine key={game.id} game={game} teams={teams} myTeamId={teamId} />
            ))}
          </div>
        ) : (
          <p className="text-sm text-black/50 dark:text-white/50">
            Pas encore de match joué.
          </p>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Meilleurs joueurs</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          {topPlayers.map((player) => (
            <div
              key={player.id}
              className="rounded-lg border border-black/10 p-4 dark:border-white/10"
            >
              <p className="font-medium">
                {player.firstName} {player.lastName}
              </p>
              <p className="text-sm text-black/50 dark:text-white/50">
                {player.position} · overall {player.overallRating}
              </p>
            </div>
          ))}
        </div>
      </section>

      {injuredPlayers.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-semibold">Infirmerie</h2>
          <div className="space-y-2">
            {injuredPlayers.map((player) => (
              <div
                key={player.id}
                className="flex items-center justify-between rounded-lg border border-black/10 px-4 py-3 text-sm dark:border-white/10"
              >
                <span>
                  {player.firstName} {player.lastName}
                </span>
                <span className="text-red-500">
                  🩹 Indispo. ({player.injuryGamesRemaining} matchs)
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      <Link
        href={`/teams/${teamId}`}
        className="inline-block text-sm underline underline-offset-2"
      >
        Voir le roster complet →
      </Link>
    </div>
  );
}

function StatCard({
  label,
  value,
  warning,
}: {
  label: string;
  value: string;
  warning?: boolean;
}) {
  return (
    <div className="rounded-lg border border-black/10 p-4 dark:border-white/10">
      <p className="text-xs uppercase tracking-wide text-black/50 dark:text-white/50">
        {label}
      </p>
      <p className={`mt-1 text-xl font-semibold ${warning ? "text-red-500" : ""}`}>
        {value}
      </p>
    </div>
  );
}

function GameLine({
  game,
  teams,
  myTeamId,
}: {
  game: Game;
  teams: Team[];
  myTeamId: string;
}) {
  const home = teams.find((t) => t.id === game.homeTeamId);
  const away = teams.find((t) => t.id === game.awayTeamId);
  const opponent = game.homeTeamId === myTeamId ? away : home;
  const isHome = game.homeTeamId === myTeamId;

  return (
    <Link
      href={`/game/${game.id}`}
      className="flex items-center justify-between rounded-lg border border-black/10 px-4 py-3 text-sm transition hover:bg-black/5 dark:border-white/10 dark:hover:bg-white/5"
    >
      <span>
        {isHome ? "vs" : "@"} {opponent ? teamFullName(opponent) : "?"}
      </span>
      <span className="flex items-center gap-3 text-black/50 dark:text-white/50">
        {game.status === "final" ? (
          <span className="font-medium text-black dark:text-white">
            {game.homeScore}-{game.awayScore}
          </span>
        ) : (
          <span>{formatGameDate(game.gameDate)}</span>
        )}
      </span>
    </Link>
  );
}
