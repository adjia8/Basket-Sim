import "server-only";
import { prisma } from "@/lib/prisma";
import { getRosterForTeam } from "@/lib/data-access/players";
import { getContractsForTeam } from "@/lib/data-access/contracts";
import { updateGameResult } from "@/lib/data-access/schedule";
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
import { getMembershipForTeam } from "@/lib/data-access/memberships";
import { maybeCreatePressConference } from "@/lib/data-access/press";
import { maybeFlagTradeRequest } from "@/lib/data-access/trade-requests";
import { winPctForStandings } from "@/lib/careers/player-demands";
import { parseRotationOrder } from "@/lib/careers/rotation-rules";
import { DEVELOPMENT_CONTRACT_GAME_LIMIT } from "@/lib/careers/contract-type-rules";
import {
  chemistryTrainingBonus,
  trainingFatigueDelta,
  type TrainingFocus,
  type TrainingIntensity,
} from "@/lib/careers/training-rules";
import { moraleBonus, type PressGameContext } from "@/lib/careers/press-rules";
import { teamFullName } from "@/lib/utils";
import type { Locale } from "@/lib/i18n/locale";
import type { BoxScoreEntry, Game, Player } from "@/lib/types";

// Meilleure marqueuse d'une équipe sur CE match — sert à personnaliser une
// question de conférence de presse ("X a terminé avec Y points..."),
// undefined si personne n'a marqué (jamais le cas en pratique, mais évite un
// crash si un jour l'entrée de box score manque).
function topScorer(
  boxScore: BoxScoreEntry[],
  teamId: string,
  roster: Player[]
): { name: string; points: number } | undefined {
  const entries = boxScore.filter((e) => e.teamId === teamId && e.points > 0);
  if (entries.length === 0) return undefined;
  const best = entries.reduce((a, b) => (b.points > a.points ? b : a));
  const player = roster.find((p) => p.id === best.playerId);
  if (!player) return undefined;
  return { name: `${player.firstName} ${player.lastName}`, points: best.points };
}

// Cœur de la simulation d'un match, partagé entre l'endpoint /api/simulate-
// game (un match à la fois, déclenché par un manager humain) et
// simulateAllAiGames (src/app/actions/simulate-bulk.ts, qui rejoue en masse
// les matchs IA-vs-IA jamais déclenchés par personne — voir ce fichier pour
// le contexte : sans ça, le reste de la ligue reste figé à 0-0 pour
// toujours, ce qui bloque même la fin de saison). `game` est déjà validé
// "pas encore joué" par l'appelant ; cette fonction ne fait aucune
// vérification d'autorisation/de disponibilité (c'est le rôle de l'appelant,
// différent selon qu'il s'agit d'un match humain ou d'un lot IA).
export async function simulateAndResolveGame(careerId: string, game: Game, locale: Locale): Promise<Game | undefined> {
  const [homeTeam, awayTeam, homeRoster, awayRoster, homeContracts, awayContracts] = await Promise.all([
    getTeamById(game.homeTeamId),
    getTeamById(game.awayTeamId),
    getRosterForTeam(careerId, game.homeTeamId),
    getRosterForTeam(careerId, game.awayTeamId),
    getContractsForTeam(careerId, game.homeTeamId),
    getContractsForTeam(careerId, game.awayTeamId),
  ]);

  if (!homeTeam || !awayTeam) {
    throw new Error(`simulateAndResolveGame: team not found for game ${game.id}`);
  }

  const [homeManager, awayManager] = await Promise.all([
    getMembershipForTeam(careerId, game.homeTeamId),
    getMembershipForTeam(careerId, game.awayTeamId),
  ]);

  const homeContractByPlayerId = new Map(homeContracts.map((c) => [c.playerId, c]));
  const awayContractByPlayerId = new Map(awayContracts.map((c) => [c.playerId, c]));

  const gameDate = new Date(game.gameDate);
  const [homeRestDays, awayRestDays, homeTeamState, awayTeamState, homeGm, awayGm] = await Promise.all([
    getRestDays(careerId, game.homeTeamId, game.season, gameDate),
    getRestDays(careerId, game.awayTeamId, game.season, gameDate),
    getOrCreateTeamState(careerId, game.homeTeamId, game.leagueId),
    getOrCreateTeamState(careerId, game.awayTeamId, game.leagueId),
    getGmBonusForTeam(careerId, game.homeTeamId),
    getGmBonusForTeam(careerId, game.awayTeamId),
  ]);

  // Les joueurs actuellement blessés ne jouent pas : exclus du roster transmis
  // au moteur (ni minutes, ni stats de box score). Exception : une blessure
  // mineure sur laquelle le manager a choisi de faire jouer le joueur quand
  // même (voir src/app/actions/roster.ts, setPlayingThroughInjury). Une
  // joueuse en contrat de développement ayant déjà atteint la limite
  // d'activation (WNBA, voir DEVELOPMENT_CONTRACT_GAME_LIMIT) est bloquée
  // jusqu'à repasser en contrat standard (promoteToStandardContract).
  const makeCanPlay =
    (contractByPlayerId: Map<string, (typeof homeContracts)[number]>) =>
    (p: (typeof homeRoster)[number]) => {
      if (p.injured && !(p.playingThroughInjury && p.injurySeverity === "minor")) return false;
      const contract = contractByPlayerId.get(p.id);
      if (
        contract?.contractType === "development" &&
        contract.developmentGamesActivated >= DEVELOPMENT_CONTRACT_GAME_LIMIT
      ) {
        return false;
      }
      return true;
    };
  const homeEligibleRoster = homeRoster.filter(makeCanPlay(homeContractByPlayerId));
  const awayEligibleRoster = awayRoster.filter(makeCanPlay(awayContractByPlayerId));
  const result = simulationEngine.simulateGame(homeTeam, homeEligibleRoster, awayTeam, awayEligibleRoster, {
    homeChemistry: homeTeamState.chemistry + homeGm.chemistry + moraleBonus(homeTeamState.morale),
    awayChemistry: awayTeamState.chemistry + awayGm.chemistry + moraleBonus(awayTeamState.morale),
    homeGmBonus: homeGm.strength,
    awayGmBonus: awayGm.strength,
    homeRotationOrder: parseRotationOrder(homeTeamState.rotationOrderJson),
    awayRotationOrder: parseRotationOrder(awayTeamState.rotationOrderJson),
  });

  // Activation comptée pour CHAQUE joueuse en contrat de développement
  // effectivement éligible pour ce match (dressée), pas seulement celles qui
  // ont fini par jouer des minutes — l'activation se joue au moment de la
  // feuille de match, pas de la rotation choisie par le moteur.
  const developmentPlayerIds = [
    ...homeEligibleRoster
      .filter((p) => homeContractByPlayerId.get(p.id)?.contractType === "development")
      .map((p) => homeContractByPlayerId.get(p.id)!.id),
    ...awayEligibleRoster
      .filter((p) => awayContractByPlayerId.get(p.id)?.contractType === "development")
      .map((p) => awayContractByPlayerId.get(p.id)!.id),
  ];
  if (developmentPlayerIds.length > 0) {
    await prisma.contract.updateMany({
      where: { id: { in: developmentPlayerIds } },
      data: { developmentGamesActivated: { increment: 1 } },
    });
  }
  const updated = await updateGameResult(careerId, game.id, result);

  if (updated?.playoffSeriesId) {
    await recordPlayoffGameResult(updated.playoffSeriesId, result.homeScore, result.awayScore);
  }

  // Roster complet (pas filtré), une fois par équipe (les infrastructures
  // diffèrent d'une équipe à l'autre) : décompte les indisponibilités en
  // cours, ajuste le conditionnement physique, et tire de nouvelles
  // blessures parmi les joueurs valides.
  await Promise.all([
    advanceRosterInjuries(careerId, homeRoster, result.boxScore, homeTeamState.facilitiesLevel),
    advanceRosterInjuries(careerId, awayRoster, result.boxScore, awayTeamState.facilitiesLevel),
  ]);

  // Ajuste le renommé de chaque joueur éligible : performance s'il a joué,
  // légère érosion sinon (voir data-access/renown.ts) — les blessés et les
  // joueuses en développement bloquées (hors homeEligibleRoster/
  // awayEligibleRoster) ne sont volontairement pas concernés.
  await advancePlayerRenown(careerId, result.boxScore, [...homeEligibleRoster, ...awayEligibleRoster]);

  // Programme d'entraînement : fait dériver le bonus temporaire de chaque
  // joueur vers le plafond de l'intensité choisie (ou vers 0 si aucun focus
  // ciblant des attributs n'est actif).
  const homeFocus = homeTeamState.trainingFocus as TrainingFocus | null;
  const awayFocus = awayTeamState.trainingFocus as TrainingFocus | null;
  const homeIntensity = homeTeamState.trainingIntensity as TrainingIntensity;
  const awayIntensity = awayTeamState.trainingIntensity as TrainingIntensity;
  await Promise.all([
    advanceRosterTraining(careerId, homeRoster, homeFocus, homeIntensity),
    advanceRosterTraining(careerId, awayRoster, awayFocus, awayIntensity),
  ]);

  // Fatigue : récupération selon les jours de repos réels (accélérée par de
  // bonnes infrastructures) puis gain pour ceux qui ont joué, plus le coût
  // (ou le gain, pour un focus "repos") de l'entraînement en cours.
  await Promise.all([
    advanceRosterFatigue(
      careerId,
      homeRoster,
      result.boxScore,
      homeRestDays,
      homeTeamState.facilitiesLevel,
      trainingFatigueDelta(homeFocus, homeIntensity)
    ),
    advanceRosterFatigue(
      careerId,
      awayRoster,
      result.boxScore,
      awayRestDays,
      awayTeamState.facilitiesLevel,
      trainingFatigueDelta(awayFocus, awayIntensity)
    ),
  ]);

  // Chimie d'équipe : dérive vers sa cible (bilan à jour + QI basket moyen du
  // roster), plus le bonus si un focus "cohésion d'équipe" est actif.
  const standings = await getStandings(careerId, game.leagueId, game.season);
  const homeStandingsRow = standings.find((s) => s.teamId === game.homeTeamId);
  const awayStandingsRow = standings.find((s) => s.teamId === game.awayTeamId);
  await Promise.all([
    advanceTeamChemistry(
      careerId,
      game.homeTeamId,
      game.leagueId,
      winPctForStandings(homeStandingsRow?.wins ?? 0, homeStandingsRow?.losses ?? 0),
      homeRoster,
      chemistryTrainingBonus(homeFocus, homeIntensity)
    ),
    advanceTeamChemistry(
      careerId,
      game.awayTeamId,
      game.leagueId,
      winPctForStandings(awayStandingsRow?.wins ?? 0, awayStandingsRow?.losses ?? 0),
      awayRoster,
      chemistryTrainingBonus(awayFocus, awayIntensity)
    ),
  ]);

  // Conférence de presse aléatoire (au plus 1/semaine réelle) — seulement
  // pour les équipes gérées par un humain, jamais pour un match IA-vs-IA.
  const homeRankIndex = standings.findIndex((s) => s.teamId === game.homeTeamId);
  const awayRankIndex = standings.findIndex((s) => s.teamId === game.awayTeamId);
  const homeTopScorer = topScorer(result.boxScore, game.homeTeamId, homeRoster);
  const awayTopScorer = topScorer(result.boxScore, game.awayTeamId, awayRoster);
  const homeGameContext: PressGameContext = {
    teamName: teamFullName(homeTeam),
    opponentName: teamFullName(awayTeam),
    won: result.homeScore > result.awayScore,
    teamScore: result.homeScore,
    opponentScore: result.awayScore,
    wins: homeStandingsRow?.wins ?? 0,
    losses: homeStandingsRow?.losses ?? 0,
    streak: homeStandingsRow?.streak ?? "-",
    rank: homeRankIndex >= 0 ? homeRankIndex + 1 : standings.length,
    leagueSize: standings.length,
    topPerformerName: homeTopScorer?.name,
    topPerformerPoints: homeTopScorer?.points,
  };
  const awayGameContext: PressGameContext = {
    teamName: teamFullName(awayTeam),
    opponentName: teamFullName(homeTeam),
    won: result.awayScore > result.homeScore,
    teamScore: result.awayScore,
    opponentScore: result.homeScore,
    wins: awayStandingsRow?.wins ?? 0,
    losses: awayStandingsRow?.losses ?? 0,
    streak: awayStandingsRow?.streak ?? "-",
    rank: awayRankIndex >= 0 ? awayRankIndex + 1 : standings.length,
    leagueSize: standings.length,
    topPerformerName: awayTopScorer?.name,
    topPerformerPoints: awayTopScorer?.points,
  };
  await Promise.all([
    homeManager
      ? maybeCreatePressConference(careerId, game.homeTeamId, game.leagueId, gameDate, locale, homeGameContext)
      : Promise.resolve(),
    awayManager
      ? maybeCreatePressConference(careerId, game.awayTeamId, game.leagueId, gameDate, locale, awayGameContext)
      : Promise.resolve(),
  ]);

  // Nouvelle demande de trade éventuelle (cooldown + tirage, voir
  // maybeFlagTradeRequest) — même restriction aux équipes humaines.
  await Promise.all([
    homeManager
      ? maybeFlagTradeRequest(careerId, game.homeTeamId, game.leagueId, game.season, gameDate)
      : Promise.resolve(),
    awayManager
      ? maybeFlagTradeRequest(careerId, game.awayTeamId, game.leagueId, game.season, gameDate)
      : Promise.resolve(),
  ]);

  return updated;
}
