import Link from "next/link";
import { getCurrentMembership } from "@/lib/auth/dal";
import { getScheduleForCareer, getScheduleForTeam } from "@/lib/data-access/schedule";
import { getTeamsByLeague } from "@/lib/data-access/teams";
import { preseasonSeasonLabel } from "@/lib/careers/schedule-rules";
import { getTranslator } from "@/lib/i18n/translate";
import { prisma } from "@/lib/prisma";
import { SimulateAllAiButton } from "@/components/schedule/SimulateAllAiButton";
import { SimulateNextMyGamesButton } from "@/components/schedule/SimulateNextMyGamesButton";
import type { Locale } from "@/lib/i18n/locale";
import { formatGameDate, teamFullName } from "@/lib/utils";
import type { Game, Team } from "@/lib/types";

// Plafond relevé pour les Server Actions de cette page (voir
// simulate-bulk.ts) : un match simulé prend 30-50s, largement au-dessus du
// défaut de la plateforme (10s sur Vercel Hobby sans ce réglage) — sans ce
// plafond, "Simuler tous les matchs IA restants" se fait tuer avant de
// répondre. D'après la doc Next.js, pour les Server Actions ce réglage se
// fait au niveau de la page, pas dans le fichier de l'action elle-même.
export const maxDuration = 60;

export default async function SchedulePage({
  searchParams,
}: {
  searchParams: Promise<{ all?: string }>;
}) {
  const { all } = await searchParams;
  const showAll = all === "1";
  const membership = await getCurrentMembership();
  const { t, locale } = await getTranslator();

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

  // Aucun match IA-vs-IA ne se simule tout seul — voir simulate-bulk.ts pour
  // le contexte complet (ça bloque même la fin de saison).
  const humanTeamIds = (
    await prisma.membership.findMany({ where: { careerId: membership.careerId }, select: { teamId: true } })
  ).map((m) => m.teamId);
  const pendingAiGamesCount = await prisma.game.count({
    where: {
      careerId: membership.careerId,
      status: { not: "final" },
      homeTeamId: { notIn: humanTeamIds },
      awayTeamId: { notIn: humanTeamIds },
    },
  });
  const myPendingGamesCount = await prisma.game.count({
    where: {
      careerId: membership.careerId,
      status: { not: "final" },
      OR: [{ homeTeamId: membership.teamId }, { awayTeamId: membership.teamId }],
    },
  });

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">{t("schedule.title")}</h1>
        <div className="flex flex-wrap items-center gap-3">
          {myPendingGamesCount > 0 && (
            <SimulateNextMyGamesButton
              initialRemaining={myPendingGamesCount}
              maxCount={Math.min(myPendingGamesCount, 20)}
              labels={{
                label: t("schedule.simulateNextMyLabel"),
                button: t("schedule.simulateNextMyButton"),
                runningPrefix: t("schedule.simulateNextMyRunningPrefix"),
                remainingSuffix: t("schedule.simulateNextMyRemainingSuffix"),
                done: t("schedule.simulateNextMyDone"),
                error: t("schedule.simulateNextMyError"),
                waiting: t("schedule.simulateNextMyWaiting"),
                timedOut: t("schedule.simulateNextMyTimedOut"),
              }}
            />
          )}
          {pendingAiGamesCount > 0 && (
            <SimulateAllAiButton
              initialCount={pendingAiGamesCount}
              labels={{
                button: t("schedule.simulateAllAi"),
                runningPrefix: t("schedule.simulateAllAiRunningPrefix"),
                remainingSuffix: t("schedule.simulateAllAiRemainingSuffix"),
                done: t("schedule.simulateAllAiDone"),
                error: t("schedule.simulateAllAiError"),
                timedOut: t("schedule.simulateAllAiTimedOut"),
              }}
            />
          )}
          <Link
            href={showAll ? "/schedule" : "/schedule?all=1"}
            className="rounded-full bg-black/5 px-3 py-1 text-sm dark:bg-white/10"
          >
            {showAll ? t("schedule.myTeam") : t("schedule.wholeLeague")}
          </Link>
        </div>
      </div>

      {preseasonGames.length > 0 && (
        <div className="mt-6">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-black/50 dark:text-white/50">
            {t("schedule.preseasonHeading")}
          </h2>
          <GameList games={preseasonGames} teamById={teamById} locale={locale} upcomingLabel={t("schedule.upcoming")} />
        </div>
      )}

      <div className="mt-6">
        {preseasonGames.length > 0 && (
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-black/50 dark:text-white/50">
            {t("schedule.regularSeasonHeading")}
          </h2>
        )}
        <GameList games={games} teamById={teamById} locale={locale} upcomingLabel={t("schedule.upcoming")} />
      </div>
    </div>
  );
}

function GameList({
  games,
  teamById,
  locale,
  upcomingLabel,
}: {
  games: Game[];
  teamById: Map<string, Team>;
  locale: Locale;
  upcomingLabel: string;
}) {
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
              <span>{formatGameDate(game.gameDate, locale)}</span>
              {game.status === "final" ? (
                <span className="font-medium text-black dark:text-white">
                  {game.awayScore}-{game.homeScore}
                </span>
              ) : (
                <span className="rounded-full bg-black/5 px-2 py-0.5 text-xs dark:bg-white/10">
                  {upcomingLabel}
                </span>
              )}
            </span>
          </Link>
        );
      })}
    </div>
  );
}
