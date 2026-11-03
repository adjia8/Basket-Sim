import { getCurrentMembership } from "@/lib/auth/dal";
import { getFreeAgentReport } from "@/lib/data-access/free-agent-report";
import { getProspectsForCareer } from "@/lib/data-access/prospects";
import { getTeamsByLeague } from "@/lib/data-access/teams";
import { prisma } from "@/lib/prisma";
import { getTranslator } from "@/lib/i18n/translate";
import Link from "next/link";
import { formatSalary, playerHref } from "@/lib/utils";

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
    <div className="mx-auto max-w-6xl space-y-10 px-4 py-8 lg:px-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("seasonRecap.title")}</h1>
        <p className="mt-1 text-soft">{t("seasonRecap.subtitle")}</p>
      </div>

      <section>
        <h2 className="mb-3 text-lg font-semibold">{t("seasonRecap.freeAgentsHeading")}</h2>
        {freeAgentReport.length === 0 ? (
          <p className="text-sm text-muted">{t("seasonRecap.noFreeAgents")}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table w-full min-w-[720px] text-left text-sm">
              <thead>
                <tr className="border-b border-line text-muted">
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
                  <tr key={player.id} className="border-b border-line-soft">
                    <td className="py-2 pr-4 font-medium">
                      <Link href={playerHref(player.id)} className="hover:underline">
                        {player.firstName} {player.lastName}
                      </Link>
                    </td>
                    <td className="py-2 pr-4">{player.overallRating}</td>
                    <td className="py-2 pr-4">{player.renown}</td>
                    <td className="py-2 pr-4">{formatSalary(desiredContract, locale)}</td>
                    <td className="py-2 pr-4 text-xs text-soft">
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
          <p className="text-sm text-muted">{t("seasonRecap.noDraftClass")}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table w-full min-w-[560px] text-left text-sm">
              <thead>
                <tr className="border-b border-line text-muted">
                  <th className="py-2 pr-4">{t("seasonRecap.colProspect")}</th>
                  <th className="py-2 pr-4">{t("seasonRecap.colPosition")}</th>
                  <th className="py-2 pr-4">{t("seasonRecap.colOverall")}</th>
                  <th className="py-2 pr-4">{t("seasonRecap.colAge")}</th>
                  <th className="py-2">{t("seasonRecap.colScouting")}</th>
                </tr>
              </thead>
              <tbody>
                {prospects.map((prospect) => (
                  <tr key={prospect.id} className="border-b border-line-soft">
                    <td className="py-2 pr-4 font-medium">
                      {prospect.firstName} {prospect.lastName}
                    </td>
                    <td className="py-2 pr-4">{prospect.position}</td>
                    <td className="py-2 pr-4">{prospect.overallRating}</td>
                    <td className="py-2 pr-4">{prospect.age}</td>
                    <td className="py-2 text-xs text-soft">
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
          <p className="text-sm text-muted">{t("seasonRecap.noRetirees")}</p>
        ) : (
          <div className="space-y-2">
            {retirees.map((state) => (
              <div
                key={state.id}
                className="flex items-center justify-between card px-4 py-3 text-sm"
              >
                <span>
                  <Link href={playerHref(state.player.id)} className="hover:underline">
                    {state.player.firstName} {state.player.lastName}
                  </Link>
                  <span className="ml-2 text-xs text-muted">
                    ({t("seasonRecap.peakOverallPrefix")} {state.peakOverallRating})
                  </span>
                </span>
                {state.hallOfFame ? (
                  <span className="rounded-full bg-warn/10 px-2 py-0.5 text-xs font-medium text-warn">
                    {t("seasonRecap.hallOfFame")}
                  </span>
                ) : (
                  <span className="text-xs text-faint">{t("seasonRecap.retired")}</span>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      <p className="text-xs text-faint">{t("seasonRecap.footnote")}</p>
    </div>
  );
}
