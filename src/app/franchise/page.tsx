import { getCurrentMembership } from "@/lib/auth/dal";
import { getScheduleForCareer } from "@/lib/data-access/schedule";
import { getOrAdvancePlayoffs } from "@/lib/data-access/playoffs";
import { getOrCreateTeamState } from "@/lib/data-access/team-state";
import {
  getChampionshipsForTeam,
  getFranchiseRecords,
  getLegendsForTeam,
} from "@/lib/data-access/franchise-history";
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

  const [championships, records, legends] = await Promise.all([
    getChampionshipsForTeam(membership.careerId, membership.teamId),
    getFranchiseRecords(membership.careerId, membership.teamId),
    getLegendsForTeam(membership.careerId, membership.teamId),
  ]);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-2xl font-bold">{t("franchisePage.title")}</h1>
      <p className="mt-1 text-black/60 dark:text-white/60">{t("franchisePage.description")}</p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <div className="rounded-lg border border-black/10 p-4 dark:border-white/10">
          <p className="text-xs uppercase tracking-wide text-black/50 dark:text-white/50">{t("gm.treasury")}</p>
          <p
            className={`mt-1 text-2xl font-semibold ${toneClass(
              financeTone(teamState.finances, healthyFinancesThreshold(membership.leagueId))
            )}`}
          >
            {formatSalary(teamState.finances, locale)}
          </p>
        </div>
        <div className="rounded-lg border border-black/10 p-4 dark:border-white/10">
          <p className="text-xs uppercase tracking-wide text-black/50 dark:text-white/50">
            {t("franchisePage.attendanceLabel")}
          </p>
          <p className="mt-1 text-xs text-black/50 dark:text-white/50">
            {t("franchisePage.attendanceDescription")}
          </p>
          <p className={`mt-3 text-2xl font-semibold ${toneClass(ratingTone(teamState.attendance))}`}>
            {teamState.attendance}%
          </p>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
            <div
              className="h-full rounded-full bg-black dark:bg-white"
              style={{ width: `${teamState.attendance}%` }}
            />
          </div>
        </div>
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

      <div className="mt-8">
        <h2 className="text-lg font-semibold">{t("franchisePage.championshipsHeading")}</h2>
        {championships.count > 0 ? (
          <p className="mt-2 text-sm">
            {t("franchisePage.championshipsCount", { count: championships.count })}{" "}
            <span className="text-black/50 dark:text-white/50">({championships.seasons.join(", ")})</span>
          </p>
        ) : (
          <p className="mt-2 text-sm text-black/50 dark:text-white/50">{t("franchisePage.noChampionships")}</p>
        )}
      </div>

      <div className="mt-8">
        <h2 className="text-lg font-semibold">{t("franchisePage.recordsHeading")}</h2>
        {records.bestSeason || records.highestTeamScore || records.highestPlayerGame ? (
          <ul className="mt-2 space-y-1 text-sm">
            {records.bestSeason && (
              <li>
                {t("franchisePage.recordBestSeason")}{" "}
                <span className="font-medium">
                  {records.bestSeason.wins}-{records.bestSeason.losses}
                </span>{" "}
                <span className="text-black/50 dark:text-white/50">({records.bestSeason.season})</span>
              </li>
            )}
            <li>
              {t("franchisePage.recordWinStreak")} <span className="font-medium">{records.longestWinStreak}</span>
            </li>
            {records.highestTeamScore && (
              <li>
                {t("franchisePage.recordTeamScore")}{" "}
                <span className="font-medium">{records.highestTeamScore.points}</span>{" "}
                <span className="text-black/50 dark:text-white/50">
                  (vs {records.highestTeamScore.opponentAbbr}, {records.highestTeamScore.season})
                </span>
              </li>
            )}
            {records.highestPlayerGame && (
              <li>
                {t("franchisePage.recordPlayerGame")}{" "}
                <span className="font-medium">
                  {records.highestPlayerGame.playerName} — {records.highestPlayerGame.points}
                </span>{" "}
                <span className="text-black/50 dark:text-white/50">({records.highestPlayerGame.season})</span>
              </li>
            )}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-black/50 dark:text-white/50">{t("franchisePage.noRecords")}</p>
        )}
      </div>

      <div className="mt-8">
        <h2 className="text-lg font-semibold">{t("franchisePage.legendsHeading")}</h2>
        {legends.length > 0 ? (
          <ul className="mt-2 flex flex-wrap gap-2 text-sm">
            {legends.map((legend) => (
              <li
                key={legend.playerId}
                className="rounded-full border border-black/10 px-3 py-1 dark:border-white/10"
              >
                {legend.firstName} {legend.lastName}{" "}
                <span className="text-black/50 dark:text-white/50">
                  ({legend.position}, {legend.peakOverallRating}
                  {legend.retiredSeason ? `, ${legend.retiredSeason}` : ""})
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-black/50 dark:text-white/50">{t("franchisePage.noLegends")}</p>
        )}
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
