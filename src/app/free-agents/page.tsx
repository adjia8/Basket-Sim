import { getCurrentMembership } from "@/lib/auth/dal";
import { getFreeAgents, getPayrollForTeam } from "@/lib/data-access/contracts";
import { getLeagueById } from "@/lib/data-access/leagues";
import { getStandings } from "@/lib/data-access/standings";
import { getTeamById } from "@/lib/data-access/teams";
import { getOrCreateTeamState } from "@/lib/data-access/team-state";
import { isFreeAgencyOpen } from "@/lib/data-access/season-windows";
import { prisma } from "@/lib/prisma";
import { signFreeAgent } from "@/app/actions/roster";
import { MAX_ROSTER_SIZE } from "@/lib/careers/roster-rules";
import {
  minAcceptableSalary,
  teamMeetsPlayerDemands,
  winPctForStandings,
} from "@/lib/careers/player-demands";
import { getTranslator } from "@/lib/i18n/translate";
import { formatSalary } from "@/lib/utils";

export default async function FreeAgentsPage() {
  const membership = await getCurrentMembership();
  const { t, locale } = await getTranslator();

  const [freeAgents, rosterSize, payroll, league, faOpen, standings, myTeam, myTeamState] = await Promise.all([
    getFreeAgents(membership.careerId, membership.leagueId),
    prisma.contract.count({
      where: { careerId: membership.careerId, teamId: membership.teamId },
    }),
    getPayrollForTeam(membership.careerId, membership.teamId),
    getLeagueById(membership.leagueId),
    isFreeAgencyOpen(membership.careerId, membership.season),
    getStandings(membership.careerId, membership.leagueId, membership.season),
    getTeamById(membership.teamId),
    getOrCreateTeamState(membership.careerId, membership.teamId, membership.leagueId),
  ]);

  const rosterFull = rosterSize >= MAX_ROSTER_SIZE;
  const salaryCap = league?.salaryCap ?? Infinity;
  // Un contrat a toujours un salaire strictement positif : si la masse
  // salariale actuelle atteint déjà le plafond, aucune signature ne peut plus
  // passer, quel que soit le montant (aléatoire) qui serait proposé.
  const capReached = payroll >= salaryCap;
  const canSign = !rosterFull && !capReached && faOpen;

  const myStandingsRow = standings.find((row) => row.teamId === membership.teamId);
  const teamWinPct = winPctForStandings(myStandingsRow?.wins ?? 0, myStandingsRow?.losses ?? 0);
  const teamMarketAppeal = myTeam?.marketAppeal ?? 50;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="text-2xl font-bold">{t("freeAgents.title")}</h1>
      <p className="mt-1 text-black/60 dark:text-white/60">{t("freeAgents.subtitle")}</p>

      <p className="mt-4 text-sm text-black/60 dark:text-white/60">
        {t("freeAgents.payrollPrefix")}{" "}
        <span className={capReached ? "font-semibold text-red-500" : "font-semibold"}>
          {formatSalary(payroll, locale)} / {formatSalary(salaryCap, locale)}
        </span>
      </p>

      {!faOpen && <p className="mt-2 text-sm text-red-500">{t("freeAgents.notOpenYet")}</p>}
      {rosterFull && (
        <p className="mt-2 text-sm text-red-500">
          {t("freeAgents.rosterFull", { size: rosterSize, max: MAX_ROSTER_SIZE })}
        </p>
      )}
      {capReached && <p className="mt-2 text-sm text-red-500">{t("freeAgents.capReached")}</p>}

      <div className="mt-6 overflow-x-auto">
        <table className="w-full min-w-[560px] text-left text-sm">
          <thead>
            <tr className="border-b border-black/10 text-black/50 dark:border-white/10 dark:text-white/50">
              <th className="py-2 pr-4">{t("freeAgents.colPlayer")}</th>
              <th className="py-2 pr-4">{t("freeAgents.colPosition")}</th>
              <th className="py-2 pr-4">{t("freeAgents.colOverall")}</th>
              <th className="py-2 pr-4">{t("freeAgents.colAge")}</th>
              <th className="py-2 pr-4">{t("freeAgents.colInjuryRisk")}</th>
              <th className="py-2 pr-4">{t("freeAgents.colRenown")}</th>
              <th className="py-2 pr-4">{t("freeAgents.colSalaryDemand")}</th>
              {canSign && <th className="py-2">{t("freeAgents.colAction")}</th>}
            </tr>
          </thead>
          <tbody>
            {freeAgents.map((player) => {
              const meetsDemands = teamMeetsPlayerDemands({
                renown: player.renown,
                teamWinPct,
                teamMarketAppeal,
                teamFacilitiesLevel: myTeamState.facilitiesLevel,
              });
              const expectedSalary = minAcceptableSalary(
                player.renown,
                player.overallRating,
                membership.leagueId
              );

              return (
                <tr key={player.id} className="border-b border-black/5 dark:border-white/5">
                  <td className="py-2 pr-4 font-medium">
                    {player.firstName} {player.lastName}
                  </td>
                  <td className="py-2 pr-4">{player.position}</td>
                  <td className="py-2 pr-4 font-semibold">{player.overallRating}</td>
                  <td className="py-2 pr-4">{player.age}</td>
                  <td className="py-2 pr-4">
                    {player.injuryRisk}
                    {player.injured && (
                      <span className="ml-1 text-xs text-red-500">
                        {t("roster.unavailable")} ({player.injuryGamesRemaining})
                      </span>
                    )}
                  </td>
                  <td className="py-2 pr-4">{player.renown}</td>
                  <td className="py-2 pr-4">{formatSalary(expectedSalary, locale)}</td>
                  {canSign && (
                    <td className="py-2">
                      {meetsDemands ? (
                        <form action={signFreeAgent}>
                          <input type="hidden" name="playerId" value={player.id} />
                          <button
                            type="submit"
                            className="rounded-full bg-black px-3 py-1 text-xs font-medium text-white transition hover:bg-black/80 dark:bg-white dark:text-black dark:hover:bg-white/80"
                          >
                            {t("freeAgents.sign")}
                          </button>
                        </form>
                      ) : (
                        <span className="text-xs text-red-500">{t("freeAgents.refuses")}</span>
                      )}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
        {freeAgents.length === 0 && (
          <p className="mt-4 text-sm text-black/50 dark:text-white/50">{t("freeAgents.none")}</p>
        )}
      </div>
    </div>
  );
}
