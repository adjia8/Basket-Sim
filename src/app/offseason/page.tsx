import Link from "next/link";
import { getCurrentMembership } from "@/lib/auth/dal";
import { prisma } from "@/lib/prisma";
import { getTranslator } from "@/lib/i18n/translate";
import type { DictionaryKey } from "@/lib/i18n/dictionary";
import { getOrAdvancePlayoffs } from "@/lib/data-access/playoffs";
import { getTeamsByLeague } from "@/lib/data-access/teams";
import { getAwards } from "@/lib/data-access/awards";
import { getOffseasonOutlook, getOffseasonView, maybeChampionCeremony, type SeriesSummary } from "@/lib/data-access/offseason";
import { ensureGmContract, standingParts } from "@/lib/data-access/gm-career";
import { advanceSeason } from "@/app/actions/season";
import { chooseSeasonPlan, holdBoardMeeting } from "@/app/actions/offseason";
import { ALL_NBA, MAJOR_AWARDS } from "@/lib/careers/awards-rules";
import { awardName } from "@/lib/careers/news-rules";
import { ownerMood, parseSeasonReview, SEASON_PLANS } from "@/lib/careers/offseason-rules";
import { tierIndex } from "@/lib/careers/gm-rules";
import { neutralTone, toneClass, type ScaleTone } from "@/lib/color-scale";
import { formatSalary, playerHref, teamFullName } from "@/lib/utils";

const ROUND_KEYS: Record<string, DictionaryKey> = {
  "round-1": "playoffsPage.round.round1",
  "conf-semis": "playoffsPage.round.confSemis",
  "conf-finals": "playoffsPage.round.confFinals",
  semifinals: "playoffsPage.round.semifinals",
  finals: "playoffsPage.round.finals",
  "play-in-7-8": "playoffsPage.round.playIn78",
  "play-in-9-10": "playoffsPage.round.playIn910",
  "play-in-final": "playoffsPage.round.playInFinal",
};

const OUTCOME_TONES: Record<string, ScaleTone> = { met: "good", exceeded: "good", warning: "average", fired: "bad" };
const OUTCOME_KEYS: Record<string, DictionaryKey> = {
  met: "gm.outcomeMet",
  exceeded: "gm.outcomeExceeded",
  warning: "gm.outcomeWarning",
  fired: "gm.outcomeFired",
};

export default async function OffseasonPage() {
  const m = await getCurrentMembership();
  const { t, locale } = await getTranslator();
  const women = m.leagueId === "wnba";

  const playoffs = await getOrAdvancePlayoffs(m.careerId, m.season, m.leagueId);
  if (!playoffs?.champion) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <h1 className="text-2xl font-bold">{t("offseason.title")}</h1>
        <p className="mt-2 text-soft">{t("offseason.notReady")}</p>
        <Link href="/playoffs" className="mt-4 inline-block rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-fg">
          {t("offseason.backPlayoffs")}
        </Link>
      </div>
    );
  }
  await maybeChampionCeremony(m.careerId, m.leagueId, m.season, locale);

  const [view, outlook, teams, awards, membership] = await Promise.all([
    getOffseasonView(m.careerId, m.leagueId, m.season, m.teamId),
    getOffseasonOutlook(m.careerId, m.leagueId, m.season, m.teamId),
    getTeamsByLeague(m.leagueId),
    getAwards(m.careerId),
    prisma.membership.findUnique({ where: { id: m.id }, include: { gmProfile: true } }),
  ]);
  if (!view) return null;
  const gm = membership?.gmProfile ?? null;
  const teamById = new Map(teams.map((x) => [x.id, x]));
  const name = (id: string) => {
    const x = teamById.get(id);
    return x ? teamFullName(x) : id;
  };
  const abbr = (id: string) => teamById.get(id)?.abbreviation ?? id;
  const seasonAwards = awards.filter((a) => a.season === m.season);
  const finalsMvp = seasonAwards.find((a) => a.type === "finals_mvp");
  const myChampion = view.championTeamId === m.teamId;
  const tier = (v: string) => t(`domain.expectationTier.${v}` as DictionaryKey);

  const review = gm ? parseSeasonReview(gm.seasonReviewJson) : null;
  const meeting = review?.season === m.season ? review : null;
  const [parts, contract] = gm && meeting ? await Promise.all([standingParts(m.careerId, m.teamId, gm), ensureGmContract(gm, m.leagueId, m.teamId)]) : [null, null];

  const seriesRow = (s: SeriesSummary) => (
    <li key={`${s.round}-${s.winnerTeamId}`} className="flex flex-wrap items-baseline gap-x-2 text-sm">
      <span className={`font-semibold ${s.winnerTeamId === m.teamId ? "text-accent" : ""}`}>
        ({s.winnerSeed}) {abbr(s.winnerTeamId)}
      </span>
      <span className="tabular font-semibold">
        {s.winnerWins}-{s.loserWins}
      </span>
      <span className={s.loserTeamId === m.teamId ? "text-accent" : "text-muted"}>
        ({s.loserSeed}) {abbr(s.loserTeamId)}
      </span>
    </li>
  );
  const roundOrder = [...new Set(view.rounds.map((s) => s.round))];

  return (
    <div className="mx-auto max-w-6xl space-y-10 px-4 py-8 lg:px-8" data-testid="offseason-page">
      {/* 1. Le champion */}
      <section className="card relative overflow-hidden px-6 py-8 text-center">
        <p className="eyebrow">{t("offseason.eyebrow", { season: m.season })}</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight" data-testid="offseason-champion">
          🏆 {t("offseason.championTitle", { team: name(view.championTeamId), league: women ? "WNBA" : "NBA" })}
        </h1>
        {view.finals && (
          <p className="mt-2 text-soft">
            {t("offseason.championSub", { score: `${view.finals.winnerWins}-${view.finals.loserWins}`, opponent: name(view.finals.loserTeamId) })}
          </p>
        )}
        {myChampion && <p className="mx-auto mt-4 max-w-2xl rounded-md bg-accent/10 px-4 py-3 font-medium">{t("offseason.myTitle")}</p>}
        {finalsMvp?.playerId && (
          <div className="mx-auto mt-6 max-w-md card px-4 py-3">
            <p className="eyebrow">{t("offseason.finalsMvp")}</p>
            <p className="mt-1 text-lg font-semibold">
              <Link href={playerHref(finalsMvp.playerId, finalsMvp.teamId)} className="hover:underline">
                {finalsMvp.playerName}
              </Link>
            </p>
            {finalsMvp.statLine && <p className="text-sm text-muted">{t("offseason.finalsMvpLine", { line: finalsMvp.statLine })}</p>}
          </div>
        )}
      </section>

      {/* 2. Parcours des playoffs */}
      <section>
        <h2 className="mb-3 text-xl font-semibold">{t("offseason.runTitle")}</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {roundOrder.map((round) => (
            <div key={round} className="card p-4">
              <p className="eyebrow mb-2">{t(ROUND_KEYS[round] ?? "playoffsPage.round.finals")}</p>
              <ul className="space-y-1">{view.rounds.filter((s) => s.round === round).map(seriesRow)}</ul>
            </div>
          ))}
        </div>
      </section>

      {/* 3. Trophées */}
      <section>
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-xl font-semibold">{t("offseason.awardsTitle")}</h2>
          <Link href="/awards" className="text-sm text-accent hover:underline">
            {t("offseason.awardsAll")}
          </Link>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {MAJOR_AWARDS.map((type) => {
            const w = seasonAwards.find((a) => a.type === type && a.rank === 1);
            if (!w) return null;
            const mine = w.teamId === m.teamId;
            return (
              <div key={type} className={`card p-4 text-sm ${mine ? "ring-2 ring-accent" : ""}`}>
                <p className="eyebrow">{awardName(type, locale, women)}</p>
                <p className="mt-1 text-base">
                  {w.playerId ? (
                    <Link href={playerHref(w.playerId, w.teamId)} className="font-semibold hover:underline">
                      {w.playerName}
                    </Link>
                  ) : (
                    <span className="font-semibold">{w.label}</span>
                  )}{" "}
                  <span className="text-xs text-muted">{abbr(w.teamId)}</span>
                  {mine && <span className="ml-2 rounded-full bg-accent/15 px-2 py-0.5 text-xs font-medium text-accent">{t("offseason.yours")}</span>}
                </p>
                {w.statLine && <p className="text-xs text-muted">{w.statLine}</p>}
              </div>
            );
          })}
        </div>
        {seasonAwards.some((a) => ALL_NBA.includes(a.type)) && (
          <div className="card mt-3 p-4 text-sm">
            <p className="eyebrow mb-2">{women ? "All-WNBA" : t("offseason.allLeague")}</p>
            <ul className="space-y-1">
              {ALL_NBA.map((type) => (
                <li key={type}>
                  <span className="text-muted">{awardName(type, locale, women)} : </span>
                  {seasonAwards
                    .filter((a) => a.type === type)
                    .map((a, i) => (
                      <span key={a.id} className={a.teamId === m.teamId ? "font-semibold text-accent" : ""}>
                        {i > 0 && ", "}
                        {a.playerName}
                      </span>
                    ))}
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {/* 4. Leaders */}
      {view.leaders.length > 0 && (
        <section>
          <h2 className="mb-3 text-xl font-semibold">{t("offseason.leadersTitle")}</h2>
          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {view.leaders.map((l) => (
              <div key={l.key} className="card p-4 text-sm">
                <p className="eyebrow">{t(`offseason.leader.${l.key}` as DictionaryKey)}</p>
                <p className="mt-1 text-2xl font-bold tabular">{l.value.toFixed(1).replace(".", locale === "fr" ? "," : ".")}</p>
                <Link href={playerHref(l.playerId, l.teamId)} className={`hover:underline ${l.teamId === m.teamId ? "font-semibold text-accent" : ""}`}>
                  {l.name}
                </Link>{" "}
                <span className="text-xs text-muted">{abbr(l.teamId)}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 5. Ma saison */}
      <section>
        <h2 className="mb-3 text-xl font-semibold">{t("offseason.mySeasonTitle")}</h2>
        <div className="grid gap-3 lg:grid-cols-2">
          <div className="card p-4 text-sm">
            <dl className="grid grid-cols-2 gap-y-2">
              <dt className="text-muted">{t("offseason.record")}</dt>
              <dd className="font-semibold tabular">
                {view.myRecord.wins}-{view.myRecord.losses}
              </dd>
              {view.myRecord.confRank && (
                <>
                  <dt className="text-muted">{t("offseason.confRank")}</dt>
                  <dd className="font-semibold tabular">{view.myRecord.confRank}</dd>
                </>
              )}
              <dt className="text-muted">{t("offseason.leagueRank")}</dt>
              <dd className="font-semibold tabular">{view.myRecord.leagueRank}</dd>
              <dt className="text-muted">{t("offseason.result")}</dt>
              <dd className="font-semibold">{tier(view.myResult)}</dd>
              {view.myTopScorer && (
                <>
                  <dt className="text-muted">{t("offseason.topScorer")}</dt>
                  <dd>
                    <Link href={playerHref(view.myTopScorer.playerId, m.teamId)} className="font-semibold hover:underline">
                      {view.myTopScorer.name}
                    </Link>{" "}
                    <span className="text-muted tabular">({view.myTopScorer.ppg.toFixed(1).replace(".", locale === "fr" ? "," : ".")} pts)</span>
                  </dd>
                </>
              )}
            </dl>
          </div>
          <div className="card p-4 text-sm">
            <p className="eyebrow mb-2">{t("offseason.myRunTitle")}</p>
            {view.myRun.length === 0 ? (
              <p className="text-muted">{t("offseason.myRunNone")}</p>
            ) : (
              <ul className="space-y-1">
                {view.myRun.map((s) => (
                  <li key={s.round} className="flex flex-wrap gap-x-2">
                    <span className="text-muted">{t(ROUND_KEYS[s.round] ?? "playoffsPage.round.finals")}</span>
                    <span>{s.winnerTeamId === m.teamId ? abbr(s.loserTeamId) : abbr(s.winnerTeamId)}</span>
                    <span className="tabular font-semibold">
                      {s.winnerTeamId === m.teamId ? `${s.winnerWins}-${s.loserWins}` : `${s.loserWins}-${s.winnerWins}`}
                    </span>
                    <span className={s.winnerTeamId === m.teamId ? toneClass("good") : toneClass("bad")}>
                      {s.winnerTeamId === m.teamId ? t("offseason.won") : t("offseason.lost")}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </section>

      {/* 6. L'intersaison qui s'annonce */}
      <section className="space-y-4" data-testid="offseason-outlook">
        <div>
          <h2 className="text-xl font-semibold">{t("offseason.outlook.title")}</h2>
          <p className="mt-1 text-sm text-soft">{t("offseason.outlook.intro")}</p>
        </div>

        {/* Retraites */}
        <div className="card p-4" data-testid="outlook-retirees">
          <h3 className="text-lg font-semibold">{t("offseason.outlook.retireTitle")}</h3>
          {outlook.retirees.length === 0 ? (
            <p className="mt-1 text-sm text-muted">{t("offseason.outlook.retireNone")}</p>
          ) : (
            <ul className="mt-2 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
              {outlook.retirees.map((r) => (
                <li key={r.playerId} className={r.teamId === m.teamId ? "font-semibold text-accent" : ""}>
                  <Link href={playerHref(r.playerId, r.teamId)} className="hover:underline">
                    {r.name}
                  </Link>{" "}
                  <span className="text-xs text-muted">
                    {r.teamId ? abbr(r.teamId) : t("offseason.outlook.noTeam")} · {t("offseason.outlook.ageShort", { age: r.age })} · {t("offseason.outlook.peak", { peak: r.peak })}
                  </span>
                  {r.hallOfFame && (
                    <span className="ml-2 rounded-full bg-warn/10 px-2 py-0.5 text-xs font-medium text-warn">{t("offseason.outlook.hof")}</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Agents libres */}
        <div className="card p-4" data-testid="outlook-free-agents">
          <h3 className="text-lg font-semibold">{t("offseason.outlook.faTitle")}</h3>
          <div className="mt-2 grid gap-4 lg:grid-cols-2">
            <div>
              <p className="eyebrow mb-1">{t("offseason.outlook.faMine")}</p>
              {outlook.myExpiring.length === 0 ? (
                <p className="text-sm text-muted">{t("offseason.outlook.faMineNone")}</p>
              ) : (
                <>
                  <ul className="space-y-1 text-sm">
                    {outlook.myExpiring.map((e) => (
                      <li key={e.playerId}>
                        <Link href={playerHref(e.playerId, m.teamId)} className="font-medium hover:underline">
                          {e.name}
                        </Link>{" "}
                        <span className="text-xs text-muted">
                          {e.position} · {t("offseason.outlook.ageShort", { age: e.age })} · {e.overall} · {formatSalary(e.salary, locale)}
                        </span>
                        {e.option && <span className="ml-2 text-xs text-warn">{t(`offseason.outlook.option.${e.option}` as DictionaryKey)}</span>}
                      </li>
                    ))}
                  </ul>
                  <p className="mt-2 text-xs text-soft">{t("offseason.outlook.faMineHint")}</p>
                </>
              )}
            </div>
            <div>
              <p className="eyebrow mb-1">{t("offseason.outlook.faLeague", { count: outlook.expiringCount })}</p>
              <ul className="space-y-1 text-sm">
                {outlook.leagueExpiring.map((e) => (
                  <li key={e.playerId}>
                    <Link href={playerHref(e.playerId, e.teamId)} className="hover:underline">
                      {e.name}
                    </Link>{" "}
                    <span className="text-xs text-muted">
                      {e.teamId ? abbr(e.teamId) : ""} · {e.position} · {t("offseason.outlook.ageShort", { age: e.age })} · <span className="font-semibold">{e.overall}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        {/* Classe de draft */}
        <div className="card p-4" data-testid="outlook-draft">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="text-lg font-semibold">{t("offseason.outlook.draftTitle", { season: outlook.draftSeason })}</h3>
            <Link href="/draft" className="text-sm text-accent hover:underline">
              {t("offseason.outlook.draftLink")}
            </Link>
          </div>
          <p className="mt-1 text-xs text-soft">{t("offseason.outlook.draftHint")}</p>
          <div className="mt-2 overflow-x-auto">
            <table className="data-table w-full min-w-[560px] text-left text-sm">
              <thead>
                <tr className="border-b border-line text-muted">
                  <th className="py-1.5 pr-3">#</th>
                  <th className="py-1.5 pr-3">{t("offseason.outlook.col.player")}</th>
                  <th className="py-1.5 pr-3">{t("offseason.outlook.col.age")}</th>
                  <th className="py-1.5 pr-3">{t("offseason.outlook.col.origin")}</th>
                  <th className="py-1.5 pr-3">{t("offseason.outlook.col.current")}</th>
                  <th className="py-1.5">{t("offseason.outlook.col.potential")}</th>
                </tr>
              </thead>
              <tbody>
                {outlook.draftClass.map((p, i) => (
                  <tr key={p.id} className="border-b border-line-soft">
                    <td className="py-1.5 pr-3 text-faint tabular">{i + 1}</td>
                    <td className="py-1.5 pr-3 font-medium">
                      {p.name} <span className="text-xs text-muted">{p.position}</span>
                    </td>
                    <td className="py-1.5 pr-3 tabular">{p.age}</td>
                    <td className="py-1.5 pr-3 text-xs text-soft">{p.origin ?? p.nationality}</td>
                    <td className="py-1.5 pr-3 tabular">
                      {p.current.low}-{p.current.high}
                    </td>
                    <td className="py-1.5 tabular font-semibold">
                      {p.potential.low}-{p.potential.high}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Demandes de transfert */}
        <div className="card p-4" data-testid="outlook-requests">
          <h3 className="text-lg font-semibold">{t("offseason.outlook.requestsTitle")}</h3>
          <div className="mt-2 grid gap-4 lg:grid-cols-2">
            {([
              ["offseason.outlook.requestsMine", "offseason.outlook.requestsMineNone", outlook.myRequests],
              ["offseason.outlook.requestsOthers", "offseason.outlook.requestsOthersNone", outlook.otherRequests],
            ] as const).map(([title, none, list]) => (
              <div key={title}>
                <p className="eyebrow mb-1">{t(title)}</p>
                {list.length === 0 ? (
                  <p className="text-sm text-muted">{t(none)}</p>
                ) : (
                  <ul className="space-y-1.5 text-sm">
                    {list.map((r) => (
                      <li key={r.playerId}>
                        <Link href={playerHref(r.playerId, r.teamId)} className="font-medium hover:underline">
                          {r.name}
                        </Link>{" "}
                        <span className="text-xs text-muted">
                          {r.teamId ? abbr(r.teamId) : ""} · {r.position} · {t("offseason.outlook.ageShort", { age: r.age })} · {r.overall}
                        </span>
                        <span className="block text-xs text-soft">
                          {r.reasons.map((reason) => t(`domain.tradeReason.${reason}` as DictionaryKey)).join(" · ")}
                          {r.promised && <span className="ml-1 text-faint">({t("offseason.outlook.promised")})</span>}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 7. Réunion avec la direction */}
      {gm && (
        <section className="card p-6" data-testid="board-meeting">
          <h2 className="text-xl font-semibold">{t("offseason.boardTitle")}</h2>
          {!meeting ? (
            <div className="mt-2">
              <p className="text-soft">{t("offseason.boardIntro")}</p>
              <form action={holdBoardMeeting} className="mt-4">
                <button type="submit" className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-fg hover:bg-accent-hover" data-testid="board-enter">
                  {t("offseason.boardEnter")}
                </button>
              </form>
            </div>
          ) : (
            <div className="mt-3 space-y-5">
              <blockquote className="border-l-4 border-accent pl-4 text-base italic" data-testid="board-speech">
                {t(`offseason.mood.${ownerMood(meeting.outcome, meeting.result === "champion", tierIndex(meeting.result) < tierIndex(meeting.expectation))}` as DictionaryKey, {
                  expectation: tier(meeting.expectation).toLowerCase(),
                  result: tier(meeting.result).toLowerCase(),
                })}
              </blockquote>

              <div className="grid gap-4 lg:grid-cols-2">
                <div>
                  <p className="eyebrow mb-2">{t("offseason.factors")}</p>
                  <dl className="grid grid-cols-2 gap-y-1 text-sm">
                    <dt className="text-muted">{t("offseason.factor.expectation")}</dt>
                    <dd>{tier(meeting.expectation)}</dd>
                    <dt className="text-muted">{t("offseason.factor.result")}</dt>
                    <dd className="font-semibold">{tier(meeting.result)}</dd>
                    <dt className="text-muted">{t("offseason.factor.objectives")}</dt>
                    <dd>{meeting.objectivesTotal > 0 ? `${meeting.objectivesMet}/${meeting.objectivesTotal}` : t("offseason.factor.objectivesNone")}</dd>
                    <dt className="text-muted">{t("offseason.factor.finances")}</dt>
                    <dd className={meeting.financesNegative ? toneClass("bad") : ""}>
                      {meeting.financesNegative ? t("offseason.factor.financesBad") : t("offseason.factor.financesOk")}
                    </dd>
                    <dt className="text-muted">{t("offseason.factor.approval")}</dt>
                    <dd className={`tabular ${toneClass(neutralTone(meeting.approval))}`}>{meeting.approval}/99</dd>
                    <dt className="text-muted">{t("offseason.verdict")}</dt>
                    <dd className={`font-bold ${toneClass(OUTCOME_TONES[meeting.outcome] ?? "average")}`} data-testid="board-verdict">
                      {t(OUTCOME_KEYS[meeting.outcome])}
                    </dd>
                  </dl>
                </div>
                {parts && (
                  <div>
                    <p className="eyebrow mb-2">{t("offseason.standingTitle")}</p>
                    <dl className="grid grid-cols-2 gap-y-1 text-sm">
                      {(["board", "players", "press", "fans"] as const).map((k) => (
                        <div key={k} className="contents">
                          <dt className="text-muted">{t(`offseason.part.${k}` as DictionaryKey)}</dt>
                          <dd className={`tabular ${toneClass(neutralTone(parts[k]))}`}>{parts[k]}/99</dd>
                        </div>
                      ))}
                    </dl>
                    {contract && meeting.outcome !== "fired" && (
                      <p className="mt-3 text-sm text-soft">
                        {contract.years <= 1
                          ? t("offseason.contractLast")
                          : t("offseason.contract", { salary: formatSalary(contract.salary, locale), years: contract.years - 1 })}
                      </p>
                    )}
                  </div>
                )}
              </div>

              {meeting.outcome === "fired" ? (
                <p className="text-sm text-soft">{t("offseason.firedText")}</p>
              ) : meeting.plan ? (
                <div className="rounded-md bg-surface-2 px-4 py-3 text-sm" data-testid="board-plan">
                  <p className="font-semibold">{t("offseason.planChosen", { plan: t(`offseason.plan.${meeting.plan}` as DictionaryKey) })}</p>
                  <p className="mt-1 italic">{t(`offseason.planReply.${meeting.plan}` as DictionaryKey)}</p>
                </div>
              ) : (
                <div>
                  <p className="font-medium italic">{t("offseason.planQuestion")}</p>
                  <div className="mt-3 grid gap-3 md:grid-cols-3">
                    {SEASON_PLANS.map((plan) => (
                      <form key={plan} action={chooseSeasonPlan} className="card flex flex-col p-4">
                        <input type="hidden" name="plan" value={plan} />
                        <p className="font-semibold">{t(`offseason.plan.${plan}` as DictionaryKey)}</p>
                        <p className="mt-1 flex-1 text-xs text-soft">{t(`offseason.plan.${plan}Desc` as DictionaryKey)}</p>
                        <button
                          type="submit"
                          className="mt-3 rounded-md border border-line px-3 py-1.5 text-sm font-medium hover:bg-surface-2"
                          data-testid={`plan-${plan}`}
                        >
                          {t(`offseason.plan.${plan}` as DictionaryKey)}
                        </button>
                      </form>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </section>
      )}

      {/* 8. Suite */}
      <section className="card bg-surface-2 p-6">
        <h2 className="text-xl font-semibold">{t("offseason.nextTitle")}</h2>
        <p className="mt-2 text-sm text-soft">{t("offseason.nextText")}</p>
        {gm && !meeting ? (
          <p className="mt-4 text-sm font-medium text-warn">{t("offseason.nextNeedsMeeting")}</p>
        ) : (
          <form action={advanceSeason} className="mt-4">
            <button type="submit" className="rounded-md bg-accent px-5 py-2 text-sm font-semibold text-accent-fg hover:bg-accent-hover" data-testid="offseason-advance">
              {t("offseason.nextButton")}
            </button>
          </form>
        )}
      </section>
    </div>
  );
}
