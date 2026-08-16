import { notFound } from "next/navigation";
import { getCurrentMembership } from "@/lib/auth/dal";
import { getContractsForTeam, getPayrollForTeam } from "@/lib/data-access/contracts";
import { getLeagueById } from "@/lib/data-access/leagues";
import { getMembershipForTeam } from "@/lib/data-access/memberships";
import { getRosterForTeam } from "@/lib/data-access/players";
import { getSeasonStatsForPlayers, type SeasonStats } from "@/lib/data-access/season-stats";
import { isTradeDeadlinePassed } from "@/lib/data-access/season-windows";
import { getOrCreateTeamState } from "@/lib/data-access/team-state";
import { getTeamById } from "@/lib/data-access/teams";
import { prisma } from "@/lib/prisma";
import { RosterTable, type RosterPlayer } from "@/components/team/RosterTable";
import { TradeProposalForm, type TradePick } from "@/components/team/TradeProposalForm";
import { TrainingPlanForm } from "@/components/team/TrainingPlanForm";
import { RotationOrderForm } from "@/components/team/RotationOrderForm";
import { TeamColorSwatch } from "@/components/team/TeamColorSwatch";
import { MAX_ROSTER_SIZE, MIN_ROSTER_SIZE } from "@/lib/careers/roster-rules";
import { getPlayerDemandStates, type PlayerDemandState } from "@/lib/data-access/trade-requests";
import { mergeRotationOrder, parseRotationOrder } from "@/lib/careers/rotation-rules";
import { getTranslator, type Translator } from "@/lib/i18n/translate";
import { formatSalary, teamFullName } from "@/lib/utils";

function pickLabel(t: Translator, pick: Pick<TradePick, "pickNumber" | "round" | "season" | "originalTeamId" | "teamId" | "originalTeamAbbreviation">): string {
  const base =
    pick.pickNumber !== null
      ? t("common.draftPick.full", { number: pick.pickNumber, round: pick.round, season: pick.season })
      : t("common.draftPick.roundOnly", { round: pick.round, season: pick.season });
  return pick.originalTeamId !== pick.teamId
    ? base + t("common.draftPick.via", { abbr: pick.originalTeamAbbreviation })
    : base;
}

async function getPendingPicksForTeam(t: Translator, careerId: string, teamId: string): Promise<TradePick[]> {
  const rows = await prisma.draftPick.findMany({
    where: { careerId, teamId, status: "pending" },
    include: { originalTeam: true },
    orderBy: [{ season: "asc" }, { round: "asc" }],
  });
  return rows.map((row) => {
    const pick = {
      id: row.id,
      season: row.season,
      round: row.round,
      pickNumber: row.pickNumber,
      originalTeamId: row.originalTeamId,
      teamId: row.teamId,
      originalTeamAbbreviation: row.originalTeam.abbreviation,
    };
    return { ...pick, label: pickLabel(t, pick) };
  });
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
  const { t, locale } = await getTranslator();

  const [roster, contracts, league, manager, totalPayroll, deadCap, picks, tradeDeadlinePassed, teamState] =
    await Promise.all([
      getRosterForTeam(membership.careerId, teamId),
      getContractsForTeam(membership.careerId, teamId),
      getLeagueById(team.leagueId),
      getMembershipForTeam(membership.careerId, teamId),
      getPayrollForTeam(membership.careerId, teamId),
      prisma.deadCap.findMany({ where: { careerId: membership.careerId, teamId } }),
      getPendingPicksForTeam(t, membership.careerId, teamId),
      isTradeDeadlinePassed(membership.careerId, membership.season),
      getOrCreateTeamState(membership.careerId, teamId, team.leagueId),
    ]);

  const isMyTeam = team.id === membership.teamId;

  const seasonStats = await getSeasonStatsForPlayers(
    membership.careerId,
    membership.season,
    roster.map((p) => p.id)
  );
  const emptyStats: SeasonStats = { gamesPlayed: 0, points: 0, rebounds: 0, assists: 0, ppg: 0, rpg: 0, apg: 0 };

  // Demande de trade visible uniquement pour mon propre effectif — état
  // persisté (voir trade-requests.ts), plus recalculé en direct à chaque
  // rendu : purement informatif, n'affecte aucune mécanique.
  const demandStates: Map<string, PlayerDemandState> = isMyTeam
    ? await getPlayerDemandStates(membership.careerId, roster.map((p) => p.id))
    : new Map();

  const contractByPlayerId = new Map(contracts.map((c) => [c.playerId, c]));
  const rosterWithContracts: RosterPlayer[] = roster.map((player) => {
    const contract = contractByPlayerId.get(player.id);
    const salary = contract?.salary ?? 0;
    const demandState = demandStates.get(player.id);
    const stats = seasonStats.get(player.id) ?? emptyStats;
    return {
      ...player,
      salary,
      yearsRemaining: contract?.yearsRemaining ?? 0,
      guaranteed: contract?.guaranteed ?? true,
      contractType: contract?.contractType ?? "standard",
      wantsTrade: demandState?.wantsTrade ?? false,
      tradeReasons: demandState?.reasons ?? [],
      ppg: stats.ppg,
      rpg: stats.rpg,
      apg: stats.apg,
    };
  });

  const rotationOrder = isMyTeam
    ? mergeRotationOrder(rosterWithContracts, parseRotationOrder(teamState.rotationOrderJson))
    : [];

  const deadCapTotal = deadCap.reduce((sum, d) => sum + d.salary, 0);
  const salaryCap = league?.salaryCap ?? 0;
  const overCap = totalPayroll > salaryCap;
  const standardRosterSize = contracts.filter((c) => c.contractType === "standard").length;
  const minRosterSize = MIN_ROSTER_SIZE[team.leagueId] ?? MIN_ROSTER_SIZE.nba;
  const maxRosterSize = MAX_ROSTER_SIZE[team.leagueId] ?? MAX_ROSTER_SIZE.nba;
  const isOpponentInMyLeague = !isMyTeam && team.leagueId === membership.leagueId;
  const managedByMe = manager?.userId === membership.userId;
  const managerLabel = managedByMe
    ? t("team.managedByMe")
    : manager
      ? t("team.managedBy", { email: manager.email })
      : t("team.managedByAi");

  let myRosterWithContracts: RosterPlayer[] = [];
  let myPicks: TradePick[] = [];
  if (isOpponentInMyLeague) {
    const [myRoster, myContracts, myPendingPicks] = await Promise.all([
      getRosterForTeam(membership.careerId, membership.teamId),
      getContractsForTeam(membership.careerId, membership.teamId),
      getPendingPicksForTeam(t, membership.careerId, membership.teamId),
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
        contractType: contract?.contractType ?? "standard",
        wantsTrade: false, // non pertinent dans le contexte du formulaire d'échange
        tradeReasons: [],
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
            {t("team.payroll")}
          </p>
          <p className={`mt-1 text-xl font-semibold ${overCap ? "text-red-500" : ""}`}>
            {formatSalary(totalPayroll, locale)} / {formatSalary(salaryCap, locale)}
            {overCap && <span className="ml-2 text-sm font-normal">{t("team.overCap")}</span>}
          </p>
          {deadCapTotal > 0 && (
            <p className="mt-1 text-xs text-black/50 dark:text-white/50">
              {t("team.deadCapNote", { amount: formatSalary(deadCapTotal, locale) })}
            </p>
          )}
        </div>
        <div className="rounded-lg border border-black/10 p-4 dark:border-white/10">
          <p className="text-xs uppercase tracking-wide text-black/50 dark:text-white/50">
            {t("team.roster")}
          </p>
          <p className="mt-1 text-xl font-semibold">
            {t("team.rosterCount", { count: standardRosterSize, max: maxRosterSize })}
          </p>
        </div>
        <div className="rounded-lg border border-black/10 p-4 dark:border-white/10">
          <p className="text-xs uppercase tracking-wide text-black/50 dark:text-white/50">
            {t("team.chemistry")}
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

      {isMyTeam && (
        <div className="mt-6">
          <RotationOrderForm initialOrder={rotationOrder} />
        </div>
      )}

      <div className="mt-6">
        <RosterTable
          teamId={team.id}
          roster={rosterWithContracts}
          canRelease={isMyTeam && standardRosterSize > minRosterSize}
          locale={locale}
          labels={{
            player: t("roster.column.player"),
            position: t("roster.column.position"),
            nationality: t("roster.column.nationality"),
            overall: t("roster.column.overall"),
            height: t("roster.column.height"),
            age: t("roster.column.age"),
            salary: t("roster.column.salary"),
            yearsRemaining: t("roster.column.yearsRemaining"),
            ppg: t("roster.column.ppg"),
            rpg: t("roster.column.rpg"),
            apg: t("roster.column.apg"),
            unavailable: t("roster.unavailable"),
            games: t("roster.games"),
            rest: t("roster.rest"),
            playThroughInjury: t("roster.playThroughInjury"),
            wantsTrade: t("roster.wantsTrade"),
            notGuaranteed: t("roster.notGuaranteed"),
            severity: {
              minor: t("domain.injurySeverity.minor"),
              moderate: t("domain.injurySeverity.moderate"),
              severe: t("domain.injurySeverity.severe"),
            },
            tradeReason: {
              competitiveness: t("domain.tradeReason.competitiveness"),
              market: t("domain.tradeReason.market"),
              facilities: t("domain.tradeReason.facilities"),
            },
            contractType: {
              development: t("roster.contractType.development"),
              two_way: t("roster.contractType.two_way"),
            },
          }}
        />
      </div>

      {picks.length > 0 && (
        <div className="mt-6">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-black/50 dark:text-white/50">
            {t("team.draftPicks")}
          </h2>
          <ul className="flex flex-wrap gap-2 text-sm">
            {picks.map((pick) => (
              <li
                key={pick.id}
                className="rounded-full border border-black/10 px-3 py-1 dark:border-white/10"
              >
                {pick.label}
              </li>
            ))}
          </ul>
        </div>
      )}

      {isOpponentInMyLeague && tradeDeadlinePassed && (
        <p className="mt-8 rounded-lg border border-black/10 p-4 text-sm text-red-500 dark:border-white/10">
          {t("team.tradeDeadlinePassed")}
        </p>
      )}

      {isOpponentInMyLeague && !tradeDeadlinePassed && (
        <TradeProposalForm
          myRoster={myRosterWithContracts}
          theirRoster={rosterWithContracts}
          myTeamId={membership.teamId}
          myPicks={myPicks}
          theirPicks={picks}
          opponentTeamId={team.id}
          locale={locale}
          labels={{
            title: t("trade.proposeTitle"),
            myPlayersToOffer: t("trade.myPlayersToOffer"),
            myPicksToOffer: t("trade.myPicksToOffer"),
            theirPlayersToReceive: t("trade.theirPlayersToReceive"),
            theirPicksToReceive: t("trade.theirPicksToReceive"),
            proposing: t("common.proposing"),
            proposeButton: t("trade.proposeButton"),
          }}
        />
      )}
    </div>
  );
}
