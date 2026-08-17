import { notFound } from "next/navigation";
import Link from "next/link";
import { getCurrentMembership } from "@/lib/auth/dal";
import { prisma } from "@/lib/prisma";
import { getOrCreateTeamState } from "@/lib/data-access/team-state";
import { getStandings } from "@/lib/data-access/standings";
import { getTeamsByLeague, getTeamById } from "@/lib/data-access/teams";
import { acceptPoachOffer, declinePoachOffer } from "@/app/actions/gm";
import type { ExpectationTier } from "@/lib/careers/gm-rules";
import { healthyFinancesThreshold } from "@/lib/careers/finance-rules";
import { getTranslator, type Translator } from "@/lib/i18n/translate";
import { formatSalary, teamFullName } from "@/lib/utils";
import { financeTone, ratingTone, neutralTone, toneClass, type ScaleTone } from "@/lib/color-scale";

const OUTCOME_TONES: Record<string, ScaleTone> = {
  met: "good",
  exceeded: "good",
  poached: "good",
  warning: "average",
  fired: "bad",
};

function expectationLabels(t: Translator): Record<ExpectationTier, string> {
  return {
    rebuild: t("domain.expectationTier.rebuild"),
    play_in: t("domain.expectationTier.play_in"),
    playoffs: t("domain.expectationTier.playoffs"),
    conf_semis: t("domain.expectationTier.conf_semis"),
    conf_finals: t("domain.expectationTier.conf_finals"),
    nba_finals: t("domain.expectationTier.nba_finals"),
    champion: t("domain.expectationTier.champion"),
  };
}

function outcomeLabels(t: Translator): Record<string, string> {
  return {
    met: t("gm.outcomeMet"),
    exceeded: t("gm.outcomeExceeded"),
    warning: t("gm.outcomeWarning"),
    fired: t("gm.outcomeFired"),
    poached: t("gm.outcomePoached"),
  };
}

function sexLabels(t: Translator): Record<string, string> {
  return { M: t("gm.sexMale"), F: t("gm.sexFemale"), autre: t("gm.sexOther") };
}

export default async function GmPage() {
  const membership = await getCurrentMembership();
  const { t, locale } = await getTranslator();

  const membershipRow = await prisma.membership.findUnique({
    where: { id: membership.id },
    include: { gmProfile: { include: { seasonRecords: { orderBy: { createdAt: "desc" } } } } },
  });
  const gm = membershipRow?.gmProfile;
  if (!gm) notFound();

  const [teamState, standings, leagueTeams] = await Promise.all([
    getOrCreateTeamState(membership.careerId, membership.teamId, membership.leagueId),
    getStandings(membership.careerId, membership.leagueId, membership.season),
    getTeamsByLeague(membership.leagueId),
  ]);
  const teamNameById = new Map(leagueTeams.map((t) => [t.id, teamFullName(t)]));
  const myStandingsRow = standings.find((row) => row.teamId === membership.teamId);

  const offerTeam = gm.pendingOfferTeamId ? await getTeamById(gm.pendingOfferTeamId) : null;

  const expectationLabel = expectationLabels(t);
  const outcomeLabel = outcomeLabels(t);
  const sexLabel = sexLabels(t);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-2xl font-bold">{t("gm.pageTitle")}</h1>

      {offerTeam && (
        <div className="mt-6 rounded-xl border border-blue-500/30 bg-blue-500/5 p-4">
          <p className="font-medium">
            {t("gm.poachOfferPrefix")}{" "}
            <Link href={`/teams/${offerTeam.id}`} className="hover:underline">
              {teamFullName(offerTeam)}
            </Link>{" "}
            {t("gm.poachOfferSuffix")}
          </p>
          <div className="mt-3 flex gap-2">
            <form action={acceptPoachOffer}>
              <button
                type="submit"
                className="rounded-full bg-black px-4 py-1.5 text-sm font-medium text-white transition hover:bg-black/80 dark:bg-white dark:text-black dark:hover:bg-white/80"
              >
                {t("gm.accept")}
              </button>
            </form>
            <form action={declinePoachOffer}>
              <button
                type="submit"
                className="rounded-full border border-black/10 px-4 py-1.5 text-sm hover:bg-black/5 dark:border-white/10 dark:hover:bg-white/10"
              >
                {t("gm.decline")}
              </button>
            </form>
          </div>
        </div>
      )}

      <div className="mt-6 rounded-xl border border-black/10 p-4 dark:border-white/10">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-black/50 dark:text-white/50">
          {t("gm.identity")}
        </h2>
        <p className="text-lg font-semibold">
          {gm.firstName} {gm.lastName}
        </p>
        <p className="text-sm text-black/50 dark:text-white/50">
          {t("player.ageLabel", { age: gm.age })} · {sexLabel[gm.sex] ?? gm.sex}
        </p>
        <div className="mt-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-5">
          <PointStat label={t("gm.pointOffense")} value={gm.offensePoints} />
          <PointStat label={t("gm.pointDefense")} value={gm.defensePoints} />
          <PointStat label={t("gm.pointPhysical")} value={gm.physicalPoints} />
          <PointStat label={t("gm.pointTactical")} value={gm.tacticalPoints} />
          <PointStat label={t("gm.pointChemistry")} value={gm.chemistryPoints} />
        </div>
      </div>

      <div className="mt-6 flex flex-wrap gap-4">
        <div className="rounded-lg border border-black/10 p-4 dark:border-white/10">
          <p className="text-xs uppercase tracking-wide text-black/50 dark:text-white/50">{t("gm.treasury")}</p>
          <p
            className={`mt-1 text-xl font-semibold ${toneClass(
              financeTone(teamState.finances, healthyFinancesThreshold(membership.leagueId))
            )}`}
          >
            {formatSalary(teamState.finances, locale)}
          </p>
        </div>
        <div className="rounded-lg border border-black/10 p-4 dark:border-white/10">
          <p className="text-xs uppercase tracking-wide text-black/50 dark:text-white/50">{t("gm.facilities")}</p>
          <p className={`mt-1 text-xl font-semibold ${toneClass(ratingTone(teamState.facilitiesLevel))}`}>
            {teamState.facilitiesLevel} / 99
          </p>
        </div>
        <div className="rounded-lg border border-black/10 p-4 dark:border-white/10">
          <p className="text-xs uppercase tracking-wide text-black/50 dark:text-white/50">{t("gm.trainingStaff")}</p>
          <p className={`mt-1 text-xl font-semibold ${toneClass(ratingTone(teamState.trainingStaffLevel))}`}>
            {teamState.trainingStaffLevel} / 99
          </p>
        </div>
        <div className="rounded-lg border border-black/10 p-4 dark:border-white/10">
          <p className="text-xs uppercase tracking-wide text-black/50 dark:text-white/50">
            {t("gm.frontOfficeApproval")}
          </p>
          <p className={`mt-1 text-xl font-semibold ${toneClass(neutralTone(gm.frontOfficeApproval))}`}>
            {gm.frontOfficeApproval} / 99
          </p>
        </div>
      </div>

      <div className="mt-6 rounded-xl border border-black/10 p-4 dark:border-white/10">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-black/50 dark:text-white/50">
          {t("gm.currentSeasonRecord")}
        </h2>
        <p className="text-lg font-semibold">
          {myStandingsRow ? `${myStandingsRow.wins}-${myStandingsRow.losses}` : "0-0"}
        </p>
        <p className="text-sm text-black/50 dark:text-white/50">
          {t("gm.objectivePrefix")} {expectationLabel[gm.currentExpectationTier as ExpectationTier]}
        </p>
      </div>

      <div className="mt-6 rounded-xl border border-black/10 p-4 dark:border-white/10">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-black/50 dark:text-white/50">
          {t("gm.contract")}
        </h2>
        <p className="text-sm">
          {t("gm.hiredSincePrefix")} <strong>{gm.hiredSeason}</strong>
          {t("gm.hiredSinceSuffix")}
        </p>
        <p className="mt-1 text-sm">
          {gm.warningsAtCurrentTeam > 0 ? (
            <span className={toneClass("bad")}>
              {t(gm.warningsAtCurrentTeam > 1 ? "gm.warningMany" : "gm.warningOne", {
                count: gm.warningsAtCurrentTeam,
              })}
            </span>
          ) : (
            <span className={toneClass("good")}>{t("gm.noWarning")}</span>
          )}
        </p>
      </div>

      <div className="mt-6 rounded-xl border border-black/10 p-4 dark:border-white/10">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-black/50 dark:text-white/50">
          {t("gm.careerRecord")}
        </h2>
        {gm.seasonRecords.length === 0 ? (
          <p className="text-sm text-black/50 dark:text-white/50">{t("gm.noSeasonCompleted")}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-black/10 text-black/50 dark:border-white/10 dark:text-white/50">
                  <th className="py-2 pr-4">{t("gm.colSeason")}</th>
                  <th className="py-2 pr-4">{t("gm.colTeam")}</th>
                  <th className="py-2 pr-4">{t("gm.colRecord")}</th>
                  <th className="py-2 pr-4">{t("gm.colObjective")}</th>
                  <th className="py-2 pr-4">{t("gm.colResult")}</th>
                  <th className="py-2">{t("gm.colOutcome")}</th>
                </tr>
              </thead>
              <tbody>
                {gm.seasonRecords.map((record) => (
                  <tr key={record.id} className="border-b border-black/5 dark:border-white/5">
                    <td className="py-2 pr-4">{record.season}</td>
                    <td className="py-2 pr-4">
                      <Link href={`/teams/${record.teamId}`} className="hover:underline">
                        {teamNameById.get(record.teamId) ?? record.teamId}
                      </Link>
                    </td>
                    <td className="py-2 pr-4">
                      {record.wins}-{record.losses}
                    </td>
                    <td className="py-2 pr-4">{expectationLabel[record.expectationTier as ExpectationTier]}</td>
                    <td className="py-2 pr-4">{expectationLabel[record.resultTier as ExpectationTier]}</td>
                    <td className={`py-2 font-medium ${toneClass(OUTCOME_TONES[record.outcome] ?? "average")}`}>
                      {outcomeLabel[record.outcome] ?? record.outcome}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function PointStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-black/10 p-2 text-center dark:border-white/10">
      <p className="text-xs text-black/50 dark:text-white/50">{label}</p>
      <p className="font-semibold">{value}</p>
    </div>
  );
}
