import Link from "next/link";
import { getCurrentMembership } from "@/lib/auth/dal";
import { getCupState } from "@/lib/data-access/nba-cup";
import { getTeamsByLeague } from "@/lib/data-access/teams";
import { prisma } from "@/lib/prisma";
import { getTranslator } from "@/lib/i18n/translate";
import { ALL_STAR_HOSTS, allStarBreakDays, allStarGameDate, cupCalendar } from "@/lib/careers/nba-cup-rules";
import { formatGameDate, playerHref } from "@/lib/utils";

export default async function CupPage() {
  const m = await getCurrentMembership();
  const { t, locale } = await getTranslator();
  const [state, teams, awards] = await Promise.all([
    getCupState(m.careerId, m.season),
    getTeamsByLeague(m.leagueId),
    prisma.award.findMany({ where: { careerId: m.careerId, season: m.season, type: { in: ["nba_cup", "cup_mvp"] } } }),
  ]);
  const teamById = new Map(teams.map((team) => [team.id, team]));
  const short = (id: string) => teamById.get(id)?.abbreviation ?? id;
  const full = (id: string) => {
    const team = teamById.get(id);
    return team ? `${team.city} ${team.name}` : id;
  };
  const day = (d: Date) => formatGameDate(d.toISOString(), locale);
  const cal = cupCalendar(m.season);
  const asg = allStarGameDate(m.season);
  const breakDays = allStarBreakDays(m.season);
  const host = ALL_STAR_HOSTS[m.season];
  const mvpAward = awards.find((a) => a.type === "cup_mvp");
  const mvpPlayer = mvpAward?.playerId
    ? await prisma.player.findUnique({ where: { id: mvpAward.playerId }, select: { firstName: true, lastName: true } })
    : null;

  const stages = ["qf", "sf", "final"] as const;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 lg:px-8">
      <h1 className="text-2xl font-bold tracking-tight">{t("cup.title")}</h1>
      <p className="mt-1 max-w-3xl text-sm text-muted">{t("cup.subtitle")}</p>
      <p className="mt-2 text-xs text-faint">
        {t("cup.calendar", {
          nights: cal.groupNights.map(day).join(", "),
          qf: cal.quarterfinals.map(day).join(" / "),
          sf: cal.semifinals.map(day).join(" / "),
          final: day(cal.final),
        })}
      </p>
      <p className="mt-1 text-xs text-faint">
        {t("cup.allStar", {
          date: day(asg),
          host: host ? ` (${host})` : "",
          from: day(breakDays[0]),
          to: day(breakDays[breakDays.length - 1]),
        })}
      </p>

      {!state.hasCup ? (
        <p className="mt-6 card p-4 text-sm text-muted">{t("cup.none")}</p>
      ) : (
        <>
          {state.champion && (
            <div className="mt-6 card border-accent/40 p-4">
              <p className="eyebrow">{t("cup.champion")}</p>
              <p className="mt-1 text-xl font-semibold">🏆 {full(state.champion)}</p>
              {mvpAward?.playerId && mvpPlayer && (
                <p className="mt-1 text-sm">
                  <span className="text-muted">{t("cup.mvp")} : </span>
                  <Link href={playerHref(mvpAward.playerId, mvpAward.teamId)} className="font-medium hover:underline">
                    {mvpPlayer.firstName} {mvpPlayer.lastName}
                  </Link>
                  {mvpAward.statLine && <span className="text-xs text-muted"> · {mvpAward.statLine}</span>}
                </p>
              )}
            </div>
          )}

          <section className="mt-8">
            <h2 className="text-lg font-semibold">{t("cup.knockout")}</h2>
            {state.knockout.length === 0 ? (
              <p className="mt-2 text-sm text-muted">{t("cup.tbd")}</p>
            ) : (
              <div className="mt-3 grid gap-3 md:grid-cols-3">
                {stages.map((stage) => (
                  <div key={stage} className="card p-4 text-sm">
                    <p className="eyebrow mb-2">{t(`cup.stage.${stage}`)}</p>
                    <ul className="space-y-2">
                      {state.knockout
                        .filter((g) => g.cupStage === stage)
                        .map((g) => {
                          const final = g.status === "final";
                          const homeWon = final && (g.homeScore ?? 0) > (g.awayScore ?? 0);
                          return (
                            <li key={g.id}>
                              <Link href={`/game/${g.id}`} className="block rounded-md px-2 py-1 hover:bg-surface-2">
                                <span className="text-xs text-faint">{day(g.gameDate)}</span>
                                <span className="flex justify-between">
                                  <span className={final && !homeWon ? "font-semibold" : ""}>
                                    {short(g.awayTeamId)} <span className="text-xs text-faint">{state.seeds.get(g.awayTeamId)}</span>
                                  </span>
                                  <span className="tabular">{final ? g.awayScore : ""}</span>
                                </span>
                                <span className="flex justify-between">
                                  <span className={homeWon ? "font-semibold" : ""}>
                                    @ {short(g.homeTeamId)} <span className="text-xs text-faint">{state.seeds.get(g.homeTeamId)}</span>
                                  </span>
                                  <span className="tabular">{final ? g.homeScore : ""}</span>
                                </span>
                              </Link>
                            </li>
                          );
                        })}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="mt-8">
            <h2 className="text-lg font-semibold">{t("cup.groups")}</h2>
            {(["east", "west"] as const).map((conf) => (
              <div key={conf} className="mt-4">
                <p className="eyebrow mb-2">{t(`cup.conf.${conf}`)}</p>
                <div className="grid gap-3 md:grid-cols-3">
                  {state.groups
                    .filter((g) => g.conference === conf)
                    .map((g) => (
                      <div key={g.group} className="card p-3 text-sm">
                        <p className="mb-2 flex justify-between font-semibold">
                          <span>{g.group}</span>
                          <span className="text-xs font-normal text-faint">
                            {g.played}/{g.total}
                          </span>
                        </p>
                        <table className="w-full">
                          <thead>
                            <tr className="text-xs text-muted">
                              <th className="text-left font-normal">{t("cup.col.team")}</th>
                              <th className="text-right font-normal">{t("cup.col.record")}</th>
                              <th className="text-right font-normal">{t("cup.col.diff")}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {g.rows.map((row, i) => {
                              const seed = state.seeds.get(row.teamId);
                              const mine = row.teamId === m.teamId;
                              return (
                                <tr key={row.teamId} className={mine ? "font-semibold text-accent-text" : ""}>
                                  <td className="py-0.5">
                                    <Link href={`/teams/${row.teamId}`} className="hover:underline">
                                      {short(row.teamId)}
                                    </Link>
                                    {seed && (
                                      <span className="ml-1 rounded bg-good/15 px-1 text-[10px] text-good">
                                        {i === 0 ? t("cup.qualified") : t("cup.wildcard")}
                                      </span>
                                    )}
                                  </td>
                                  <td className="text-right tabular">
                                    {row.wins}-{row.losses}
                                  </td>
                                  <td className="text-right tabular">
                                    {row.pointDiff > 0 ? `+${row.pointDiff}` : row.pointDiff}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    ))}
                </div>
              </div>
            ))}
          </section>
        </>
      )}
    </div>
  );
}
