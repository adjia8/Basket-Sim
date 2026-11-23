import "server-only";
import { prisma } from "@/lib/prisma";
import { applyAwardEffects, saveAwardsOnce, type AwardDraft } from "@/lib/data-access/awards";
import { createInboxMessage } from "@/lib/data-access/inbox";
import { getPlayoffResultTier } from "@/lib/data-access/playoffs";
import { getSeasonLines } from "@/lib/data-access/season-stats";
import { getStandings } from "@/lib/data-access/standings";
import { getTeamsByLeague } from "@/lib/data-access/teams";
import { getOrCreateTeamState } from "@/lib/data-access/team-state";
import { minGamesForAwards } from "@/lib/careers/awards-rules";
import { parseBoardObjectives } from "@/lib/careers/board-objectives-rules";
import { evaluateGmSeason, type ExpectationTier } from "@/lib/careers/gm-rules";
import { championNews } from "@/lib/careers/news-rules";
import {
  finalsTotals,
  parseSeasonReview,
  pickFinalsMvp,
  type FinalsBoxLine,
  type SeasonReview,
} from "@/lib/careers/offseason-rules";
import type { Locale } from "@/lib/i18n/locale";
import { teamFullName } from "@/lib/utils";

// Fin de saison : proclamation du champion (MVP des Finales, actualité,
// message à chaque GM humain), récapitulatif de la saison, réunion avec la
// direction. Voir la page /offseason.

const playoffLabel = (season: string) => `${season}-playoffs`;

function fmtLine(t: { games: number; points: number; rebounds: number; assists: number }, locale: Locale): string {
  const f = (v: number) => (v / Math.max(1, t.games)).toFixed(1).replace(".", locale === "fr" ? "," : ".");
  return locale === "fr"
    ? `${f(t.points)} pts · ${f(t.rebounds)} reb · ${f(t.assists)} pas`
    : `${f(t.points)} pts · ${f(t.rebounds)} reb · ${f(t.assists)} ast`;
}

// Idempotent : MVP des Finales + annonce du champion, une seule fois.
export async function maybeChampionCeremony(careerId: string, leagueId: string, season: string, locale: Locale): Promise<void> {
  const finals = await prisma.playoffSeries.findFirst({
    where: { careerId, season: playoffLabel(season), round: "finals", winnerTeamId: { not: null } },
  });
  if (!finals?.winnerTeamId) return;
  if ((await prisma.award.count({ where: { careerId, season, type: "finals_mvp" } })) > 0) return;

  const champion = finals.winnerTeamId;
  const games = await prisma.game.findMany({ where: { careerId, playoffSeriesId: finals.id, status: "final" }, select: { boxScore: true } });
  const boxes = games.map((g) => {
    try {
      return (JSON.parse(g.boxScore ?? "[]") as FinalsBoxLine[]) ?? [];
    } catch {
      return [];
    }
  });
  const mvp = pickFinalsMvp(finalsTotals(boxes, champion));
  const line = mvp && mvp.games > 0 ? fmtLine(mvp, locale) : null;
  const drafts: AwardDraft[] = mvp ? [{ type: "finals_mvp", rank: 1, playerId: mvp.playerId, teamId: champion, statLine: line }] : [];
  // Sans box score exploitable, le titre est tout de même annoncé (une fois, via l'actualité).
  if (drafts.length > 0 && !(await saveAwardsOnce(careerId, season, "finals_mvp", drafts))) return;
  if (drafts.length === 0 && (await prisma.leagueNews.count({ where: { careerId, season, type: "champion" } })) > 0) return;

  const [teams, mvpPlayer, humans] = await Promise.all([
    getTeamsByLeague(leagueId),
    mvp ? prisma.player.findUnique({ where: { id: mvp.playerId }, select: { firstName: true, lastName: true } }) : null,
    prisma.membership.findMany({ where: { careerId }, select: { teamId: true } }),
  ]);
  const teamName = (id: string) => {
    const t = teams.find((x) => x.id === id);
    return t ? teamFullName(t) : id;
  };
  const loser = finals.homeTeamId === champion ? finals.awayTeamId : finals.homeTeamId;
  const champWins = finals.homeTeamId === champion ? finals.homeWins : finals.awayWins;
  const loserWins = finals.homeTeamId === champion ? finals.awayWins : finals.homeWins;
  const mvpName = mvpPlayer ? `${mvpPlayer.firstName} ${mvpPlayer.lastName}` : null;
  const news = championNews(locale, teamName(champion), teamName(loser), `${champWins}-${loserWins}`, mvpName, line, leagueId === "wnba");

  await Promise.all([
    applyAwardEffects(careerId, drafts),
    prisma.leagueNews.create({ data: { careerId, season, type: "champion", title: news.title, body: news.body, teamId: champion, playerId: mvp?.playerId ?? null } }),
  ]);
  for (const h of humans) {
    await createInboxMessage(careerId, h.teamId, season, "season_end", news.title, `${news.body}\n\n${locale === "fr" ? "La cérémonie de fin de saison t'attend : trophées, bilan et réunion avec la direction." : "The end-of-season ceremony awaits: trophies, review and a meeting with ownership."}`, "/offseason");
  }
}

// ---------------------------------------------------------------------------
// Vue de la page /offseason.

export interface SeriesSummary {
  round: string;
  conference: string | null;
  winnerTeamId: string;
  loserTeamId: string;
  winnerWins: number;
  loserWins: number;
  winnerSeed: number;
  loserSeed: number;
}

export interface Leader {
  key: "ppg" | "rpg" | "apg" | "spg" | "bpg";
  playerId: string;
  name: string;
  teamId: string;
  value: number;
}

export interface OffseasonView {
  championTeamId: string;
  finals: SeriesSummary | null;
  rounds: SeriesSummary[];
  leaders: Leader[];
  myRecord: { wins: number; losses: number; confRank: number | null; leagueRank: number };
  myResult: ExpectationTier;
  myRun: SeriesSummary[];
  myTopScorer: { playerId: string; name: string; ppg: number } | null;
}

export async function getOffseasonView(
  careerId: string,
  leagueId: string,
  season: string,
  teamId: string
): Promise<OffseasonView | null> {
  const [series, standings, teams, lines, myResult] = await Promise.all([
    prisma.playoffSeries.findMany({ where: { careerId, season: playoffLabel(season) } }),
    getStandings(careerId, leagueId, season),
    getTeamsByLeague(leagueId),
    getSeasonLines(careerId, season),
    getPlayoffResultTier(careerId, season, teamId),
  ]);
  const finalsRow = series.find((s) => s.round === "finals" && s.winnerTeamId);
  if (!finalsRow?.winnerTeamId) return null;

  const summarize = (s: (typeof series)[number]): SeriesSummary | null => {
    if (!s.winnerTeamId) return null;
    const homeWon = s.winnerTeamId === s.homeTeamId;
    return {
      round: s.round,
      conference: s.conference,
      winnerTeamId: s.winnerTeamId,
      loserTeamId: homeWon ? s.awayTeamId : s.homeTeamId,
      winnerWins: homeWon ? s.homeWins : s.awayWins,
      loserWins: homeWon ? s.awayWins : s.homeWins,
      winnerSeed: homeWon ? s.homeSeed : s.awaySeed,
      loserSeed: homeWon ? s.awaySeed : s.homeSeed,
    };
  };
  const ORDER = ["play-in-7-8", "play-in-9-10", "play-in-final", "round-1", "conf-semis", "semifinals", "conf-finals", "finals"];
  const all = series
    .map(summarize)
    .filter((s): s is SeriesSummary => !!s)
    .sort((a, b) => ORDER.indexOf(a.round) - ORDER.indexOf(b.round) || (a.conference ?? "").localeCompare(b.conference ?? "") || a.winnerSeed - b.winnerSeed);
  const rounds = all.filter((s) => !s.round.startsWith("play-in"));

  // Classement : rang dans la conférence et dans la ligue.
  const sorted = [...standings].sort((a, b) => b.wins - a.wins || a.losses - b.losses);
  const mine = standings.find((r) => r.teamId === teamId);
  const conferenceOf = new Map(teams.map((t) => [t.id, t.conferenceId]));
  const myConf = conferenceOf.get(teamId);
  const confRows = sorted.filter((r) => conferenceOf.get(r.teamId) === myConf);
  const confRank = myConf && confRows.length < sorted.length ? confRows.findIndex((r) => r.teamId === teamId) + 1 : null;

  const minGames = minGamesForAwards(lines);
  const eligible = lines.filter((l) => l.gamesPlayed >= minGames);
  const leaders: Leader[] = (["ppg", "rpg", "apg", "spg", "bpg"] as const).flatMap((key) => {
    const best = [...eligible].sort((a, b) => b[key] - a[key])[0];
    return best ? [{ key, playerId: best.playerId, name: best.name, teamId: best.teamId, value: best[key] }] : [];
  });
  const myTop = lines.filter((l) => l.teamId === teamId && l.gamesPlayed >= minGames).sort((a, b) => b.ppg - a.ppg)[0];

  return {
    championTeamId: finalsRow.winnerTeamId,
    finals: summarize(finalsRow),
    rounds,
    leaders,
    myRecord: {
      wins: mine?.wins ?? 0,
      losses: mine?.losses ?? 0,
      confRank,
      leagueRank: sorted.findIndex((r) => r.teamId === teamId) + 1,
    },
    myResult,
    myRun: all.filter((s) => s.winnerTeamId === teamId || s.loserTeamId === teamId),
    myTopScorer: myTop ? { playerId: myTop.playerId, name: myTop.name, ppg: myTop.ppg } : null,
  };
}


// ---------------------------------------------------------------------------
// Réunion avec la direction : verdict calculé (mêmes règles que la fin de
// saison, voir evaluateGmSeason) et figé — advanceSeason le reprend tel quel.

export async function computeSeasonReview(
  careerId: string,
  leagueId: string,
  season: string,
  teamId: string,
  gm: {
    currentExpectationTier: string;
    warningsAtCurrentTeam: number;
    frontOfficeApproval: number;
    boardObjectivesJson: string | null;
    seasonReviewJson: string | null;
  }
): Promise<SeasonReview> {
  const existing = parseSeasonReview(gm.seasonReviewJson);
  if (existing?.season === season) return existing;
  const [result, teamState] = await Promise.all([
    getPlayoffResultTier(careerId, season, teamId),
    getOrCreateTeamState(careerId, teamId, leagueId),
  ]);
  const expectation = gm.currentExpectationTier as ExpectationTier;
  const financesNegative = teamState.finances < 0;
  const { gap, outcome } = evaluateGmSeason(expectation, result, financesNegative, gm.warningsAtCurrentTeam, gm.frontOfficeApproval);
  const objectives = parseBoardObjectives(gm.boardObjectivesJson);
  const judged = objectives?.season === season ? objectives.objectives : [];
  return {
    season,
    outcome,
    gap,
    expectation,
    result,
    financesNegative,
    approval: gm.frontOfficeApproval,
    objectivesMet: judged.filter((o) => o.status === "met").length,
    objectivesTotal: judged.length,
    plan: null,
  };
}
