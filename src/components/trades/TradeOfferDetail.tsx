import Link from "next/link";
import type { Translator } from "@/lib/i18n/translate";
import type { DictionaryKey } from "@/lib/i18n/dictionary";
import type { Locale } from "@/lib/i18n/locale";
import type { AssetView, OfferDetail } from "@/lib/data-access/trade-review";
import type { ReviewPoint, TradeVerdict } from "@/lib/careers/trade-review-rules";
import { formatSalary } from "@/lib/utils";

// Détail d'une offre d'échange : ce que je reçois / ce que je cède (âge,
// poste, note, stats, contrat), puis l'avis de l'entraîneur adjoint.

const VERDICT_TONE: Record<TradeVerdict, string> = {
  big_gain: "bg-good/20 text-good",
  gain: "bg-good/10 text-good",
  even: "bg-surface-3 text-soft",
  loss: "bg-bad/10 text-bad",
  big_loss: "bg-bad/20 text-bad",
};

const one = (v: number, locale: Locale) => v.toLocaleString(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 });

function AssetRow({ a, t, locale }: { a: AssetView; t: Translator; locale: Locale }) {
  if (a.kind === "pick") {
    return (
      <li className="py-2 text-sm">
        <span className="font-medium">
          {a.pickNumber !== null
            ? t("common.draftPick.full", { number: a.pickNumber, round: a.round, season: a.season }) + t("common.draftPick.via", { abbr: a.originalAbbr })
            : t("common.draftPick.roundOnly", { round: a.round, season: a.season }) + ` (${a.originalAbbr})`}
        </span>
      </li>
    );
  }
  const years = a.yearsRemaining <= 1 ? t("tradeReview.lastYear") : t("tradeReview.years", { n: a.yearsRemaining });
  const typeLabel =
    a.contractType === "standard"
      ? null
      : a.contractType === "two_way" || a.contractType === "development"
        ? t(`tradeReview.contractType.${a.contractType}` as DictionaryKey)
        : t("tradeReview.contractType.other");
  return (
    <li className="py-2 text-sm" data-testid="offer-player">
      <div className="flex items-baseline justify-between gap-2">
        <Link href={`/teams/${a.teamId}/players/${a.id}`} className="min-w-0 truncate font-medium hover:underline">
          {a.name}
        </Link>
        <span className="shrink-0 rounded bg-surface-3 px-1.5 py-0.5 text-xs font-semibold tabular">{a.overall}</span>
      </div>
      <p className="mt-0.5 text-xs text-muted">
        {a.position} · {t("tradeReview.age", { age: a.age })} ·{" "}
        {t("tradeReview.contract", { salary: formatSalary(a.salary, locale), years })}
        {typeLabel && ` · ${typeLabel}`}
      </p>
      <p className="text-xs text-faint tabular">
        {a.gamesPlayed > 0
          ? t("tradeReview.stats", { ppg: one(a.ppg, locale), rpg: one(a.rpg, locale), apg: one(a.apg, locale), mpg: one(a.mpg, locale), gp: a.gamesPlayed })
          : t("tradeReview.noStats")}
      </p>
    </li>
  );
}

function pointText(p: ReviewPoint, t: Translator, locale: Locale): string {
  switch (p.kind) {
    case "salarySaved":
    case "salaryAdded":
      return t(`tradeReview.point.${p.kind}`, { amount: formatSalary(p.amount, locale) });
    case "positionGap":
      return t("tradeReview.point.positionGap", { position: t(`report.posLong.${p.position}` as DictionaryKey) });
    default: {
      const { kind, ...vars } = p;
      return t(`tradeReview.point.${kind}` as DictionaryKey, vars as Record<string, string | number>);
    }
  }
}

const POSITIVE = new Set(["upgrade", "younger", "salarySaved", "picksGained"]);
const NEGATIVE = new Set(["downgrade", "older", "salaryAdded", "taxCrossed", "badContract", "picksLost", "positionGap", "veteranForRebuild", "weakensNow", "fanFavourite"]);

export function TradeOfferDetail({ detail, t, locale }: { detail: OfferDetail; t: Translator; locale: Locale }) {
  const net = detail.salaryIn - detail.salaryOut;
  const netLabel = `${net > 0 ? "+" : net < 0 ? "−" : ""}${formatSalary(Math.abs(net), locale)}`;
  const r = detail.review;
  return (
    <div className="mt-3 space-y-3" data-testid="offer-detail">
      <div className="grid gap-3 md:grid-cols-2">
        <section className="rounded-md border border-good/30 bg-surface-2 px-3 py-2">
          <h4 className="eyebrow text-good">{t("tradeReview.youGet")}</h4>
          <ul className="divide-y divide-line-soft">
            {detail.incoming.map((a) => (
              <AssetRow key={a.id} a={a} t={t} locale={locale} />
            ))}
          </ul>
        </section>
        <section className="rounded-md border border-bad/30 bg-surface-2 px-3 py-2">
          <h4 className="eyebrow text-bad">{t("tradeReview.youGive")}</h4>
          <ul className="divide-y divide-line-soft">
            {detail.outgoing.map((a) => (
              <AssetRow key={a.id} a={a} t={t} locale={locale} />
            ))}
          </ul>
        </section>
      </div>
      <p className="text-xs text-muted tabular">
        {t("tradeReview.salaryLine", {
          in: detail.salaryIn ? formatSalary(detail.salaryIn, locale) : "—",
          out: detail.salaryOut ? formatSalary(detail.salaryOut, locale) : "—",
          net: net === 0 ? "=" : netLabel,
        })}
      </p>

      {r && (
        <section className="rounded-md border border-info/30 bg-surface-2 p-3" data-testid="offer-review">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h4 className="eyebrow text-info">{t("tradeReview.adviserTitle")}</h4>
              <p className="text-xs text-faint">
                {detail.adviser ? t("tradeReview.adviserName", { name: detail.adviser, skill: detail.adviserSkill }) : t("tradeReview.noAdviser")}
              </p>
            </div>
            <span className={`rounded px-2 py-0.5 text-xs font-semibold ${VERDICT_TONE[r.verdict]}`} data-testid="offer-verdict" data-verdict={r.verdict}>
              {t(`tradeReview.verdict.${r.verdict}` as DictionaryKey)}
            </span>
          </div>
          <p className="mt-2 text-sm italic">{t(`tradeReview.summary.${r.verdict}` as DictionaryKey)}</p>
          {r.points.length > 0 && (
            <ul className="mt-2 space-y-1 text-sm">
              {r.points.map((p, i) => (
                <li key={i} className="flex gap-2">
                  <span className={POSITIVE.has(p.kind) ? "text-good" : NEGATIVE.has(p.kind) ? "text-bad" : "text-muted"}>
                    {POSITIVE.has(p.kind) ? "+" : NEGATIVE.has(p.kind) ? "−" : "•"}
                  </span>
                  <span>{pointText(p, t, locale)}</span>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-2 text-2xs text-faint">{t(`tradeReview.confidence.${r.confidence}` as DictionaryKey)}</p>
        </section>
      )}
    </div>
  );
}
