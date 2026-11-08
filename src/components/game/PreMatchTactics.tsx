import Link from "next/link";
import type { TacticsReport } from "@/lib/data-access/tactics";
import type { Translator } from "@/lib/i18n/translate";
import { tacticsSummary } from "@/components/team/TacticsPanel";

function signed(value: number): string {
  const text = value.toFixed(1).replace(".", ",");
  return value > 0 ? `+${text}` : text;
}

// Avant-match : ta tactique, celle de l'adversaire, l'avantage estimé et le
// conseil de ton assistant (contre-tactique), avec un lien pour modifier.
export function PreMatchTactics({ report, myTeamId, t }: { report: TacticsReport; myTeamId: string; t: Translator }) {
  if (!report.opponent) return null;
  const edge = report.edgeCurrent ?? 0;
  const counterEdge = report.edgeCounter ?? edge;
  const worthChanging = report.counter && counterEdge - edge >= 0.3;
  return (
    <section className="card mt-6 p-4 text-sm">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="eyebrow">{t("tactics.preMatchHeading")}</h2>
        <Link href={`/teams/${myTeamId}?tab=tactics`} className="text-xs font-medium text-accent-text hover:underline">
          {t("tactics.preMatchLink")} →
        </Link>
      </div>
      <dl className="mt-3 grid gap-2 sm:grid-cols-2">
        <div>
          <dt className="text-xs text-muted">{t("tactics.preMatchMine")}</dt>
          <dd className="font-medium">{tacticsSummary(t, report.current)}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted">{t("tactics.preMatchTheirs")}</dt>
          <dd className="font-medium">{tacticsSummary(t, report.opponent.tactics)}</dd>
        </div>
      </dl>
      <p className={`mt-3 text-xs font-medium ${edge >= 0 ? "text-good" : "text-bad"}`}>
        {t("tactics.preMatchEdge", { value: signed(edge) })}
      </p>
      <p className="mt-1 text-xs text-muted">
        {worthChanging && report.counter
          ? t("tactics.preMatchAdvice", { tactics: tacticsSummary(t, report.counter), value: signed(counterEdge) })
          : t("tactics.preMatchOk")}
      </p>
    </section>
  );
}
