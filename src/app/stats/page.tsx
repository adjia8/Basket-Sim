import Link from "next/link";
import { getCurrentMembership } from "@/lib/auth/dal";
import { getSeasonLines, type PlayerSeasonLine } from "@/lib/data-access/season-stats";
import { getTeamsByLeague } from "@/lib/data-access/teams";
import { getTranslator } from "@/lib/i18n/translate";
import type { DictionaryKey } from "@/lib/i18n/dictionary";
import { minGamesForAwards } from "@/lib/careers/awards-rules";
import { playerHref } from "@/lib/utils";

const CATEGORIES = ["ppg", "rpg", "apg", "spg", "bpg", "fgPct", "tpPct", "mpg"] as const;
type Category = (typeof CATEGORIES)[number];

// Pourcentages : volume minimal de tirs pour ne pas couronner un 3/3.
function qualifies(line: PlayerSeasonLine, category: Category): boolean {
  if (category === "fgPct") return line.fga >= line.gamesPlayed * 5;
  if (category === "tpPct") return line.tpa >= line.gamesPlayed * 2;
  return true;
}

export default async function StatsPage({
  searchParams,
}: {
  searchParams: Promise<{ cat?: string; phase?: string }>;
}) {
  const m = await getCurrentMembership();
  const { t, locale } = await getTranslator();
  const params = await searchParams;
  const category: Category = CATEGORIES.includes(params.cat as Category) ? (params.cat as Category) : "ppg";
  const playoffs = params.phase === "playoffs";
  const season = playoffs ? `${m.season}-playoffs` : m.season;

  const [lines, teams] = await Promise.all([getSeasonLines(m.careerId, season), getTeamsByLeague(m.leagueId)]);
  const abbr = new Map(teams.map((team) => [team.id, team.abbreviation]));
  const minGames = minGamesForAwards(lines);
  const ranked = lines
    .filter((l) => l.gamesPlayed >= minGames && qualifies(l, category))
    .sort((a, b) => b[category] - a[category])
    .slice(0, 25);
  const fmt = (v: number) => v.toFixed(1).replace(".", locale === "fr" ? "," : ".");
  const href = (cat: Category, phase: boolean) => `/stats?cat=${cat}${phase ? "&phase=playoffs" : ""}`;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="text-2xl font-bold tracking-tight">{t("league.stats.title")}</h1>
      <p className="mt-1 text-sm text-muted">{t("league.stats.subtitle")}</p>

      <div className="mt-5 flex flex-wrap gap-2 text-sm">
        {[false, true].map((phase) => (
          <Link
            key={String(phase)}
            href={href(category, phase)}
            className={`rounded-md px-3 py-1 ${phase === playoffs ? "bg-accent text-accent-fg" : "border border-line hover:bg-surface-2"}`}
          >
            {phase ? t("league.stats.playoffs") : t("league.stats.regular")}
          </Link>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-1 border-b border-line text-sm">
        {CATEGORIES.map((c) => (
          <Link
            key={c}
            href={href(c, playoffs)}
            className={`-mb-px border-b-2 px-3 py-2 ${c === category ? "border-accent font-medium text-fg" : "border-transparent text-muted hover:text-fg"}`}
          >
            {t(`league.stats.cat.${c}` as DictionaryKey)}
          </Link>
        ))}
      </div>

      {ranked.length === 0 ? (
        <p className="mt-6 text-sm text-muted">{t("league.stats.empty")}</p>
      ) : (
        <>
          <p className="mt-3 text-xs text-faint">{t("league.stats.minGames", { count: minGames })}</p>
          <div className="card mt-2 overflow-x-auto">
            <table className="w-full min-w-[520px] text-sm">
              <thead>
                <tr className="border-b border-line text-left text-[11px] uppercase tracking-wide text-muted">
                  <th className="px-4 py-2 font-medium">{t("league.stats.col.rank")}</th>
                  <th className="px-2 py-2 font-medium">{t("league.stats.col.player")}</th>
                  <th className="px-2 py-2 font-medium">{t("league.stats.col.team")}</th>
                  <th className="px-2 py-2 text-right font-medium">{t("league.stats.col.games")}</th>
                  <th className="px-4 py-2 text-right font-medium">{t(`league.stats.cat.${category}` as DictionaryKey)}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line-soft">
                {ranked.map((l, i) => (
                  <tr key={l.playerId} className={l.teamId === m.teamId ? "bg-accent/5" : ""}>
                    <td className="px-4 py-2 tabular text-faint">{i + 1}</td>
                    <td className="px-2 py-2">
                      <Link href={playerHref(l.playerId, l.teamId)} className="font-medium hover:underline">
                        {l.name}
                      </Link>
                    </td>
                    <td className="px-2 py-2 text-muted">{abbr.get(l.teamId) ?? l.teamId}</td>
                    <td className="px-2 py-2 text-right tabular text-muted">{l.gamesPlayed}</td>
                    <td className="px-4 py-2 text-right font-semibold tabular">{fmt(l[category])}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
