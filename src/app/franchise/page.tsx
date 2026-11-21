import { getCurrentMembership } from "@/lib/auth/dal";
import { getScheduleForCareer } from "@/lib/data-access/schedule";
import { getOrAdvancePlayoffs } from "@/lib/data-access/playoffs";
import { getOrCreateTeamState } from "@/lib/data-access/team-state";
import {
  getChampionshipsForTeam,
  getFranchiseRecords,
  getLegendsForTeam,
} from "@/lib/data-access/franchise-history";
import { PRICE_LEVELS, healthyFinancesThreshold, upgradeCost } from "@/lib/careers/finance-rules";
import { parseLedger, totalExpenses, totalRevenue } from "@/lib/data-access/finance";
import { setPricing, upgradeFacility } from "@/app/actions/franchise";
import { getTranslator } from "@/lib/i18n/translate";
import Link from "next/link";
import { formatSalary, playerHref } from "@/lib/utils";
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
  const facilitiesCost = upgradeCost(teamState.facilitiesLevel, membership.leagueId, "training");
  const arenaCost = upgradeCost(teamState.arenaLevel, membership.leagueId, "arena");
  const ledger = parseLedger(teamState.financeLedgerJson, membership.season);

  const [championships, records, legends] = await Promise.all([
    getChampionshipsForTeam(membership.careerId, membership.teamId),
    getFranchiseRecords(membership.careerId, membership.teamId),
    getLegendsForTeam(membership.careerId, membership.teamId),
  ]);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-2xl font-bold tracking-tight">{t("franchisePage.title")}</h1>
      <p className="mt-1 text-sm text-muted">{t("franchisePage.description")}</p>

      <div className="mt-6 grid items-start gap-4 sm:grid-cols-2">
        <div className="card p-4">
          <p className="text-xs uppercase tracking-wide text-muted">{t("gm.treasury")}</p>
          <p
            className={`mt-1 text-2xl font-semibold ${toneClass(
              financeTone(teamState.finances, healthyFinancesThreshold(membership.leagueId))
            )}`}
          >
            {formatSalary(teamState.finances, locale)}
          </p>
        </div>
        <div className="card p-4">
          <p className="text-xs uppercase tracking-wide text-muted">
            {t("franchisePage.attendanceLabel")}
          </p>
          <p className="mt-1 text-xs text-muted">
            {t("franchisePage.attendanceDescription")}
          </p>
          <p className={`mt-3 text-2xl font-semibold ${toneClass(ratingTone(teamState.attendance))}`}>
            {teamState.attendance}%
          </p>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface-3">
            <div
              className="h-full rounded-full bg-accent"
              style={{ width: `${teamState.attendance}%` }}
            />
          </div>
        </div>
      </div>

      {!isOffseasonWindow && (
        <p className="mt-4 text-sm text-bad">{t("franchisePage.offseasonOnly")}</p>
      )}

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <FacilityCard
          label={t("finance.training")}
          description={t("franchisePage.facilitiesDescription")}
          level={teamState.facilitiesLevel}
          canAfford={teamState.finances >= facilitiesCost}
          canUpgrade={isOffseasonWindow}
          component="facilities"
          upgradeLabel={t("franchisePage.upgrade", { cost: formatSalary(facilitiesCost, locale) })}
        />
        <FacilityCard
          label={t("finance.arena")}
          description={t("finance.arenaDescription")}
          level={teamState.arenaLevel}
          canAfford={teamState.finances >= arenaCost}
          canUpgrade={isOffseasonWindow}
          component="arena"
          upgradeLabel={t("franchisePage.upgrade", { cost: formatSalary(arenaCost, locale) })}
        />
        <div className="card p-4">
          <p className="text-xs uppercase tracking-wide text-muted">{t("common.nav.staff")}</p>
          <p className={`mt-1 text-2xl font-semibold ${toneClass(ratingTone(teamState.trainingStaffLevel))}`}>
            {teamState.trainingStaffLevel} / 99
          </p>
          <p className="mt-2 text-xs text-muted">{t("staff.franchiseLink")}</p>
          <Link href="/staff" className="mt-3 inline-block text-sm font-medium text-accent-text hover:underline">
            {t("staff.title")} →
          </Link>
        </div>
      </div>

      <section className="mt-8" data-testid="finances">
        <h2 className="text-lg font-semibold">{t("finance.title")}</h2>
        <p className="mt-1 text-xs text-muted">{t("finance.subtitle")}</p>

        <form action={setPricing} className="mt-3 card flex flex-wrap items-end gap-3 p-4 text-sm">
          <p className="w-full font-medium">{t("finance.pricing")}</p>
          <p className="w-full text-xs text-faint">{t("finance.pricingHint")}</p>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-muted">{t("finance.ticket")}</span>
            <select name="ticketPriceLevel" defaultValue={teamState.ticketPriceLevel} className="field px-2 py-1">
              {PRICE_LEVELS.map((l) => (
                <option key={l} value={l}>
                  {t("finance.level", { level: l })}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-muted">{t("finance.concession")}</span>
            <select name="concessionPriceLevel" defaultValue={teamState.concessionPriceLevel} className="field px-2 py-1">
              {PRICE_LEVELS.map((l) => (
                <option key={l} value={l}>
                  {t("finance.level", { level: l })}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" className="rounded-md bg-accent px-4 py-1.5 font-medium text-accent-fg hover:bg-accent-hover">
            {t("finance.save")}
          </button>
        </form>

        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          {[
            { title: t("finance.current"), l: ledger.current },
            ...(ledger.previous ? [{ title: t("finance.previous"), l: ledger.previous }] : []),
          ].map(({ title, l }) => {
            const revenue = totalRevenue(l);
            const expenses = totalExpenses(l);
            return (
              <div key={title} className="card p-4 text-sm">
                <p className="eyebrow">
                  {title} · {l.season}
                </p>
                {revenue === 0 && expenses === 0 ? (
                  <p className="mt-2 text-muted">{t("finance.noData")}</p>
                ) : (
                  <>
                    <p className="mt-2 text-xs font-semibold uppercase text-muted">{t("finance.revenue")}</p>
                    <ul className="mt-1 space-y-0.5">
                      {(Object.keys(l.revenue) as (keyof typeof l.revenue)[]).map((k) => (
                        <li key={k} className="flex justify-between gap-2">
                          <span>{t(`finance.rev.${k}`)}</span>
                          <span className="tabular">{formatSalary(l.revenue[k], locale)}</span>
                        </li>
                      ))}
                    </ul>
                    <p className="mt-2 text-xs font-semibold uppercase text-muted">{t("finance.expenses")}</p>
                    <ul className="mt-1 space-y-0.5">
                      {(Object.keys(l.expenses) as (keyof typeof l.expenses)[])
                        .filter((k) => l.expenses[k] > 0)
                        .map((k) => (
                          <li key={k} className="flex justify-between gap-2">
                            <span>{t(`finance.exp.${k}`)}</span>
                            <span className="tabular text-bad">−{formatSalary(l.expenses[k], locale)}</span>
                          </li>
                        ))}
                    </ul>
                    <p className="mt-2 flex justify-between border-t border-line pt-2 font-semibold">
                      <span>{t("finance.net")}</span>
                      <span className={`tabular ${revenue - expenses >= 0 ? "text-good" : "text-bad"}`}>
                        {formatSalary(revenue - expenses, locale)}
                      </span>
                    </p>
                    {l.homeGames > 0 && (
                      <p className="mt-1 text-xs text-faint">
                        {t("finance.attendance", {
                          games: l.homeGames,
                          fans: Math.round(l.attendees / l.homeGames).toLocaleString(locale === "fr" ? "fr-FR" : "en-US"),
                        })}
                      </p>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <div className="mt-8">
        <h2 className="text-lg font-semibold">{t("franchisePage.championshipsHeading")}</h2>
        {championships.count > 0 ? (
          <p className="mt-2 text-sm">
            {t("franchisePage.championshipsCount", { count: championships.count })}{" "}
            <span className="text-muted">({championships.seasons.join(", ")})</span>
          </p>
        ) : (
          <p className="mt-2 text-sm text-muted">{t("franchisePage.noChampionships")}</p>
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
                <span className="text-muted">({records.bestSeason.season})</span>
              </li>
            )}
            <li>
              {t("franchisePage.recordWinStreak")} <span className="font-medium">{records.longestWinStreak}</span>
            </li>
            {records.highestTeamScore && (
              <li>
                {t("franchisePage.recordTeamScore")}{" "}
                <span className="font-medium">{records.highestTeamScore.points}</span>{" "}
                <span className="text-muted">
                  (vs {records.highestTeamScore.opponentAbbr}, {records.highestTeamScore.season})
                </span>
              </li>
            )}
            {records.highestPlayerGame && (
              <li>
                {t("franchisePage.recordPlayerGame")}{" "}
                <span className="font-medium">
                  <Link href={playerHref(records.highestPlayerGame.playerId)} className="hover:underline">
                    {records.highestPlayerGame.playerName}
                  </Link>{" "}
                  — {records.highestPlayerGame.points}
                </span>{" "}
                <span className="text-muted">({records.highestPlayerGame.season})</span>
              </li>
            )}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-muted">{t("franchisePage.noRecords")}</p>
        )}
      </div>

      <div className="mt-8">
        <h2 className="text-lg font-semibold">{t("franchisePage.legendsHeading")}</h2>
        {legends.length > 0 ? (
          <ul className="mt-2 flex flex-wrap gap-2 text-sm">
            {legends.map((legend) => (
              <li
                key={legend.playerId}
                className="rounded-full border border-line px-3 py-1"
              >
                <Link href={playerHref(legend.playerId)} className="hover:underline">
                  {legend.firstName} {legend.lastName}
                </Link>{" "}
                <span className="text-muted">
                  ({legend.position}, {legend.peakOverallRating}
                  {legend.retiredSeason ? `, ${legend.retiredSeason}` : ""})
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-muted">{t("franchisePage.noLegends")}</p>
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
  component: "facilities" | "arena";
  upgradeLabel: string;
}) {
  return (
    <div className="card p-4">
      <p className="font-medium">{label}</p>
      <p className="mt-1 text-xs text-muted">{description}</p>
      <p className={`mt-3 text-xl font-semibold ${toneClass(ratingTone(level))}`}>{level} / 99</p>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface-3">
        <div
          className="h-full rounded-full bg-accent"
          style={{ width: `${level}%` }}
        />
      </div>
      {canUpgrade && (
        <form action={upgradeFacility} className="mt-4">
          <input type="hidden" name="component" value={component} />
          <button
            type="submit"
            disabled={!canAfford}
            className="rounded-md bg-accent px-4 py-1.5 text-sm font-medium text-accent-fg transition hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-40"
          >
            {upgradeLabel}
          </button>
        </form>
      )}
    </div>
  );
}
