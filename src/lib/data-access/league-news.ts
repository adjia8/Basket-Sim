import "server-only";
import { prisma } from "@/lib/prisma";
import { translatorFor } from "@/lib/i18n/translate";
import type { Locale } from "@/lib/i18n/locale";
import type { BoxScoreEntry, Player, Team } from "@/lib/types";
import { performanceNews, starInjuryNews, streakNews, tradeNews } from "@/lib/careers/news-rules";

// Seuils d'actualité : on ne garde que le vraiment marquant.
const BIG_GAME_POINTS: Record<string, number> = { nba: 45, wnba: 35 };
const STAR_OVERALL = 82;
const STREAK_MILESTONE = 10; // puis tous les 5 matchs (10, 15, 20…)

export interface NewsRow {
  season: string;
  gameDate: Date | null;
  type: string;
  title: string;
  body: string;
  teamId: string | null;
  playerId: string | null;
}

// Actualité née d'un match (calculée en mémoire, écrite avec le reste des
// écritures du match — voir simulate.ts).
export function leagueNewsForGame(params: {
  locale: Locale;
  women: boolean;
  season: string;
  gameDate: Date;
  home: Team;
  away: Team;
  boxScore: BoxScoreEntry[];
  rosters: Player[];
  injuries: { playerId: string; teamId: string; severity: string; durationGames: number; injuryType: string }[];
  streaks: Map<string, number>; // > 0 : victoires de suite, < 0 : défaites
}): NewsRow[] {
  const { locale, women, season, gameDate, home, away } = params;
  const byId = new Map(params.rosters.map((p) => [p.id, p]));
  const teamName = (id: string) => (id === home.id ? `${home.city} ${home.name}` : `${away.city} ${away.name}`);
  const opponentName = (id: string) => (id === home.id ? `${away.city} ${away.name}` : `${home.city} ${home.name}`);
  const name = (id: string) => {
    const p = byId.get(id);
    return p ? `${p.firstName} ${p.lastName}` : id;
  };
  const rows: NewsRow[] = [];
  const bigGame = BIG_GAME_POINTS[home.leagueId] ?? 45;

  for (const e of params.boxScore) {
    const tripleDouble = e.points >= 10 && e.rebounds >= 10 && e.assists >= 10;
    if (e.points < bigGame && !tripleDouble) continue;
    const text = performanceNews(locale, name(e.playerId), teamName(e.teamId), opponentName(e.teamId), e, tripleDouble, women);
    rows.push({ season, gameDate, type: "performance", ...text, teamId: e.teamId, playerId: e.playerId });
  }

  const t = translatorFor(locale);
  for (const injury of params.injuries) {
    const player = byId.get(injury.playerId);
    if (!player || injury.severity !== "severe" || player.overallRating < STAR_OVERALL) continue;
    const text = starInjuryNews(
      locale,
      name(injury.playerId),
      teamName(injury.teamId),
      t(`domain.injuryType.${injury.injuryType}` as "domain.injuryType.illness"),
      injury.durationGames,
      women
    );
    rows.push({ season, gameDate, type: "injury", ...text, teamId: injury.teamId, playerId: injury.playerId });
  }

  for (const [teamId, streak] of params.streaks) {
    const n = Math.abs(streak);
    if (n < STREAK_MILESTONE || (n - STREAK_MILESTONE) % 5 !== 0) continue;
    const text = streakNews(locale, teamName(teamId), n, streak > 0);
    rows.push({ season, gameDate, type: "streak", ...text, teamId, playerId: null });
  }
  return rows;
}

export interface NewsView {
  id: string;
  season: string;
  gameDate: Date | null;
  createdAt: Date;
  type: string;
  title: string;
  body: string;
  teamId: string | null;
  playerId: string | null;
}

export async function getLeagueNews(careerId: string, take = 60, type?: string): Promise<NewsView[]> {
  return prisma.leagueNews.findMany({
    where: { careerId, ...(type ? { type } : {}) },
    orderBy: [{ createdAt: "desc" }],
    take,
  });
}

// Annonce un échange conclu (joueurs uniquement : les picks ne font pas les
// gros titres).
export async function recordTradeNews(
  careerId: string,
  season: string,
  teamAId: string,
  teamBId: string,
  aReceives: string[],
  bReceives: string[],
  locale: Locale
): Promise<void> {
  const [teams, players] = await Promise.all([
    prisma.team.findMany({ where: { id: { in: [teamAId, teamBId] } }, select: { id: true, city: true, name: true } }),
    prisma.player.findMany({ where: { id: { in: [...aReceives, ...bReceives] } }, select: { id: true, firstName: true, lastName: true } }),
  ]);
  const teamName = (id: string) => {
    const t = teams.find((x) => x.id === id);
    return t ? `${t.city} ${t.name}` : id;
  };
  const name = (id: string) => {
    const p = players.find((x) => x.id === id);
    return p ? `${p.firstName} ${p.lastName}` : id;
  };
  const text = tradeNews(locale, teamName(teamAId), teamName(teamBId), aReceives.map(name), bReceives.map(name));
  await prisma.leagueNews.create({
    data: { careerId, season, type: "trade", title: text.title, body: text.body, teamId: teamAId },
  });
}
