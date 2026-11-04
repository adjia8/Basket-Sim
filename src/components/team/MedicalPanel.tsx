import Link from "next/link";
import type { MedicalRow, InjuryHistoryRow } from "@/lib/data-access/medical";
import type { Translator } from "@/lib/i18n/translate";
import type { Locale } from "@/lib/i18n/locale";
import { setRestNextGame } from "@/app/actions/roster";
import { SortableTable } from "@/components/ui/SortableTable";
import { formatGameDate, playerHref } from "@/lib/utils";
import { WEAR_NEEDS_REST } from "@/lib/careers/wear-rules";

// Jauge horizontale 0-100 (énergie, usure, condition).
function Meter({ value, tone }: { value: number; tone: "good" | "warn" | "bad" }) {
  const color = tone === "good" ? "bg-good" : tone === "warn" ? "bg-warn" : "bg-bad";
  return (
    <span className="flex items-center gap-2">
      <span className="h-1.5 w-16 overflow-hidden rounded-full bg-surface-3">
        <span className={`block h-full ${color}`} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
      </span>
      <span className="w-6 text-right tabular">{value}</span>
    </span>
  );
}

// Onglet « Médical » de la page d'équipe, façon Football Manager : état
// physique de chaque joueur, risque de blessure du prochain match, gestion de
// la charge (repos) pour mon équipe, et historique des blessures.
export function MedicalPanel({
  teamId,
  isMyTeam,
  rows,
  history,
  t,
  locale,
}: {
  teamId: string;
  isMyTeam: boolean;
  rows: MedicalRow[];
  history: InjuryHistoryRow[];
  t: Translator;
  locale: Locale;
}) {
  const injured = rows.filter((r) => r.player.injured).length;
  const needRest = rows.filter((r) => !r.player.injured && r.needsRest).length;
  const highRisk = rows.filter((r) => !r.player.injured && r.riskLevel === "high").length;
  const riskLabel = { low: t("team.medical.riskLow"), medium: t("team.medical.riskMedium"), high: t("team.medical.riskHigh") };
  const riskTone = { low: "text-good", medium: "text-warn", high: "text-bad" };

  const status = (r: MedicalRow) => {
    const p = r.player;
    if (p.injured) {
      const injury = p.injuryType ? t(`domain.injuryType.${p.injuryType}` as "domain.injuryType.illness") : t(`domain.injurySeverity.${p.injurySeverity ?? "minor"}`);
      return (
        <span className="text-bad">
          {r.returnDate
            ? t("team.medical.out", { injury, date: formatGameDate(r.returnDate.toISOString(), locale) })
            : t("team.medical.outSeason", { injury })}
        </span>
      );
    }
    if (p.restNextGame) return <span className="text-info">{t("team.medical.resting")}</span>;
    if (r.needsRest) return <span className="text-warn">{t("team.medical.needRest")}</span>;
    return <span className="text-good">{t("team.medical.fit")}</span>;
  };

  return (
    <div className="mt-6 space-y-8">
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: t("team.medical.injured"), value: injured, tone: injured ? "text-bad" : "" },
          { label: t("team.medical.needRest"), value: needRest, tone: needRest ? "text-warn" : "" },
          { label: t("team.medical.highRisk"), value: highRisk, tone: highRisk ? "text-bad" : "" },
        ].map((c) => (
          <div key={c.label} className="card px-4 py-3">
            <p className="eyebrow">{c.label}</p>
            <p className={`mt-1 text-2xl font-bold tabular ${c.tone}`}>{c.value}</p>
          </div>
        ))}
      </div>
      <p className="text-xs text-muted">{t("team.medical.explain")}</p>

      <div className="card overflow-x-auto px-4">
        <SortableTable
          minWidth={760}
          initialSort={{ column: 5, descending: true }}
          columns={[
            { label: t("roster.column.player") },
            { label: t("team.medical.status") },
            { label: t("team.medical.energy"), descendingFirst: true },
            { label: t("team.medical.wear"), descendingFirst: true },
            { label: t("team.medical.condition"), descendingFirst: true },
            { label: t("team.medical.risk"), descendingFirst: true },
            ...(isMyTeam ? [{ label: t("team.medical.action"), sortable: false }] : []),
          ]}
          rows={rows.map((r) => {
            const p = r.player;
            const energy = 100 - Math.min(99, p.fatigue);
            const wear = p.wear ?? 0;
            return {
              key: p.id,
              sortValues: [
                `${p.lastName} ${p.firstName}`,
                p.injured ? 3 : p.restNextGame ? 2 : r.needsRest ? 1 : 0,
                energy,
                wear,
                p.conditioning,
                p.injured ? -1 : r.riskChance,
                null,
              ],
              cells: [
                <Link key="n" href={playerHref(p.id, teamId)} className="font-medium hover:underline">
                  {p.firstName} {p.lastName}
                </Link>,
                status(r),
                <Meter key="e" value={energy} tone={energy >= 70 ? "good" : energy >= 45 ? "warn" : "bad"} />,
                <Meter key="w" value={wear} tone={wear < 40 ? "good" : wear < WEAR_NEEDS_REST ? "warn" : "bad"} />,
                <Meter key="c" value={p.conditioning} tone={p.conditioning >= 85 ? "good" : p.conditioning >= 60 ? "warn" : "bad"} />,
                p.injured ? (
                  <span key="r" className="text-faint">–</span>
                ) : (
                  <span key="r" className={riskTone[r.riskLevel]}>
                    {riskLabel[r.riskLevel]} <span className="text-xs text-muted tabular">({(r.riskChance * 100).toFixed(1)} %)</span>
                  </span>
                ),
                ...(isMyTeam
                  ? [
                      p.injured ? (
                        <span key="a" />
                      ) : (
                        <form key="a" action={setRestNextGame}>
                          <input type="hidden" name="playerId" value={p.id} />
                          <input type="hidden" name="value" value={p.restNextGame ? "false" : "true"} />
                          <button
                            type="submit"
                            className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
                              p.restNextGame
                                ? "border border-line hover:bg-surface-2"
                                : r.needsRest
                                  ? "bg-warn/20 text-warn hover:bg-warn/30"
                                  : "border border-line hover:bg-surface-2"
                            }`}
                          >
                            {p.restNextGame ? t("team.medical.cancelRest") : t("team.medical.rest")}
                          </button>
                        </form>
                      ),
                    ]
                  : []),
              ],
            };
          })}
        />
      </div>

      <section>
        <h2 className="eyebrow mb-3">{t("team.medical.history")}</h2>
        {history.length === 0 ? (
          <p className="text-sm text-muted">{t("team.medical.noHistory")}</p>
        ) : (
          <ul className="card divide-y divide-line-soft px-4 text-sm">
            {history.map((h) => (
              <li key={h.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span>
                  <span className="text-faint tabular">{formatGameDate(h.gameDate.toISOString(), locale)}</span>{" "}
                  <Link href={playerHref(h.playerId, teamId)} className="font-medium hover:underline">
                    {h.playerName}
                  </Link>{" "}
                  — {t(`domain.injuryType.${h.injuryType}` as "domain.injuryType.illness")}
                </span>
                <span
                  className={`text-xs ${h.severity === "severe" ? "text-bad" : h.severity === "moderate" ? "text-warn" : "text-muted"}`}
                >
                  {t(`domain.injurySeverity.${h.severity}` as "domain.injurySeverity.minor")} ·{" "}
                  {t("team.medical.games", { count: h.gamesOut })}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
