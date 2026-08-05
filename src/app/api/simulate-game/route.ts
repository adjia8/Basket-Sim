import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/dal";
import { prisma } from "@/lib/prisma";
import { getMembershipForTeam } from "@/lib/data-access/memberships";
import { getRosterForTeam } from "@/lib/data-access/players";
import { getGameById, setGameReady, updateGameResult } from "@/lib/data-access/schedule";
import { getTeamById } from "@/lib/data-access/teams";
import { simulationEngine } from "@/lib/simulation/mockEngine";

export async function POST(request: Request) {
  const session = await getSession();
  if (!session?.userId) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const membership = await prisma.membership.findUnique({
    where: { userId: session.userId },
  });
  if (!membership) {
    return NextResponse.json({ error: "Aucune carrière" }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const gameId = body?.gameId;

  if (!gameId || typeof gameId !== "string") {
    return NextResponse.json({ error: "gameId manquant" }, { status: 400 });
  }

  const game = await getGameById(membership.careerId, gameId);
  if (!game) {
    return NextResponse.json({ error: "Match introuvable" }, { status: 404 });
  }
  if (game.status === "final") {
    return NextResponse.json(
      { error: "Ce match a déjà été joué" },
      { status: 409 }
    );
  }

  const side: "home" | "away" | null =
    game.homeTeamId === membership.teamId
      ? "home"
      : game.awayTeamId === membership.teamId
        ? "away"
        : null;

  const [homeManager, awayManager] = await Promise.all([
    getMembershipForTeam(membership.careerId, game.homeTeamId),
    getMembershipForTeam(membership.careerId, game.awayTeamId),
  ]);

  // Si je ne gère aucune des deux équipes, je ne peux agir que sur un match
  // opposant deux équipes IA (personne d'autre ne peut le déclencher) — sinon
  // je suis un simple spectateur du match d'un autre manager.
  if (!side && (homeManager || awayManager)) {
    return NextResponse.json(
      { error: "Tu ne gères aucune des deux équipes de ce match" },
      { status: 403 }
    );
  }

  const updatedGame = side
    ? await setGameReady(membership.careerId, gameId, side)
    : game;
  if (!updatedGame) {
    return NextResponse.json({ error: "Match introuvable" }, { status: 404 });
  }

  // Un camp géré par l'IA est toujours "prêt".
  const homeEffectiveReady = !homeManager || updatedGame.homeReady;
  const awayEffectiveReady = !awayManager || updatedGame.awayReady;

  if (!homeEffectiveReady || !awayEffectiveReady) {
    const waitingManager = !homeEffectiveReady ? homeManager : awayManager;
    return NextResponse.json({
      simulated: false,
      waitingFor: waitingManager?.email ?? "l'autre manager",
    });
  }

  const [homeTeam, awayTeam, homeRoster, awayRoster] = await Promise.all([
    getTeamById(updatedGame.homeTeamId),
    getTeamById(updatedGame.awayTeamId),
    getRosterForTeam(membership.careerId, updatedGame.homeTeamId),
    getRosterForTeam(membership.careerId, updatedGame.awayTeamId),
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
  const updated = await updateGameResult(membership.careerId, gameId, result);

  return NextResponse.json({ simulated: true, game: updated });
}
