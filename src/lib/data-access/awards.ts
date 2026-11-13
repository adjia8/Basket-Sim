import "server-only";
import { prisma } from "@/lib/prisma";
import { getStandings } from "@/lib/data-access/standings";
import { getTeamsByLeague } from "@/lib/data-access/teams";
import { createInboxMessage } from "@/lib/data-access/inbox";
import { getSeasonLines, type PlayerSeasonLine } from "@/lib/data-access/season-stats";
import { PlayerStatePatches } from "@/lib/data-access/player-state-patches";
import { winPctForStandings } from "@/lib/careers/player-demands";
import { teamStrengthScore } from "@/lib/careers/gm-rules";
import { clampMorale } from "@/lib/careers/morale-rules";
import { NBA_ROOKIES_START_SEASON } from "@/lib/mock-data/rookies-nba";
import { allStarSelectionDue } from "@/lib/careers/nba-cup-rules";
import {
  ALL_NBA,
  ALL_STAR_SEASON_FRACTION,
  AWARD_EFFECTS,
  allStarScore,
  dpoyScore,
  expectedWinPct,
  improvementScore,
  isRegularSeason,
  minGamesForAwards,
  mvpScore,
  rookieScore,
  sixthManScore,
  statLine,
  type AwardType,
} from "@/lib/careers/awards-rules";
import { allLeagueNews, allStarNews, awardInboxText, awardName, awardNews } from "@/lib/careers/news-rules";
import type { Locale } from "@/lib/i18n/locale";
import type { Team } from "@/lib/types";

const START_SEASON = "2026-2027";

export interface AwardDraft {
  type: AwardType;
  rank: number;
  playerId: string | null;
  teamId: string;
  staffId?: string | null;
  label?: string | null;
  statLine?: string | null;
}

function previousSeason(season: string): string {
  const [a, b] = season.split("-").map(Number);
  return `${a - 1}-${b - 1}`;
}

function teamLabel(team: Team | undefined): string {
  return team ? `${team.city} ${team.name}` : "";
}

async function leagueContext(careerId: string, leagueId: string, season: string) {
  const [standings, teams, lines, memberships] = await Promise.all([
    getStandings(careerId, leagueId, season),
    getTeamsByLeague(leagueId),
    getSeasonLines(careerId, season),
    prisma.membership.findMany({ where: { careerId }, select: { teamId: true } }),
  ]);
  const winPct = new Map(standings.map((r) => [r.teamId, winPctForStandings(r.wins, r.losses)]));
  const teamById = new Map(teams.map((t) => [t.id, t]));
  const humanTeams = new Set(memberships.map((m) => m.teamId));
  const minGames = minGamesForAwards(lines);
  const eligible = lines.filter((l) => l.gamesPlayed >= minGames);
  return { teams, teamById, winPct, humanTeams, lines, eligible };
}

// Enregistre les distinctions UNE seule fois (verrou consultatif, puis
// revérification) — renvoie false si un autre appel l'a déjà fait.
export async function saveAwardsOnce(
  careerId: string,
  season: string,
  sentinel: AwardType,
  drafts: AwardDraft[]
): Promise<boolean> {
  if (drafts.length === 0) return false;
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`awards:${careerId}:${season}:${sentinel}`}))`;
    if ((await tx.award.count({ where: { careerId, season, type: sentinel } })) > 0) return false;
    await tx.award.createMany({
      data: drafts.map((d) => ({
        careerId,
        season,
        type: d.type,
        rank: d.rank,
        playerId: d.playerId,
        teamId: d.teamId,
        staffId: d.staffId ?? null,
        label: d.label ?? null,
        statLine: d.statLine ?? null,
      })),
    });
    return true;
  });
}

// Renommée et moral des lauréats (podiums exclus).
export async function applyAwardEffects(careerId: string, drafts: AwardDraft[]): Promise<void> {
  const winners = drafts.filter((d) => d.rank === 1 && d.playerId);
  if (winners.length === 0) return;
  const states = await prisma.playerState.findMany({
    where: { careerId, playerId: { in: winners.map((w) => w.playerId!) } },
    select: { playerId: true, renown: true, morale: true },
  });
  const current = new Map(states.map((s) => [s.playerId, { renown: s.renown, morale: s.morale }]));
  for (const w of winners) {
    const c = current.get(w.playerId!);
    if (!c) continue;
    c.renown = Math.min(99, c.renown + AWARD_EFFECTS[w.type].renown);
    c.morale = clampMorale(c.morale + AWARD_EFFECTS[w.type].morale);
  }
  const patches = new PlayerStatePatches();
  for (const [playerId, c] of current) patches.set(playerId, { renown: c.renown, morale: c.morale });
  await patches.apply(careerId);
}

// Notifie les GM humains dont un joueur est distingué.
export async function notifyHumans(
  careerId: string,
  season: string,
  drafts: AwardDraft[],
  humanTeams: Set<string>,
  nameOf: (id: string) => string,
  locale: Locale,
  women: boolean
): Promise<void> {
  for (const d of drafts) {
    if (d.rank !== 1 || !d.playerId || !humanTeams.has(d.teamId)) continue;
    const msg = awardInboxText(locale, nameOf(d.playerId), awardName(d.type, locale, women), women);
    await createInboxMessage(careerId, d.teamId, season, "award", msg.title, msg.body, `/teams/${d.teamId}/players/${d.playerId}`, {
      playerId: d.playerId,
    });
  }
}

// ---------------------------------------------------------------------------
// All-Star : 12 joueurs par conférence (24 sans conférence), sur la
// production et le bilan de l'équipe.
async function selectAllStars(careerId: string, leagueId: string, season: string, locale: Locale): Promise<void> {
  const ctx = await leagueContext(careerId, leagueId, season);
  const women = leagueId === "wnba";
  const conferences = await prisma.conference.findMany({ where: { leagueId } });
  const groups =
    conferences.length > 1
      ? conferences.map((c) => ({ label: c.name, teamIds: new Set(ctx.teams.filter((t) => t.conferenceId === c.id).map((t) => t.id)), size: 12 }))
      : [{ label: women ? "WNBA" : "NBA", teamIds: new Set(ctx.teams.map((t) => t.id)), size: 24 }];
  const drafts: AwardDraft[] = [];
  const newsGroups: { label: string; names: string[] }[] = [];
  for (const g of groups) {
    const picks = ctx.eligible
      .filter((l) => g.teamIds.has(l.teamId))
      .sort((a, b) => allStarScore(b, ctx.winPct.get(b.teamId) ?? 0.5) - allStarScore(a, ctx.winPct.get(a.teamId) ?? 0.5))
      .slice(0, g.size);
    picks.forEach((l) =>
      drafts.push({ type: "all_star", rank: 1, playerId: l.playerId, teamId: l.teamId, statLine: statLine(l, locale) })
    );
    newsGroups.push({ label: g.label, names: picks.slice(0, 6).map((l) => l.name) });
  }
  if (!(await saveAwardsOnce(careerId, season, "all_star", drafts))) return;
  const nameOf = (id: string) => ctx.lines.find((l) => l.playerId === id)?.name ?? id;
  const news = allStarNews(locale, newsGroups);
  await Promise.all([
    applyAwardEffects(careerId, drafts),
    prisma.leagueNews.create({ data: { careerId, season, type: "all_star", title: news.title, body: news.body } }),
  ]);
  await notifyHumans(careerId, season, drafts, ctx.humanTeams, nameOf, locale, women);
}

// ---------------------------------------------------------------------------
// Trophées de fin de saison régulière.
async function computeSeasonAwards(careerId: string, leagueId: string, season: string, locale: Locale): Promise<void> {
  const ctx = await leagueContext(careerId, leagueId, season);
  const women = leagueId === "wnba";
  const pct = (l: PlayerSeasonLine) => ctx.winPct.get(l.teamId) ?? 0.5;
  const drafts: AwardDraft[] = [];
  const lineText = (l: PlayerSeasonLine) => statLine(l, locale);
  const podium = (type: AwardType, ranked: PlayerSeasonLine[], size = 3) =>
    ranked.slice(0, size).forEach((l, i) =>
      drafts.push({ type, rank: i + 1, playerId: l.playerId, teamId: l.teamId, statLine: lineText(l) })
    );

  const byMvp = [...ctx.eligible].sort((a, b) => mvpScore(b, pct(b)) - mvpScore(a, pct(a)));
  podium("mvp", byMvp);
  podium("dpoy", [...ctx.eligible].sort((a, b) => dpoyScore(b, pct(b)) - dpoyScore(a, pct(a))));

  // Rookies : la liste officielle pour la saison de départ (NBA), puis les
  // joueurs draftés dans la carrière.
  const drafted = await prisma.playerTeamStint.findMany({
    where: { careerId, season, reason: "drafted" },
    select: { playerId: true },
  });
  const rookieIds = new Set([
    ...drafted.map((d) => d.playerId),
    ...(season === START_SEASON && leagueId === "nba" ? [...NBA_ROOKIES_START_SEASON] : []),
  ]);
  const rookieMin = Math.ceil(minGamesForAwards(ctx.lines) * 0.6);
  podium(
    "roy",
    ctx.lines.filter((l) => rookieIds.has(l.playerId) && l.gamesPlayed >= rookieMin).sort((a, b) => rookieScore(b) - rookieScore(a))
  );

  // Sixième homme : hors des 5 joueurs les plus utilisés de son équipe.
  const starters = new Set<string>();
  for (const team of ctx.teams) {
    ctx.lines
      .filter((l) => l.teamId === team.id)
      .sort((a, b) => b.mpg - a.mpg)
      .slice(0, 5)
      .forEach((l) => starters.add(l.playerId));
  }
  podium(
    "sixth_man",
    ctx.eligible.filter((l) => !starters.has(l.playerId) && l.mpg >= 15).sort((a, b) => sixthManScore(b) - sixthManScore(a))
  );

  // Meilleure progression : comparaison avec la saison précédente de la
  // carrière (absente la première saison).
  const previous = await prisma.playerSeasonStat.count({ where: { careerId, season: previousSeason(season) } });
  if (previous > 0) {
    const prevLines = await getSeasonLines(careerId, previousSeason(season));
    const prevById = new Map(prevLines.map((l) => [l.playerId, l]));
    const prevMin = minGamesForAwards(prevLines);
    podium(
      "mip",
      ctx.eligible
        .filter((l) => (prevById.get(l.playerId)?.gamesPlayed ?? 0) >= prevMin)
        .sort((a, b) => improvementScore(b, prevById.get(b.playerId)!) - improvementScore(a, prevById.get(a.playerId)!))
    );
  }

  // Entraîneur de l'année : l'équipe qui dépasse le plus ce que laissait
  // attendre la force de son effectif.
  const contracts = await prisma.contract.findMany({
    where: { careerId },
    select: { teamId: true, player: { select: { playerStates: { where: { careerId }, select: { overallRating: true } } } } },
  });
  const ratingsByTeam = new Map<string, number[]>();
  for (const c of contracts) {
    const r = c.player.playerStates[0]?.overallRating;
    if (r !== undefined) ratingsByTeam.set(c.teamId, [...(ratingsByTeam.get(c.teamId) ?? []), r]);
  }
  const strengthRank = [...ctx.teams]
    .map((t) => ({ id: t.id, score: teamStrengthScore(ratingsByTeam.get(t.id) ?? [], 50) }))
    .sort((a, b) => b.score - a.score)
    .map((t) => t.id);
  const overperformer = ctx.teams
    .map((t) => ({ id: t.id, delta: (ctx.winPct.get(t.id) ?? 0.5) - expectedWinPct(strengthRank.indexOf(t.id) + 1, ctx.teams.length) }))
    .sort((a, b) => b.delta - a.delta)[0];
  const coach = overperformer
    ? await prisma.staffMember.findFirst({ where: { careerId, teamId: overperformer.id, role: "head_coach" } })
    : null;
  if (overperformer && coach) {
    drafts.push({
      type: "coach",
      rank: 1,
      playerId: null,
      teamId: overperformer.id,
      staffId: coach.id,
      label: `${coach.firstName} ${coach.lastName}`,
    });
  }

  // Équipes All-NBA (5 par équipe, sur le classement du MVP).
  ALL_NBA.forEach((type, i) =>
    byMvp.slice(i * 5, i * 5 + 5).forEach((l) => drafts.push({ type, rank: 1, playerId: l.playerId, teamId: l.teamId, statLine: lineText(l) }))
  );

  if (!(await saveAwardsOnce(careerId, season, "mvp", drafts))) return;

  // Retombées, actualité, notifications.
  const nameOf = (id: string) => ctx.lines.find((l) => l.playerId === id)?.name ?? id;
  const news: { type: string; title: string; body: string; teamId: string | null; playerId: string | null }[] = [];
  for (const type of ["mvp", "dpoy", "roy", "sixth_man", "mip", "coach"] as AwardType[]) {
    const winner = drafts.find((d) => d.type === type && d.rank === 1);
    if (!winner) continue;
    const runnersUp = drafts.filter((d) => d.type === type && d.rank > 1 && d.playerId).map((d) => nameOf(d.playerId!));
    const text = awardNews(
      locale,
      type,
      winner.playerId ? nameOf(winner.playerId) : (winner.label ?? ""),
      teamLabel(ctx.teamById.get(winner.teamId)),
      winner.statLine ?? null,
      runnersUp,
      women
    );
    news.push({ type: "award", ...text, teamId: winner.teamId, playerId: winner.playerId });
  }
  const allLeague = allLeagueNews(
    locale,
    ALL_NBA.map((type) => ({ type, names: drafts.filter((d) => d.type === type).map((d) => nameOf(d.playerId!)) })),
    women
  );
  news.push({ type: "award", ...allLeague, teamId: null, playerId: null });
  await Promise.all([
    applyAwardEffects(careerId, drafts),
    prisma.leagueNews.createMany({ data: news.map((n) => ({ careerId, season, ...n })) }),
    coach
      ? prisma.staffMember.update({
          where: { id: coach.id },
          data: { rating: Math.min(95, coach.rating + 2), motivation: coach.motivation === null ? null : Math.min(95, coach.motivation + 1) },
        })
      : Promise.resolve(),
  ]);
  await notifyHumans(careerId, season, drafts, ctx.humanTeams, nameOf, locale, women);
}

// Appelée après chaque lot de matchs (et après un match du GM) : désigne
// les All-Stars à ~55 % de la saison régulière, et décerne les trophées
// une fois la saison régulière terminée. Idempotente.
export async function maybeLeagueMilestones(careerId: string, leagueId: string, season: string, locale: Locale): Promise<void> {
  if (!isRegularSeason(season)) return;
  const [total, finals, allStars, mvps, lastPlayed] = await Promise.all([
    prisma.game.count({ where: { careerId, season } }),
    prisma.game.count({ where: { careerId, season, status: "final" } }),
    prisma.award.count({ where: { careerId, season, type: "all_star" } }),
    prisma.award.count({ where: { careerId, season, type: "mvp" } }),
    prisma.game.findFirst({ where: { careerId, season, status: "final" }, orderBy: { gameDate: "desc" }, select: { gameDate: true } }),
  ]);
  if (total === 0) return;
  // NBA : calé sur la vraie date du All-Star Game ; WNBA : fraction de saison.
  const allStarDue =
    leagueId === "nba"
      ? allStarSelectionDue(season, lastPlayed?.gameDate ?? null)
      : finals / total >= ALL_STAR_SEASON_FRACTION;
  if (allStars === 0 && allStarDue) await selectAllStars(careerId, leagueId, season, locale);
  if (mvps === 0 && finals === total) await computeSeasonAwards(careerId, leagueId, season, locale);
}

export interface AwardView {
  id: string;
  season: string;
  type: AwardType;
  rank: number;
  playerId: string | null;
  playerName: string | null;
  teamId: string;
  label: string | null;
  statLine: string | null;
}

async function toViews(rows: Awaited<ReturnType<typeof prisma.award.findMany>>): Promise<AwardView[]> {
  const ids = [...new Set(rows.map((r) => r.playerId).filter(Boolean))] as string[];
  const players = await prisma.player.findMany({ where: { id: { in: ids } }, select: { id: true, firstName: true, lastName: true } });
  const nameById = new Map(players.map((p) => [p.id, `${p.firstName} ${p.lastName}`]));
  return rows.map((r) => ({
    id: r.id,
    season: r.season,
    type: r.type as AwardType,
    rank: r.rank,
    playerId: r.playerId,
    playerName: r.playerId ? (nameById.get(r.playerId) ?? r.playerId) : null,
    teamId: r.teamId,
    label: r.label,
    statLine: r.statLine,
  }));
}

export async function getAwards(careerId: string): Promise<AwardView[]> {
  const rows = await prisma.award.findMany({ where: { careerId }, orderBy: [{ season: "desc" }, { rank: "asc" }] });
  return toViews(rows);
}

export async function getPlayerAwards(careerId: string, playerId: string): Promise<AwardView[]> {
  const rows = await prisma.award.findMany({ where: { careerId, playerId, rank: 1 }, orderBy: { season: "desc" } });
  return toViews(rows);
}

// Course aux trophées (classement provisoire, saison en cours) : mêmes
// formules que le vote de fin de saison.
export interface RaceEntry {
  playerId: string;
  name: string;
  teamId: string;
  statLine: string;
}

export async function getAwardRace(
  careerId: string,
  leagueId: string,
  season: string,
  locale: Locale
): Promise<Partial<Record<AwardType, RaceEntry[]>>> {
  if (!isRegularSeason(season)) return {};
  const ctx = await leagueContext(careerId, leagueId, season);
  if (ctx.eligible.length === 0) return {};
  const pct = (l: PlayerSeasonLine) => ctx.winPct.get(l.teamId) ?? 0.5;
  const toEntry = (l: PlayerSeasonLine): RaceEntry => ({
    playerId: l.playerId,
    name: l.name,
    teamId: l.teamId,
    statLine: statLine(l, locale),
  });
  const drafted = await prisma.playerTeamStint.findMany({
    where: { careerId, season, reason: "drafted" },
    select: { playerId: true },
  });
  const rookieIds = new Set([
    ...drafted.map((d) => d.playerId),
    ...(season === START_SEASON && leagueId === "nba" ? [...NBA_ROOKIES_START_SEASON] : []),
  ]);
  const rookieMin = Math.ceil(minGamesForAwards(ctx.lines) * 0.6);
  return {
    mvp: [...ctx.eligible].sort((a, b) => mvpScore(b, pct(b)) - mvpScore(a, pct(a))).slice(0, 5).map(toEntry),
    dpoy: [...ctx.eligible].sort((a, b) => dpoyScore(b, pct(b)) - dpoyScore(a, pct(a))).slice(0, 5).map(toEntry),
    roy: ctx.lines
      .filter((l) => rookieIds.has(l.playerId) && l.gamesPlayed >= rookieMin)
      .sort((a, b) => rookieScore(b) - rookieScore(a))
      .slice(0, 5)
      .map(toEntry),
  };
}
