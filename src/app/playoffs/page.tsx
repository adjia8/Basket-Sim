import Link from "next/link";
import { getCurrentMembership } from "@/lib/auth/dal";
import { getOrAdvancePlayoffs } from "@/lib/data-access/playoffs";
import { getTeamsByLeague } from "@/lib/data-access/teams";
import { prisma } from "@/lib/prisma";
import { getTranslator } from "@/lib/i18n/translate";
import type { DictionaryKey } from "@/lib/i18n/dictionary";
import { teamFullName } from "@/lib/utils";
import type { Team } from "@/lib/types";

const ROUND_KEYS: Record<string, DictionaryKey> = {
  "play-in-7-8": "playoffsPage.round.playIn78",
  "play-in-9-10": "playoffsPage.round.playIn910",
  "play-in-final": "playoffsPage.round.playInFinal",
  "round-1": "playoffsPage.round.round1",
  "conf-semis": "playoffsPage.round.confSemis",
  "conf-finals": "playoffsPage.round.confFinals",
  semifinals: "playoffsPage.round.semifinals",
  finals: "playoffsPage.round.finals",
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

const CONFERENCE_KEYS: Record<string, DictionaryKey> = {
  "nba-east": "playoffsPage.conference.nbaEast",
  "nba-west": "playoffsPage.conference.nbaWest",
};

export default async function PlayoffsPage() {
  const membership = await getCurrentMembership();
  const { t } = await getTranslator();
  const playoffs = await getOrAdvancePlayoffs(
    membership.careerId,
    membership.season,
    membership.leagueId
  );

  if (!playoffs) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8">
        <h1 className="text-2xl font-bold">{t("playoffsPage.title")}</h1>
        <p className="mt-4 text-sm text-black/50 dark:text-white/50">{t("playoffsPage.regularSeasonNotOver")}</p>
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
        <h1 className="text-2xl font-bold">{t("playoffsPage.title")}</h1>
        {championTeam && (
          <p className="mt-2 text-sm font-medium">
            {t("playoffsPage.championPrefix")} {teamFullName(championTeam)}
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
            <h2 className="mb-3 text-lg font-semibold">{ROUND_KEYS[round] ? t(ROUND_KEYS[round]) : round}</h2>
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
                        {CONFERENCE_KEYS[series.conference] ? t(CONFERENCE_KEYS[series.conference]) : series.conference}
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
                        ? t("playoffsPage.singleGame")
                        : `${t("playoffsPage.bestOfPrefix")} ${series.bestOf}`}
                    </p>
                    {series.winnerTeamId ? (
                      <p className="mt-2 text-sm font-medium">{t("playoffsPage.seriesOver")}</p>
                    ) : nextGame ? (
                      <Link
                        href={`/game/${nextGame.id}`}
                        className="mt-2 inline-block text-sm underline underline-offset-2"
                      >
                        {t("playoffsPage.viewNextGame")}
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
