import type { Translator } from "@/lib/i18n/translate";
import type { DictionaryKey } from "@/lib/i18n/dictionary";
import type { TeamReport } from "@/lib/data-access/team-report";
import { METRIC_KIND, type Advice, type RankedMetric } from "@/lib/careers/team-report-rules";

// Rapport d'équipe (points forts / points faibles), façon Football Manager.
function formatValue(m: RankedMetric): string {
  if (m.key === "fgPct" || m.key === "tpPct" || m.key === "ftPct") return `${(m.value * 100).toFixed(1)} %`;
  if (METRIC_KIND[m.key] === "rating") return m.value.toFixed(0);
  return m.value.toFixed(1);
}

function MetricLine({ m, t, tone }: { m: RankedMetric; t: Translator; tone: "good" | "bad" }) {
  return (
    <li className="flex items-baseline justify-between gap-3 py-1.5">
      <span>
        {t(`report.metric.${m.key}` as DictionaryKey)}
        <span className="ml-1.5 text-xs text-faint">{formatValue(m)}</span>
      </span>
      <span className={`shrink-0 text-xs font-semibold tabular ${tone === "good" ? "text-good" : "text-bad"}`}>
        {m.rank === 1 ? t("report.rankFirst", { of: m.of }) : t("report.rank", { rank: m.rank, of: m.of })}
      </span>
    </li>
  );
}

function adviceText(a: Advice, t: Translator): string {
  switch (a.kind) {
    case "recruit":
      return t(a.critical ? "report.advice.recruitCritical" : "report.advice.recruitThin", {
        pos: t(`report.pos.${a.position}` as DictionaryKey),
      });
    case "tactic":
      return t(`report.advice.tactic.${a.tactic}` as DictionaryKey);
    case "training":
      return t(`report.advice.training.${a.focus}` as DictionaryKey);
    default:
      return t("report.advice.bench");
  }
}

export function TeamReportPanel({ report, t }: { report: TeamReport; t: Translator }) {
  const fewGames = report.gamesPlayed < 5;
  return (
    <div className="mt-6 space-y-6" data-testid="team-report">
      <p className="text-xs text-muted">
        {fewGames ? t("report.fewGames", { games: report.gamesPlayed }) : t("report.intro", { games: report.gamesPlayed })}
        {" · "}
        {t("report.averageAge", { age: report.averageAge.toFixed(1) })}
      </p>

      <div className="grid gap-4 md:grid-cols-2">
        <section className="card border-good/30 p-4">
          <h3 className="eyebrow mb-2 text-good">{t("report.strengths")}</h3>
          {report.strengths.length === 0 ? (
            <p className="text-sm text-muted">{t("report.none")}</p>
          ) : (
            <ul className="divide-y divide-line-soft text-sm" data-testid="report-strengths">
              {report.strengths.map((m) => (
                <MetricLine key={m.key} m={m} t={t} tone="good" />
              ))}
            </ul>
          )}
        </section>
        <section className="card border-bad/30 p-4">
          <h3 className="eyebrow mb-2 text-bad">{t("report.weaknesses")}</h3>
          {report.weaknesses.length === 0 ? (
            <p className="text-sm text-muted">{t("report.none")}</p>
          ) : (
            <ul className="divide-y divide-line-soft text-sm" data-testid="report-weaknesses">
              {report.weaknesses.map((m) => (
                <MetricLine key={m.key} m={m} t={t} tone="bad" />
              ))}
            </ul>
          )}
        </section>
      </div>

      <section>
        <h3 className="eyebrow mb-2">{t("report.depthTitle")}</h3>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5" data-testid="report-depth">
          {report.depth.map((d) => (
            <div
              key={d.position}
              className={`card p-3 text-sm ${d.need === "critical" ? "border-bad/50" : d.need === "thin" ? "border-warn/50" : ""}`}
            >
              <p className="font-semibold">{t(`report.posLong.${d.position}` as DictionaryKey)}</p>
              <p className="mt-1 text-xs text-muted">{t("report.depthBest", { best: d.best || "—" })}</p>
              <p className="text-xs text-muted">{t("report.depthCount", { count: d.count, quality: d.quality })}</p>
              {d.need && (
                <p className={`mt-1 text-2xs font-semibold ${d.need === "critical" ? "text-bad" : "text-warn"}`}>
                  {t(d.need === "critical" ? "report.needCritical" : "report.needThin")}
                </p>
              )}
            </div>
          ))}
        </div>
      </section>

      {report.advice.length > 0 && (
        <section className="card border-info/30 p-4">
          <h3 className="eyebrow mb-2 text-info">{t("report.adviceTitle")}</h3>
          <ul className="list-disc space-y-1 pl-5 text-sm" data-testid="report-advice">
            {report.advice.map((a, i) => (
              <li key={i}>{adviceText(a, t)}</li>
            ))}
          </ul>
        </section>
      )}

      <details className="card p-4">
        <summary className="cursor-pointer text-sm font-medium">{t("report.allMetrics")}</summary>
        <ul className="mt-3 grid gap-x-6 text-sm sm:grid-cols-2">
          {report.ranked.map((m) => {
            const pct = 1 - (m.rank - 1) / Math.max(1, m.of - 1);
            return (
              <li key={m.key} className="py-1.5">
                <div className="flex items-baseline justify-between gap-2">
                  <span>
                    {t(`report.metric.${m.key}` as DictionaryKey)}
                    <span className="ml-1.5 text-xs text-faint">{formatValue(m)}</span>
                  </span>
                  <span className="text-xs text-muted tabular">{m.rank === 1 ? t("report.rankFirst", { of: m.of }) : t("report.rank", { rank: m.rank, of: m.of })}</span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-3">
                  <div
                    className={`h-full ${pct >= 0.67 ? "bg-good" : pct <= 0.33 ? "bg-bad" : "bg-warn"}`}
                    style={{ width: `${Math.max(4, pct * 100)}%` }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      </details>
    </div>
  );
}
