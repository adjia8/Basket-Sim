import { getCurrentMembership } from "@/lib/auth/dal";
import { getScheduleForCareer } from "@/lib/data-access/schedule";
import { getOrAdvancePlayoffs } from "@/lib/data-access/playoffs";
import { getOrCreateTeamState } from "@/lib/data-access/team-state";
import { healthyFinancesThreshold, upgradeCost } from "@/lib/careers/finance-rules";
import { upgradeFacility } from "@/app/actions/franchise";
import { getTranslator } from "@/lib/i18n/translate";
import { formatSalary } from "@/lib/utils";
import { financeTone, ratingTone, toneClass } from "@/lib/color-scale";

export default async function FranchisePage() {
  const membership = await getCurrentMembership();
  const { t, locale } = await getTranslator();

  const games = await getScheduleForCareer(membership.careerId, membership.season);
  const seasonComplete = games.length > 0 && games.every((g) => g.status === "final");
  const playoffs = seasonComplete
    ? await getOrAdvancePlayoffs(membership.careerId, membership.season, membership.leagueId)
    : null;
  const isOffseasonWindow = seasonComplete && !!playoffs?.champion;

  const teamState = await getOrCreateTeamState(membership.careerId, membership.teamId, membership.leagueId);
  const facilitiesCost = upgradeCost(teamState.facilitiesLevel, membership.leagueId);
  const trainingStaffCost = upgradeCost(teamState.trainingStaffLevel, membership.leagueId);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-2xl font-bold">{t("franchisePage.title")}</h1>
      <p className="mt-1 text-black/60 dark:text-white/60">{t("franchisePage.description")}</p>

      <div className="mt-6 rounded-lg border border-black/10 p-4 dark:border-white/10">
        <p className="text-xs uppercase tracking-wide text-black/50 dark:text-white/50">{t("gm.treasury")}</p>
        <p
          className={`mt-1 text-2xl font-semibold ${toneClass(
            financeTone(teamState.finances, healthyFinancesThreshold(membership.leagueId))
          )}`}
        >
          {formatSalary(teamState.finances, locale)}
        </p>
      </div>

      {!isOffseasonWindow && (
        <p className="mt-4 text-sm text-red-500">{t("franchisePage.offseasonOnly")}</p>
      )}

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <FacilityCard
          label={t("franchisePage.facilitiesLabel")}
          description={t("franchisePage.facilitiesDescription")}
          level={teamState.facilitiesLevel}
          canAfford={teamState.finances >= facilitiesCost}
          canUpgrade={isOffseasonWindow}
          component="facilities"
          upgradeLabel={t("franchisePage.upgrade", { cost: formatSalary(facilitiesCost, locale) })}
        />
        <FacilityCard
          label={t("franchisePage.trainingStaffLabel")}
          description={t("franchisePage.trainingStaffDescription")}
          level={teamState.trainingStaffLevel}
          canAfford={teamState.finances >= trainingStaffCost}
          canUpgrade={isOffseasonWindow}
          component="trainingStaff"
          upgradeLabel={t("franchisePage.upgrade", { cost: formatSalary(trainingStaffCost, locale) })}
        />
      </div>
    </div>
  );
}

function FacilityCard({
  label,
  description,
  level,
  canAfford,
  canUpgrade,
  component,
  upgradeLabel,
}: {
  label: string;
  description: string;
  level: number;
  canAfford: boolean;
  canUpgrade: boolean;
  component: "facilities" | "trainingStaff";
  upgradeLabel: string;
}) {
  return (
    <div className="rounded-lg border border-black/10 p-4 dark:border-white/10">
      <p className="font-medium">{label}</p>
      <p className="mt-1 text-xs text-black/50 dark:text-white/50">{description}</p>
      <p className={`mt-3 text-xl font-semibold ${toneClass(ratingTone(level))}`}>{level} / 99</p>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
        <div
          className="h-full rounded-full bg-black dark:bg-white"
          style={{ width: `${level}%` }}
        />
      </div>
      {canUpgrade && (
        <form action={upgradeFacility} className="mt-4">
          <input type="hidden" name="component" value={component} />
          <button
            type="submit"
            disabled={!canAfford}
            className="rounded-full bg-black px-4 py-1.5 text-sm font-medium text-white transition hover:bg-black/80 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-white dark:text-black dark:hover:bg-white/80"
          >
            {upgradeLabel}
          </button>
        </form>
      )}
    </div>
  );
}
