import "server-only";
import { prisma } from "@/lib/prisma";
import { calendarDay } from "@/lib/careers/schedule-rules";

// Horloge du jeu, façon Football Manager : le temps n'avance qu'au fil des
// matchs simulés, donc « aujourd'hui » = le jour du dernier match joué de
// la Career (ou, avant tout match, le jour du tout premier match prévu).

export type SeasonPhase = "preseason" | "regular" | "playoffs";

export interface NextMyGame {
  id: string;
  date: Date;
  opponentTeamId: string;
  isHome: boolean;
  phase: SeasonPhase;
}

export interface GameClock {
  today: Date | null;
  nextGame: NextMyGame | null;
  daysUntilNextGame: number | null;
  // Plus aucun match IA à jouer avant (ou le même jour que) mon prochain
  // match : le prochain « Continuer » joue directement ce match.
  isMatchDay: boolean;
}

function phaseOf(season: string): SeasonPhase {
  if (season.endsWith("-preseason")) return "preseason";
  if (season.endsWith("-playoffs")) return "playoffs";
  return "regular";
}

// Fin de la journée calendaire (UTC) d'une date : tous les matchs du même
// jour sont joués ensemble.
export function endOfGameDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 23, 59, 59));
}

export async function getGameClock(careerId: string, teamId: string): Promise<GameClock> {
  const [lastPlayed, firstScheduled, next, humanTeams] = await Promise.all([
    prisma.game.findFirst({
      where: { careerId, status: "final" },
      orderBy: { gameDate: "desc" },
      select: { gameDate: true },
    }),
    prisma.game.findFirst({
      where: { careerId, status: { not: "final" } },
      orderBy: { gameDate: "asc" },
      select: { gameDate: true },
    }),
    prisma.game.findFirst({
      where: { careerId, status: { not: "final" }, OR: [{ homeTeamId: teamId }, { awayTeamId: teamId }] },
      orderBy: { gameDate: "asc" },
    }),
    prisma.membership.findMany({ where: { careerId }, select: { teamId: true } }),
  ]);

  const today = lastPlayed?.gameDate ?? firstScheduled?.gameDate ?? null;
  if (!next) return { today, nextGame: null, daysUntilNextGame: null, isMatchDay: false };

  const humanTeamIds = humanTeams.map((m) => m.teamId);
  const aiGamesBefore = await prisma.game.count({
    where: {
      careerId,
      status: { not: "final" },
      homeTeamId: { notIn: humanTeamIds },
      awayTeamId: { notIn: humanTeamIds },
      gameDate: { lte: endOfGameDay(next.gameDate) },
    },
  });

  const isHome = next.homeTeamId === teamId;
  const daysUntilNextGame = today
    ? Math.max(0, Math.round((Date.parse(calendarDay(next.gameDate)) - Date.parse(calendarDay(today))) / 86_400_000))
    : null;
  return {
    today,
    nextGame: {
      id: next.id,
      date: next.gameDate,
      opponentTeamId: isHome ? next.awayTeamId : next.homeTeamId,
      isHome,
      phase: phaseOf(next.season),
    },
    daysUntilNextGame,
    isMatchDay: aiGamesBefore === 0,
  };
}
