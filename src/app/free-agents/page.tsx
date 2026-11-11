import { getCurrentMembership } from "@/lib/auth/dal";
import { getFreeAgents, getPayrollForTeam } from "@/lib/data-access/contracts";
import { getLeagueById } from "@/lib/data-access/leagues";
import { getStandings } from "@/lib/data-access/standings";
import { getTeamById } from "@/lib/data-access/teams";
import { getOrCreateTeamState } from "@/lib/data-access/team-state";
import { isFreeAgencyOpen } from "@/lib/data-access/season-windows";
import { prisma } from "@/lib/prisma";
import { MAX_ROSTER_SIZE } from "@/lib/careers/roster-rules";
import { checkSalaryMove, NBA_MINIMUM_EXCEPTION, payrollWarningLine } from "@/lib/careers/cap-rules";
import {
  minAcceptableSalary,
  teamMeetsPlayerDemands,
  winPctForStandings,
} from "@/lib/careers/player-demands";
import { getTranslator } from "@/lib/i18n/translate";
import Link from "next/link";
import { formatSalary, playerHref } from "@/lib/utils";
import { SortableTable } from "@/components/ui/SortableTable";

export default async function FreeAgentsPage() {
  const membership = await getCurrentMembership();
  const { t, locale } = await getTranslator();

  const [freeAgents, rosterSize, payroll, league, faOpen, standings, myTeam, myTeamState] = await Promise.all([
    getFreeAgents(membership.careerId, membership.leagueId),
    prisma.contract.count({
      where: { careerId: membership.careerId, teamId: membership.teamId, contractType: "standard" },
    }),
    getPayrollForTeam(membership.careerId, membership.teamId),
    getLeagueById(membership.leagueId),
    isFreeAgencyOpen(membership.careerId, membership.season),
    getStandings(membership.careerId, membership.leagueId, membership.season),
    getTeamById(membership.teamId),
    getOrCreateTeamState(membership.careerId, membership.teamId, membership.leagueId),
  ]);

  const maxRosterSize = MAX_ROSTER_SIZE[membership.leagueId] ?? MAX_ROSTER_SIZE.nba;
  const rosterFull = rosterSize >= maxRosterSize;
  const salaryCap = league?.salaryCap ?? Infinity;
  // Au-dessus du plafond : plus aucune signature en WNBA (plafond strict) ;
  // en NBA, seulement les joueurs qui acceptent le minimum (voir
  // cap-rules.ts) — vérifié joueur par joueur plus bas.
  const capReached = payroll >= salaryCap;
  const softCap = membership.leagueId === "nba";
  const canSign = !rosterFull && faOpen && (softCap || !capReached);
  const payrollInRed = payroll > payrollWarningLine(membership.leagueId, salaryCap);

  const myStandingsRow = standings.find((row) => row.teamId === membership.teamId);
  const teamWinPct = winPctForStandings(myStandingsRow?.wins ?? 0, myStandingsRow?.losses ?? 0);
  const teamMarketAppeal = myTeam?.marketAppeal ?? 50;

  return (
    <div className="mx-auto max-w-6xl px-4 lg:px-8 py-8">
      <h1 className="text-2xl font-bold tracking-tight">{t("freeAgents.title")}</h1>
      <p className="mt-1 text-soft">{t("freeAgents.subtitle")}</p>

      <p className="mt-4 text-sm text-soft">
        {t("freeAgents.payrollPrefix")}{" "}
        <span className={payrollInRed ? "font-semibold text-bad" : "font-semibold"}>
          {formatSalary(payroll, locale)} / {formatSalary(salaryCap, locale)}
        </span>
      </p>

      {!faOpen && <p className="mt-2 text-sm text-bad">{t("freeAgents.notOpenYet")}</p>}
      {rosterFull && (
        <p className="mt-2 text-sm text-bad">
          {t("freeAgents.rosterFull", { size: rosterSize, max: maxRosterSize })}
        </p>
      )}
      {capReached && (
        <p className="mt-2 text-sm text-bad">
          {softCap
            ? t("freeAgents.overCapMinimumOnly", { limit: formatSalary(NBA_MINIMUM_EXCEPTION, locale) })
            : t("freeAgents.capReached")}
        </p>
      )}

      <div className="mt-6 overflow-x-auto">
        <SortableTable
          minWidth={560}
          initialSort={{ column: 2, descending: true }}
          columns={[
            { label: t("freeAgents.colPlayer") },
            { label: t("freeAgents.colPosition") },
            { label: t("freeAgents.colOverall"), align: "right", descendingFirst: true },
            { label: t("freeAgents.colAge"), align: "right" },
            { label: t("freeAgents.colInjuryRisk"), align: "right" },
            { label: t("freeAgents.colRenown"), align: "right", descendingFirst: true },
            { label: t("freeAgents.colSalaryDemand"), align: "right", descendingFirst: true },
            ...(canSign ? [{ label: t("freeAgents.colAction"), sortable: false }] : []),
          ]}
          rows={freeAgents.map((player) => {
            const meetsDemands = teamMeetsPlayerDemands({
              renown: player.renown,
              teamWinPct,
              teamMarketAppeal,
              teamFacilitiesLevel: myTeamState.facilitiesLevel,
            });
            const expectedSalary = minAcceptableSalary(player.renown, player.overallRating, membership.leagueId);
            const affordable = checkSalaryMove(
              membership.leagueId,
              salaryCap,
              "sign",
              payroll + expectedSalary,
              expectedSalary
            ).ok;
            return {
              key: player.id,
              sortValues: [
                `${player.lastName} ${player.firstName}`,
                player.position,
                player.overallRating,
                player.age,
                player.injuryRisk,
                player.renown,
                expectedSalary,
                null,
              ],
              cells: [
                <Link key="name" href={playerHref(player.id)} className="font-medium hover:underline">
                  {player.firstName} {player.lastName}
                </Link>,
                player.position,
                <span key="ovr" className="font-semibold">{player.overallRating}</span>,
                player.age,
                <span key="risk">
                  {player.injuryRisk}
                  {player.injured && (
                    <span className="ml-1 text-xs text-bad">
                      {t("roster.unavailable")} ({player.injuryGamesRemaining})
                    </span>
                  )}
                </span>,
                player.renown,
                formatSalary(expectedSalary, locale),
                ...(canSign
                  ? [
                      !affordable ? (
                        <span key="act" className="text-xs text-muted">{t("freeAgents.overBudget")}</span>
                      ) : meetsDemands ? (
                        <Link
                          key="act"
                          href={playerHref(player.id)}
                          className="rounded-md bg-accent px-3 py-1 text-xs font-medium text-accent-fg transition hover:bg-accent-hover"
                        >
                          {t("nego.negotiate")}
                        </Link>
                      ) : (
                        <span key="act" className="text-xs text-bad">{t("freeAgents.refuses")}</span>
                      ),
                    ]
                  : []),
              ],
            };
          })}
        />
        {freeAgents.length === 0 && (
          <p className="mt-4 text-sm text-muted">{t("freeAgents.none")}</p>
        )}
      </div>
    </div>
  );
}
