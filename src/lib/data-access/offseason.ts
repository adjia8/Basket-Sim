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
import { generateProspectClass } from "@/lib/careers/generate-prospects";
import { nextSeasonLabel } from "@/lib/careers/season-format";
import { retirementPlanned } from "@/lib/careers/aging-rules";
import { isHallOfFameWorthy } from "@/lib/careers/hall-of-fame-rules";
import { tradeRequestReasons, winPctForStandings, type TradeRequestReason } from "@/lib/careers/player-demands";
import { ambitiousWantsOut, personalityFor, tradeRequestChanceMultiplier } from "@/lib/careers/personality-rules";
import { tradeRequestMessageText } from "@/lib/careers/inbox-rules";
import { estimateRating, type Estimate } from "@/lib/careers/potential-rules";
import { NEUTRAL_STAFF_PROFILE } from "@/lib/careers/staff-rules";
import { aiRespondToTradeRequest } from "@/lib/data-access/trade-requests";
import { getStaffProfiles } from "@/lib/data-access/staff";
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
  // Intersaison qui s'annonce : la classe de draft est révélée, et les
  // joueurs mécontents font savoir qu'ils veulent partir.
  await ensureDraftClass(careerId, leagueId, nextSeasonLabel(season), teams.length * 2);
  await offseasonTradeRequests(careerId, leagueId, season, locale, new Set(humans.map((h) => h.teamId)));
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

// ---------------------------------------------------------------------------
// Intersaison qui s'annonce.

// Classe de draft de la saison suivante, générée une seule fois (révélée dès
// la fin de saison ; advanceSeason la reprend telle quelle).
export async function ensureDraftClass(careerId: string, leagueId: string, draftSeason: string, size: number): Promise<void> {
  if ((await prisma.prospect.count({ where: { careerId, draftSeason } })) > 0) return;
  await prisma.prospect.deleteMany({ where: { careerId } });
  await generateProspectClass(careerId, leagueId, size, draftSeason);
  await prisma.prospect.updateMany({ where: { careerId, draftSeason: null }, data: { draftSeason } });
}

// Chance qu'un joueur insatisfait réclame son départ à l'été (plus élevée
// qu'en cours de saison : c'est le moment des bilans), au plus une par équipe.
export const OFFSEASON_REQUEST_CHANCE = 0.1;
const MAX_REQUESTS_PER_TEAM = 1;

async function offseasonTradeRequests(careerId: string, leagueId: string, season: string, locale: Locale, humans: Set<string>): Promise<void> {
  const [standings, teams, contracts, lastGame] = await Promise.all([
    getStandings(careerId, leagueId, season),
    getTeamsByLeague(leagueId),
    prisma.contract.findMany({ where: { careerId }, select: { playerId: true, teamId: true } }),
    prisma.game.findFirst({ where: { careerId, status: "final" }, orderBy: { gameDate: "desc" }, select: { gameDate: true } }),
  ]);
  const gameDate = lastGame?.gameDate ?? new Date();
  const teamOf = new Map(contracts.map((c) => [c.playerId, c.teamId]));
  const states = await prisma.playerState.findMany({
    where: { careerId, retired: false, wantsTrade: false, activePromiseType: null, playerId: { in: [...teamOf.keys()] } },
    include: { player: { select: { firstName: true, lastName: true } } },
  });
  const facilities = new Map(
    (await prisma.teamState.findMany({ where: { careerId }, select: { teamId: true, facilitiesLevel: true } })).map((t) => [t.teamId, t.facilitiesLevel])
  );
  const perTeam = new Map<string, number>();
  for (const st of states) {
    const teamId = teamOf.get(st.playerId)!;
    if ((perTeam.get(teamId) ?? 0) >= MAX_REQUESTS_PER_TEAM) continue;
    if (retirementPlanned(st, `${careerId}:${st.playerId}:${season}:retire`)) continue;
    const team = teams.find((t) => t.id === teamId);
    const row = standings.find((r) => r.teamId === teamId);
    if (!team) continue;
    const winPct = winPctForStandings(row?.wins ?? 0, row?.losses ?? 0);
    const reasons: TradeRequestReason[] = tradeRequestReasons({
      renown: st.renown,
      age: st.age,
      teamWinPct: winPct,
      teamMarketAppeal: team.marketAppeal,
      teamFacilitiesLevel: facilities.get(teamId) ?? 50,
      morale: st.morale,
    });
    const personality = personalityFor(st.playerId, st.age);
    if (ambitiousWantsOut(personality, winPct) && !reasons.includes("competitiveness")) reasons.push("competitiveness");
    if (reasons.length === 0 || Math.random() >= OFFSEASON_REQUEST_CHANCE * tradeRequestChanceMultiplier(personality)) continue;

    await prisma.playerState.update({
      where: { id: st.id },
      data: { wantsTrade: true, tradeRequestReasonsJson: JSON.stringify(reasons), tradeRequestSinceSeason: season, lastTradeRequestCheckDate: gameDate },
    });
    perTeam.set(teamId, (perTeam.get(teamId) ?? 0) + 1);
    const playerName = `${st.player.firstName} ${st.player.lastName}`;
    if (humans.has(teamId)) {
      const { title, body } = tradeRequestMessageText(locale, playerName);
      await createInboxMessage(careerId, teamId, season, "trade_request", title, body, `/teams/${teamId}/players/${st.playerId}`, {
        gameDate,
        playerId: st.playerId,
      });
    } else {
      // L'IA répond comme en saison, mais pour la saison qui vient.
      await aiRespondToTradeRequest({
        careerId,
        teamId,
        leagueId,
        season: nextSeasonLabel(season),
        gameDate,
        locale,
        state: st,
        reasons,
        playerName,
        teamName: teamFullName(team),
      });
    }
  }
}

export interface OutlookPlayer {
  playerId: string;
  name: string;
  teamId: string | null;
  position: string;
  age: number;
  overall: number;
}

export interface OffseasonOutlook {
  retirees: (OutlookPlayer & { peak: number; hallOfFame: boolean })[];
  myExpiring: (OutlookPlayer & { salary: number; option: string | null })[];
  leagueExpiring: (OutlookPlayer & { salary: number })[];
  expiringCount: number;
  draftClass: { id: string; name: string; position: string; age: number; origin: string | null; nationality: string; current: Estimate; potential: Estimate }[];
  draftSeason: string;
  myRequests: (OutlookPlayer & { reasons: TradeRequestReason[]; promised: boolean })[];
  otherRequests: (OutlookPlayer & { reasons: TradeRequestReason[]; promised: boolean })[];
}

export async function getOffseasonOutlook(careerId: string, leagueId: string, season: string, teamId: string): Promise<OffseasonOutlook> {
  const draftSeason = nextSeasonLabel(season);
  const [players, contracts, prospects, profiles] = await Promise.all([
    prisma.player.findMany({
      where: { leagueId, OR: [{ careerId: null }, { careerId }] },
      select: { id: true, firstName: true, lastName: true, position: true, playerStates: { where: { careerId } } },
    }),
    prisma.contract.findMany({ where: { careerId }, select: { playerId: true, teamId: true, salary: true, yearsRemaining: true, optionType: true, contractType: true } }),
    prisma.prospect.findMany({ where: { careerId, draftSeason } }),
    getStaffProfiles(careerId, [teamId], leagueId),
  ]);
  const contractOf = new Map(contracts.map((c) => [c.playerId, c]));
  const retirees: OffseasonOutlook["retirees"] = [];
  const expiring: (OutlookPlayer & { salary: number; option: string | null })[] = [];
  const requests: (OutlookPlayer & { reasons: TradeRequestReason[]; promised: boolean })[] = [];
  for (const p of players) {
    const st = p.playerStates[0];
    if (!st || st.retired) continue;
    const c = contractOf.get(p.id);
    const base: OutlookPlayer = { playerId: p.id, name: `${p.firstName} ${p.lastName}`, teamId: c?.teamId ?? null, position: p.position, age: st.age, overall: st.overallRating };
    const retiring = retirementPlanned(st, `${careerId}:${p.id}:${season}:retire`);
    if (retiring) {
      // Joueurs sans club ni passage en NBA récent : seulement les noms qui comptent.
      if (c || st.overallRating >= 65 || st.peakOverallRating >= 80) {
        const peak = Math.max(st.peakOverallRating, st.overallRating);
        retirees.push({ ...base, peak, hallOfFame: isHallOfFameWorthy(peak, Math.max(st.peakRenown, st.renown)) });
      }
      continue;
    }
    if (c && c.yearsRemaining <= 1) expiring.push({ ...base, salary: c.salary, option: null });
    else if (c && c.yearsRemaining === 2 && c.optionType && c.teamId === teamId) expiring.push({ ...base, salary: c.salary, option: c.optionType });
    if (c && st.wantsTrade) {
      requests.push({
        ...base,
        reasons: st.tradeRequestReasonsJson ? (JSON.parse(st.tradeRequestReasonsJson) as TradeRequestReason[]) : [],
        promised: !!st.activePromiseType,
      });
    }
  }
  const byOverall = <T extends { overall: number }>(a: T, b: T) => b.overall - a.overall;
  const scouting = (profiles.get(teamId) ?? NEUTRAL_STAFF_PROFILE).scouting;
  const draftClass = prospects
    .map((p) => ({
      id: p.id,
      name: `${p.firstName} ${p.lastName}`,
      position: p.position,
      age: p.age,
      origin: p.scoutingNote,
      nationality: p.nationality,
      // Mêmes graines que la page Draft : mêmes estimations.
      current: estimateRating(p.overallRating, scouting, `${careerId}:${teamId}:${p.id}:cur`, 0.6),
      potential: estimateRating(p.potential || p.overallRating, scouting, `${careerId}:${teamId}:${p.id}:pot`),
    }))
    .sort((a, b) => b.current.mid * 0.6 + b.potential.mid * 0.4 - (a.current.mid * 0.6 + a.potential.mid * 0.4));
  const leagueExpiring = expiring.filter((e) => e.teamId !== teamId && !e.option);
  return {
    retirees: retirees.sort((a, b) => b.peak - a.peak),
    myExpiring: expiring.filter((e) => e.teamId === teamId).sort(byOverall),
    leagueExpiring: leagueExpiring.sort(byOverall).slice(0, 20),
    expiringCount: leagueExpiring.length,
    draftClass: draftClass.slice(0, 20),
    draftSeason,
    myRequests: requests.filter((r) => r.teamId === teamId).sort(byOverall),
    otherRequests: requests.filter((r) => r.teamId !== teamId).sort(byOverall),
  };
}
