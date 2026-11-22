import { getCurrentMembership } from "@/lib/auth/dal";
import { getOrCreateTeamState } from "@/lib/data-access/team-state";
import {
  getChampionshipsForTeam,
  getFranchiseRecords,
  getLegendsForTeam,
} from "@/lib/data-access/franchise-history";
import { PRICE_LEVELS, healthyFinancesThreshold, upgradeCost } from "@/lib/careers/finance-rules";
import {
  baselineTiers,
  facilityBonuses,
  financingPlan,
  MAX_CONCURRENT_PROJECTS,
  ownersAcceptChance,
  parsePlan,
  projectOptions,
  type FacilityDomain,
} from "@/lib/careers/facility-projects-rules";
import { tierEffectLines } from "@/lib/careers/facility-effects-text";
import { getFacilityComparison, settleFacilityProjects, type FeatureComparison } from "@/lib/data-access/facility-projects";
import { Stars } from "@/components/ui/Stars";
import { getGameClock } from "@/lib/data-access/game-clock";
import { prisma } from "@/lib/prisma";
import { FacilityProjectCard, type ProjectCardView } from "@/components/franchise/FacilityProjectCard";
import type { DictionaryKey } from "@/lib/i18n/dictionary";
import { parseLedger, totalExpenses, totalRevenue } from "@/lib/data-access/finance";
import { setPricing } from "@/app/actions/franchise";
import { getTranslator } from "@/lib/i18n/translate";
import Link from "next/link";
import { formatLongDate, formatSalary, playerHref } from "@/lib/utils";
import { financeTone, ratingTone, toneClass } from "@/lib/color-scale";

export default async function FranchisePage() {
  const membership = await getCurrentMembership();
  const { t, locale } = await getTranslator();


  // Chantiers arrivés à échéance (ex. livrés pendant l'intersaison).
  const clock = await getGameClock(membership.careerId, membership.teamId);
  const today = clock.today ?? new Date();
  await settleFacilityProjects(membership.careerId, membership.teamId, membership.season, today, locale);
  const [teamState, gm, myTeam, comparison, requesters] = await Promise.all([
    getOrCreateTeamState(membership.careerId, membership.teamId, membership.leagueId),
    prisma.gmProfile.findFirst({ where: { membership: { careerId: membership.careerId, teamId: membership.teamId } }, select: { frontOfficeApproval: true } }),
    prisma.team.findUnique({ where: { id: membership.teamId }, select: { marketAppeal: true } }),
    getFacilityComparison(membership.careerId, membership.leagueId, membership.teamId),
    // Joueurs de mon effectif qui réclament une installation.
    prisma.playerState.findMany({
      where: {
        careerId: membership.careerId,
        facilityRequestKey: { not: null },
        player: { contracts: { some: { careerId: membership.careerId, teamId: membership.teamId } } },
      },
      select: { facilityRequestKey: true, facilityPromiseBy: true, player: { select: { firstName: true, lastName: true } } },
    }),
  ]);
  const baseline = baselineTiers(membership.teamId, myTeam?.marketAppeal ?? 50);
  const ratingLine = (c: FeatureComparison | undefined) =>
    c
      ? t("facility.compare", {
          rank:
            (locale === "fr" ? (c.rank === 1 ? "1er" : `${c.rank}e`) : `#${c.rank}`) +
            (c.tied ? ` ${t("facility.tied")}` : ""),
          of: c.of,
          avg: c.average.toLocaleString(locale, { maximumFractionDigits: 1 }),
          best: c.best ? `${c.best.teamName} (${c.best.stars.toLocaleString(locale)} ★)` : "—",
        })
      : "";
  const ledger = parseLedger(teamState.financeLedgerJson, membership.season);

  // Projets d'infrastructure (voir facility-projects-rules.ts).
  const plan = parsePlan(teamState.facilityProjectsJson);
  const bonuses = facilityBonuses(plan, membership.leagueId, baseline);
  const options = projectOptions(
    plan,
    membership.leagueId,
    {
      training: upgradeCost(teamState.facilitiesLevel, membership.leagueId, "training"),
      arena: upgradeCost(teamState.arenaLevel, membership.leagueId, "arena"),
    },
    baseline
  );
  const money = (v: number) => formatSalary(v, locale);
  const projectName = (key: string) => t(`facility.project.${key}.name` as DictionaryKey);
  const ownersAsked = plan.ownersRequestSeason === membership.season;
  const views = (domain: FacilityDomain): ProjectCardView[] =>
    options
      .filter((o) => o.def.domain === domain)
      .map((o) => {
        const total = o.def.tiers.length;
        let status: ProjectCardView["status"] = null;
        let progressPct: number | null = null;
        if (o.building) {
          status = { text: t("facility.status.building", { date: formatLongDate(o.building.completesOn, locale) }), tone: "info" };
          const start = new Date(o.building.startedOn).getTime();
          const end = new Date(o.building.completesOn).getTime();
          progressPct = Math.round(Math.min(1, Math.max(0, (today.getTime() - start) / Math.max(1, end - start))) * 100);
        } else if (o.blockedBy === "maxed") status = { text: t("facility.status.maxed"), tone: "muted" };
        else if (o.blockedBy === "exclusive") status = { text: t("facility.status.exclusive", { other: projectName(o.def.exclusiveWith!) }), tone: "warn" };
        else if (o.blockedBy === "concurrent") status = { text: t("facility.status.concurrent", { max: MAX_CONCURRENT_PROJECTS }), tone: "warn" };
        const next = o.next;
        const fin = next
          ? {
              cash: financingPlan(next.cost, "cash"),
              loan: financingPlan(next.cost, "loan"),
              owners: financingPlan(next.cost, "owners"),
            }
          : null;
        const chance = next ? Math.round(ownersAcceptChance(gm?.frontOfficeApproval ?? 50, teamState.finances / Math.max(1, next.cost)) * 100) : 0;
        return {
          key: o.def.key,
          name: projectName(o.def.key),
          desc: t(`facility.project.${o.def.key}.desc` as DictionaryKey),
          tierLabel: o.def.repeatable ? t("facility.repeatable") : t("facility.tier", { n: o.built, max: total }),
          builtDots: o.def.repeatable ? null : { total, built: o.built },
          status,
          progressPct,
          next:
            next && !o.building && o.blockedBy !== "exclusive"
              ? {
                  title: o.def.repeatable ? t("facility.repeatable") : t("facility.nextTier", { n: next.tier }),
                  effects: tierEffectLines(next, t, locale),
                  cost: money(next.cost),
                  duration: t("facility.duration", { days: next.days }),
                  upkeep: next.upkeep > 0 ? t("facility.upkeepShort", { amount: money(next.upkeep) }) : null,
                  afterCash: {
                    text: t("facility.afterCash", { amount: money(teamState.finances - next.cost) }),
                    tone:
                      teamState.finances - next.cost < 0
                        ? ("bad" as const)
                        : teamState.finances - next.cost < healthyFinancesThreshold(membership.leagueId)
                          ? ("warn" as const)
                          : ("good" as const),
                  },
                }
              : null,
          financing: fin
            ? [
                { value: "cash" as const, label: t("facility.financing.cash", { now: money(fin.cash.now) }), disabled: teamState.finances < fin.cash.now },
                {
                  value: "loan" as const,
                  label: t("facility.financing.loan", { now: money(fin.loan.now), per: money(fin.loan.perSeason) }),
                  disabled: teamState.finances < fin.loan.now,
                },
                {
                  value: "owners" as const,
                  label: ownersAsked ? t("facility.financing.ownersAsked") : t("facility.financing.owners", { chance }),
                  disabled: ownersAsked || teamState.finances < fin.owners.now,
                },
              ]
            : [],
          canStart: !!next && !o.building && !o.blockedBy,
          warning: domain === "arena" ? t("facility.worksWarning") : null,
          rating: comparison.get(o.def.key)
            ? { stars: comparison.get(o.def.key)!.stars, line: ratingLine(comparison.get(o.def.key)) }
            : null,
          request: (() => {
            const who = requesters.filter((r) => r.facilityRequestKey === o.def.key);
            if (who.length === 0) return null;
            const names = who.map((r) => `${r.player.firstName} ${r.player.lastName}`).join(", ");
            return who.some((r) => r.facilityPromiseBy) ? t("facility.requestPromised", { names }) : t("facility.requested", { names });
          })(),
        };
      });
  const activeEffects = tierEffectLines(
    {
      level: 0,
      effects: {
        recovery: bonuses.recovery,
        medical: bonuses.medical,
        development: bonuses.development,
        tactical: bonuses.tactical,
        homeCourt: bonuses.homeCourt,
        fill: bonuses.fill,
        premium: bonuses.premium,
        concessions: bonuses.concessions,
        merch: bonuses.merch,
        sponsors: bonuses.sponsors,
      },
    },
    t,
    locale
  ).slice(0, -1); // sans la ligne « niveau global »
  const building = plan.projects.filter((p) => p.status === "building");
  // Budget travaux : ce que le club peut investir sans fragiliser sa trésorerie.
  const reserve = healthyFinancesThreshold(membership.leagueId);
  const investable = Math.max(0, teamState.finances - reserve);
  const loansNext = plan.loans.reduce((s, l) => s + l.perSeason, 0);
  const loansTotal = plan.loans.reduce((s, l) => s + l.perSeason * l.seasonsLeft, 0);
  const seasonNet = totalRevenue(ledger.current) - totalExpenses(ledger.current);
  const budget = [
    { label: t("facility.budget.treasury"), value: money(teamState.finances), tone: teamState.finances >= reserve ? "text-good" : "text-bad", strong: true },
    { label: t("facility.budget.reserve"), value: money(reserve), tone: "text-muted", strong: false },
    { label: t("facility.budget.investable"), value: money(investable), tone: investable > 0 ? "text-good" : "text-bad", strong: true },
    { label: t("facility.budget.seasonNet"), value: money(seasonNet), tone: seasonNet >= 0 ? "text-good" : "text-bad", strong: false },
    { label: t("facility.budget.loans"), value: loansTotal > 0 ? t("facility.budget.loansValue", { next: money(loansNext), total: money(loansTotal) }) : "—", tone: loansTotal > 0 ? "text-warn" : "text-muted", strong: false },
    { label: t("facility.budget.upkeep"), value: bonuses.upkeep > 0 ? money(bonuses.upkeep) : "—", tone: "text-muted", strong: false },
    {
      label: t("facility.budget.owners"),
      value: t("facility.budget.ownersValue", { approval: gm?.frontOfficeApproval ?? 50 }),
      tone: (gm?.frontOfficeApproval ?? 50) >= 60 ? "text-good" : (gm?.frontOfficeApproval ?? 50) >= 40 ? "text-soft" : "text-bad",
      strong: false,
    },
  ];
  const cardLabels = {
    financingTitle: t("facility.financing.title"),
    start: t("facility.start"),
    starting: t("facility.starting"),
    cost: t("facility.cost"),
  };

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

      <section className="mt-8" data-testid="facilities">
        <h2 className="text-lg font-semibold">{t("facility.title")}</h2>
        <p className="mt-1 text-sm text-muted">{t("facility.intro")}</p>

        <div className="mt-3 card p-4 text-sm" data-testid="facility-budget">
          <p className="eyebrow">{t("facility.budget.title")}</p>
          <dl className="mt-2 grid gap-x-6 gap-y-1.5 sm:grid-cols-2">
            {budget.map((b) => (
              <div key={b.label} className="flex items-baseline justify-between gap-3">
                <dt className="text-xs text-muted">{b.label}</dt>
                <dd className={`tabular ${b.strong ? "font-semibold" : "text-xs"} ${b.tone}`}>{b.value}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-2 text-2xs text-faint">{t("facility.budget.hint", { reserve: money(reserve) })}</p>
        </div>

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div className="card p-4 text-sm">
            <p className="eyebrow">{t("facility.activeBonuses")}</p>
            {activeEffects.length === 0 ? (
              <p className="mt-1 text-xs text-muted">{t("facility.noBonus")}</p>
            ) : (
              <ul className="mt-1 space-y-0.5 text-xs text-good">
                {activeEffects.map((e) => (
                  <li key={e}>+ {e}</li>
                ))}
              </ul>
            )}
            {bonuses.upkeep > 0 && <p className="mt-2 text-xs text-muted">{t("facility.upkeep", { amount: money(bonuses.upkeep) })}</p>}
          </div>
          <div className="card p-4 text-sm" data-testid="facility-progress">
            <p className="eyebrow">{t("facility.inProgress")}</p>
            {building.length === 0 ? (
              <p className="mt-1 text-xs text-muted">{t("facility.noneInProgress")}</p>
            ) : (
              <ul className="mt-1 space-y-0.5 text-xs">
                {building.map((p) => (
                  <li key={p.key}>
                    {t("facility.progressLine", { name: projectName(p.key), tier: p.tier, date: formatLongDate(p.completesOn, locale) })}
                  </li>
                ))}
              </ul>
            )}
            {plan.loans.length > 0 && (
              <>
                <p className="eyebrow mt-3">{t("facility.loans")}</p>
                <ul className="mt-1 space-y-0.5 text-xs text-muted">
                  {plan.loans.map((l, i) => (
                    <li key={i}>
                      {t("facility.loanLine", { name: projectName(l.key), tier: l.tier, per: money(l.perSeason), n: l.seasonsLeft })}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        </div>

        {(["training", "arena"] as const).map((domain) => {
          const level = domain === "training" ? teamState.facilitiesLevel : teamState.arenaLevel;
          return (
            <div key={domain} className="mt-6" data-testid={`facility-${domain}`}>
              <div className="flex items-baseline justify-between gap-3">
                <h3 className="flex flex-wrap items-center gap-2 font-semibold">
                  {t(`facility.domain.${domain}`)}
                  {comparison.get(`domain:${domain}`) && <Stars value={comparison.get(`domain:${domain}`)!.stars} />}
                </h3>
                <span className={`text-sm font-semibold ${toneClass(ratingTone(level))}`}>{t("facility.level", { level })}</span>
              </div>
              {comparison.get(`domain:${domain}`) && (
                <p className="mt-0.5 text-xs text-faint" data-testid={`facility-${domain}-compare`}>
                  {ratingLine(comparison.get(`domain:${domain}`))}
                </p>
              )}
              <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-surface-3">
                <div className="h-full rounded-full bg-accent" style={{ width: `${level}%` }} />
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {views(domain).map((v) => (
                  <FacilityProjectCard key={v.key} view={v} labels={cardLabels} />
                ))}
              </div>
            </div>
          );
        })}

        <div className="mt-6 card p-4">
          <p className="text-xs uppercase tracking-wide text-muted">{t("common.nav.staff")}</p>
          <p className={`mt-1 text-2xl font-semibold ${toneClass(ratingTone(teamState.trainingStaffLevel))}`}>
            {teamState.trainingStaffLevel} / 99
          </p>
          <p className="mt-2 text-xs text-muted">{t("staff.franchiseLink")}</p>
          <Link href="/staff" className="mt-3 inline-block text-sm font-medium text-accent-text hover:underline">
            {t("staff.title")} →
          </Link>
        </div>
      </section>

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
