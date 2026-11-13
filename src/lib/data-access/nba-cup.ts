import "server-only";
import { prisma } from "@/lib/prisma";
import { createInboxMessage } from "@/lib/data-access/inbox";
import { getTeamsByLeague } from "@/lib/data-access/teams";
import { PlayerStatePatches } from "@/lib/data-access/player-state-patches";
import { applyAwardEffects, notifyHumans, saveAwardsOnce, type AwardDraft } from "@/lib/data-access/awards";
import { clampMorale } from "@/lib/careers/morale-rules";
import {
  ALL_STAR_HOSTS,
  CUP_FINAL_VENUE,
  allStarGameDate,
  conferenceQualifiers,
  cupCalendar,
  cupSeasonLabel,
  groupConference,
  groupStandings,
  type CupGameResult,
  type CupStage,
  type GroupRow,
} from "@/lib/careers/nba-cup-rules";
import type { BoxScoreEntry, Team } from "@/lib/types";
import type { Locale } from "@/lib/i18n/locale";

// NBA Cup et All-Star Game : progression du tournoi au fil des matchs joués
// (voir nba-cup-rules.ts pour le format et les dates).

type GameRow = Awaited<ReturnType<typeof prisma.game.findMany>>[number];

function asResult(g: GameRow): CupGameResult | null {
  return g.homeScore == null || g.awayScore == null
    ? null
    : { homeTeamId: g.homeTeamId, awayTeamId: g.awayTeamId, homeScore: g.homeScore, awayScore: g.awayScore };
}

function winnerOf(g: GameRow): string | null {
  if (g.status !== "final" || g.homeScore == null || g.awayScore == null) return null;
  return g.homeScore > g.awayScore ? g.homeTeamId : g.awayTeamId;
}

function teamName(teamById: Map<string, Team>, id: string): string {
  const t = teamById.get(id);
  return t ? `${t.city} ${t.name}` : id;
}

export interface CupGroupTable {
  group: string;
  conference: "east" | "west";
  rows: GroupRow[];
  played: number;
  total: number;
}

export interface CupState {
  hasCup: boolean;
  groups: CupGroupTable[];
  groupStageDone: boolean;
  knockout: GameRow[];
  seeds: Map<string, string>; // teamId -> "E1".."W4"
  champion: string | null;
}

export async function getCupState(careerId: string, season: string): Promise<CupState> {
  const [groupGames, knockout] = await Promise.all([
    prisma.game.findMany({ where: { careerId, season, cupStage: "group" }, orderBy: { gameDate: "asc" } }),
    prisma.game.findMany({ where: { careerId, season: cupSeasonLabel(season) }, orderBy: { gameDate: "asc" } }),
  ]);
  const byGroup = new Map<string, GameRow[]>();
  for (const g of groupGames) (byGroup.get(g.cupGroup ?? "") ?? byGroup.set(g.cupGroup ?? "", []).get(g.cupGroup ?? "")!).push(g);
  const groups: CupGroupTable[] = [...byGroup.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([group, games]) => {
      const teams = [...new Set(games.flatMap((g) => [g.homeTeamId, g.awayTeamId]))];
      const results = games.map(asResult).filter((r): r is CupGameResult => r !== null);
      return {
        group,
        conference: groupConference(group),
        rows: groupStandings(teams, results),
        played: results.length,
        total: games.length,
      };
    });
  const groupStageDone = groups.length > 0 && groups.every((g) => g.played === g.total);
  const seeds = new Map<string, string>();
  if (groupStageDone) {
    for (const conf of ["east", "west"] as const) {
      conferenceQualifiers(groups.filter((g) => g.conference === conf).map((g) => g.rows)).forEach((row, i) =>
        seeds.set(row.teamId, `${conf === "east" ? "E" : "W"}${i + 1}`)
      );
    }
  }
  const final = knockout.find((g) => g.cupStage === "final");
  return { hasCup: groups.length > 0, groups, groupStageDone, knockout, seeds, champion: final ? winnerOf(final) : null };
}

// Date avant laquelle la simulation en lot doit s'arrêter tant que le tour
// suivant de la phase finale n'est pas créé (sinon la ligue dépasserait le
// 4 décembre avant que les quarts n'existent).
export async function cupBarrier(careerId: string, leagueId: string, season: string): Promise<Date | null> {
  if (leagueId !== "nba") return null;
  const [groupCount, stages] = await Promise.all([
    prisma.game.count({ where: { careerId, season, cupStage: "group" } }),
    prisma.game.findMany({ where: { careerId, season: cupSeasonLabel(season) }, select: { cupStage: true } }),
  ]);
  if (groupCount === 0) return null;
  const has = (s: CupStage) => stages.some((g) => g.cupStage === s);
  const cal = cupCalendar(season);
  const day = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  if (!has("qf")) return day(cal.quarterfinals[0]);
  if (!has("sf")) return day(cal.semifinals[0]);
  if (!has("final")) return day(cal.final);
  return null;
}

interface KoGame {
  home: string;
  away: string;
  date: Date;
  stage: CupStage;
  label: string;
}

async function createRoundOnce(careerId: string, leagueId: string, season: string, stage: CupStage, games: KoGame[]): Promise<boolean> {
  const label = cupSeasonLabel(season);
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`cup:${careerId}:${season}:${stage}`}))`;
    if ((await tx.game.count({ where: { careerId, season: label, cupStage: stage } })) > 0) return false;
    await tx.game.createMany({
      data: games.map((g) => ({
        careerId,
        leagueId,
        season: label,
        gameDate: g.date,
        homeTeamId: g.home,
        awayTeamId: g.away,
        status: "scheduled",
        cupStage: g.stage,
        cupGroup: g.label,
      })),
    });
    return true;
  });
}

function fr(locale: Locale): boolean {
  return locale === "fr";
}

// Fait avancer la Cup : quarts dès la fin des groupes, demies puis finale à
// la fin de chaque tour, trophées à l'issue de la finale. Renvoie true si
// des matchs impliquant un GM humain viennent d'être créés (le calendrier de
// son équipe change : l'appelant doit recalculer son prochain match).
export async function advanceNbaCup(careerId: string, leagueId: string, season: string, locale: Locale): Promise<boolean> {
  if (leagueId !== "nba") return false;
  const state = await getCupState(careerId, season);
  if (!state.hasCup || !state.groupStageDone) return false;
  const [teams, memberships] = await Promise.all([
    getTeamsByLeague(leagueId),
    prisma.membership.findMany({ where: { careerId }, select: { teamId: true } }),
  ]);
  const teamById = new Map(teams.map((t) => [t.id, t]));
  const humans = new Set(memberships.map((m) => m.teamId));
  const name = (id: string) => teamName(teamById, id);
  const cal = cupCalendar(season);
  const seedOf = (id: string) => state.seeds.get(id) ?? "";
  const better = (a: string, b: string) => (seedOf(a).slice(1) <= seedOf(b).slice(1) ? [a, b] : [b, a]);
  const stage = (s: CupStage) => state.knockout.filter((g) => g.cupStage === s);
  const done = (s: CupStage) => stage(s).length > 0 && stage(s).every((g) => g.status === "final");
  const involvesHuman = (games: KoGame[]) => games.some((g) => humans.has(g.home) || humans.has(g.away));

  if (stage("qf").length === 0) {
    const seedTeam = (seed: string) => [...state.seeds.entries()].find(([, s]) => s === seed)?.[0];
    const games: KoGame[] = [];
    (["E", "W"] as const).forEach((c, ci) => {
      for (const [a, b] of [
        [1, 4],
        [2, 3],
      ]) {
        const home = seedTeam(`${c}${a}`);
        const away = seedTeam(`${c}${b}`);
        if (home && away) games.push({ home, away, date: cal.quarterfinals[ci], stage: "qf", label: `${c}${a}-${c}${b}` });
      }
    });
    if (games.length !== 4 || !(await createRoundOnce(careerId, leagueId, season, "qf", games))) return false;
    const list = games.map((g) => `${name(g.home)} – ${name(g.away)}`).join(", ");
    await prisma.leagueNews.create({
      data: {
        careerId,
        season,
        type: "cup",
        gameDate: cal.quarterfinals[0],
        title: fr(locale) ? "NBA Cup : les quarts de finale sont connus" : "NBA Cup: quarterfinals set",
        body: fr(locale) ? `Affiches : ${list}.` : `Matchups: ${list}.`,
      },
    });
    for (const teamId of humans) {
      const qualified = state.seeds.has(teamId);
      await createInboxMessage(
        careerId,
        teamId,
        season,
        "cup",
        qualified
          ? fr(locale) ? "Qualifiés pour les quarts de la NBA Cup" : "Through to the NBA Cup quarterfinals"
          : fr(locale) ? "Éliminés de la NBA Cup" : "Out of the NBA Cup",
        qualified
          ? fr(locale)
            ? `Ton équipe est tête de série ${seedOf(teamId)} : quart de finale à élimination directe, chez la mieux classée.`
            : `Your team is seed ${seedOf(teamId)}: a single-elimination quarterfinal, hosted by the higher seed.`
          : fr(locale)
            ? "Ton équipe ne sort pas de son groupe. Ces matchs ont compté au classement de la saison régulière."
            : "Your team didn't get out of its group. Those games still counted in the regular-season standings.",
        "/cup"
      );
    }
    return involvesHuman(games);
  }

  if (stage("sf").length === 0) {
    if (!done("qf")) return false;
    const games: KoGame[] = [];
    (["E", "W"] as const).forEach((c, ci) => {
      const winners = stage("qf")
        .filter((g) => g.cupGroup?.startsWith(c))
        .map((g) => winnerOf(g)!)
        .filter(Boolean);
      if (winners.length === 2) {
        const [home, away] = better(winners[0], winners[1]);
        games.push({ home, away, date: cal.semifinals[ci], stage: "sf", label: `${seedOf(home)}-${seedOf(away)}` });
      }
    });
    if (games.length !== 2 || !(await createRoundOnce(careerId, leagueId, season, "sf", games))) return false;
    const list = games.map((g) => `${name(g.home)} – ${name(g.away)}`).join(", ");
    await prisma.leagueNews.create({
      data: {
        careerId,
        season,
        type: "cup",
        gameDate: cal.semifinals[0],
        title: fr(locale) ? "NBA Cup : place aux demi-finales" : "NBA Cup: semifinals set",
        body: fr(locale) ? `Affiches : ${list}.` : `Matchups: ${list}.`,
      },
    });
    return involvesHuman(games);
  }

  if (stage("final").length === 0) {
    if (!done("sf")) return false;
    const finalists = stage("sf").map((g) => winnerOf(g)!).filter(Boolean);
    if (finalists.length !== 2) return false;
    const [home, away] = better(finalists[0], finalists[1]);
    const games: KoGame[] = [{ home, away, date: cal.final, stage: "final", label: CUP_FINAL_VENUE }];
    if (!(await createRoundOnce(careerId, leagueId, season, "final", games))) return false;
    await prisma.leagueNews.create({
      data: {
        careerId,
        season,
        type: "cup",
        gameDate: cal.final,
        title: fr(locale) ? `Finale de la NBA Cup : ${name(home)} – ${name(away)}` : `NBA Cup final: ${name(home)} vs ${name(away)}`,
        body: fr(locale)
          ? `Rendez-vous le 11 décembre au ${CUP_FINAL_VENUE}. La finale ne compte pas au classement.`
          : `Tip-off December 11 at ${CUP_FINAL_VENUE}. The final doesn't count in the standings.`,
      },
    });
    return involvesHuman(games);
  }

  if (done("final") && state.champion) await crownChampion(careerId, season, state, teamById, humans, locale);
  return false;
}

async function crownChampion(
  careerId: string,
  season: string,
  state: CupState,
  teamById: Map<string, Team>,
  humans: Set<string>,
  locale: Locale
): Promise<void> {
  const champion = state.champion!;
  const final = state.knockout.find((g) => g.cupStage === "final")!;
  const runnerUp = final.homeTeamId === champion ? final.awayTeamId : final.homeTeamId;
  // MVP : meilleur joueur du vainqueur sur l'ensemble du tournoi.
  const groupGames = await prisma.game.findMany({
    where: { careerId, season, cupStage: "group", OR: [{ homeTeamId: champion }, { awayTeamId: champion }] },
  });
  const totals = new Map<string, { pts: number; reb: number; ast: number; gp: number }>();
  for (const g of [...groupGames, ...state.knockout]) {
    if (!g.boxScore) continue;
    for (const e of JSON.parse(g.boxScore) as BoxScoreEntry[]) {
      if (e.teamId !== champion || e.minutesPlayed <= 0) continue;
      const t = totals.get(e.playerId) ?? { pts: 0, reb: 0, ast: 0, gp: 0 };
      t.pts += e.points;
      t.reb += e.rebounds;
      t.ast += e.assists;
      t.gp += 1;
      totals.set(e.playerId, t);
    }
  }
  const best = [...totals.entries()].sort(
    ([, a], [, b]) => (b.pts + b.reb + b.ast) / b.gp - (a.pts + a.reb + a.ast) / a.gp || b.gp - a.gp
  )[0];
  const line = best
    ? fr(locale)
      ? `${(best[1].pts / best[1].gp).toFixed(1)} pts, ${(best[1].reb / best[1].gp).toFixed(1)} reb, ${(best[1].ast / best[1].gp).toFixed(1)} pd en ${best[1].gp} matchs`
      : `${(best[1].pts / best[1].gp).toFixed(1)} pts, ${(best[1].reb / best[1].gp).toFixed(1)} reb, ${(best[1].ast / best[1].gp).toFixed(1)} ast in ${best[1].gp} games`
    : null;
  const drafts: AwardDraft[] = [
    { type: "nba_cup", rank: 1, playerId: null, teamId: champion, label: teamName(teamById, champion) },
    ...(best ? [{ type: "cup_mvp" as const, rank: 1, playerId: best[0], teamId: champion, statLine: line }] : []),
  ];
  if (!(await saveAwardsOnce(careerId, season, "nba_cup", drafts))) return;

  // Moral de tout l'effectif vainqueur (+5), et retombées du MVP.
  const roster = await prisma.contract.findMany({ where: { careerId, teamId: champion }, select: { playerId: true } });
  const states = await prisma.playerState.findMany({
    where: { careerId, playerId: { in: roster.map((r) => r.playerId) } },
    select: { playerId: true, morale: true },
  });
  const patches = new PlayerStatePatches();
  for (const s of states) patches.set(s.playerId, { morale: clampMorale(s.morale + 5) });
  await patches.apply(careerId);
  await applyAwardEffects(careerId, drafts);

  const mvpName = best
    ? await prisma.player.findUnique({ where: { id: best[0] }, select: { firstName: true, lastName: true } })
    : null;
  const mvp = mvpName ? `${mvpName.firstName} ${mvpName.lastName}` : null;
  const score = `${Math.max(final.homeScore ?? 0, final.awayScore ?? 0)}-${Math.min(final.homeScore ?? 0, final.awayScore ?? 0)}`;
  await prisma.leagueNews.create({
    data: {
      careerId,
      season,
      type: "cup",
      gameDate: final.gameDate,
      teamId: champion,
      playerId: best?.[0] ?? null,
      title: fr(locale)
        ? `${teamName(teamById, champion)} remporte la NBA Cup`
        : `${teamName(teamById, champion)} win the NBA Cup`,
      body: fr(locale)
        ? `Victoire ${score} en finale contre ${teamName(teamById, runnerUp)} à Indianapolis.${mvp ? ` MVP du tournoi : ${mvp} (${line}).` : ""}`
        : `A ${score} win over ${teamName(teamById, runnerUp)} in the final in Indianapolis.${mvp ? ` Tournament MVP: ${mvp} (${line}).` : ""}`,
    },
  });
  if (humans.has(champion)) {
    await createInboxMessage(
      careerId,
      champion,
      season,
      "cup",
      fr(locale) ? "Vous remportez la NBA Cup !" : "You won the NBA Cup!",
      fr(locale)
        ? `Le trophée est à vous. Tout l'effectif savoure (moral en hausse).${mvp ? ` ${mvp} est élu MVP du tournoi.` : ""}`
        : `The trophy is yours. The whole roster is buzzing (morale up).${mvp ? ` ${mvp} is named tournament MVP.` : ""}`,
      "/cup"
    );
  }
  if (best && humans.has(champion)) {
    await notifyHumans(careerId, season, drafts.filter((d) => d.type === "cup_mvp"), humans, () => mvp ?? "", locale, false);
  }
}

// ---------------------------------------------------------------------------
// All-Star Game (NBA) : joué pendant la pause, une fois le calendrier arrivé
// au match qui suit (le temps n'avance qu'au fil des matchs joués).

export async function maybePlayAllStarGame(careerId: string, leagueId: string, season: string, locale: Locale): Promise<void> {
  if (leagueId !== "nba") return;
  const gameDate = allStarGameDate(season);
  const [lastPlayed, done, allStars, teams, memberships] = await Promise.all([
    prisma.game.findFirst({ where: { careerId, season, status: "final" }, orderBy: { gameDate: "desc" }, select: { gameDate: true } }),
    prisma.award.count({ where: { careerId, season, type: "all_star_mvp" } }),
    prisma.award.findMany({ where: { careerId, season, type: "all_star" } }),
    getTeamsByLeague(leagueId),
    prisma.membership.findMany({ where: { careerId }, select: { teamId: true } }),
  ]);
  if (done > 0 || allStars.length === 0 || !lastPlayed || lastPlayed.gameDate < gameDate) return;
  const conferences = await prisma.conference.findMany({ where: { leagueId } });
  const eastId = conferences.find((c) => /east/i.test(c.name))?.id;
  const teamById = new Map(teams.map((t) => [t.id, t]));
  const states = await prisma.playerState.findMany({
    where: { careerId, playerId: { in: allStars.map((a) => a.playerId!).filter(Boolean) } },
    select: { playerId: true, overallRating: true },
  });
  const ovr = new Map(states.map((s) => [s.playerId, s.overallRating]));
  const side = (east: boolean) => allStars.filter((a) => (teamById.get(a.teamId)?.conferenceId === eastId) === east);
  const strength = (list: typeof allStars) =>
    list.reduce((sum, a) => sum + (ovr.get(a.playerId!) ?? 80), 0) / Math.max(1, list.length);
  const east = side(true);
  const west = side(false);
  let eastScore = Math.round(160 + (strength(east) - 85) * 2 + Math.random() * 30);
  const westScore = Math.round(160 + (strength(west) - 85) * 2 + Math.random() * 30);
  if (eastScore === westScore) eastScore += Math.random() < 0.5 ? 2 : -2;
  const winners = eastScore > westScore ? east : west;
  // MVP : tirage pondéré par la note parmi les vainqueurs.
  const weights = winners.map((a) => Math.pow(ovr.get(a.playerId!) ?? 80, 6));
  let pick = Math.random() * weights.reduce((s, w) => s + w, 0);
  const mvp = winners.find((_, i) => (pick -= weights[i]) <= 0) ?? winners[0];
  const pts = 22 + Math.floor(Math.random() * 18);
  const reb = 4 + Math.floor(Math.random() * 9);
  const ast = 3 + Math.floor(Math.random() * 8);
  const line = fr(locale) ? `${pts} pts, ${reb} reb, ${ast} pd` : `${pts} pts, ${reb} reb, ${ast} ast`;
  const drafts: AwardDraft[] = [{ type: "all_star_mvp", rank: 1, playerId: mvp.playerId, teamId: mvp.teamId, statLine: line }];
  if (!(await saveAwardsOnce(careerId, season, "all_star_mvp", drafts))) return;
  await applyAwardEffects(careerId, drafts);
  const player = await prisma.player.findUnique({ where: { id: mvp.playerId! }, select: { firstName: true, lastName: true } });
  const mvpName = player ? `${player.firstName} ${player.lastName}` : "";
  const host = ALL_STAR_HOSTS[season];
  const eastWon = eastScore > westScore;
  await prisma.leagueNews.create({
    data: {
      careerId,
      season,
      type: "all_star",
      gameDate,
      playerId: mvp.playerId,
      teamId: mvp.teamId,
      title: fr(locale)
        ? `All-Star Game : ${eastWon ? "l'Est" : "l'Ouest"} l'emporte ${Math.max(eastScore, westScore)}-${Math.min(eastScore, westScore)}`
        : `All-Star Game: the ${eastWon ? "East" : "West"} wins ${Math.max(eastScore, westScore)}-${Math.min(eastScore, westScore)}`,
      body: fr(locale)
        ? `${host ? `À ${host}, ` : ""}${mvpName} (${teamName(teamById, mvp.teamId)}) est élu MVP avec ${line}.`
        : `${host ? `In ${host}, ` : ""}${mvpName} (${teamName(teamById, mvp.teamId)}) takes MVP honors with ${line}.`,
    },
  });
  await notifyHumans(careerId, season, drafts, new Set(memberships.map((m) => m.teamId)), () => mvpName, locale, false);
}
