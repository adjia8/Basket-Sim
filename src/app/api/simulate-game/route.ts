import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/dal";
import { prisma } from "@/lib/prisma";
import { getRosterForTeam } from "@/lib/data-access/players";
import { getGameById, updateGameResult } from "@/lib/data-access/schedule";
import { getTeamById } from "@/lib/data-access/teams";
import { simulationEngine } from "@/lib/simulation/mockEngine";

export async function POST(request: Request) {
  const session = await getSession();
  if (!session?.userId) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const career = await prisma.career.findUnique({
    where: { userId: session.userId },
  });
  if (!career) {
    return NextResponse.json({ error: "Aucune carrière" }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const gameId = body?.gameId;

  if (!gameId || typeof gameId !== "string") {
    return NextResponse.json({ error: "gameId manquant" }, { status: 400 });
  }

  const game = await getGameById(career.id, gameId);
  if (!game) {
    return NextResponse.json({ error: "Match introuvable" }, { status: 404 });
  }
  if (game.status === "final") {
    return NextResponse.json(
      { error: "Ce match a déjà été joué" },
      { status: 409 }
    );
  }

  const [homeTeam, awayTeam, homeRoster, awayRoster] = await Promise.all([
    getTeamById(game.homeTeamId),
    getTeamById(game.awayTeamId),
    getRosterForTeam(career.id, game.homeTeamId),
    getRosterForTeam(career.id, game.awayTeamId),
  ]);

  if (!homeTeam || !awayTeam) {
    return NextResponse.json({ error: "Équipe introuvable" }, { status: 404 });
  }

  const result = simulationEngine.simulateGame(
    homeTeam,
    homeRoster,
    awayTeam,
    awayRoster
  );
  const updated = await updateGameResult(career.id, gameId, result);

  return NextResponse.json({ game: updated });
}
