import Link from "next/link";
import { getCurrentMembership } from "@/lib/auth/dal";
import { prisma } from "@/lib/prisma";
import {
  ensureCareerStaff,
  getStaffBudgetSummary,
  getStaffMarket,
  getStaffProfiles,
  getTeamStaff,
} from "@/lib/data-access/staff";
import {
  budgetIncreaseChance,
  NEUTRAL_STAFF_PROFILE,
  staffImpact,
  staffSlots,
  STAFF_ROLES,
  type StaffRole,
} from "@/lib/careers/staff-rules";
import { hireStaffAction, requestBudgetAction } from "@/app/actions/staff";
import { estimateError } from "@/lib/careers/potential-rules";
import { StaffTable, RatingBar } from "@/components/staff/StaffTable";
import { getTranslator, type Translator } from "@/lib/i18n/translate";
import type { DictionaryKey } from "@/lib/i18n/dictionary";
import { formatSalary } from "@/lib/utils";

function signed(value: number, digits = 0): string {
  const text = value.toFixed(digits).replace(".", ",");
  return value > 0 ? `+${text}` : text;
}

function AreaCard({
  label,
  level,
  effects,
}: {
  label: string;
  level: number;
  effects: { text: string; good: boolean | null }[];
}) {
  return (
    <div className="card px-4 py-3">
      <div className="flex items-baseline justify-between gap-2">
        <p className="eyebrow">{label}</p>
        <RatingBar value={level} />
      </div>
      <ul className="mt-2 space-y-0.5 text-xs">
        {effects.map((e) => (
          <li key={e.text} className={e.good === null ? "text-muted" : e.good ? "text-good" : "text-bad"}>
            {e.text}
          </li>
        ))}
      </ul>
    </div>
  );
}

const MESSAGES = new Set([
  "hired",
  "fired",
  "renewed",
  "budgetApproved",
  "budgetDenied",
  "notFound",
  "notAvailable",
  "noSlot",
  "overBudget",
  "notRenewable",
  "alreadyRequested",
]);
const GOOD_MESSAGES = new Set(["hired", "fired", "renewed", "budgetApproved"]);

function tone(value: number, inverse = false): boolean | null {
  if (value === 0) return null;
  return inverse ? value < 0 : value > 0;
}

export default async function StaffPage({
  searchParams,
}: {
  searchParams: Promise<{ role?: string; msg?: string }>;
}) {
  const m = await getCurrentMembership();
  const { t, locale } = await getTranslator();
  const params = await searchParams;
  const role = STAFF_ROLES.includes(params.role as StaffRole) ? (params.role as StaffRole) : undefined;
  await ensureCareerStaff(m.careerId, m.leagueId, m.season);

  const [summary, staff, market, profiles, gm] = await Promise.all([
    getStaffBudgetSummary(m.careerId, m.teamId, m.leagueId, m.season),
    getTeamStaff(m.careerId, m.teamId),
    getStaffMarket(m.careerId, role),
    getStaffProfiles(m.careerId, [m.teamId], m.leagueId),
    prisma.gmProfile.findUnique({ where: { membershipId: m.id }, select: { frontOfficeApproval: true } }),
  ]);
  const slots = staffSlots(m.leagueId);
  const profile = profiles.get(m.teamId) ?? NEUTRAL_STAFF_PROFILE;
  const impact = staffImpact(profile);
  const filledByRole = new Map(STAFF_ROLES.map((r) => [r, staff.filter((s) => s.role === r).length]));
  const usedPct = summary.budget > 0 ? Math.min(100, ((summary.committed + summary.severance) / summary.budget) * 100) : 0;
  const message = params.msg && MESSAGES.has(params.msg) ? params.msg : null;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="text-2xl font-bold tracking-tight">{t("staff.title")}</h1>
      <p className="mt-1 max-w-3xl text-sm text-muted">{t("staff.subtitle")}</p>

      {message && (
        <p
          className={`mt-4 rounded-md px-3 py-2 text-sm ${GOOD_MESSAGES.has(message) ? "bg-good/10 text-good" : "bg-bad/10 text-bad"}`}
        >
          {t(`staff.msg.${message}` as DictionaryKey)}
        </p>
      )}

      {/* Budget */}
      <section className="card mt-6 p-4 sm:p-5">
        <div className="grid gap-4 sm:grid-cols-4">
          {[
            { label: t("staff.budget"), value: summary.budget, cls: "" },
            { label: t("staff.committed"), value: summary.committed, cls: "" },
            { label: t("staff.severance"), value: summary.severance, cls: summary.severance > 0 ? "text-warn" : "" },
            { label: t("staff.available"), value: summary.available, cls: summary.available < 0 ? "text-bad" : "text-good" },
          ].map((c) => (
            <div key={c.label}>
              <p className="eyebrow">{c.label}</p>
              <p className={`mt-1 text-xl font-bold tabular ${c.cls}`}>{formatSalary(c.value, locale)}</p>
            </div>
          ))}
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-surface-3">
          <div className={`h-full ${usedPct >= 100 ? "bg-bad" : "bg-accent"}`} style={{ width: `${usedPct}%` }} />
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted">
          {summary.canRequestIncrease ? (
            <>
              <form action={requestBudgetAction}>
                <button
                  type="submit"
                  className="rounded-md border border-line px-3 py-1 text-xs font-medium text-fg hover:bg-surface-2"
                >
                  {t("staff.requestIncrease")}
                </button>
              </form>
              <span>
                {t("staff.requestHint", {
                  chance: Math.round(budgetIncreaseChance(gm?.frontOfficeApproval ?? 50) * 100),
                })}
              </span>
            </>
          ) : (
            <span>{t("staff.requestDone")}</span>
          )}
        </div>
      </section>

      {/* Impact */}
      <h2 className="eyebrow mb-3 mt-8">{t("staff.impactHeading")}</h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <AreaCard
          label={t("staff.area.tactics")}
          level={profile.tactics}
          effects={[{ text: t("staff.effect.strength", { value: signed(impact.tacticsStrength, 1) }), good: tone(impact.tacticsStrength) }]}
        />
        <AreaCard
          label={t("staff.area.offense")}
          level={profile.offense}
          effects={[{ text: t("staff.effect.strength", { value: signed(impact.offenseStrength, 1) }), good: tone(impact.offenseStrength) }]}
        />
        <AreaCard
          label={t("staff.area.defense")}
          level={profile.defense}
          effects={[{ text: t("staff.effect.strength", { value: signed(impact.defenseStrength, 1) }), good: tone(impact.defenseStrength) }]}
        />
        <AreaCard
          label={t("staff.area.motivation")}
          level={profile.motivation}
          effects={[
            { text: t("staff.effect.chemistry", { value: signed(impact.chemistry) }), good: tone(impact.chemistry) },
            { text: t("staff.effect.morale", { value: signed(impact.moraleShift) }), good: tone(impact.moraleShift) },
          ]}
        />
        <AreaCard
          label={t("staff.area.development")}
          level={profile.development}
          effects={[{ text: t("staff.effect.development", { value: signed(impact.developmentPct) }), good: tone(impact.developmentPct) }]}
        />
        <AreaCard
          label={t("staff.area.fitness")}
          level={profile.fitness}
          effects={[
            { text: t("staff.effect.wear", { value: signed(impact.wearPct) }), good: tone(impact.wearPct, true) },
            { text: t("staff.effect.recovery", { value: signed(impact.fatigueRecoveryPct) }), good: tone(impact.fatigueRecoveryPct) },
          ]}
        />
        <AreaCard
          label={t("staff.area.scouting")}
          level={profile.scouting}
          effects={[
            {
              text: t("staff.effect.scouting", { value: Math.round(estimateError(profile.scouting) / 2) }),
              good: profile.scouting >= 60 ? true : profile.scouting < 40 ? false : null,
            },
          ]}
        />
        <AreaCard
          label={t("staff.area.medical")}
          level={profile.medical}
          effects={[
            { text: t("staff.effect.injuryRisk", { value: signed(impact.injuryRiskPct) }), good: tone(impact.injuryRiskPct, true) },
            ...(impact.fasterRecoveryPct > 0
              ? [{ text: t("staff.effect.fasterHealing", { value: impact.fasterRecoveryPct }), good: true }]
              : []),
          ]}
        />
      </div>

      {/* Mon staff */}
      <h2 className="eyebrow mb-3 mt-8">{t("staff.myStaff")}</h2>
      <StaffTable staff={staff} slots={slots} t={t} locale={locale} manage />

      {/* Marché */}
      <section id="market" className="mt-10 scroll-mt-20">
        <h2 className="eyebrow mb-1">{t("staff.market")}</h2>
        <p className="mb-3 text-xs text-muted">{t("staff.marketHint")}</p>
        <div className="mb-3 flex flex-wrap gap-2 text-sm">
          {[undefined, ...STAFF_ROLES].map((r) => (
            <Link
              key={r ?? "all"}
              href={r ? `/staff?role=${r}#market` : "/staff#market"}
              className={`rounded-md px-3 py-1 ${r === role ? "bg-accent text-accent-fg" : "border border-line hover:bg-surface-2"}`}
            >
              {r ? t(`staff.role.${r}` as DictionaryKey) : t("staff.allRoles")}
            </Link>
          ))}
        </div>
        {market.length === 0 ? (
          <p className="text-sm text-muted">{t("staff.emptyMarket")}</p>
        ) : (
          <MarketTable market={market} t={t} locale={locale} available={summary.available} filledByRole={filledByRole} slots={slots} role={role} />
        )}
      </section>
    </div>
  );
}

function MarketTable({
  market,
  t,
  locale,
  available,
  filledByRole,
  slots,
  role,
}: {
  market: Awaited<ReturnType<typeof getStaffMarket>>;
  t: Translator;
  locale: "fr" | "en";
  available: number;
  filledByRole: Map<StaffRole, number>;
  slots: Record<StaffRole, number>;
  role?: StaffRole;
}) {
  return (
    <div className="card overflow-x-auto">
      <table className="w-full min-w-[760px] text-sm">
        <thead>
          <tr className="border-b border-line text-left text-[11px] uppercase tracking-wide text-muted">
            <th className="px-4 py-2 font-medium">{t("staff.col.name")}</th>
            <th className="px-2 py-2 font-medium">{t("staff.col.age")}</th>
            <th className="px-2 py-2 font-medium">{t("staff.col.specialty")}</th>
            <th className="px-2 py-2 font-medium">{t("staff.col.rating")}</th>
            <th className="px-2 py-2 font-medium">{t("staff.col.motivation")}</th>
            <th className="px-2 py-2 text-right font-medium">{t("staff.col.demand")}</th>
            <th className="px-4 py-2" />
          </tr>
        </thead>
        <tbody className="divide-y divide-line-soft">
          {market.map((c) => {
            const noSlot = (filledByRole.get(c.role) ?? 0) >= slots[c.role];
            const tooExpensive = c.salary > available;
            return (
              <tr key={c.id}>
                <td className="px-4 py-2">
                  <p className="font-medium">
                    {c.firstName} {c.lastName}
                  </p>
                  <p className="text-xs text-muted">{t(`staff.role.${c.role}` as DictionaryKey)}</p>
                </td>
                <td className="px-2 py-2 tabular">{c.age}</td>
                <td className="px-2 py-2 text-xs">{c.specialty ? t(`staff.specialty.${c.specialty}` as DictionaryKey) : "—"}</td>
                <td className="px-2 py-2">
                  <RatingBar value={c.rating} />
                </td>
                <td className="px-2 py-2 tabular">{c.motivation ?? "—"}</td>
                <td className={`px-2 py-2 text-right tabular ${tooExpensive ? "text-bad" : ""}`}>{formatSalary(c.salary, locale)}</td>
                <td className="px-4 py-2 text-right">
                  {noSlot ? (
                    <span className="text-xs text-faint">{t("staff.noSlot")}</span>
                  ) : tooExpensive ? (
                    <span className="text-xs text-bad">{t("staff.tooExpensive")}</span>
                  ) : (
                    <form action={hireStaffAction} className="inline-flex items-center gap-1">
                      <input type="hidden" name="staffId" value={c.id} />
                      {role && <input type="hidden" name="role" value={role} />}
                      <select name="years" defaultValue="2" className="field px-1.5 py-1 text-xs">
                        {[1, 2, 3, 4].map((y) => (
                          <option key={y} value={y}>
                            {t("staff.years", { count: y })}
                          </option>
                        ))}
                      </select>
                      <button
                        type="submit"
                        className="rounded-md bg-accent px-2.5 py-1 text-xs font-medium text-accent-fg hover:bg-accent-hover"
                      >
                        {t("staff.hire")}
                      </button>
                    </form>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
