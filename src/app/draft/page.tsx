import { getCurrentMembership } from "@/lib/auth/dal";
import { getProspectsForCareer } from "@/lib/data-access/prospects";
import { getLeagueById } from "@/lib/data-access/leagues";
import { getCurrentDraftPick } from "@/lib/data-access/draft-picks";
import { getMembershipForTeam } from "@/lib/data-access/memberships";
import { getTeamById, getTeamsByLeague } from "@/lib/data-access/teams";
import { prisma } from "@/lib/prisma";
import { draftForAiTeam, draftProspect } from "@/app/actions/draft";
import { rookieScaleContract } from "@/lib/careers/rookie-scale";
import { getTranslator } from "@/lib/i18n/translate";
import { formatSalary, teamFullName } from "@/lib/utils";

export default async function DraftPage() {
  const membership = await getCurrentMembership();
  const { t, locale } = await getTranslator();

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
        <h1 className="text-2xl font-bold">{t("draft.title")}</h1>
        <p className="mt-4 text-sm text-black/50 dark:text-white/50">
          {hasDraftPicks > 0 ? t("draft.overForSeason") : t("draft.noneInProgress")}
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
      <h1 className="text-2xl font-bold">{t("draft.title")}</h1>
      <p className="mt-1 text-black/60 dark:text-white/60">
        {t("draft.pickLine", {
          number: currentPick.pickNumber,
          round: currentPick.round,
          team: pickTeam ? teamFullName(pickTeam) : "?",
          salary: formatSalary(pickTerms.salary, locale),
        })}{" "}
        {pickTerms.guaranteed ? t("draft.guaranteed") : t("draft.notGuaranteed")}
      </p>

      {isMyTurn ? (
        <p className="mt-3 text-sm font-medium">{t("draft.yourTurn")}</p>
      ) : manager ? (
        <p className="mt-3 text-sm text-black/50 dark:text-white/50">
          {t("draft.waitingForPrefix")} {manager.email}…
        </p>
      ) : (
        <form action={draftForAiTeam} className="mt-4">
          <button
            type="submit"
            className="rounded-full bg-black px-4 py-1.5 text-sm font-medium text-white transition hover:bg-black/80 dark:bg-white dark:text-black dark:hover:bg-white/80"
          >
            {t("draft.draftForAi", { team: pickTeam ? teamFullName(pickTeam) : t("draft.aiFallback") })}
          </button>
        </form>
      )}

      {prospects.length === 0 ? (
        <p className="mt-6 text-sm text-black/50 dark:text-white/50">{t("draft.noProspects")}</p>
      ) : (
        <div className="mt-6 overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead>
              <tr className="border-b border-black/10 text-black/50 dark:border-white/10 dark:text-white/50">
                <th className="py-2 pr-4">{t("draft.colProspect")}</th>
                <th className="py-2 pr-4">{t("draft.colPosition")}</th>
                <th className="py-2 pr-4">{t("draft.colOverall")}</th>
                <th className="py-2 pr-4">{t("draft.colAge")}</th>
                {isMyTurn && <th className="py-2">{t("draft.colAction")}</th>}
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
                          {t("draft.draftButton")}
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
