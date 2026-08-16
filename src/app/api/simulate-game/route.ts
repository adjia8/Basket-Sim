import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/dal";
import { prisma } from "@/lib/prisma";
import { getMembershipForTeam } from "@/lib/data-access/memberships";
import { getGameById, setGameReady } from "@/lib/data-access/schedule";
import { simulateAndResolveGame } from "@/lib/data-access/simulate";
import { getTranslator } from "@/lib/i18n/translate";

export async function POST(request: Request) {
  const { t, locale } = await getTranslator();
  const session = await getSession();
  if (!session?.userId) {
    return NextResponse.json({ error: t("simulateAction.notAuthenticated") }, { status: 401 });
  }

  const membership = await prisma.membership.findUnique({
    where: { userId: session.userId },
  });
  if (!membership) {
    return NextResponse.json({ error: t("simulateAction.noCareer") }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const gameId = body?.gameId;

  if (!gameId || typeof gameId !== "string") {
    return NextResponse.json({ error: t("simulateAction.missingGameId") }, { status: 400 });
  }

  const game = await getGameById(membership.careerId, gameId);
  if (!game) {
    return NextResponse.json({ error: t("simulateAction.gameNotFound") }, { status: 404 });
  }
  if (game.status === "final") {
    return NextResponse.json(
      { error: t("simulateAction.alreadyPlayed") },
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
      { error: t("simulateAction.notYourGame") },
      { status: 403 }
    );
  }

  const updatedGame = side
    ? await setGameReady(membership.careerId, gameId, side)
    : game;
  if (!updatedGame) {
    return NextResponse.json({ error: t("simulateAction.gameNotFound") }, { status: 404 });
  }

  // Un camp géré par l'IA est toujours "prêt".
  const homeEffectiveReady = !homeManager || updatedGame.homeReady;
  const awayEffectiveReady = !awayManager || updatedGame.awayReady;

  if (!homeEffectiveReady || !awayEffectiveReady) {
    const waitingManager = !homeEffectiveReady ? homeManager : awayManager;
    return NextResponse.json({
      simulated: false,
      waitingFor: waitingManager?.email ?? t("game.otherManagerFallback"),
    });
  }

  let updated;
  try {
    updated = await simulateAndResolveGame(membership.careerId, updatedGame, locale);
  } catch {
    return NextResponse.json({ error: t("simulateAction.teamNotFound") }, { status: 404 });
  }

  return NextResponse.json({ simulated: true, game: updated });
}
