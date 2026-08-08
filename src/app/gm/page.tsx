import { notFound } from "next/navigation";
import { getCurrentMembership } from "@/lib/auth/dal";
import { prisma } from "@/lib/prisma";
import { getOrCreateTeamState } from "@/lib/data-access/team-state";
import { getStandings } from "@/lib/data-access/standings";
import { getTeamsByLeague, getTeamById } from "@/lib/data-access/teams";
import { acceptPoachOffer, declinePoachOffer } from "@/app/actions/gm";
import { EXPECTATION_LABELS, type ExpectationTier } from "@/lib/careers/gm-rules";
import { healthyFinancesThreshold } from "@/lib/careers/finance-rules";
import { formatSalary, teamFullName } from "@/lib/utils";
import { financeTone, ratingTone, toneClass, type ScaleTone } from "@/lib/color-scale";

const OUTCOME_LABELS: Record<string, string> = {
  met: "Objectif atteint",
  exceeded: "Objectif dépassé",
  warning: "Avertissement",
  fired: "Licencié",
  poached: "Parti (dépeçage)",
};

const OUTCOME_TONES: Record<string, ScaleTone> = {
  met: "good",
  exceeded: "good",
  poached: "good",
  warning: "average",
  fired: "bad",
};

const SEX_LABELS: Record<string, string> = { M: "Homme", F: "Femme", autre: "Autre" };

export default async function GmPage() {
  const membership = await getCurrentMembership();

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

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-2xl font-bold">Page GM</h1>

      {offerTeam && (
        <div className="mt-6 rounded-xl border border-blue-500/30 bg-blue-500/5 p-4">
          <p className="font-medium">
            Offre de dépeçage : {teamFullName(offerTeam)} souhaite t&apos;embaucher.
          </p>
          <div className="mt-3 flex gap-2">
            <form action={acceptPoachOffer}>
              <button
                type="submit"
                className="rounded-full bg-black px-4 py-1.5 text-sm font-medium text-white transition hover:bg-black/80 dark:bg-white dark:text-black dark:hover:bg-white/80"
              >
                Accepter
              </button>
            </form>
            <form action={declinePoachOffer}>
              <button
                type="submit"
                className="rounded-full border border-black/10 px-4 py-1.5 text-sm hover:bg-black/5 dark:border-white/10 dark:hover:bg-white/10"
              >
                Refuser
              </button>
            </form>
          </div>
        </div>
      )}

      <div className="mt-6 rounded-xl border border-black/10 p-4 dark:border-white/10">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-black/50 dark:text-white/50">
          Identité
        </h2>
        <p className="text-lg font-semibold">
          {gm.firstName} {gm.lastName}
        </p>
        <p className="text-sm text-black/50 dark:text-white/50">
          {gm.age} ans · {SEX_LABELS[gm.sex] ?? gm.sex}
        </p>
        <div className="mt-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-5">
          <PointStat label="Offensif" value={gm.offensePoints} />
          <PointStat label="Défensif" value={gm.defensePoints} />
          <PointStat label="Physique" value={gm.physicalPoints} />
          <PointStat label="Tactique" value={gm.tacticalPoints} />
          <PointStat label="Cohésion" value={gm.chemistryPoints} />
        </div>
      </div>

      <div className="mt-6 flex flex-wrap gap-4">
        <div className="rounded-lg border border-black/10 p-4 dark:border-white/10">
          <p className="text-xs uppercase tracking-wide text-black/50 dark:text-white/50">Trésorerie</p>
          <p
            className={`mt-1 text-xl font-semibold ${toneClass(
              financeTone(teamState.finances, healthyFinancesThreshold(membership.leagueId))
            )}`}
          >
            {formatSalary(teamState.finances)}
          </p>
        </div>
        <div className="rounded-lg border border-black/10 p-4 dark:border-white/10">
          <p className="text-xs uppercase tracking-wide text-black/50 dark:text-white/50">Infrastructures</p>
          <p className={`mt-1 text-xl font-semibold ${toneClass(ratingTone(teamState.facilitiesLevel))}`}>
            {teamState.facilitiesLevel} / 99
          </p>
        </div>
        <div className="rounded-lg border border-black/10 p-4 dark:border-white/10">
          <p className="text-xs uppercase tracking-wide text-black/50 dark:text-white/50">Personnel de training</p>
          <p className={`mt-1 text-xl font-semibold ${toneClass(ratingTone(teamState.trainingStaffLevel))}`}>
            {teamState.trainingStaffLevel} / 99
          </p>
        </div>
      </div>

      <div className="mt-6 rounded-xl border border-black/10 p-4 dark:border-white/10">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-black/50 dark:text-white/50">
          Bilan de la saison en cours
        </h2>
        <p className="text-lg font-semibold">
          {myStandingsRow ? `${myStandingsRow.wins}-${myStandingsRow.losses}` : "0-0"}
        </p>
        <p className="text-sm text-black/50 dark:text-white/50">
          Objectif : {EXPECTATION_LABELS[gm.currentExpectationTier as ExpectationTier]}
        </p>
      </div>

      <div className="mt-6 rounded-xl border border-black/10 p-4 dark:border-white/10">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-black/50 dark:text-white/50">
          Contrat
        </h2>
        <p className="text-sm">
          En poste depuis la saison <strong>{gm.hiredSeason}</strong>.
        </p>
        <p className="mt-1 text-sm">
          {gm.warningsAtCurrentTeam > 0 ? (
            <span className={toneClass("bad")}>
              {gm.warningsAtCurrentTeam} avertissement{gm.warningsAtCurrentTeam > 1 ? "s" : ""} — la
              direction attend mieux la saison prochaine.
            </span>
          ) : (
            <span className={toneClass("good")}>
              Aucun avertissement — la direction est satisfaite de ta gestion.
            </span>
          )}
        </p>
      </div>

      <div className="mt-6 rounded-xl border border-black/10 p-4 dark:border-white/10">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-black/50 dark:text-white/50">
          Bilan de carrière
        </h2>
        {gm.seasonRecords.length === 0 ? (
          <p className="text-sm text-black/50 dark:text-white/50">
            Aucune saison terminée pour l&apos;instant.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-black/10 text-black/50 dark:border-white/10 dark:text-white/50">
                  <th className="py-2 pr-4">Saison</th>
                  <th className="py-2 pr-4">Équipe</th>
                  <th className="py-2 pr-4">Bilan</th>
                  <th className="py-2 pr-4">Objectif</th>
                  <th className="py-2 pr-4">Résultat</th>
                  <th className="py-2">Issue</th>
                </tr>
              </thead>
              <tbody>
                {gm.seasonRecords.map((record) => (
                  <tr key={record.id} className="border-b border-black/5 dark:border-white/5">
                    <td className="py-2 pr-4">{record.season}</td>
                    <td className="py-2 pr-4">{teamNameById.get(record.teamId) ?? record.teamId}</td>
                    <td className="py-2 pr-4">
                      {record.wins}-{record.losses}
                    </td>
                    <td className="py-2 pr-4">{EXPECTATION_LABELS[record.expectationTier as ExpectationTier]}</td>
                    <td className="py-2 pr-4">{EXPECTATION_LABELS[record.resultTier as ExpectationTier]}</td>
                    <td className={`py-2 font-medium ${toneClass(OUTCOME_TONES[record.outcome] ?? "average")}`}>
                      {OUTCOME_LABELS[record.outcome] ?? record.outcome}
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
