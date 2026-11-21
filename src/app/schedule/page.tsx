import Link from "next/link";
import { Fragment } from "react";
import { allStarBreakDays, allStarGameDate, cupSeasonLabel } from "@/lib/careers/nba-cup-rules";
import { monthKey, monthsBetween, weeksCovering, weeksOfMonth } from "@/lib/careers/month-grid";
import { MonthCalendar, type CalendarGame } from "@/components/schedule/MonthCalendar";
import { getGameClock } from "@/lib/data-access/game-clock";
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
  searchParams: Promise<{ all?: string; view?: string; month?: string }>;
}) {
  const { all, view, month: monthParam } = await searchParams;
  const showAll = all === "1";
  // Mon équipe : calendrier mensuel par défaut (liste au choix) ; toute la
  // ligue : liste (trop de matchs par jour pour une grille).
  const showMonth = !showAll && view !== "list";
  const membership = await getCurrentMembership();
  const { t, locale } = await getTranslator();

  const [teams, preseasonGames, regularGames, cupGames] = await Promise.all([
    getTeamsByLeague(membership.leagueId),
    showAll
      ? getScheduleForCareer(membership.careerId, preseasonSeasonLabel(membership.season))
      : getScheduleForTeam(membership.careerId, membership.teamId, preseasonSeasonLabel(membership.season)),
    showAll
      ? getScheduleForCareer(membership.careerId, membership.season)
      : getScheduleForTeam(membership.careerId, membership.teamId, membership.season),
    // Phase finale de la NBA Cup (libellé de saison à part, voir nba-cup-rules.ts).
    showAll
      ? getScheduleForCareer(membership.careerId, cupSeasonLabel(membership.season))
      : getScheduleForTeam(membership.careerId, membership.teamId, cupSeasonLabel(membership.season)),
  ]);
  const games = [...regularGames, ...cupGames].sort((a, b) => a.gameDate.localeCompare(b.gameDate));
  const allStarDay = membership.leagueId === "nba" ? allStarGameDate(membership.season).toISOString().slice(0, 10) : null;
  const cupLabels: Record<string, string> = {
    group: t("cup.title"),
    qf: `${t("cup.title")} · ${t("cup.stage.qf")}`,
    sf: `${t("cup.title")} · ${t("cup.stage.sf")}`,
    final: `${t("cup.title")} · ${t("cup.stage.final")}`,
  };

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

  // Calendrier mensuel (voir month-grid.ts) : mois affiché = celui demandé,
  // sinon celui du jour de jeu, borné aux mois de la saison.
  const allMine = [...preseasonGames, ...games];
  const clock = await getGameClock(membership.careerId, membership.teamId);
  const today = clock.today ? clock.today.toISOString().slice(0, 10) : null;
  const months = allMine.length
    ? monthsBetween(allMine[0].gameDate.slice(0, 10), allMine[allMine.length - 1].gameDate.slice(0, 10))
    : [monthKey(today ?? new Date().toISOString())];
  const wanted = monthParam && /^\d{4}-\d{2}$/.test(monthParam) ? monthParam : monthKey(today ?? allMine[0]?.gameDate ?? new Date().toISOString());
  const month = months.includes(wanted) ? wanted : wanted < months[0] ? months[0] : months[months.length - 1];
  const gamesByDay = new Map<string, CalendarGame>();
  for (const g of allMine) {
    const home = g.homeTeamId === membership.teamId;
    const opp = teamById.get(home ? g.awayTeamId : g.homeTeamId);
    const played = g.status === "final" && g.homeScore !== undefined && g.awayScore !== undefined;
    const mine = home ? g.homeScore : g.awayScore;
    const theirs = home ? g.awayScore : g.homeScore;
    gamesByDay.set(g.gameDate.slice(0, 10), {
      id: g.id,
      opponent: opp?.abbreviation ?? "?",
      home,
      played,
      won: played && (mine ?? 0) > (theirs ?? 0),
      score: played ? `${mine}-${theirs}` : null,
      cup: !!g.cupStage,
    });
  }
  const weekdayFmt = new Intl.DateTimeFormat(locale === "fr" ? "fr-FR" : "en-US", { weekday: "short", timeZone: "UTC" });
  const weekdayLabels = weeksCovering("2026-11-02", "2026-11-08")[0].map((d) => weekdayFmt.format(new Date(`${d}T12:00:00Z`)).replace(".", ""));
  const monthLabel = new Intl.DateTimeFormat(locale === "fr" ? "fr-FR" : "en-US", { month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(`${month}-15T12:00:00Z`)
  );
  const idx = months.indexOf(month);
  const monthProps = {
    month,
    weeks: weeksOfMonth(month),
    gamesByDay,
    today,
    breakDays: new Set(
      membership.leagueId === "nba" ? allStarBreakDays(membership.season).map((d) => d.toISOString().slice(0, 10)) : []
    ),
    weekdayLabels,
    monthLabel,
    prevHref: idx > 0 ? `/schedule?month=${months[idx - 1]}` : null,
    nextHref: idx < months.length - 1 ? `/schedule?month=${months[idx + 1]}` : null,
    labels: {
      win: t("schedule.win"),
      loss: t("schedule.loss"),
      allStar: t("schedule.allStarShort"),
      today: t("schedule.today"),
      prev: t("schedule.prevMonth"),
      next: t("schedule.nextMonth"),
    },
  };

  return (
    <div className="mx-auto max-w-6xl px-4 lg:px-8 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight">{t("schedule.title")}</h1>
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
                leaguePrefix: t("schedule.simulateNextMyLeaguePrefix"),
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
          {!showAll && (
            <Link
              href={showMonth ? "/schedule?view=list" : "/schedule"}
              className="rounded-full bg-surface-2 px-3 py-1 text-sm"
              data-testid="schedule-view-toggle"
            >
              {showMonth ? t("schedule.viewList") : t("schedule.viewMonth")}
            </Link>
          )}
          <Link
            href={showAll ? "/schedule" : "/schedule?all=1"}
            className="rounded-full bg-surface-2 px-3 py-1 text-sm"
          >
            {showAll ? t("schedule.myTeam") : t("schedule.wholeLeague")}
          </Link>
        </div>
      </div>

      {showMonth && (
        <div className="mt-6">
          <MonthCalendar {...monthProps} />
        </div>
      )}

      {!showMonth && preseasonGames.length > 0 && (
        <div className="mt-6">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">
            {t("schedule.preseasonHeading")}
          </h2>
          <GameList games={preseasonGames} teamById={teamById} locale={locale} upcomingLabel={t("schedule.upcoming")} />
        </div>
      )}

      {!showMonth && (
      <div className="mt-6">
        {preseasonGames.length > 0 && (
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">
            {t("schedule.regularSeasonHeading")}
          </h2>
        )}
        <GameList
          games={games}
          teamById={teamById}
          locale={locale}
          upcomingLabel={t("schedule.upcoming")}
          cupLabels={cupLabels}
          breakAfter={allStarDay}
          breakLabel={t("cup.allStarBreak")}
        />
      </div>
      )}
    </div>
  );
}

function GameList({
  games,
  teamById,
  locale,
  upcomingLabel,
  cupLabels,
  breakAfter,
  breakLabel,
}: {
  games: Game[];
  teamById: Map<string, Team>;
  locale: Locale;
  upcomingLabel: string;
  cupLabels?: Record<string, string>;
  breakAfter?: string | null;
  breakLabel?: string;
}) {
  // Séparateur de la pause du All-Star : avant le premier match qui la suit.
  const firstAfterBreak = breakAfter ? games.find((g) => g.gameDate > breakAfter)?.id : undefined;
  return (
    <div className="space-y-2">
      {games.map((game) => {
        const home = teamById.get(game.homeTeamId);
        const away = teamById.get(game.awayTeamId);
        return (
          <Fragment key={game.id}>
          {game.id === firstAfterBreak && (
            <p className="py-2 text-center text-xs font-semibold uppercase tracking-wide text-warn">⭐ {breakLabel}</p>
          )}
          <Link
            href={`/game/${game.id}`}
            className="flex items-center justify-between gap-3 card px-4 py-3 text-sm transition hover:bg-surface-2"
          >
            <span className="min-w-0">
              {/* Sur mobile, la date passe sous l'affiche (elle s'étalait sur trois lignes à droite). */}
              <span className="block text-xs text-muted sm:hidden">{formatGameDate(game.gameDate, locale)}</span>
              {away ? teamFullName(away) : "?"} @ {home ? teamFullName(home) : "?"}
              {game.cupStage && cupLabels && (
                <span className="ml-2 rounded bg-accent/15 px-1.5 py-0.5 text-xs font-medium text-accent-text">
                  🏆 {cupLabels[game.cupStage]}
                  {game.cupStage === "group" && game.cupGroup ? ` · ${game.cupGroup}` : ""}
                </span>
              )}
            </span>
            <span className="flex shrink-0 items-center gap-3 text-muted">
              <span className="hidden whitespace-nowrap sm:inline">{formatGameDate(game.gameDate, locale)}</span>
              {game.status === "final" ? (
                <span className="font-medium text-fg">
                  {game.awayScore}-{game.homeScore}
                </span>
              ) : (
                <span className="rounded-full bg-surface-2 px-2 py-0.5 text-xs">
                  {upcomingLabel}
                </span>
              )}
            </span>
          </Link>
          </Fragment>
        );
      })}
    </div>
  );
}
