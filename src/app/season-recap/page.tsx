import { getCurrentMembership } from "@/lib/auth/dal";
import { getFreeAgentReport } from "@/lib/data-access/free-agent-report";
import { getProspectsForCareer } from "@/lib/data-access/prospects";
import { getTeamsByLeague } from "@/lib/data-access/teams";
import { prisma } from "@/lib/prisma";
import { getTranslator } from "@/lib/i18n/translate";
import { formatSalary } from "@/lib/utils";

export default async function SeasonRecapPage() {
  const membership = await getCurrentMembership();
  const { t, locale } = await getTranslator();

  const [freeAgentReport, prospects, teams, retirees] = await Promise.all([
    getFreeAgentReport(membership.careerId, membership.leagueId, membership.season),
    getProspectsForCareer(membership.careerId),
    getTeamsByLeague(membership.leagueId),
    prisma.playerState.findMany({
      where: { careerId: membership.careerId, retiredSeason: membership.season },
      include: { player: true },
      orderBy: { hallOfFame: "desc" },
    }),
  ]);

  const teamById = new Map(teams.map((t) => [t.id, t]));

  return (
    <div className="mx-auto max-w-5xl space-y-10 px-4 py-8">
      <div>
        <h1 className="text-2xl font-bold">{t("seasonRecap.title")}</h1>
        <p className="mt-1 text-black/60 dark:text-white/60">{t("seasonRecap.subtitle")}</p>
      </div>

      <section>
        <h2 className="mb-3 text-lg font-semibold">{t("seasonRecap.freeAgentsHeading")}</h2>
        {freeAgentReport.length === 0 ? (
          <p className="text-sm text-black/50 dark:text-white/50">{t("seasonRecap.noFreeAgents")}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead>
                <tr className="border-b border-black/10 text-black/50 dark:border-white/10 dark:text-white/50">
                  <th className="py-2 pr-4">{t("seasonRecap.colPlayer")}</th>
                  <th className="py-2 pr-4">{t("seasonRecap.colOverall")}</th>
                  <th className="py-2 pr-4">{t("seasonRecap.colRenown")}</th>
                  <th className="py-2 pr-4">{t("seasonRecap.colDesiredContract")}</th>
                  <th className="py-2 pr-4">{t("seasonRecap.colPreferences")}</th>
                  <th className="py-2">{t("seasonRecap.colInterestedTeams")}</th>
                </tr>
              </thead>
              <tbody>
                {freeAgentReport.map(({ player, desiredContract, wantsCompetitiveTeam, wantsAttractiveMarket, wantsGoodFacilities, interestedTeamIds }) => (
                  <tr key={player.id} className="border-b border-black/5 dark:border-white/5">
                    <td className="py-2 pr-4 font-medium">
                      {player.firstName} {player.lastName}
                    </td>
                    <td className="py-2 pr-4">{player.overallRating}</td>
                    <td className="py-2 pr-4">{player.renown}</td>
                    <td className="py-2 pr-4">{formatSalary(desiredContract, locale)}</td>
                    <td className="py-2 pr-4 text-xs text-black/60 dark:text-white/60">
                      {[
                        wantsCompetitiveTeam && t("seasonRecap.prefCompetitive"),
                        wantsAttractiveMarket && t("seasonRecap.prefBigMarket"),
                        wantsGoodFacilities && t("seasonRecap.prefGoodFacilities"),
                      ]
                        .filter(Boolean)
                        .join(", ") || "—"}
                    </td>
                    <td className="py-2 text-xs">
                      {interestedTeamIds.length === 0
                        ? t("seasonRecap.none")
                        : interestedTeamIds
                            .map((id) => teamById.get(id)?.abbreviation ?? id)
                            .join(", ")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">{t("seasonRecap.nextDraftClassHeading")}</h2>
        {prospects.length === 0 ? (
          <p className="text-sm text-black/50 dark:text-white/50">{t("seasonRecap.noDraftClass")}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead>
                <tr className="border-b border-black/10 text-black/50 dark:border-white/10 dark:text-white/50">
                  <th className="py-2 pr-4">{t("seasonRecap.colProspect")}</th>
                  <th className="py-2 pr-4">{t("seasonRecap.colPosition")}</th>
                  <th className="py-2 pr-4">{t("seasonRecap.colOverall")}</th>
                  <th className="py-2 pr-4">{t("seasonRecap.colAge")}</th>
                  <th className="py-2">{t("seasonRecap.colScouting")}</th>
                </tr>
              </thead>
              <tbody>
                {prospects.map((prospect) => (
                  <tr key={prospect.id} className="border-b border-black/5 dark:border-white/5">
                    <td className="py-2 pr-4 font-medium">
                      {prospect.firstName} {prospect.lastName}
                    </td>
                    <td className="py-2 pr-4">{prospect.position}</td>
                    <td className="py-2 pr-4">{prospect.overallRating}</td>
                    <td className="py-2 pr-4">{prospect.age}</td>
                    <td className="py-2 text-xs text-black/60 dark:text-white/60">
                      {prospect.scoutingNote ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">{t("seasonRecap.hallOfFameHeading")}</h2>
        {retirees.length === 0 ? (
          <p className="text-sm text-black/50 dark:text-white/50">{t("seasonRecap.noRetirees")}</p>
        ) : (
          <div className="space-y-2">
            {retirees.map((state) => (
              <div
                key={state.id}
                className="flex items-center justify-between rounded-lg border border-black/10 px-4 py-3 text-sm dark:border-white/10"
              >
                <span>
                  {state.player.firstName} {state.player.lastName}
                  <span className="ml-2 text-xs text-black/50 dark:text-white/50">
                    ({t("seasonRecap.peakOverallPrefix")} {state.peakOverallRating})
                  </span>
                </span>
                {state.hallOfFame ? (
                  <span className="rounded-full bg-yellow-500/10 px-2 py-0.5 text-xs font-medium text-yellow-600 dark:text-yellow-400">
                    {t("seasonRecap.hallOfFame")}
                  </span>
                ) : (
                  <span className="text-xs text-black/40 dark:text-white/40">{t("seasonRecap.retired")}</span>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      <p className="text-xs text-black/40 dark:text-white/40">{t("seasonRecap.footnote")}</p>
    </div>
  );
}
