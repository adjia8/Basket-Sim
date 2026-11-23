import Link from "next/link";
import { getCurrentMembership } from "@/lib/auth/dal";
import { getTranslator } from "@/lib/i18n/translate";
import type { DictionaryKey } from "@/lib/i18n/dictionary";
import { formatSalary } from "@/lib/utils";
import { searchPlayers } from "@/lib/data-access/scouting";
import { parseFilters, STRENGTHS, strengthValue, topStrengths } from "@/lib/careers/scouting-rules";
import { ratingStars } from "@/lib/careers/potential-rules";
import { Stars } from "@/components/ui/Stars";

// Scouting : trouver des joueurs selon le poste, l'âge, le niveau, les points
// forts et le contrat — puis lancer un échange ou une négociation.
export default async function ScoutingPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const membership = await getCurrentMembership();
  const { t, locale } = await getTranslator();
  const q = await searchParams;
  const filters = parseFilters(q, membership.teamId);
  const { results, total, scoutingLevel } = await searchPlayers(membership.careerId, membership.leagueId, membership.teamId, filters);
  const money = (v: number) => formatSalary(v, locale);
  const input = "field w-full px-2 py-1.5 text-sm";
  const label = "flex flex-col gap-1 text-xs text-muted";

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 lg:px-8">
      <h1 className="text-2xl font-bold tracking-tight">{t("scouting.title")}</h1>
      <p className="mt-1 text-sm text-muted">{t("scouting.intro", { level: scoutingLevel })}</p>

      <form method="get" className="mt-5 card grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4" data-testid="scouting-form">
        <label className={label}>
          {t("scouting.position")}
          <select name="pos" defaultValue={filters.position ?? ""} className={input}>
            <option value="">{t("scouting.any")}</option>
            {["PG", "SG", "SF", "PF", "C"].map((p) => (
              <option key={p} value={p}>
                {t(`report.posLong.${p}` as DictionaryKey)}
              </option>
            ))}
          </select>
        </label>
        <div className={label}>
          {t("scouting.age")}
          <div className="flex gap-2">
            <input type="number" name="ageMin" min={18} max={45} defaultValue={filters.ageMin} className={input} aria-label={t("scouting.min")} />
            <input type="number" name="ageMax" min={18} max={45} defaultValue={filters.ageMax} className={input} aria-label={t("scouting.max")} />
          </div>
        </div>
        <div className={label}>
          {t("scouting.overall")}
          <div className="flex gap-2">
            <input type="number" name="ovrMin" min={40} max={99} defaultValue={filters.ovrMin} className={input} aria-label={t("scouting.min")} />
            <input type="number" name="ovrMax" min={40} max={99} defaultValue={filters.ovrMax} className={input} aria-label={t("scouting.max")} />
          </div>
        </div>
        <label className={label}>
          {t("scouting.potential")}
          <input type="number" name="potMin" min={0} max={99} defaultValue={filters.potMin || ""} placeholder="—" className={input} />
        </label>
        <div className={label}>
          {t("scouting.strength")}
          <div className="flex gap-2">
            <select name="str" defaultValue={filters.strength ?? ""} className={`${input} min-w-0 flex-1`}>
              <option value="">{t("scouting.any")}</option>
              {STRENGTHS.map((s) => (
                <option key={s} value={s}>
                  {t(`scouting.str.${s}` as DictionaryKey)}
                </option>
              ))}
            </select>
            <input type="number" name="strMin" min={40} max={99} defaultValue={filters.strengthMin} className="field w-16 shrink-0 px-2 py-1.5 text-sm" aria-label={t("scouting.min")} />
          </div>
        </div>
        <div className={label}>
          {t("scouting.salary")}
          <div className="flex gap-2">
            <input type="number" name="salMin" min={0} max={80} step={0.5} defaultValue={filters.salaryMin / 1e6 || ""} placeholder="min" className={input} />
            <input type="number" name="salMax" min={0} max={80} step={0.5} defaultValue={filters.salaryMax / 1e6 || ""} placeholder="max" className={input} />
          </div>
        </div>
        <label className={label}>
          {t("scouting.yearsMax")}
          <select name="yearsMax" defaultValue={String(filters.yearsMax)} className={input}>
            <option value="0">{t("scouting.any")}</option>
            {[1, 2, 3, 4].map((y) => (
              <option key={y} value={y}>
                {t("scouting.yearsUpTo", { n: y })}
              </option>
            ))}
          </select>
        </label>
        <label className={label}>
          {t("scouting.status")}
          <select name="status" defaultValue={filters.status} className={input}>
            {(["any", "contract", "expiring", "free_agent", "abroad"] as const).map((s) => (
              <option key={s} value={s}>
                {t(`scouting.statusOpt.${s}` as DictionaryKey)}
              </option>
            ))}
          </select>
        </label>
        <label className={label}>
          {t("scouting.sort")}
          <select name="sort" defaultValue={filters.sort} className={input}>
            {(["overall", "potential", "age", "salary", "strength"] as const).map((s) => (
              <option key={s} value={s}>
                {t(`scouting.sortOpt.${s}` as DictionaryKey)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 self-end text-sm">
          <input type="checkbox" name="mine" value="1" defaultChecked={filters.excludeTeamId === null} />
          {t("scouting.includeMine")}
        </label>
        <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-2 lg:justify-end">
          <Link href="/scouting" className="rounded-md border border-line-strong px-4 py-1.5 text-sm hover:bg-surface-2">
            {t("scouting.reset")}
          </Link>
          <button type="submit" className="rounded-md bg-accent px-5 py-1.5 text-sm font-semibold text-accent-fg hover:bg-accent-hover">
            {t("scouting.search")}
          </button>
        </div>
      </form>

      <p className="mt-5 text-sm text-soft" data-testid="scouting-count">
        {t("scouting.count", { total, shown: results.length })}
      </p>
      {results.length === 0 ? (
        <p className="mt-2 text-sm text-muted">{t("scouting.none")}</p>
      ) : (
        <div className="mt-2 overflow-x-auto card">
          <table className="data-table w-full text-left text-sm" data-testid="scouting-results">
            <thead>
              <tr>
                <th className="px-3 py-2">{t("scouting.col.player")}</th>
                <th className="px-3 py-2">{t("scouting.col.team")}</th>
                <th className="px-3 py-2">{t("scouting.col.pos")}</th>
                <th className="px-3 py-2">{t("scouting.col.age")}</th>
                <th className="px-3 py-2">{t("scouting.col.ovr")}</th>
                <th className="px-3 py-2">{t("scouting.col.pot")}</th>
                <th className="px-3 py-2">{t("scouting.col.strengths")}</th>
                <th className="px-3 py-2">{t("scouting.col.contract")}</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {results.map((r) => {
                const mine = r.teamId === membership.teamId;
                return (
                  <tr key={r.id} data-testid="scouting-row">
                    <td className="px-3 py-2">
                      <Link href={`/teams/${r.teamId ?? membership.teamId}/players/${r.id}`} className="font-medium hover:underline">
                        {r.name}
                      </Link>
                      {r.onTradeBlock && <span className="ml-1.5 rounded bg-warn/15 px-1 text-2xs font-semibold text-warn">{t("scouting.onBlock")}</span>}
                    </td>
                    <td className="px-3 py-2">
                      {r.teamAbbr ??
                        (r.abroadClub ? (
                          <span className="text-info" title={r.abroadClub}>
                            {r.abroadClub.replace(/ \(.*\)$/, "")}
                          </span>
                        ) : r.rightsTeamId ? (
                          <span className="text-warn">{t("scouting.rights")}</span>
                        ) : (
                          <span className="text-good">{t("scouting.freeAgent")}</span>
                        ))}
                    </td>
                    <td className="px-3 py-2">{r.position}</td>
                    <td className="px-3 py-2 tabular">{r.age}</td>
                    <td className="px-3 py-2 font-semibold tabular">{r.overall}</td>
                    <td className="px-3 py-2">
                      <Stars value={ratingStars(r.potential)} />
                    </td>
                    <td className="px-3 py-2 text-xs">
                      {(filters.strength ? [filters.strength] : topStrengths(r.ratings))
                        .map((s) => `${t(`scouting.str.${s}` as DictionaryKey)} ${strengthValue(r.ratings, s)}`)
                        .join(" · ")}
                    </td>
                    <td className="px-3 py-2 text-xs tabular">
                      {r.teamId
                        ? `${money(r.salary)} · ${t("scouting.yearsLeft", { n: r.yearsRemaining })}`
                        : r.abroadClub
                          ? t("scouting.buyoutShort", { amount: money(r.buyout) })
                          : "—"}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {mine ? null : r.teamId ? (
                        <Link
                          href={`/teams/${r.teamId}?tab=trade&want=${r.id}`}
                          className="whitespace-nowrap rounded-md bg-accent px-2.5 py-1 text-xs font-medium text-accent-fg hover:bg-accent-hover"
                          data-testid="scouting-trade"
                        >
                          {t("scouting.proposeTrade")}
                        </Link>
                      ) : r.abroadClub ? (
                        <Link
                          href={`/teams/${membership.teamId}/players/${r.id}`}
                          className="whitespace-nowrap rounded-md border border-info/60 px-2.5 py-1 text-xs text-info hover:bg-info/10"
                          data-testid="scouting-europe"
                        >
                          {t("scouting.recruitEurope")}
                        </Link>
                      ) : (
                        <Link href="/free-agents" className="rounded-md border border-line-strong px-2.5 py-1 text-xs hover:bg-surface-2">
                          {t("scouting.signFa")}
                        </Link>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
