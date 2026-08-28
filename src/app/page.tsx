import { DashboardClient } from "@/components/dashboard/DashboardClient";
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

// Plafond relevé pour la Server Action advanceCalendar (voir
// simulate-bulk.ts) : un match simulé prend 30-50s, même contrainte déjà
// rencontrée sur schedule/page.tsx (défaut de la plateforme trop bas sans
// ce réglage — voir son commentaire pour le détail).
export const maxDuration = 60;

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

  return (
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
        advanceCalendar: t("dashboard.advanceCalendar"),
        advanceCalendarRunningPrefix: t("dashboard.advanceCalendarRunningPrefix"),
        advanceCalendarUpToDate: t("dashboard.advanceCalendarUpToDate"),
        advanceCalendarError: t("dashboard.advanceCalendarError"),
        advanceCalendarTimedOut: t("dashboard.advanceCalendarTimedOut"),
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
  );
}
