import { getCurrentMembership } from "@/lib/auth/dal";
import { getFreeAgents } from "@/lib/data-access/contracts";
import { prisma } from "@/lib/prisma";
import { signFreeAgent } from "@/app/actions/roster";
import { MAX_ROSTER_SIZE } from "@/lib/careers/roster-rules";

export default async function FreeAgentsPage() {
  const membership = await getCurrentMembership();

  const [freeAgents, rosterSize] = await Promise.all([
    getFreeAgents(membership.careerId, membership.leagueId),
    prisma.contract.count({
      where: { careerId: membership.careerId, teamId: membership.teamId },
    }),
  ]);

  const rosterFull = rosterSize >= MAX_ROSTER_SIZE;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="text-2xl font-bold">Agents libres</h1>
      <p className="mt-1 text-black/60 dark:text-white/60">
        Joueurs de ta ligue actuellement sans contrat.
      </p>

      {rosterFull && (
        <p className="mt-4 text-sm text-red-500">
          Effectif complet ({rosterSize} / {MAX_ROSTER_SIZE}) — libère un joueur
          pour pouvoir en signer un autre.
        </p>
      )}

      <div className="mt-6 overflow-x-auto">
        <table className="w-full min-w-[560px] text-left text-sm">
          <thead>
            <tr className="border-b border-black/10 text-black/50 dark:border-white/10 dark:text-white/50">
              <th className="py-2 pr-4">Joueur</th>
              <th className="py-2 pr-4">Poste</th>
              <th className="py-2 pr-4">Overall</th>
              <th className="py-2 pr-4">Âge</th>
              {!rosterFull && <th className="py-2">Action</th>}
            </tr>
          </thead>
          <tbody>
            {freeAgents.map((player) => (
              <tr key={player.id} className="border-b border-black/5 dark:border-white/5">
                <td className="py-2 pr-4 font-medium">
                  {player.firstName} {player.lastName}
                </td>
                <td className="py-2 pr-4">{player.position}</td>
                <td className="py-2 pr-4 font-semibold">{player.overallRating}</td>
                <td className="py-2 pr-4">{player.age}</td>
                {!rosterFull && (
                  <td className="py-2">
                    <form action={signFreeAgent}>
                      <input type="hidden" name="playerId" value={player.id} />
                      <button
                        type="submit"
                        className="rounded-full bg-black px-3 py-1 text-xs font-medium text-white transition hover:bg-black/80 dark:bg-white dark:text-black dark:hover:bg-white/80"
                      >
                        Signer
                      </button>
                    </form>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        {freeAgents.length === 0 && (
          <p className="mt-4 text-sm text-black/50 dark:text-white/50">
            Aucun agent libre pour le moment.
          </p>
        )}
      </div>
    </div>
  );
}
