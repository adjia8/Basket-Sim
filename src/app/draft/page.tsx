import { getCurrentMembership } from "@/lib/auth/dal";
import { getProspectsForCareer } from "@/lib/data-access/prospects";
import { getLeagueById } from "@/lib/data-access/leagues";
import { getCurrentDraftPick } from "@/lib/data-access/draft-picks";
import { getMembershipForTeam } from "@/lib/data-access/memberships";
import { getTeamById, getTeamsByLeague } from "@/lib/data-access/teams";
import { prisma } from "@/lib/prisma";
import { draftForAiTeam, draftProspect } from "@/app/actions/draft";
import { rookieScaleContract } from "@/lib/careers/rookie-scale";
import { formatSalary, teamFullName } from "@/lib/utils";

export default async function DraftPage() {
  const membership = await getCurrentMembership();

  const [prospects, teams, league] = await Promise.all([
    getProspectsForCareer(membership.careerId),
    getTeamsByLeague(membership.leagueId),
    getLeagueById(membership.leagueId),
  ]);
  const picksPerRound = teams.length;
  const salaryCap = league?.salaryCap ?? Infinity;

  const currentPick = await getCurrentDraftPick(
    membership.careerId,
    membership.season,
    salaryCap,
    picksPerRound,
    membership.leagueId
  );

  if (!currentPick) {
    const hasDraftPicks = await prisma.draftPick.count({
      where: { careerId: membership.careerId, season: membership.season },
    });
    return (
      <div className="mx-auto max-w-5xl px-4 py-8">
        <h1 className="text-2xl font-bold">Draft</h1>
        <p className="mt-4 text-sm text-black/50 dark:text-white/50">
          {hasDraftPicks > 0
            ? "Draft terminé pour cette saison."
            : "Aucun draft en cours pour l'instant — termine la saison en cours pour ouvrir le prochain."}
        </p>
      </div>
    );
  }

  const [pickTeam, manager] = await Promise.all([
    getTeamById(currentPick.teamId),
    getMembershipForTeam(membership.careerId, currentPick.teamId),
  ]);

  const isMyTurn = currentPick.teamId === membership.teamId;
  const pickTerms = rookieScaleContract(currentPick.pickNumber, picksPerRound, membership.leagueId);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="text-2xl font-bold">Draft</h1>
      <p className="mt-1 text-black/60 dark:text-white/60">
        Pick {currentPick.pickNumber} (Tour {currentPick.round}) —{" "}
        {pickTeam ? teamFullName(pickTeam) : "?"} · {formatSalary(pickTerms.salary)} ·{" "}
        {pickTerms.guaranteed ? "contrat garanti" : "contrat non garanti"}
      </p>

      {isMyTurn ? (
        <p className="mt-3 text-sm font-medium">C&apos;est à toi de choisir !</p>
      ) : manager ? (
        <p className="mt-3 text-sm text-black/50 dark:text-white/50">
          En attente de {manager.email}…
        </p>
      ) : (
        <form action={draftForAiTeam} className="mt-4">
          <button
            type="submit"
            className="rounded-full bg-black px-4 py-1.5 text-sm font-medium text-white transition hover:bg-black/80 dark:bg-white dark:text-black dark:hover:bg-white/80"
          >
            Faire drafter {pickTeam ? teamFullName(pickTeam) : "l'IA"}
          </button>
        </form>
      )}

      {prospects.length === 0 ? (
        <p className="mt-6 text-sm text-black/50 dark:text-white/50">
          Aucun prospect disponible pour l&apos;instant.
        </p>
      ) : (
        <div className="mt-6 overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead>
              <tr className="border-b border-black/10 text-black/50 dark:border-white/10 dark:text-white/50">
                <th className="py-2 pr-4">Prospect</th>
                <th className="py-2 pr-4">Poste</th>
                <th className="py-2 pr-4">Overall</th>
                <th className="py-2 pr-4">Âge</th>
                {isMyTurn && <th className="py-2">Action</th>}
              </tr>
            </thead>
            <tbody>
              {prospects.map((prospect) => (
                <tr key={prospect.id} className="border-b border-black/5 dark:border-white/5">
                  <td className="py-2 pr-4 font-medium">
                    {prospect.firstName} {prospect.lastName}
                  </td>
                  <td className="py-2 pr-4">{prospect.position}</td>
                  <td className="py-2 pr-4 font-semibold">{prospect.overallRating}</td>
                  <td className="py-2 pr-4">{prospect.age}</td>
                  {isMyTurn && (
                    <td className="py-2">
                      <form action={draftProspect}>
                        <input type="hidden" name="prospectId" value={prospect.id} />
                        <button
                          type="submit"
                          className="rounded-full bg-black px-3 py-1 text-xs font-medium text-white transition hover:bg-black/80 dark:bg-white dark:text-black dark:hover:bg-white/80"
                        >
                          Drafter
                        </button>
                      </form>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
