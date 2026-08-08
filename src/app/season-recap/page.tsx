import { getCurrentMembership } from "@/lib/auth/dal";
import { getFreeAgentReport } from "@/lib/data-access/free-agent-report";
import { getProspectsForCareer } from "@/lib/data-access/prospects";
import { getTeamsByLeague } from "@/lib/data-access/teams";
import { prisma } from "@/lib/prisma";
import { formatSalary } from "@/lib/utils";

export default async function SeasonRecapPage() {
  const membership = await getCurrentMembership();

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
        <h1 className="text-2xl font-bold">Bilan de fin de saison</h1>
        <p className="mt-1 text-black/60 dark:text-white/60">
          Agents libres, prochaine classe de draft, et retraites/Hall of Fame — le
          plus pertinent juste après avoir basculé sur une nouvelle saison.
        </p>
      </div>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Agents libres</h2>
        {freeAgentReport.length === 0 ? (
          <p className="text-sm text-black/50 dark:text-white/50">Aucun agent libre pour le moment.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead>
                <tr className="border-b border-black/10 text-black/50 dark:border-white/10 dark:text-white/50">
                  <th className="py-2 pr-4">Joueur</th>
                  <th className="py-2 pr-4">Overall</th>
                  <th className="py-2 pr-4">Renommé</th>
                  <th className="py-2 pr-4">Contrat visé</th>
                  <th className="py-2 pr-4">Préférences</th>
                  <th className="py-2">Équipes intéressées</th>
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
                    <td className="py-2 pr-4">{formatSalary(desiredContract)}</td>
                    <td className="py-2 pr-4 text-xs text-black/60 dark:text-white/60">
                      {[
                        wantsCompetitiveTeam && "compétitive",
                        wantsAttractiveMarket && "grand marché",
                        wantsGoodFacilities && "bonnes infrastructures",
                      ]
                        .filter(Boolean)
                        .join(", ") || "—"}
                    </td>
                    <td className="py-2 text-xs">
                      {interestedTeamIds.length === 0
                        ? "Aucune"
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
        <h2 className="mb-3 text-lg font-semibold">Prochaine classe de draft</h2>
        {prospects.length === 0 ? (
          <p className="text-sm text-black/50 dark:text-white/50">
            Aucune classe de draft générée pour le moment — passe à la saison
            suivante pour en obtenir une.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead>
                <tr className="border-b border-black/10 text-black/50 dark:border-white/10 dark:text-white/50">
                  <th className="py-2 pr-4">Prospect</th>
                  <th className="py-2 pr-4">Poste</th>
                  <th className="py-2 pr-4">Overall</th>
                  <th className="py-2 pr-4">Âge</th>
                  <th className="py-2">Scouting</th>
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
        <h2 className="mb-3 text-lg font-semibold">Hall of Fame &amp; retraites</h2>
        {retirees.length === 0 ? (
          <p className="text-sm text-black/50 dark:text-white/50">
            Personne n&apos;a pris sa retraite à la dernière intersaison.
          </p>
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
                    (overall au sommet : {state.peakOverallRating})
                  </span>
                </span>
                {state.hallOfFame ? (
                  <span className="rounded-full bg-yellow-500/10 px-2 py-0.5 text-xs font-medium text-yellow-600 dark:text-yellow-400">
                    🏆 Hall of Fame
                  </span>
                ) : (
                  <span className="text-xs text-black/40 dark:text-white/40">Retraite</span>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      <p className="text-xs text-black/40 dark:text-white/40">
        Les équipes intéressées et les préférences affichées sont indicatives
        — elles reflètent les règles de signature déjà en vigueur
        (compétitivité, marché, infrastructures, salaire).
      </p>
    </div>
  );
}
