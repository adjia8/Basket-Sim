import Link from "next/link";
import { getCurrentMembership } from "@/lib/auth/dal";
import { getOrAdvancePlayoffs } from "@/lib/data-access/playoffs";
import { getTeamsByLeague } from "@/lib/data-access/teams";
import { prisma } from "@/lib/prisma";
import { teamFullName } from "@/lib/utils";
import type { Team } from "@/lib/types";

const ROUND_LABELS: Record<string, string> = {
  "play-in-7-8": "Play-in (7 vs 8)",
  "play-in-9-10": "Play-in (9 vs 10)",
  "play-in-final": "Play-in (finale — 8e place)",
  "round-1": "1er tour",
  "conf-semis": "Demi-finale de conférence",
  "conf-finals": "Finale de conférence",
  semifinals: "Demi-finale",
  finals: "Finale",
};

const NBA_ROUND_ORDER = [
  "play-in-7-8",
  "play-in-9-10",
  "play-in-final",
  "round-1",
  "conf-semis",
  "conf-finals",
  "finals",
];
const WNBA_ROUND_ORDER = ["round-1", "semifinals", "finals"];

const CONFERENCE_LABELS: Record<string, string> = {
  "nba-east": "Conférence Est",
  "nba-west": "Conférence Ouest",
};

export default async function PlayoffsPage() {
  const membership = await getCurrentMembership();
  const playoffs = await getOrAdvancePlayoffs(
    membership.careerId,
    membership.season,
    membership.leagueId
  );

  if (!playoffs) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8">
        <h1 className="text-2xl font-bold">Playoffs</h1>
        <p className="mt-4 text-sm text-black/50 dark:text-white/50">
          La saison régulière n&apos;est pas encore terminée.
        </p>
      </div>
    );
  }

  const teams = await getTeamsByLeague(membership.leagueId);
  const teamsById = new Map(teams.map((t) => [t.id, t]));

  const seriesIds = playoffs.series.map((s) => s.id);
  const nextGames = seriesIds.length
    ? await prisma.game.findMany({
        where: { playoffSeriesId: { in: seriesIds }, status: "scheduled" },
      })
    : [];
  const nextGameBySeriesId = new Map(
    nextGames.map((g) => [g.playoffSeriesId as string, g])
  );

  const roundOrder = membership.leagueId === "nba" ? NBA_ROUND_ORDER : WNBA_ROUND_ORDER;
  const championTeam = playoffs.champion ? teamsById.get(playoffs.champion) : undefined;

  return (
    <div className="mx-auto max-w-4xl space-y-8 px-4 py-8">
      <div>
        <h1 className="text-2xl font-bold">Playoffs</h1>
        {championTeam && (
          <p className="mt-2 text-sm font-medium">
            🏆 Champion : {teamFullName(championTeam)}
          </p>
        )}
      </div>

      {roundOrder.map((round) => {
        const roundSeries = playoffs.series
          .filter((s) => s.round === round)
          .sort(
            (a, b) =>
              (a.conference ?? "").localeCompare(b.conference ?? "") ||
              a.slotIndex - b.slotIndex
          );
        if (roundSeries.length === 0) return null;

        return (
          <section key={round}>
            <h2 className="mb-3 text-lg font-semibold">{ROUND_LABELS[round] ?? round}</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {roundSeries.map((series) => {
                const homeTeam = teamsById.get(series.homeTeamId);
                const awayTeam = teamsById.get(series.awayTeamId);
                if (!homeTeam || !awayTeam) return null;
                const nextGame = nextGameBySeriesId.get(series.id);

                return (
                  <div
                    key={series.id}
                    className="rounded-lg border border-black/10 p-4 dark:border-white/10"
                  >
                    {series.conference && (
                      <p className="mb-1 text-xs uppercase tracking-wide text-black/50 dark:text-white/50">
                        {CONFERENCE_LABELS[series.conference] ?? series.conference}
                      </p>
                    )}
                    <SeriesLine
                      seed={series.homeSeed}
                      team={homeTeam}
                      wins={series.homeWins}
                      isWinner={series.winnerTeamId === series.homeTeamId}
                    />
                    <SeriesLine
                      seed={series.awaySeed}
                      team={awayTeam}
                      wins={series.awayWins}
                      isWinner={series.winnerTeamId === series.awayTeamId}
                    />
                    <p className="mt-2 text-xs text-black/50 dark:text-white/50">
                      {series.bestOf === 1
                        ? "Match unique"
                        : `Au meilleur des ${series.bestOf}`}
                    </p>
                    {series.winnerTeamId ? (
                      <p className="mt-2 text-sm font-medium">Série terminée</p>
                    ) : nextGame ? (
                      <Link
                        href={`/game/${nextGame.id}`}
                        className="mt-2 inline-block text-sm underline underline-offset-2"
                      >
                        Voir le prochain match →
                      </Link>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function SeriesLine({
  seed,
  team,
  wins,
  isWinner,
}: {
  seed: number;
  team: Team;
  wins: number;
  isWinner: boolean;
}) {
  return (
    <div className={`flex items-center justify-between text-sm ${isWinner ? "font-semibold" : ""}`}>
      <span className="flex items-center gap-2">
        <span
          className="h-2.5 w-2.5 rounded-full"
          style={{ backgroundColor: team.primaryColor }}
        />
        #{seed} {teamFullName(team)}
      </span>
      <span>{wins}</span>
    </div>
  );
}
