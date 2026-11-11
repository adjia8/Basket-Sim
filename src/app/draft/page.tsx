import Link from "next/link";
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
import { ensureCareerStaff, getStaffProfiles } from "@/lib/data-access/staff";
import { NEUTRAL_STAFF_PROFILE } from "@/lib/careers/staff-rules";
import { estimateError, estimateRating, ratingStars } from "@/lib/careers/potential-rules";
import { Stars } from "@/components/ui/Stars";

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
      <div className="mx-auto max-w-6xl px-4 lg:px-8 py-8">
        <h1 className="text-2xl font-bold tracking-tight">{t("draft.title")}</h1>
        <p className="mt-4 text-sm text-muted">
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

  // Brouillard du recrutement (voir potential-rules.ts) : le GM ne voit que
  // les estimations de ses recruteurs, triées sur l'estimation (trier sur la
  // vraie note la trahirait).
  await ensureCareerStaff(membership.careerId, membership.leagueId, membership.season);
  const scouting = ((await getStaffProfiles(membership.careerId, [membership.teamId], membership.leagueId)).get(membership.teamId) ?? NEUTRAL_STAFF_PROFILE).scouting;
  const scouted = prospects
    .map((p) => ({
      prospect: p,
      current: estimateRating(p.overallRating, scouting, `${membership.careerId}:${membership.teamId}:${p.id}:cur`, 0.6),
      potential: estimateRating(p.potential || p.overallRating, scouting, `${membership.careerId}:${membership.teamId}:${p.id}:pot`),
    }))
    .sort((a, b) => b.current.mid - a.current.mid);
  const pickTerms = rookieScaleContract(currentPick.pickNumber, picksPerRound, membership.leagueId);

  return (
    <div className="mx-auto max-w-6xl px-4 lg:px-8 py-8">
      <h1 className="text-2xl font-bold tracking-tight">{t("draft.title")}</h1>
      <p className="mt-1 text-soft">
        {t("draft.pickLinePrefix", { number: currentPick.pickNumber, round: currentPick.round })}{" "}
        {pickTeam ? (
          <Link href={`/teams/${pickTeam.id}`} className="hover:underline">
            {teamFullName(pickTeam)}
          </Link>
        ) : (
          "?"
        )}{" "}
        {t("draft.pickLineSuffix", { salary: formatSalary(pickTerms.salary, locale) })}{" "}
        {pickTerms.guaranteed ? t("draft.guaranteed") : t("draft.notGuaranteed")}
      </p>

      {isMyTurn ? (
        <p className="mt-3 text-sm font-medium">{t("draft.yourTurn")}</p>
      ) : manager ? (
        <p className="mt-3 text-sm text-muted">
          {t("draft.waitingForPrefix")} {manager.email}…
        </p>
      ) : (
        <form action={draftForAiTeam} className="mt-4">
          <button
            type="submit"
            className="rounded-md bg-accent px-4 py-1.5 text-sm font-medium text-accent-fg transition hover:bg-accent-hover"
          >
            {t("draft.draftForAi", { team: pickTeam ? teamFullName(pickTeam) : t("draft.aiFallback") })}
          </button>
        </form>
      )}

      {prospects.length > 0 && (
        <p className="mt-4 text-xs text-muted">
          {t("draft.scoutingHint", { level: scouting, error: Math.round(estimateError(scouting) / 2) })}
        </p>
      )}

      {prospects.length === 0 ? (
        <p className="mt-6 text-sm text-muted">{t("draft.noProspects")}</p>
      ) : (
        <div className="mt-6 overflow-x-auto">
          <table className="data-table w-full min-w-[560px] text-left text-sm">
            <thead>
              <tr className="border-b border-line text-muted">
                <th className="py-2 pr-4">{t("draft.colProspect")}</th>
                <th className="py-2 pr-4">{t("draft.colPosition")}</th>
                <th className="py-2 pr-4">{t("draft.colOverall")}</th>
                <th className="py-2 pr-4">{t("draft.colPotential")}</th>
                <th className="py-2 pr-4">{t("draft.colAge")}</th>
                {isMyTurn && <th className="py-2">{t("draft.colAction")}</th>}
              </tr>
            </thead>
            <tbody>
              {scouted.map(({ prospect, current, potential }) => (
                <tr key={prospect.id} className="border-b border-line-soft">
                  <td className="py-2 pr-4 font-medium">
                    {prospect.firstName} {prospect.lastName}
                  </td>
                  <td className="py-2 pr-4">{prospect.position}</td>
                  <td className="py-2 pr-4 tabular">
                    <span className="font-semibold">{current.mid}</span>{" "}
                    <span className="text-xs text-faint">
                      ({current.low}-{current.high})
                    </span>
                  </td>
                  <td className="py-2 pr-4 tabular">
                    <Stars value={ratingStars(potential.mid)} />{" "}
                    <span className="text-xs text-faint">
                      {potential.low}-{potential.high}
                    </span>
                  </td>
                  <td className="py-2 pr-4">{prospect.age}</td>
                  {isMyTurn && (
                    <td className="py-2">
                      <form action={draftProspect}>
                        <input type="hidden" name="prospectId" value={prospect.id} />
                        <button
                          type="submit"
                          className="rounded-md bg-accent px-3 py-1 text-xs font-medium text-accent-fg transition hover:bg-accent-hover"
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
