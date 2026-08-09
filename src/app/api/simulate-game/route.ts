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
import { advanceRosterTraining } from "@/lib/data-access/training";
import { getGmBonusForTeam } from "@/lib/data-access/gm";
import { maybeCreatePressConference } from "@/lib/data-access/press";
import { winPctForStandings } from "@/lib/careers/player-demands";
import {
  chemistryTrainingBonus,
  trainingFatigueDelta,
  type TrainingFocus,
  type TrainingIntensity,
} from "@/lib/careers/training-rules";
import { moraleBonus } from "@/lib/careers/press-rules";
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
    return NextResponse.json({ error: t("simulateAction.teamNotFound") }, { status: 404 });
  }

  const gameDate = new Date(updatedGame.gameDate);
  const [homeRestDays, awayRestDays, homeTeamState, awayTeamState, homeGm, awayGm] = await Promise.all([
    getRestDays(membership.careerId, updatedGame.homeTeamId, updatedGame.season, gameDate),
    getRestDays(membership.careerId, updatedGame.awayTeamId, updatedGame.season, gameDate),
    getOrCreateTeamState(membership.careerId, updatedGame.homeTeamId, updatedGame.leagueId),
    getOrCreateTeamState(membership.careerId, updatedGame.awayTeamId, updatedGame.leagueId),
    getGmBonusForTeam(membership.careerId, updatedGame.homeTeamId),
    getGmBonusForTeam(membership.careerId, updatedGame.awayTeamId),
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
    {
      homeChemistry: homeTeamState.chemistry + homeGm.chemistry + moraleBonus(homeTeamState.morale),
      awayChemistry: awayTeamState.chemistry + awayGm.chemistry + moraleBonus(awayTeamState.morale),
      homeGmBonus: homeGm.strength,
      awayGmBonus: awayGm.strength,
    }
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

  // Programme d'entraînement : fait dériver le bonus temporaire de chaque
  // joueur vers le plafond de l'intensité choisie (ou vers 0 si aucun focus
  // ciblant des attributs n'est actif).
  const homeFocus = homeTeamState.trainingFocus as TrainingFocus | null;
  const awayFocus = awayTeamState.trainingFocus as TrainingFocus | null;
  const homeIntensity = homeTeamState.trainingIntensity as TrainingIntensity;
  const awayIntensity = awayTeamState.trainingIntensity as TrainingIntensity;
  await Promise.all([
    advanceRosterTraining(membership.careerId, homeRoster, homeFocus, homeIntensity),
    advanceRosterTraining(membership.careerId, awayRoster, awayFocus, awayIntensity),
  ]);

  // Fatigue : récupération selon les jours de repos réels (accélérée par de
  // bonnes infrastructures) puis gain pour ceux qui ont joué, plus le coût
  // (ou le gain, pour un focus "repos") de l'entraînement en cours.
  await Promise.all([
    advanceRosterFatigue(
      membership.careerId,
      homeRoster,
      result.boxScore,
      homeRestDays,
      homeTeamState.facilitiesLevel,
      trainingFatigueDelta(homeFocus, homeIntensity)
    ),
    advanceRosterFatigue(
      membership.careerId,
      awayRoster,
      result.boxScore,
      awayRestDays,
      awayTeamState.facilitiesLevel,
      trainingFatigueDelta(awayFocus, awayIntensity)
    ),
  ]);

  // Chimie d'équipe : dérive vers sa cible (bilan à jour + QI basket moyen du
  // roster), plus le bonus si un focus "cohésion d'équipe" est actif.
  const standings = await getStandings(membership.careerId, updatedGame.leagueId, updatedGame.season);
  const homeStandingsRow = standings.find((s) => s.teamId === updatedGame.homeTeamId);
  const awayStandingsRow = standings.find((s) => s.teamId === updatedGame.awayTeamId);
  await Promise.all([
    advanceTeamChemistry(
      membership.careerId,
      updatedGame.homeTeamId,
      updatedGame.leagueId,
      winPctForStandings(homeStandingsRow?.wins ?? 0, homeStandingsRow?.losses ?? 0),
      homeRoster,
      chemistryTrainingBonus(homeFocus, homeIntensity)
    ),
    advanceTeamChemistry(
      membership.careerId,
      updatedGame.awayTeamId,
      updatedGame.leagueId,
      winPctForStandings(awayStandingsRow?.wins ?? 0, awayStandingsRow?.losses ?? 0),
      awayRoster,
      chemistryTrainingBonus(awayFocus, awayIntensity)
    ),
  ]);

  // Conférence de presse aléatoire (au plus 1/semaine réelle) — seulement
  // pour les équipes gérées par un humain, jamais pour un match IA-vs-IA.
  await Promise.all([
    homeManager
      ? maybeCreatePressConference(membership.careerId, updatedGame.homeTeamId, updatedGame.leagueId, gameDate, locale)
      : Promise.resolve(),
    awayManager
      ? maybeCreatePressConference(membership.careerId, updatedGame.awayTeamId, updatedGame.leagueId, gameDate, locale)
      : Promise.resolve(),
  ]);

  return NextResponse.json({ simulated: true, game: updated });
}
