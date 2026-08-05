import { prisma } from "@/lib/prisma";
import type { BoxScoreEntry, Game } from "@/lib/types";
import { toDomainGame } from "./mappers";

// Les Game de plusieurs saisons s'accumulent dans la même Career (jamais
// supprimées au rollover) — `season` est obligatoire pour ne pas mélanger
// calendrier/classement de plusieurs saisons.
export async function getScheduleForCareer(
  careerId: string,
  season: string
): Promise<Game[]> {
  const rows = await prisma.game.findMany({
    where: { careerId, season },
    orderBy: { gameDate: "asc" },
  });
  return rows.map(toDomainGame);
}

export async function getScheduleForTeam(
  careerId: string,
  teamId: string,
  season: string
): Promise<Game[]> {
  const rows = await prisma.game.findMany({
    where: {
      careerId,
      season,
      OR: [{ homeTeamId: teamId }, { awayTeamId: teamId }],
    },
    orderBy: { gameDate: "asc" },
  });
  return rows.map(toDomainGame);
}

export async function getGameById(
  careerId: string,
  gameId: string
): Promise<Game | undefined> {
  const row = await prisma.game.findFirst({ where: { id: gameId, careerId } });
  return row ? toDomainGame(row) : undefined;
}

export async function setGameReady(
  careerId: string,
  gameId: string,
  side: "home" | "away"
): Promise<Game | undefined> {
  const { count } = await prisma.game.updateMany({
    where: { id: gameId, careerId },
    data: side === "home" ? { homeReady: true } : { awayReady: true },
  });
  if (count === 0) return undefined;
  return getGameById(careerId, gameId);
}

export async function updateGameResult(
  careerId: string,
  gameId: string,
  result: { homeScore: number; awayScore: number; boxScore: BoxScoreEntry[] }
): Promise<Game | undefined> {
  // updateMany (pas update) car le filtre porte sur id + careerId, pas sur la
  // clé unique seule — c'est ici que l'autorisation "ce match m'appartient" s'applique.
  const { count } = await prisma.game.updateMany({
    where: { id: gameId, careerId },
    data: {
      status: "final",
      homeScore: result.homeScore,
      awayScore: result.awayScore,
      boxScore: JSON.stringify(result.boxScore),
    },
  });
  if (count === 0) return undefined;
  return getGameById(careerId, gameId);
}
