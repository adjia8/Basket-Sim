import Link from "next/link";
import { getCurrentMembership } from "@/lib/auth/dal";
import { getAwardRace, getAwards, type AwardView, type RaceEntry } from "@/lib/data-access/awards";
import { getTeamsByLeague } from "@/lib/data-access/teams";
import { getTranslator } from "@/lib/i18n/translate";
import { ALL_NBA, MAJOR_AWARDS, type AwardType } from "@/lib/careers/awards-rules";
import { awardName } from "@/lib/careers/news-rules";
import { playerHref } from "@/lib/utils";

export default async function AwardsPage() {
  const m = await getCurrentMembership();
  const { t, locale } = await getTranslator();
  const women = m.leagueId === "wnba";
  const [awards, teams] = await Promise.all([getAwards(m.careerId), getTeamsByLeague(m.leagueId)]);
  const abbr = new Map(teams.map((team) => [team.id, team.abbreviation]));
  const currentHasAwards = awards.some((a) => a.season === m.season && a.type === "mvp");
  const race = currentHasAwards ? {} : await getAwardRace(m.careerId, m.leagueId, m.season, locale);
  const seasons = [...new Set([m.season, ...awards.map((a) => a.season)])].sort().reverse();

  const who = (a: { playerId: string | null; playerName: string | null; label: string | null; teamId: string }) =>
    a.playerId ? (
      <Link href={playerHref(a.playerId, a.teamId)} className="font-medium hover:underline">
        {a.playerName}
      </Link>
    ) : (
      <span className="font-medium">{a.label}</span>
    );

  const raceCard = (type: AwardType, entries: RaceEntry[] | undefined) =>
    entries && entries.length > 0 ? (
      <div key={type} className="card p-4 text-sm">
        <p className="eyebrow mb-2">{awardName(type, locale, women)}</p>
        <ol className="space-y-1">
          {entries.map((e, i) => (
            <li key={e.playerId} className="flex items-baseline justify-between gap-2">
              <span>
                <span className="mr-2 text-faint tabular">{i + 1}.</span>
                <Link href={playerHref(e.playerId, e.teamId)} className={`hover:underline ${i === 0 ? "font-semibold" : ""}`}>
                  {e.name}
                </Link>{" "}
                <span className="text-xs text-muted">{abbr.get(e.teamId)}</span>
              </span>
              <span className="text-xs text-muted tabular">{e.statLine}</span>
            </li>
          ))}
        </ol>
      </div>
    ) : null;

  const seasonBlock = (season: string, list: AwardView[]) => {
    const winners = MAJOR_AWARDS.map((type) => ({
      type,
      winner: list.find((a) => a.type === type && a.rank === 1),
      podium: list.filter((a) => a.type === type && a.rank > 1),
    })).filter((x) => x.winner);
    const allStars = list.filter((a) => a.type === "all_star");
    const asgMvp = list.find((a) => a.type === "all_star_mvp");
    const cupWinner = list.find((a) => a.type === "nba_cup");
    const cupMvp = list.find((a) => a.type === "cup_mvp");
    return (
      <section key={season} className="mt-8">
        <h2 className="text-lg font-semibold">{t("league.awards.season", { season })}</h2>
        {season === m.season && !currentHasAwards && <p className="mt-1 text-sm text-muted">{t("league.awards.pending")}</p>}
        {winners.length > 0 && (
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {winners.map(({ type, winner, podium }) => (
              <div key={type} className="card p-4 text-sm">
                <p className="eyebrow">{awardName(type, locale, women)}</p>
                <p className="mt-1 text-base">
                  🏆 {who(winner!)} <span className="text-xs text-muted">{abbr.get(winner!.teamId)}</span>
                </p>
                {winner!.statLine && <p className="text-xs text-muted">{winner!.statLine}</p>}
                {podium.length > 0 && (
                  <p className="mt-2 text-xs text-faint">
                    {t("league.awards.podium")} : {podium.map((p) => p.playerName).join(", ")}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
        {list.some((a) => ALL_NBA.includes(a.type)) && (
          <div className="card mt-3 p-4 text-sm">
            <p className="eyebrow mb-2">{t("league.awards.allLeague")}</p>
            <ul className="space-y-1">
              {ALL_NBA.map((type) => (
                <li key={type}>
                  <span className="text-muted">{awardName(type, locale, women)} : </span>
                  {list
                    .filter((a) => a.type === type)
                    .map((a, i) => (
                      <span key={a.id}>
                        {i > 0 && ", "}
                        {who(a)}
                      </span>
                    ))}
                </li>
              ))}
            </ul>
          </div>
        )}
        {cupWinner && (
          <div className="card mt-3 p-4 text-sm">
            <p className="eyebrow">{awardName("nba_cup", locale, women)}</p>
            <p className="mt-1 text-base">
              🏆 <Link href="/cup" className="font-medium hover:underline">{cupWinner.label}</Link>
            </p>
            {cupMvp && (
              <p className="mt-1 text-xs text-muted">
                {awardName("cup_mvp", locale, women)} : {who(cupMvp)} {cupMvp.statLine && `· ${cupMvp.statLine}`}
              </p>
            )}
          </div>
        )}
        <div className="card mt-3 p-4 text-sm">
          <p className="eyebrow mb-2">{t("league.awards.allStars")}</p>
          {asgMvp && (
            <p className="mb-2">
              ⭐ <span className="text-muted">{awardName("all_star_mvp", locale, women)} : </span>
              {who(asgMvp)} {asgMvp.statLine && <span className="text-xs text-muted">· {asgMvp.statLine}</span>}
            </p>
          )}
          {allStars.length === 0 ? (
            <p className="text-muted">{t("league.awards.allStarsPending")}</p>
          ) : (
            <p className="leading-relaxed">
              {allStars.map((a, i) => (
                <span key={a.id}>
                  {i > 0 && " · "}
                  {who(a)} <span className="text-xs text-faint">{abbr.get(a.teamId)}</span>
                </span>
              ))}
            </p>
          )}
        </div>
      </section>
    );
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="text-2xl font-bold tracking-tight">{t("league.awards.title")}</h1>
      <p className="mt-1 max-w-3xl text-sm text-muted">{t("league.awards.subtitle")}</p>

      {!currentHasAwards && Object.keys(race).length > 0 && (
        <section className="mt-6">
          <h2 className="text-lg font-semibold">{t("league.awards.race")}</h2>
          <p className="mt-1 text-xs text-muted">{t("league.awards.raceHint")}</p>
          <div className="mt-3 grid gap-3 lg:grid-cols-3">
            {(["mvp", "dpoy", "roy"] as AwardType[]).map((type) => raceCard(type, race[type]))}
          </div>
        </section>
      )}

      {seasons.map((season) => seasonBlock(season, awards.filter((a) => a.season === season)))}
    </div>
  );
}
