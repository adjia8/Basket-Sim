import Link from "next/link";
import { DashboardClient } from "@/components/dashboard/DashboardClient";
import { getLeagueNews } from "@/lib/data-access/league-news";
import { getCurrentMembership } from "@/lib/auth/dal";
import { getPayrollForTeam } from "@/lib/data-access/contracts";
import { getLeagueById } from "@/lib/data-access/leagues";
import { getOrAdvancePlayoffs } from "@/lib/data-access/playoffs";
import { getRosterForTeam } from "@/lib/data-access/players";
import { getScheduleForCareer } from "@/lib/data-access/schedule";
import { getStandings } from "@/lib/data-access/standings";
import { getTeamsByLeague } from "@/lib/data-access/teams";
import { preseasonSeasonLabel } from "@/lib/careers/schedule-rules";
import { getTranslator } from "@/lib/i18n/translate";
import { teamFullName } from "@/lib/utils";

export default async function DashboardPage() {
  const membership = await getCurrentMembership();
  const { t, locale } = await getTranslator();

  const [teams, players, standings, games, preseasonGames, payroll, league] = await Promise.all([
    getTeamsByLeague(membership.leagueId),
    getRosterForTeam(membership.careerId, membership.teamId),
    getStandings(membership.careerId, membership.leagueId, membership.season),
    getScheduleForCareer(membership.careerId, membership.season),
    getScheduleForCareer(membership.careerId, preseasonSeasonLabel(membership.season)),
    getPayrollForTeam(membership.careerId, membership.teamId),
    getLeagueById(membership.leagueId),
  ]);

  const seasonComplete = games.length > 0 && games.every((g) => g.status === "final");
  const playoffs = seasonComplete
    ? await getOrAdvancePlayoffs(membership.careerId, membership.season, membership.leagueId)
    : null;
  const championTeam = playoffs?.champion
    ? teams.find((t) => t.id === playoffs.champion)
    : undefined;

  const news = await getLeagueNews(membership.careerId, 5);

  return (
    <>
    <DashboardClient
      teamId={membership.teamId}
      teams={teams}
      players={players}
      standings={standings}
      games={games}
      preseasonGames={preseasonGames}
      payroll={payroll}
      salaryCap={league?.salaryCap ?? 0}
      seasonComplete={seasonComplete}
      playoffsInProgress={seasonComplete && !playoffs?.champion}
      championTeamName={championTeam ? teamFullName(championTeam) : undefined}
      inviteCode={membership.inviteCode}
      locale={locale}
      labels={{
        regularSeasonOverPlayoffs: t("dashboard.regularSeasonOverPlayoffs"),
        viewPlayoffs: t("dashboard.viewPlayoffs"),
        seasonOverChampionPrefix: t("dashboard.seasonOverChampionPrefix"),
        advanceSeason: t("dashboard.advanceSeason"),
        inviteCode: t("dashboard.inviteCode"),
        conferenceRank: t("dashboard.conferenceRank"),
        record: t("dashboard.record"),
        streak: t("dashboard.streak"),
        payroll: t("dashboard.payroll"),
        nextGame: t("dashboard.nextGame"),
        noGameScheduled: t("dashboard.noGameScheduled"),
        recentForm: t("dashboard.recentForm"),
        noGamePlayedYet: t("dashboard.noGamePlayedYet"),
        topPlayers: t("dashboard.topPlayers"),
        overallLabel: t("player.overall"),
        infirmary: t("dashboard.infirmary"),
        unavailable: t("roster.unavailable"),
        gamesUnit: t("roster.games"),
        viewFullRoster: t("common.viewFullRoster"),
        preseasonTag: t("dashboard.preseasonTag"),
        deleteCareer: t("dashboard.deleteCareer"),
        deleteCareerConfirm: t("dashboard.deleteCareerConfirm"),
        deleteCareerConfirmButton: t("dashboard.deleteCareerConfirmButton"),
        deleteCareerCancel: t("dashboard.deleteCareerCancel"),
        deletingCareer: t("dashboard.deletingCareer"),
      }}
    />
    {news.length > 0 && (
      <section className="mx-auto max-w-6xl px-4 pb-10 lg:px-8">
        <div className="card p-4">
          <div className="mb-2 flex items-baseline justify-between gap-2">
            <h2 className="eyebrow">{t("league.news.dashboardHeading")}</h2>
            <Link href="/news" className="text-xs font-medium text-accent-text hover:underline">
              {t("league.news.seeAll")} →
            </Link>
          </div>
          <ul className="divide-y divide-line-soft text-sm">
            {news.map((n) => (
              <li key={n.id} className="py-2">
                <p className="font-medium">{n.title}</p>
                {n.body && <p className="text-xs text-muted">{n.body}</p>}
              </li>
            ))}
          </ul>
        </div>
      </section>
    )}
    </>
  );
}
