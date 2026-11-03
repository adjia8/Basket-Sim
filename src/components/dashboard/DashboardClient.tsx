import Link from "next/link";
import { advanceSeason } from "@/app/actions/season";
import type { Locale } from "@/lib/i18n/locale";
import { formatGameDate, formatSalary, teamFullName } from "@/lib/utils";
import { TeamColorSwatch } from "@/components/team/TeamColorSwatch";
import { payrollWarningLine } from "@/lib/careers/cap-rules";
import { DeleteCareerButton } from "@/components/dashboard/DeleteCareerButton";
import type { Game, Player, StandingsRow, Team } from "@/lib/types";

// Composant client : tout le texte arrive déjà traduit en props depuis le
// Server Component appelant (voir app/page.tsx) — jamais de fonction `t`
// passée à travers la frontière serveur/client.
export interface DashboardLabels {
  regularSeasonOverPlayoffs: string;
  viewPlayoffs: string;
  seasonOverChampionPrefix: string;
  advanceSeason: string;
  inviteCode: string;
  conferenceRank: string;
  record: string;
  streak: string;
  payroll: string;
  nextGame: string;
  noGameScheduled: string;
  recentForm: string;
  noGamePlayedYet: string;
  topPlayers: string;
  overallLabel: string;
  infirmary: string;
  unavailable: string;
  gamesUnit: string;
  viewFullRoster: string;
  preseasonTag: string;
  deleteCareer: string;
  deleteCareerConfirm: string;
  deleteCareerConfirmButton: string;
  deleteCareerCancel: string;
  deletingCareer: string;
}

export function DashboardClient({
  teamId,
  teams,
  players,
  standings,
  games,
  preseasonGames,
  payroll,
  salaryCap,
  seasonComplete,
  playoffsInProgress,
  championTeamName,
  inviteCode,
  locale,
  labels,
}: {
  teamId: string;
  teams: Team[];
  players: Player[];
  standings: StandingsRow[];
  games: Game[];
  preseasonGames: Game[];
  payroll: number;
  salaryCap: number;
  seasonComplete: boolean;
  playoffsInProgress: boolean;
  championTeamName?: string;
  inviteCode: string;
  locale: Locale;
  labels: DashboardLabels;
}) {
  const myTeam = teams.find((t) => t.id === teamId);
  if (!myTeam) return null;

  // Fusionne pré-saison + saison régulière : la pré-saison est datée avant,
  // donc le tri chronologique la fait naturellement apparaître en premier
  // tant qu'elle n'est pas terminée — aucun traitement spécial nécessaire
  // au-delà de l'étiquette visuelle (voir preseasonGameIds).
  const preseasonGameIds = new Set(preseasonGames.map((g) => g.id));
  const myTeamGames = [...preseasonGames, ...games]
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
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-8 lg:px-8">
      {seasonComplete && playoffsInProgress && (
        <div className="flex items-center justify-between card bg-surface-2 px-4 py-3">
          <p className="text-sm font-medium">{labels.regularSeasonOverPlayoffs}</p>
          <Link
            href="/playoffs"
            className="rounded-md bg-accent px-4 py-1.5 text-sm font-medium text-accent-fg transition hover:bg-accent-hover"
          >
            {labels.viewPlayoffs}
          </Link>
        </div>
      )}

      {seasonComplete && !playoffsInProgress && (
        <div className="flex items-center justify-between card bg-surface-2 px-4 py-3">
          <p className="text-sm font-medium">
            {labels.seasonOverChampionPrefix} {championTeamName ?? "-"}
          </p>
          <form action={advanceSeason}>
            <button
              type="submit"
              className="rounded-md bg-accent px-4 py-1.5 text-sm font-medium text-accent-fg transition hover:bg-accent-hover"
            >
              {labels.advanceSeason}
            </button>
          </form>
        </div>
      )}

      <div className="relative overflow-hidden card px-6 py-5">
        <div
          className="pointer-events-none absolute inset-0 opacity-25"
          style={{
            background: `radial-gradient(120% 140% at 0% 0%, ${myTeam.primaryColor}, transparent 55%)`,
          }}
          aria-hidden
        />
        <div
          className="absolute inset-y-0 left-0 w-1.5"
          style={{ background: `linear-gradient(${myTeam.primaryColor} 50%, ${myTeam.secondaryColor} 50%)` }}
          aria-hidden
        />
        <div className="relative flex flex-wrap items-end justify-between gap-4">
          <div className="flex items-center gap-3">
            <TeamColorSwatch primaryColor={myTeam.primaryColor} secondaryColor={myTeam.secondaryColor} size="lg" />
            <h1 className="text-3xl font-bold tracking-tight">
              <Link href={`/teams/${myTeam.id}`} className="hover:underline">
                {teamFullName(myTeam)}
              </Link>
            </h1>
          </div>
          <p className="text-sm text-muted">
            {labels.inviteCode}{" "}
            <span className="rounded bg-surface-3 px-2 py-0.5 font-mono font-semibold tracking-widest text-fg">
              {inviteCode}
            </span>
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label={labels.conferenceRank} value={myRank ? `#${myRank}` : "-"} />
        <StatCard
          label={labels.record}
          value={myStandingsRow ? `${myStandingsRow.wins}-${myStandingsRow.losses}` : "0-0"}
        />
        <StatCard label={labels.streak} value={myStandingsRow?.streak ?? "-"} />
        <StatCard
          label={labels.payroll}
          value={formatSalary(payroll, locale)}
          warning={payroll > payrollWarningLine(myTeam.leagueId, salaryCap)}
        />
      </div>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="space-y-8">
          <section>
            <h2 className="eyebrow mb-3">{labels.nextGame}</h2>
            {nextGame ? (
              <div className="space-y-3">
                <GameLine
                  game={nextGame}
                  teams={teams}
                  myTeamId={teamId}
                  isPreseason={preseasonGameIds.has(nextGame.id)}
                  locale={locale}
                  preseasonTag={labels.preseasonTag}
                />
              </div>
            ) : (
              <p className="text-sm text-muted">{labels.noGameScheduled}</p>
            )}
          </section>

          <section>
            <h2 className="eyebrow mb-3">{labels.recentForm}</h2>
            {recentGames.length > 0 ? (
              <div className="space-y-2">
                {recentGames.map((game) => (
                  <GameLine
                    key={game.id}
                    game={game}
                    teams={teams}
                    myTeamId={teamId}
                    isPreseason={preseasonGameIds.has(game.id)}
                    locale={locale}
                    preseasonTag={labels.preseasonTag}
                  />
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted">{labels.noGamePlayedYet}</p>
            )}
          </section>

        </div>
        <div className="space-y-8">
          <section>
            <h2 className="eyebrow mb-3">{labels.topPlayers}</h2>
            <div className="space-y-2">
              {topPlayers.map((player) => (
                <Link
                  key={player.id}
                  href={`/teams/${teamId}/players/${player.id}`}
                  className="flex items-center gap-3 card px-4 py-3 transition hover:border-line-strong"
                >
                  <span
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-surface-3 text-lg font-bold tabular"
                    title={labels.overallLabel}
                  >
                    {player.overallRating}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate font-medium">
                      {player.firstName} {player.lastName}
                    </span>
                    <span className="block text-xs text-muted">
                      {player.position} · {labels.overallLabel}
                    </span>
                  </span>
                </Link>
              ))}
            </div>
          </section>

          {injuredPlayers.length > 0 && (
            <section>
              <h2 className="eyebrow mb-3">{labels.infirmary}</h2>
              <div className="space-y-2">
                {injuredPlayers.map((player) => (
                  <div
                    key={player.id}
                    className="flex items-center justify-between card px-4 py-3 text-sm"
                  >
                    <Link href={`/teams/${teamId}/players/${player.id}`} className="hover:underline">
                      {player.firstName} {player.lastName}
                    </Link>
                    <span className="text-bad">
                      {labels.unavailable} ({player.injuryGamesRemaining} {labels.gamesUnit})
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}

          <Link
            href={`/teams/${teamId}`}
            className="inline-block text-sm font-medium text-accent-text hover:underline"
          >
            {labels.viewFullRoster}
          </Link>
        </div>
      </div>

      <div className="border-t border-line pt-6">
        <DeleteCareerButton
          labels={{
            button: labels.deleteCareer,
            confirmMessage: labels.deleteCareerConfirm,
            confirmButton: labels.deleteCareerConfirmButton,
            cancelButton: labels.deleteCareerCancel,
            deleting: labels.deletingCareer,
          }}
        />
      </div>
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
    <div className="card px-4 py-3">
      <p className="eyebrow">{label}</p>
      <p className={`mt-1 text-2xl font-bold tabular tracking-tight ${warning ? "text-bad" : ""}`}>
        {value}
      </p>
    </div>
  );
}

function GameLine({
  game,
  teams,
  myTeamId,
  isPreseason,
  locale,
  preseasonTag,
}: {
  game: Game;
  teams: Team[];
  myTeamId: string;
  isPreseason?: boolean;
  locale: Locale;
  preseasonTag: string;
}) {
  const home = teams.find((t) => t.id === game.homeTeamId);
  const away = teams.find((t) => t.id === game.awayTeamId);
  const opponent = game.homeTeamId === myTeamId ? away : home;
  const isHome = game.homeTeamId === myTeamId;

  // Victoire/défaite du point de vue de mon équipe — sert uniquement à
  // colorer la ligne, aucun effet sur le classement/les stats (déjà pilotés
  // ailleurs par getStandings).
  const isFinal = game.status === "final" && game.homeScore != null && game.awayScore != null;
  const myScore = isHome ? game.homeScore : game.awayScore;
  const oppScore = isHome ? game.awayScore : game.homeScore;
  const won = isFinal && myScore != null && oppScore != null && myScore > oppScore;
  const lost = isFinal && myScore != null && oppScore != null && myScore < oppScore;

  return (
    <Link
      href={`/game/${game.id}`}
      className={`flex items-center justify-between rounded-lg border px-4 py-3 text-sm transition hover:bg-surface-2 ${
        won
          ? "border-good/30 bg-good/5"
          : lost
            ? "border-bad/30 bg-bad/5"
            : "border-line bg-surface"
      }`}
    >
      <span>
        {isHome ? "vs" : "@"} {opponent ? teamFullName(opponent) : "?"}
        {isPreseason && (
          <span className="ml-2 rounded-full bg-surface-2 px-2 py-0.5 text-xs font-normal text-muted">
            {preseasonTag}
          </span>
        )}
      </span>
      <span className="flex items-center gap-3 text-muted">
        {game.status === "final" ? (
          <span
            className={`font-medium ${
              won
                ? "text-good"
                : lost
                  ? "text-bad"
                  : "text-fg"
            }`}
          >
            {game.homeScore}-{game.awayScore}
          </span>
        ) : (
          <span>{formatGameDate(game.gameDate, locale)}</span>
        )}
      </span>
    </Link>
  );
}
