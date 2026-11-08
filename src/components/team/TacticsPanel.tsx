import type { TacticsReport, OptionFit } from "@/lib/data-access/tactics";
import type { Translator } from "@/lib/i18n/translate";
import type { DictionaryKey } from "@/lib/i18n/dictionary";
import { setTactics } from "@/app/actions/tactics";
import { coachExecution, fitStars, type Tactics } from "@/lib/careers/tactics-rules";

type Category = "pace" | "offense" | "defense" | "depth";
const CATEGORIES: Category[] = ["offense", "defense", "pace", "depth"];

function Stars({ value }: { value: number }) {
  return (
    <span className="tracking-tight text-accent-text" aria-label={`${value}/5`}>
      {"★".repeat(value)}
      <span className="text-faint">{"★".repeat(5 - value)}</span>
    </span>
  );
}

function signed(value: number): string {
  const text = value.toFixed(1).replace(".", ",");
  return value > 0 ? `+${text}` : text;
}

// Résumé lisible d'une tactique (« Tirs extérieurs · Zone · Rapide · Courte (8) »).
export function tacticsSummary(t: Translator, tactics: Tactics): string {
  return [
    t(`tactics.offense.${tactics.offense}` as DictionaryKey),
    t(`tactics.defense.${tactics.defense}` as DictionaryKey),
    t(`tactics.pace.${tactics.pace}` as DictionaryKey),
    t(`tactics.depth.${tactics.depth}` as DictionaryKey),
  ].join(" · ");
}

// Formulaire caché qui applique une tactique complète en un clic.
function ApplyForm({ tactics, label, primary }: { tactics: Tactics; label: string; primary?: boolean }) {
  return (
    <form action={setTactics}>
      {CATEGORIES.map((c) => (
        <input key={c} type="hidden" name={c} value={tactics[c]} />
      ))}
      <button
        type="submit"
        className={`mt-3 rounded-md px-3 py-1.5 text-xs font-medium transition ${
          primary ? "bg-accent text-accent-fg hover:bg-accent-hover" : "border border-line hover:bg-surface-2"
        }`}
      >
        {label}
      </button>
    </form>
  );
}

export function TacticsPanel({
  report,
  opponentName,
  t,
}: {
  report: TacticsReport;
  opponentName: string | null;
  t: Translator;
}) {
  const sameAsCurrent = (x: Tactics | null) =>
    !!x && CATEGORIES.every((c) => x[c] === report.current[c]);

  const optionCard = (category: Category, option: OptionFit) => {
    const duel = option.duel;
    return (
      <label
        key={option.value}
        className="flex cursor-pointer flex-col gap-1 rounded-lg border border-line px-3 py-2.5 text-sm transition hover:bg-surface-2 has-[:checked]:border-accent has-[:checked]:bg-accent/10"
      >
        <span className="flex items-center gap-2">
          <input
            type="radio"
            name={category}
            value={option.value}
            defaultChecked={report.current[category] === option.value}
            className="accent-[var(--accent)]"
          />
          <span className="flex-1 font-medium">{t(`tactics.${category}.${option.value}` as DictionaryKey)}</span>
          <Stars value={fitStars(option.fit)} />
        </span>
        <span className="text-xs leading-snug text-muted">{t(`tactics.${category}Desc.${option.value}` as DictionaryKey)}</span>
        {duel !== undefined && duel !== 0 && (
          <span className={`text-[11px] font-medium ${duel > 0 ? "text-good" : "text-bad"}`}>
            {duel > 0 ? t("tactics.duelGood") : t("tactics.duelBad")} ({signed(duel)})
          </span>
        )}
      </label>
    );
  };

  return (
    <div className="mt-6 grid gap-6 lg:grid-cols-3">
      <form action={setTactics} className="space-y-6 lg:col-span-2">
        <div>
          <h2 className="text-lg font-semibold">{t("tactics.title")}</h2>
          <p className="mt-1 text-xs leading-relaxed text-muted">{t("tactics.subtitle")}</p>
          <p className="mt-2 text-xs text-soft">
            {t("tactics.coachLine", {
              rating: report.coachTactics,
              factor: coachExecution(report.coachTactics).toFixed(2).replace(".", ","),
            })}
          </p>
        </div>
        {CATEGORIES.map((category) => (
          <fieldset key={category}>
            <legend className="eyebrow mb-2">
              {t(`tactics.${category}` as DictionaryKey)}{" "}
              <span className="font-normal normal-case tracking-normal text-faint">· {t("tactics.fit")}</span>
            </legend>
            <div className="grid gap-2 sm:grid-cols-2">{report.fits[category].map((o) => optionCard(category, o))}</div>
          </fieldset>
        ))}
        <button
          type="submit"
          className="rounded-md bg-accent px-4 py-1.5 text-sm font-medium text-accent-fg transition hover:bg-accent-hover"
        >
          {t("tactics.save")}
        </button>
      </form>

      <aside className="space-y-4">
        {report.opponent && report.counter && opponentName ? (
          <section className="card p-4 text-sm">
            <p className="eyebrow">{t("tactics.counterHeading", { team: opponentName })}</p>
            <p className="mt-2 text-xs text-muted">
              {t("tactics.counterHint", { team: opponentName, tactics: tacticsSummary(t, report.opponent.tactics) })}
            </p>
            <p className="mt-2 font-medium">{tacticsSummary(t, report.counter)}</p>
            <ul className="mt-2 space-y-0.5 text-xs">
              {report.edgeCurrent !== null && (
                <li className={report.edgeCurrent >= 0 ? "text-good" : "text-bad"}>
                  {t("tactics.edgeCurrent", { value: signed(report.edgeCurrent) })}
                </li>
              )}
              {report.edgeCounter !== null && (
                <li className={report.edgeCounter >= 0 ? "text-good" : "text-bad"}>
                  {t("tactics.edgeCounter", { value: signed(report.edgeCounter) })}
                </li>
              )}
            </ul>
            {!sameAsCurrent(report.counter) && <ApplyForm tactics={report.counter} label={t("tactics.applyCounter")} primary />}
          </section>
        ) : (
          <section className="card p-4 text-sm text-muted">{t("tactics.noOpponent")}</section>
        )}

        <section className="card p-4 text-sm">
          <p className="eyebrow">{t("tactics.suggestionHeading")}</p>
          <p className="mt-2 text-xs text-muted">{t("tactics.suggestionHint")}</p>
          <p className="mt-2 font-medium">{tacticsSummary(t, report.suggestion)}</p>
          {!sameAsCurrent(report.suggestion) && <ApplyForm tactics={report.suggestion} label={t("tactics.applySuggestion")} />}
        </section>

        <p className="text-xs text-muted">{t("tactics.aiNote")}</p>
      </aside>
    </div>
  );
}
