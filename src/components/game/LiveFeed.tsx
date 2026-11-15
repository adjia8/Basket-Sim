import type { QuarterEvent } from "@/lib/simulation/engine";
import type { Translator } from "@/lib/i18n/translate";
import type { Team } from "@/lib/types";

// Fil de commentaires du match en direct : chaque quart-temps joué devient
// quelques phrases (score, gros quart-temps, changement de leader, meilleurs
// marqueurs, fautes, expulsions, temps morts).
export function LiveFeed({
  log,
  home,
  away,
  nameOf,
  t,
}: {
  log: QuarterEvent[];
  home: Team;
  away: Team;
  nameOf: Map<string, string>;
  t: Translator;
}) {
  const teamName = (side: "home" | "away") => (side === "home" ? home.name : away.name);
  const quarterLabel = (q: number) =>
    q === 1 ? t("live.firstQuarter") : q <= 4 ? t("live.quarterName", { n: q }) : t("live.overtimeName", { n: q - 4 });
  const name = (id: string) => nameOf.get(id) ?? id;

  return (
    <section className="card mt-6 p-4 sm:p-5" data-testid="live-feed">
      <p className="eyebrow">{t("live.title")}</p>
      <ol className="mt-3 space-y-4">
        {[...log].reverse().map((e, idx, arr) => {
          const prev = arr[idx + 1];
          const prevDiff = prev ? prev.homeTotal - prev.awayTotal : 0;
          const diff = e.homeTotal - e.awayTotal;
          const lines: string[] = [];
          if (e.timeout) lines.push(t("live.timeout", { team: teamName(e.timeout) }));
          const margin = Math.abs(e.home - e.away);
          if (margin >= 8) lines.push(t("live.bigQuarter", { team: teamName(e.home > e.away ? "home" : "away"), margin }));
          if (diff === 0) lines.push(t("live.tied"));
          else if (Math.sign(diff) !== Math.sign(prevDiff)) lines.push(t("live.leadChange", { team: teamName(diff > 0 ? "home" : "away") }));
          for (const s of e.top) if (s.pts >= 8) lines.push(t("live.scorer", { name: name(s.playerId), pts: s.pts }));
          for (const id of e.foulTrouble) lines.push(t("live.foulTrouble", { name: name(id) }));
          for (const id of e.technicals) lines.push(t("live.technical", { name: name(id) }));
          for (const id of e.ejected) lines.push(t("live.ejected", { name: name(id) }));
          for (const id of e.fouledOut ?? []) lines.push(t("live.fouledOut", { name: name(id) }));
          return (
            <li key={e.q} className="border-l-2 border-accent/50 pl-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                {t("live.endOfQuarter", { quarter: quarterLabel(e.q) })}
              </p>
              <p className="mt-0.5 font-semibold tabular">
                {t("live.score", {
                  away: away.abbreviation,
                  home: home.abbreviation,
                  awayTotal: e.awayTotal,
                  homeTotal: e.homeTotal,
                  awayQ: e.away,
                  homeQ: e.home,
                })}
              </p>
              {lines.length > 0 && (
                <ul className="mt-1 space-y-0.5 text-sm text-soft">
                  {lines.map((l, i) => (
                    <li key={i}>{l}</li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
