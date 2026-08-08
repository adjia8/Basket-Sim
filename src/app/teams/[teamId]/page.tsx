import { notFound } from "next/navigation";
import { getCurrentMembership } from "@/lib/auth/dal";
import { getContractsForTeam, getPayrollForTeam } from "@/lib/data-access/contracts";
import { getLeagueById } from "@/lib/data-access/leagues";
import { getMembershipForTeam } from "@/lib/data-access/memberships";
import { getRosterForTeam } from "@/lib/data-access/players";
import { getSeasonStatsForPlayers, type SeasonStats } from "@/lib/data-access/season-stats";
import { getStandings } from "@/lib/data-access/standings";
import { isTradeDeadlinePassed } from "@/lib/data-access/season-windows";
import { getOrCreateTeamState } from "@/lib/data-access/team-state";
import { getTeamById } from "@/lib/data-access/teams";
import { prisma } from "@/lib/prisma";
import { RosterTable, type RosterPlayer } from "@/components/team/RosterTable";
import { TradeProposalForm, type TradePick } from "@/components/team/TradeProposalForm";
import { TrainingPlanForm } from "@/components/team/TrainingPlanForm";
import { TeamColorSwatch } from "@/components/team/TeamColorSwatch";
import { MIN_ROSTER_SIZE } from "@/lib/careers/roster-rules";
import {
  minAcceptableSalary,
  teamMeetsPlayerDemands,
  winPctForStandings,
} from "@/lib/careers/player-demands";
import { formatSalary, teamFullName } from "@/lib/utils";

async function getPendingPicksForTeam(careerId: string, teamId: string): Promise<TradePick[]> {
  const rows = await prisma.draftPick.findMany({
    where: { careerId, teamId, status: "pending" },
    include: { originalTeam: true },
    orderBy: [{ season: "asc" }, { round: "asc" }],
  });
  return rows.map((row) => ({
    id: row.id,
    season: row.season,
    round: row.round,
    pickNumber: row.pickNumber,
    originalTeamId: row.originalTeamId,
    teamId: row.teamId,
    originalTeamAbbreviation: row.originalTeam.abbreviation,
  }));
}

export default async function TeamRosterPage({
  params,
}: {
  params: Promise<{ teamId: string }>;
}) {
  const membership = await getCurrentMembership();
  const { teamId } = await params;
  const team = await getTeamById(teamId);
  if (!team) notFound();

  const [roster, contracts, league, manager, totalPayroll, deadCap, picks, tradeDeadlinePassed, standings, teamState] =
    await Promise.all([
      getRosterForTeam(membership.careerId, teamId),
      getContractsForTeam(membership.careerId, teamId),
      getLeagueById(team.leagueId),
      getMembershipForTeam(membership.careerId, teamId),
      getPayrollForTeam(membership.careerId, teamId),
      prisma.deadCap.findMany({ where: { careerId: membership.careerId, teamId } }),
      getPendingPicksForTeam(membership.careerId, teamId),
      isTradeDeadlinePassed(membership.careerId, membership.season),
      getStandings(membership.careerId, team.leagueId, membership.season),
      getOrCreateTeamState(membership.careerId, teamId, team.leagueId),
    ]);

  const isMyTeam = team.id === membership.teamId;
  const teamStandingsRow = standings.find((row) => row.teamId === teamId);
  const teamWinPct = winPctForStandings(teamStandingsRow?.wins ?? 0, teamStandingsRow?.losses ?? 0);

  const seasonStats = await getSeasonStatsForPlayers(
    membership.careerId,
    membership.season,
    roster.map((p) => p.id)
  );
  const emptyStats: SeasonStats = { gamesPlayed: 0, points: 0, rebounds: 0, assists: 0, ppg: 0, rpg: 0, apg: 0 };

  const contractByPlayerId = new Map(contracts.map((c) => [c.playerId, c]));
  const rosterWithContracts: RosterPlayer[] = roster.map((player) => {
    const contract = contractByPlayerId.get(player.id);
    const salary = contract?.salary ?? 0;
    // Demande de trade visible uniquement pour mon propre effectif : un
    // joueur mécontent (équipe pas assez compétitive/attractive pour son
    // standing, ou sous-payé par rapport à son exigence) — purement
    // informatif, n'affecte aucune mécanique.
    const wantsTrade =
      isMyTeam &&
      (!teamMeetsPlayerDemands({
        renown: player.renown,
        teamWinPct,
        teamMarketAppeal: team.marketAppeal,
        teamFacilitiesLevel: teamState.facilitiesLevel,
      }) ||
        salary < minAcceptableSalary(player.renown, player.overallRating, team.leagueId));
    const stats = seasonStats.get(player.id) ?? emptyStats;
    return {
      ...player,
      salary,
      yearsRemaining: contract?.yearsRemaining ?? 0,
      guaranteed: contract?.guaranteed ?? true,
      wantsTrade,
      ppg: stats.ppg,
      rpg: stats.rpg,
      apg: stats.apg,
    };
  });

  const deadCapTotal = deadCap.reduce((sum, d) => sum + d.salary, 0);
  const salaryCap = league?.salaryCap ?? 0;
  const overCap = totalPayroll > salaryCap;
  const isOpponentInMyLeague = !isMyTeam && team.leagueId === membership.leagueId;
  const managedByMe = manager?.userId === membership.userId;
  const managerLabel = managedByMe ? "Géré par toi" : manager ? `Géré par ${manager.email}` : "Géré par l'IA";

  let myRosterWithContracts: RosterPlayer[] = [];
  let myPicks: TradePick[] = [];
  if (isOpponentInMyLeague) {
    const [myRoster, myContracts, myPendingPicks] = await Promise.all([
      getRosterForTeam(membership.careerId, membership.teamId),
      getContractsForTeam(membership.careerId, membership.teamId),
      getPendingPicksForTeam(membership.careerId, membership.teamId),
    ]);
    const mySeasonStats = await getSeasonStatsForPlayers(
      membership.careerId,
      membership.season,
      myRoster.map((p) => p.id)
    );
    const myContractByPlayerId = new Map(myContracts.map((c) => [c.playerId, c]));
    myRosterWithContracts = myRoster.map((player) => {
      const contract = myContractByPlayerId.get(player.id);
      const stats = mySeasonStats.get(player.id) ?? emptyStats;
      return {
        ...player,
        salary: contract?.salary ?? 0,
        yearsRemaining: contract?.yearsRemaining ?? 0,
        guaranteed: contract?.guaranteed ?? true,
        wantsTrade: false, // non pertinent dans le contexte du formulaire d'échange
        ppg: stats.ppg,
        rpg: stats.rpg,
        apg: stats.apg,
      };
    });
    myPicks = myPendingPicks;
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="flex items-center gap-3">
        <TeamColorSwatch primaryColor={team.primaryColor} secondaryColor={team.secondaryColor} size="lg" />
        <h1 className="text-2xl font-bold">{teamFullName(team)}</h1>
        <span className="text-sm text-black/40 dark:text-white/40">
          · {managerLabel}
        </span>
      </div>

      <div className="mt-4 flex flex-wrap gap-4">
        <div className="rounded-lg border border-black/10 p-4 dark:border-white/10">
          <p className="text-xs uppercase tracking-wide text-black/50 dark:text-white/50">
            Masse salariale
          </p>
          <p className={`mt-1 text-xl font-semibold ${overCap ? "text-red-500" : ""}`}>
            {formatSalary(totalPayroll)} / {formatSalary(salaryCap)}
            {overCap && (
              <span className="ml-2 text-sm font-normal">au-dessus du plafond</span>
            )}
          </p>
          {deadCapTotal > 0 && (
            <p className="mt-1 text-xs text-black/50 dark:text-white/50">
              (dont {formatSalary(deadCapTotal)} d&apos;argent mort)
            </p>
          )}
        </div>
        <div className="rounded-lg border border-black/10 p-4 dark:border-white/10">
          <p className="text-xs uppercase tracking-wide text-black/50 dark:text-white/50">
            Effectif
          </p>
          <p className="mt-1 text-xl font-semibold">{roster.length} / 10 joueurs</p>
        </div>
        <div className="rounded-lg border border-black/10 p-4 dark:border-white/10">
          <p className="text-xs uppercase tracking-wide text-black/50 dark:text-white/50">
            Chimie d&apos;équipe
          </p>
          <p className="mt-1 text-xl font-semibold">{teamState.chemistry} / 99</p>
        </div>
      </div>

      {isMyTeam && (
        <div className="mt-6">
          <TrainingPlanForm
            focus={teamState.trainingFocus}
            intensity={teamState.trainingIntensity}
          />
        </div>
      )}

      <div className="mt-6">
        <RosterTable
          teamId={team.id}
          roster={rosterWithContracts}
          canRelease={isMyTeam && roster.length > MIN_ROSTER_SIZE}
        />
      </div>

      {picks.length > 0 && (
        <div className="mt-6">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-black/50 dark:text-white/50">
            Picks de draft
          </h2>
          <ul className="flex flex-wrap gap-2 text-sm">
            {picks.map((pick) => (
              <li
                key={pick.id}
                className="rounded-full border border-black/10 px-3 py-1 dark:border-white/10"
              >
                {pick.pickNumber !== null
                  ? `Pick ${pick.pickNumber} (Tour ${pick.round}, ${pick.season})`
                  : `Tour ${pick.round} ${pick.season}`}
                {pick.originalTeamId !== pick.teamId && (
                  <span className="text-black/40 dark:text-white/40"> (via {pick.originalTeamAbbreviation})</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {isOpponentInMyLeague && tradeDeadlinePassed && (
        <p className="mt-8 rounded-lg border border-black/10 p-4 text-sm text-red-500 dark:border-white/10">
          Date limite des échanges dépassée pour cette saison — les échanges
          rouvriront à la saison prochaine.
        </p>
      )}

      {isOpponentInMyLeague && !tradeDeadlinePassed && (
        <TradeProposalForm
          myRoster={myRosterWithContracts}
          theirRoster={rosterWithContracts}
          myPicks={myPicks}
          theirPicks={picks}
          opponentTeamId={team.id}
        />
      )}
    </div>
  );
}
