import { getCurrentCareer } from "@/lib/auth/dal";
import { getProspectsForCareer } from "@/lib/data-access/prospects";
import { prisma } from "@/lib/prisma";
import { draftProspect } from "@/app/actions/draft";
import { MAX_ROSTER_SIZE } from "@/lib/careers/roster-rules";

export default async function DraftPage() {
  const career = await getCurrentCareer();

  const [prospects, rosterSize] = await Promise.all([
    getProspectsForCareer(career.id),
    prisma.contract.count({
      where: { careerId: career.id, teamId: career.teamId },
    }),
  ]);

  const rosterFull = rosterSize >= MAX_ROSTER_SIZE;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="text-2xl font-bold">Draft</h1>
      <p className="mt-1 text-black/60 dark:text-white/60">
        Prospects disponibles pour ta ligue cette saison.
      </p>

      {rosterFull && prospects.length > 0 && (
        <p className="mt-4 text-sm text-red-500">
          Effectif complet ({rosterSize} / {MAX_ROSTER_SIZE}) — libère un joueur
          pour pouvoir en drafter un autre.
        </p>
      )}

      {prospects.length === 0 ? (
        <p className="mt-6 text-sm text-black/50 dark:text-white/50">
          Aucun prospect disponible pour l&apos;instant — termine la saison en
          cours pour ouvrir un nouveau draft.
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
                {!rosterFull && <th className="py-2">Action</th>}
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
                  {!rosterFull && (
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
