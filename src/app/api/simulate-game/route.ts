import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/dal";
import { prisma } from "@/lib/prisma";
import { getMembershipForTeam } from "@/lib/data-access/memberships";
import { getRosterForTeam } from "@/lib/data-access/players";
import { getGameById, setGameReady, updateGameResult } from "@/lib/data-access/schedule";
import { getStandings } from "@/lib/data-access/standings";
import { getTeamById } from "@/lib/data-access/teams";
import { simulationEngine } from "@/lib/simulation/mockEngine";
import { recordPlayoffGameResult } from "@/lib/data-access/playoffs";
import { advanceRosterInjuries } from "@/lib/data-access/injuries";
import { advancePlayerRenown } from "@/lib/data-access/renown";
import { advanceRosterFatigue, getRestDays } from "@/lib/data-access/fatigue";
import { advanceTeamChemistry, getOrCreateTeamState } from "@/lib/data-access/team-state";
import { winPctForStandings } from "@/lib/careers/player-demands";

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

  const gameDate = new Date(updatedGame.gameDate);
  const [homeRestDays, awayRestDays, homeTeamState, awayTeamState] = await Promise.all([
    getRestDays(membership.careerId, updatedGame.homeTeamId, updatedGame.season, gameDate),
    getRestDays(membership.careerId, updatedGame.awayTeamId, updatedGame.season, gameDate),
    getOrCreateTeamState(membership.careerId, updatedGame.homeTeamId, updatedGame.leagueId),
    getOrCreateTeamState(membership.careerId, updatedGame.awayTeamId, updatedGame.leagueId),
  ]);

  // Les joueurs actuellement blessés ne jouent pas : exclus du roster transmis
  // au moteur (ni minutes, ni stats de box score). Exception : une blessure
  // mineure sur laquelle le manager a choisi de faire jouer le joueur quand
  // même (voir src/app/actions/roster.ts, setPlayingThroughInjury).
  const canPlay = (p: (typeof homeRoster)[number]) =>
    !p.injured || (p.playingThroughInjury && p.injurySeverity === "minor");
  const result = simulationEngine.simulateGame(
    homeTeam,
    homeRoster.filter(canPlay),
    awayTeam,
    awayRoster.filter(canPlay),
    { homeChemistry: homeTeamState.chemistry, awayChemistry: awayTeamState.chemistry }
  );
  const updated = await updateGameResult(membership.careerId, gameId, result);

  if (updated?.playoffSeriesId) {
    await recordPlayoffGameResult(updated.playoffSeriesId, result.homeScore, result.awayScore);
  }

  // Roster complet (pas filtré), une fois par équipe (les infrastructures
  // diffèrent d'une équipe à l'autre) : décompte les indisponibilités en
  // cours, ajuste le conditionnement physique, et tire de nouvelles
  // blessures parmi les joueurs valides.
  await Promise.all([
    advanceRosterInjuries(membership.careerId, homeRoster, result.boxScore, homeTeamState.facilitiesLevel),
    advanceRosterInjuries(membership.careerId, awayRoster, result.boxScore, awayTeamState.facilitiesLevel),
  ]);

  // Ajuste le renommé de chaque joueur qui a joué selon sa performance.
  await advancePlayerRenown(membership.careerId, result.boxScore, [...homeRoster, ...awayRoster]);

  // Fatigue : récupération selon les jours de repos réels (accélérée par de
  // bonnes infrastructures) puis gain pour ceux qui ont joué.
  await Promise.all([
    advanceRosterFatigue(
      membership.careerId,
      homeRoster,
      result.boxScore,
      homeRestDays,
      homeTeamState.facilitiesLevel
    ),
    advanceRosterFatigue(
      membership.careerId,
      awayRoster,
      result.boxScore,
      awayRestDays,
      awayTeamState.facilitiesLevel
    ),
  ]);

  // Chimie d'équipe : dérive vers sa cible (bilan à jour + QI basket moyen du roster).
  const standings = await getStandings(membership.careerId, updatedGame.leagueId, updatedGame.season);
  const homeStandingsRow = standings.find((s) => s.teamId === updatedGame.homeTeamId);
  const awayStandingsRow = standings.find((s) => s.teamId === updatedGame.awayTeamId);
  await Promise.all([
    advanceTeamChemistry(
      membership.careerId,
      updatedGame.homeTeamId,
      updatedGame.leagueId,
      winPctForStandings(homeStandingsRow?.wins ?? 0, homeStandingsRow?.losses ?? 0),
      homeRoster
    ),
    advanceTeamChemistry(
      membership.careerId,
      updatedGame.awayTeamId,
      updatedGame.leagueId,
      winPctForStandings(awayStandingsRow?.wins ?? 0, awayStandingsRow?.losses ?? 0),
      awayRoster
    ),
  ]);

  return NextResponse.json({ simulated: true, game: updated });
}
