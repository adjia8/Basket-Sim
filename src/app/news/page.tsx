import Link from "next/link";
import { getCurrentMembership } from "@/lib/auth/dal";
import { getLeagueNews } from "@/lib/data-access/league-news";
import { getTranslator } from "@/lib/i18n/translate";
import type { DictionaryKey } from "@/lib/i18n/dictionary";
import { formatGameDate } from "@/lib/utils";

const TYPES = ["performance", "injury", "streak", "trade", "award", "all_star", "cup"] as const;

const TYPE_TONE: Record<string, string> = {
  performance: "bg-accent/15 text-accent-text",
  injury: "bg-bad/15 text-bad",
  streak: "bg-info/15 text-info",
  award: "bg-good/15 text-good",
  all_star: "bg-warn/15 text-warn",
  trade: "bg-surface-3 text-fg",
  cup: "bg-accent/15 text-accent-text",
};

export default async function NewsPage({ searchParams }: { searchParams: Promise<{ type?: string }> }) {
  const m = await getCurrentMembership();
  const { t, locale } = await getTranslator();
  const { type } = await searchParams;
  const filter = TYPES.includes(type as (typeof TYPES)[number]) ? type : undefined;
  const news = await getLeagueNews(m.careerId, 80, filter);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-2xl font-bold tracking-tight">{t("league.news.title")}</h1>
      <p className="mt-1 text-sm text-muted">{t("league.news.subtitle")}</p>
      <div className="mt-5 flex flex-wrap gap-2 text-sm">
        {[undefined, ...TYPES].map((ty) => (
          <Link
            key={ty ?? "all"}
            href={ty ? `/news?type=${ty}` : "/news"}
            className={`rounded-md px-3 py-1 ${ty === filter ? "bg-accent text-accent-fg" : "border border-line hover:bg-surface-2"}`}
          >
            {ty ? t(`league.news.type.${ty}` as DictionaryKey) : t("league.news.all")}
          </Link>
        ))}
      </div>
      {news.length === 0 ? (
        <p className="mt-6 text-sm text-muted">{t("league.news.empty")}</p>
      ) : (
        <ul className="card mt-4 divide-y divide-line-soft">
          {news.map((n) => (
            <li key={n.id} className="px-4 py-3 text-sm">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className={`rounded px-1.5 py-0.5 font-semibold ${TYPE_TONE[n.type] ?? "bg-surface-3 text-soft"}`}>
                  {t(`league.news.type.${n.type}` as DictionaryKey)}
                </span>
                {n.gameDate && <span className="text-faint tabular">{formatGameDate(n.gameDate.toISOString(), locale)}</span>}
              </div>
              <p className="mt-1 font-medium">{n.title}</p>
              {n.body && <p className="mt-0.5 text-muted">{n.body}</p>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
