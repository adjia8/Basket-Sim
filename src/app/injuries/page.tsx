import Link from "next/link";
import { getCurrentMembership } from "@/lib/auth/dal";
import { getLeagueInjuries, type InjuredPlayerView } from "@/lib/data-access/injury-report";
import { getGameClock } from "@/lib/data-access/game-clock";
import { getTranslator } from "@/lib/i18n/translate";
import type { DictionaryKey } from "@/lib/i18n/dictionary";
import { formatGameDate, playerHref } from "@/lib/utils";

const VIEWS = ["important", "all", "mine"] as const;
type View = (typeof VIEWS)[number];

const SEVERITY_TONE: Record<string, string> = {
  minor: "bg-warn/15 text-warn",
  moderate: "bg-bad/15 text-bad",
  severe: "bg-bad/25 text-bad font-bold",
};

const TIER_TONE: Record<string, string> = {
  star: "bg-accent/15 text-accent-text",
  starter: "bg-info/15 text-info",
  role: "bg-surface-3 text-soft",
};

// Infirmerie de la ligue : tous les blessés, toutes équipes confondues, les
// joueurs importants en premier (voir injury-report-rules.ts).
export default async function InjuriesPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const m = await getCurrentMembership();
  const { t, locale } = await getTranslator();
  const { view: rawView } = await searchParams;
  const view: View = VIEWS.includes(rawView as View) ? (rawView as View) : "important";

  const [all, clock] = await Promise.all([getLeagueInjuries(m.careerId, m.leagueId), getGameClock(m.careerId, m.teamId)]);
  const nextOpponent = clock.nextGame?.opponentTeamId ?? null;
  const list = all.filter((p) =>
    view === "mine" ? p.teamId === m.teamId : view === "important" ? p.tier !== "role" : true
  );
  const stars = all.filter((p) => p.tier === "star").length;
  const opponentOut = all.filter((p) => p.teamId === nextOpponent && p.tier !== "role" && !p.playingThrough);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="text-2xl font-bold tracking-tight">{t("injuries.title")}</h1>
      <p className="mt-1 text-sm text-muted">{t("injuries.subtitle")}</p>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <div className="card p-4">
          <p className="eyebrow">{t("injuries.totalLabel")}</p>
          <p className="mt-1 text-2xl font-bold tabular">{all.length}</p>
        </div>
        <div className="card p-4">
          <p className="eyebrow">{t("injuries.starsLabel")}</p>
          <p className={`mt-1 text-2xl font-bold tabular ${stars > 0 ? "text-bad" : ""}`}>{stars}</p>
        </div>
        <div className="card p-4" data-testid="injuries-opponent">
          <p className="eyebrow">{t("injuries.opponentLabel")}</p>
          {opponentOut.length === 0 ? (
            <p className="mt-1 text-sm text-muted">{nextOpponent ? t("injuries.opponentNone") : "—"}</p>
          ) : (
            <p className="mt-1 text-sm">{opponentOut.map((p) => p.name).join(", ")}</p>
          )}
        </div>
      </div>

      <nav className="mt-5 flex flex-wrap gap-2 text-sm">
        {VIEWS.map((v) => (
          <Link
            key={v}
            href={v === "important" ? "/injuries" : `/injuries?view=${v}`}
            className={`rounded-md px-3 py-1 ${v === view ? "bg-accent text-accent-fg" : "border border-line hover:bg-surface-2"}`}
          >
            {t(`injuries.view.${v}` as DictionaryKey)}
          </Link>
        ))}
      </nav>

      {list.length === 0 ? (
        <p className="mt-6 text-sm text-muted">{t("injuries.empty")}</p>
      ) : (
        <div className="card mt-4 overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm" data-testid="injuries-table">
            <thead>
              <tr className="border-b border-line-soft text-left text-[11px] uppercase tracking-wide text-faint">
                <th className="px-3 py-2 font-medium">{t("injuries.col.player")}</th>
                <th className="px-3 py-2 font-medium">{t("injuries.col.team")}</th>
                <th className="px-3 py-2 font-medium">{t("injuries.col.injury")}</th>
                <th className="px-3 py-2 text-right font-medium">{t("injuries.col.games")}</th>
                <th className="px-3 py-2 font-medium">{t("injuries.col.return")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line-soft">
              {list.map((p) => (
                <InjuryRow key={p.playerId} p={p} mine={p.teamId === m.teamId} opponent={p.teamId === nextOpponent} t={t} locale={locale} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function InjuryRow({
  p,
  mine,
  opponent,
  t,
  locale,
}: {
  p: InjuredPlayerView;
  mine: boolean;
  opponent: boolean;
  t: Awaited<ReturnType<typeof getTranslator>>["t"];
  locale: Awaited<ReturnType<typeof getTranslator>>["locale"];
}) {
  return (
    <tr className={mine ? "bg-accent/5" : ""} data-testid="injury-row">
      <td className="px-3 py-2.5">
        <Link href={playerHref(p.playerId, p.teamId)} className="font-medium hover:underline">
          {p.name}
        </Link>
        <span className="ml-2 tabular text-xs text-faint">{p.overall}</span>
        <span className={`ml-2 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${TIER_TONE[p.tier]}`}>
          {t(`injuries.tier.${p.tier}` as DictionaryKey)}
        </span>
      </td>
      <td className="px-3 py-2.5">
        <Link href={`/teams/${p.teamId}`} className="hover:underline" title={p.teamName}>
          {p.teamAbbr}
        </Link>
        {mine && <span className="ml-1.5 text-[10px] font-semibold text-accent-text">{t("injuries.mine")}</span>}
        {opponent && <span className="ml-1.5 text-[10px] font-semibold text-warn">{t("injuries.nextOpponent")}</span>}
      </td>
      <td className="px-3 py-2.5">
        {p.injuryType ? t(`domain.injuryType.${p.injuryType}` as DictionaryKey) : "—"}
        {p.severity && (
          <span className={`ml-2 rounded px-1.5 py-0.5 text-[10px] ${SEVERITY_TONE[p.severity] ?? ""}`}>
            {t(`domain.injurySeverity.${p.severity}` as DictionaryKey)}
          </span>
        )}
        {p.playingThrough && <span className="ml-2 text-[10px] text-warn">{t("injuries.playingThrough")}</span>}
      </td>
      <td className="px-3 py-2.5 text-right tabular">{p.gamesRemaining}</td>
      <td className="px-3 py-2.5 text-soft">
        {p.returnDate ? formatGameDate(p.returnDate, locale) : t("injuries.seasonOver")}
      </td>
    </tr>
  );
}
