import "server-only";
import { prisma } from "@/lib/prisma";
import { getRosterForTeam } from "@/lib/data-access/players";
import { getContractsForTeam } from "@/lib/data-access/contracts";
import { updateGameResult } from "@/lib/data-access/schedule";
import { getStandings } from "@/lib/data-access/standings";
import { getTeamById } from "@/lib/data-access/teams";
import { simulationEngine } from "@/lib/simulation/mockEngine";
import { recordPlayoffGameResult } from "@/lib/data-access/playoffs";
import { advanceRosterInjuries, estimatedReturnDate, type NewInjury } from "@/lib/data-access/injuries";
import { translatorFor } from "@/lib/i18n/translate";
import { advancePlayerRenown } from "@/lib/data-access/renown";
import { advanceRosterFatigue, getRestDays } from "@/lib/data-access/fatigue";
import { advanceAttendance, advanceTeamChemistry, getOrCreateTeamState } from "@/lib/data-access/team-state";
import { advanceRosterDevelopment, advanceRosterTraining } from "@/lib/data-access/training";
import { AI_MAX_RESTED_PER_GAME, WEAR_AI_AUTO_REST } from "@/lib/careers/wear-rules";
import { PlayerStatePatches } from "@/lib/data-access/player-state-patches";
import { advanceRosterMorale } from "@/lib/data-access/morale";
import { ensureCareerStaff, getStaffProfiles } from "@/lib/data-access/staff";
import { NEUTRAL_STAFF_PROFILE, staffEffects } from "@/lib/careers/staff-rules";
import { bestTactics, parseTactics, tacticalLoad } from "@/lib/careers/tactics-rules";
import {
  focusByHalf,
  halftimeSituation,
  parseTalks,
  pregameSituation,
  talkOutcome,
  type TalkTone,
} from "@/lib/careers/team-talk-rules";
import type { HalfState } from "@/lib/simulation/engine";
import { clampMorale } from "@/lib/careers/morale-rules";

// Niveau d'un effectif pour juger favori / outsider : moyenne des 8 meilleurs.
function teamLevel(roster: Player[]): number {
  const top = [...roster].sort((a, b) => b.overallRating - a.overallRating).slice(0, 8);
  return top.length ? top.reduce((s, p) => s + p.overallRating, 0) / top.length : 0;
}

// Les 10 meilleurs joueurs disponibles, du plus fort au moins fort : la
// rotation que l'IA évalue pour choisir sa tactique.
function topRotation(roster: Player[]): Player[] {
  return [...roster].sort((a, b) => b.overallRating - a.overallRating).slice(0, 10);
}

// Le staff d'une carrière n'est généré qu'une fois (voir ensureCareerStaff) :
// on évite de le revérifier en base à chaque match.
const careersWithStaff = new Set<string>();
async function ensureStaffOnce(careerId: string, leagueId: string, season: string): Promise<void> {
  if (careersWithStaff.has(careerId)) return;
  await ensureCareerStaff(careerId, leagueId, season.replace(/-(playoffs|preseason)$/, ""));
  careersWithStaff.add(careerId);
}
import { getGmBonusForTeam } from "@/lib/data-access/gm";
import { getMembershipForTeam } from "@/lib/data-access/memberships";
import { maybeCreatePressConference } from "@/lib/data-access/press";
import { maybeFlagTradeRequest } from "@/lib/data-access/trade-requests";
import { getFreeAgents } from "@/lib/data-access/contracts";
import { createInboxMessage } from "@/lib/data-access/inbox";
import { winPctForStandings, minAcceptableSalary } from "@/lib/careers/player-demands";
import { parseRotationOrder } from "@/lib/careers/rotation-rules";
import { DEVELOPMENT_CONTRACT_GAME_LIMIT } from "@/lib/careers/contract-type-rules";
import {
  conferenceRankChanged,
  injuryMessageText,
  standingsMessageText,
  freeAgentMessageText,
  FREE_AGENT_NEWS_COOLDOWN_DAYS,
  NOTABLE_FREE_AGENT_RENOWN_THRESHOLD,
} from "@/lib/careers/inbox-rules";
import {
  chemistryTrainingBonus,
  trainingFatigueDelta,
  type TrainingFocus,
  type TrainingIntensity,
} from "@/lib/careers/training-rules";
import { moraleBonus, type PressGameContext } from "@/lib/careers/press-rules";
import { formatLongDate, teamFullName } from "@/lib/utils";
import type { Locale } from "@/lib/i18n/locale";
import type { BoxScoreEntry, Game, Player, Team } from "@/lib/types";

// Contexte de conférence de presse d'UNE équipe sur CE match : résultat,
// meilleur marqueur, star en difficulté, blessure survenue, jeune qui
// brille, joueur usé — tout est déjà en mémoire ici (aucune requête).
// L'actualité hors match (demande de transfert, recrue, playoffs, date
// limite) est ajoutée par data-access/press.ts.
function pressContextFor(params: {
  team: Team;
  opponent: Team;
  teamId: string;
  teamScore: number;
  opponentScore: number;
  roster: Player[];
  boxScore: BoxScoreEntry[];
  standingsRow: { wins: number; losses: number; streak: string } | undefined;
  rank: number;
  leagueSize: number;
  newInjuries: NewInjury[];
  locale: Locale;
}): PressGameContext {
  const { roster, boxScore, teamId } = params;
  const byId = new Map(roster.map((p) => [p.id, p]));
  const name = (p: Player) => `${p.firstName} ${p.lastName}`;
  const entries = boxScore.filter((e) => e.teamId === teamId && byId.has(e.playerId));

  const best = entries.reduce<BoxScoreEntry | undefined>((a, b) => (!a || b.points > a.points ? b : a), undefined);
  const topPlayer = best && best.points > 0 ? byId.get(best.playerId) : undefined;

  const struggling = entries
    .filter((e) => e.minutesPlayed >= 20 && e.points <= 10 && (byId.get(e.playerId)?.renown ?? 0) >= 70)
    .sort((a, b) => (byId.get(b.playerId)?.renown ?? 0) - (byId.get(a.playerId)?.renown ?? 0))[0];

  const young = entries
    .filter((e) => e.points >= 15 && (byId.get(e.playerId)?.age ?? 99) <= 22)
    .sort((a, b) => b.points - a.points)[0];

  const worn = roster
    .filter((p) => !p.injured && (p.wear ?? 0) >= 60 && p.renown >= 65)
    .sort((a, b) => (b.wear ?? 0) - (a.wear ?? 0))[0];

  const severityRank = { minor: 0, moderate: 1, severe: 2 } as Record<string, number>;
  const injury = [...params.newInjuries].sort(
    (a, b) => (severityRank[b.severity] ?? 0) - (severityRank[a.severity] ?? 0) || b.durationGames - a.durationGames
  )[0];
  const injured = injury ? byId.get(injury.playerId) : undefined;

  return {
    teamName: teamFullName(params.team),
    teamShortName: params.team.name,
    teamCity: params.team.city,
    women: params.team.leagueId === "wnba",
    opponentName: teamFullName(params.opponent),
    won: params.teamScore > params.opponentScore,
    teamScore: params.teamScore,
    opponentScore: params.opponentScore,
    wins: params.standingsRow?.wins ?? 0,
    losses: params.standingsRow?.losses ?? 0,
    streak: params.standingsRow?.streak ?? "-",
    rank: params.rank,
    leagueSize: params.leagueSize,
    topPerformer:
      topPlayer && best
        ? { id: topPlayer.id, name: name(topPlayer), points: best.points, rebounds: best.rebounds, assists: best.assists }
        : undefined,
    strugglingStar:
      struggling && struggling.playerId !== topPlayer?.id
        ? { id: struggling.playerId, name: name(byId.get(struggling.playerId)!), points: struggling.points }
        : undefined,
    injury:
      injury && injured
        ? {
            id: injured.id,
            name: name(injured),
            label: translatorFor(params.locale)(`domain.injuryType.${injury.injuryType}`),
            gamesOut: injury.durationGames,
            severity: injury.severity as "minor" | "moderate" | "severe",
          }
        : undefined,
    youngPlayer: young
      ? {
          id: young.playerId,
          name: name(byId.get(young.playerId)!),
          age: byId.get(young.playerId)!.age,
          points: young.points,
        }
      : undefined,
    wornPlayer: worn ? { id: worn.id, name: name(worn) } : undefined,
  };
}

// Génère les messages de boîte de réception "actus de la ligue" pour UNE
// équipe humaine après résolution d'un match : blessures qui viennent de
// survenir CE match (voir advanceRosterInjuries), mouvement de classement
// depuis la dernière vérification (jamais suivi avant l'ajout de ce champ,
// donc pas de message tant qu'aucun rang précédent n'est connu), et — sous
// cooldown — signalement d'un agent libre notable disponible sur le marché.
// Volontairement séquentiel (pas Promise.all) : peu d'appels, pas de contrainte
// de latence particulière ici contrairement à la boucle de simulation elle-même.
async function notifyHumanTeamNews(
  careerId: string,
  teamId: string,
  season: string,
  leagueId: string,
  locale: Locale,
  roster: Player[],
  newInjuries: NewInjury[],
  currentRank: number,
  teamState: { id: string; lastKnownConferenceRank: number | null; lastFreeAgentNewsDate: Date | null },
  gameDate: Date
): Promise<void> {
  for (const injury of newInjuries) {
    const player = roster.find((p) => p.id === injury.playerId);
    if (!player) continue;
    const returnDate = await estimatedReturnDate(careerId, teamId, gameDate, injury.durationGames);
    const { title, body } = injuryMessageText(
      locale,
      `${player.firstName} ${player.lastName}`,
      injury.severity,
      injury.durationGames,
      translatorFor(locale)(`domain.injuryType.${injury.injuryType}`),
      returnDate ? formatLongDate(returnDate, locale) : undefined
    );
    await createInboxMessage(careerId, teamId, season, "injury", title, body, `/teams/${teamId}/players/${player.id}`, {
      gameDate,
      playerId: player.id,
    });
  }

  if (conferenceRankChanged(teamState.lastKnownConferenceRank, currentRank)) {
    const team = await getTeamById(teamId);
    if (team) {
      const { title, body } = standingsMessageText(
        locale,
        teamFullName(team),
        teamState.lastKnownConferenceRank!,
        currentRank
      );
      await createInboxMessage(careerId, teamId, season, "standings", title, body, "/standings", { gameDate });
    }
  }
  if (teamState.lastKnownConferenceRank !== currentRank) {
    await prisma.teamState.update({ where: { id: teamState.id }, data: { lastKnownConferenceRank: currentRank } });
  }

  const freeAgentCooldownOk =
    !teamState.lastFreeAgentNewsDate ||
    (gameDate.getTime() - teamState.lastFreeAgentNewsDate.getTime()) / 86_400_000 >= FREE_AGENT_NEWS_COOLDOWN_DAYS;
  if (freeAgentCooldownOk) {
    const freeAgents = await getFreeAgents(careerId, leagueId);
    const notable = [...freeAgents].sort((a, b) => b.renown - a.renown)[0];
    if (notable && notable.renown >= NOTABLE_FREE_AGENT_RENOWN_THRESHOLD) {
      const expectedSalary = minAcceptableSalary(notable.renown, notable.overallRating, leagueId);
      const { title, body } = freeAgentMessageText(
        locale,
        `${notable.firstName} ${notable.lastName}`,
        notable.position,
        expectedSalary
      );
      await createInboxMessage(careerId, teamId, season, "free_agent", title, body, "/free-agents", {
        gameDate,
        playerId: notable.id,
      });
      await prisma.teamState.update({ where: { id: teamState.id }, data: { lastFreeAgentNewsDate: gameDate } });
    }
  }
}

// Joueurs au repos pour ce match : ceux que leur manager a mis au repos
// (restNextGame) ; côté IA, en plus, les plus usés (usure ≥
// WEAR_AI_AUTO_REST), au plus AI_MAX_RESTED_PER_GAME, sans jamais descendre
// sous 9 joueurs disponibles.
function restedForGame(roster: Player[], isAi: boolean): string[] {
  const healthy = roster.filter((p) => !p.injured);
  const manual = healthy.filter((p) => p.restNextGame).map((p) => p.id);
  if (!isAi) return manual;
  const room = Math.max(0, healthy.length - manual.length - 9);
  const auto = healthy
    .filter((p) => !p.restNextGame && (p.wear ?? 0) >= WEAR_AI_AUTO_REST)
    .sort((a, b) => (b.wear ?? 0) - (a.wear ?? 0))
    .slice(0, Math.min(AI_MAX_RESTED_PER_GAME, room))
    .map((p) => p.id);
  return [...manual, ...auto];
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
// Causeries du GM qui joue ce match (voir team-talk-rules.ts) : ton
// d'avant-match, ton de mi-temps, et arrêt à la pause pour choisir ce
// dernier. Sans `talk` (IA, rattrapage), un match laissé à la pause reprend
// tel quel, sans causerie de mi-temps.
export interface MatchTalkInput {
  side: "home" | "away";
  pregame?: TalkTone;
  halftime?: TalkTone;
  stopAtHalf?: boolean;
}

export async function simulateAndResolveGame(
  careerId: string,
  game: Game,
  locale: Locale,
  talk?: MatchTalkInput
): Promise<Game | undefined> {
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
  await ensureStaffOnce(careerId, game.leagueId, game.season);
  const [homeRestDays, awayRestDays, homeTeamState, awayTeamState, homeGm, awayGm, staffProfiles] = await Promise.all([
    getRestDays(careerId, game.homeTeamId, game.season, gameDate),
    getRestDays(careerId, game.awayTeamId, game.season, gameDate),
    getOrCreateTeamState(careerId, game.homeTeamId, game.leagueId),
    getOrCreateTeamState(careerId, game.awayTeamId, game.leagueId),
    getGmBonusForTeam(careerId, game.homeTeamId),
    getGmBonusForTeam(careerId, game.awayTeamId),
    getStaffProfiles(careerId, [game.homeTeamId, game.awayTeamId], game.leagueId),
  ]);
  // Staff (voir staff-rules.ts) : force en match, cohésion, moral,
  // progression, usure, fatigue, blessures.
  const homeProfile = staffProfiles.get(game.homeTeamId) ?? NEUTRAL_STAFF_PROFILE;
  const awayProfile = staffProfiles.get(game.awayTeamId) ?? NEUTRAL_STAFF_PROFILE;
  const homeStaff = staffEffects(homeProfile);
  const awayStaff = staffEffects(awayProfile);

  // Les joueurs actuellement blessés ne jouent pas : exclus du roster transmis
  // au moteur (ni minutes, ni stats de box score). Exception : une blessure
  // mineure sur laquelle le manager a choisi de faire jouer le joueur quand
  // même (voir src/app/actions/roster.ts, setPlayingThroughInjury). Une
  // joueuse en contrat de développement ayant déjà atteint la limite
  // d'activation (WNBA, voir DEVELOPMENT_CONTRACT_GAME_LIMIT) est bloquée
  // jusqu'à repasser en contrat standard (promoteToStandardContract).
  // Gestion de la charge : joueurs mis au repos par leur manager
  // (restNextGame) et, côté IA, les plus usés (voir restedForGame).
  const restingIds = new Set([
    ...restedForGame(homeRoster, !homeManager),
    ...restedForGame(awayRoster, !awayManager),
  ]);
  const makeCanPlay =
    (contractByPlayerId: Map<string, (typeof homeContracts)[number]>) =>
    (p: (typeof homeRoster)[number]) => {
      if (restingIds.has(p.id)) return false;
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
  // Tactiques : celles du GM humain ; l'IA prend la mieux adaptée à son
  // effectif du jour (voir bestTactics).
  const homeTactics = homeManager
    ? parseTactics(homeTeamState.tacticsJson)
    : bestTactics(topRotation(homeEligibleRoster));
  const awayTactics = awayManager
    ? parseTactics(awayTeamState.tacticsJson)
    : bestTactics(topRotation(awayEligibleRoster));
  // Causeries : mi-temps éventuellement déjà jouée, réaction des joueurs.
  const talkRow = await prisma.game.findUnique({
    where: { id: game.id },
    select: { halftimeJson: true, talksJson: true },
  });
  const resumeFrom = talkRow?.halftimeJson ? (JSON.parse(talkRow.halftimeJson) as HalfState) : undefined;
  let talks = parseTalks(talkRow?.talksJson);
  if (talk) {
    const mine = talk.side === "home" ? homeEligibleRoster : awayEligibleRoster;
    const theirs = talk.side === "home" ? awayEligibleRoster : homeEligibleRoster;
    const myState = talk.side === "home" ? homeTeamState : awayTeamState;
    const motivation = (talk.side === "home" ? homeProfile : awayProfile).motivation;
    if (!resumeFrom && talk.pregame) {
      const situation = pregameSituation(teamLevel(mine), teamLevel(theirs), talk.side === "home");
      talks = { side: talk.side, pregame: talkOutcome(talk.pregame, situation, motivation, myState.morale) };
    }
    if (resumeFrom && talk.halftime && (!talks || talks.side === talk.side)) {
      const myScore = talk.side === "home" ? resumeFrom.homeScore : resumeFrom.awayScore;
      const theirScore = talk.side === "home" ? resumeFrom.awayScore : resumeFrom.homeScore;
      talks = {
        ...(talks ?? { side: talk.side }),
        halftime: talkOutcome(talk.halftime, halftimeSituation(myScore, theirScore), motivation, myState.morale),
      };
    }
  }
  const focus = focusByHalf(talks);

  const result = simulationEngine.simulateGame(homeTeam, homeEligibleRoster, awayTeam, awayEligibleRoster, {
    homeFocus: talks?.side === "home" ? focus : undefined,
    awayFocus: talks?.side === "away" ? focus : undefined,
    stopAtHalf: !!talk?.stopAtHalf && !resumeFrom,
    resumeFrom,
    homeChemistry:
      homeTeamState.chemistry + homeGm.chemistry + moraleBonus(homeTeamState.morale) + homeStaff.chemistryBonus,
    awayChemistry:
      awayTeamState.chemistry + awayGm.chemistry + moraleBonus(awayTeamState.morale) + awayStaff.chemistryBonus,
    homeGmBonus: homeGm.strength + homeStaff.strengthBonus,
    awayGmBonus: awayGm.strength + awayStaff.strengthBonus,
    homeRotationOrder: parseRotationOrder(homeTeamState.rotationOrderJson),
    awayRotationOrder: parseRotationOrder(awayTeamState.rotationOrderJson),
    homeTactics,
    awayTactics,
    homeCoachTactics: homeProfile.tactics,
    awayCoachTactics: awayProfile.tactics,
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
  // Pause de la mi-temps : on enregistre l'état et on s'arrête là (la suite
  // — blessures, fatigue, presse… — ne se joue qu'au coup de sifflet final).
  if (result.halftime) {
    await prisma.game.update({
      where: { id: game.id },
      data: { halftimeJson: JSON.stringify(result.halftime), talksJson: talks ? JSON.stringify(talks) : null },
    });
    return game;
  }

  const updated = await updateGameResult(careerId, game.id, result);
  if (resumeFrom || talks) {
    await prisma.game.update({
      where: { id: game.id },
      data: { halftimeJson: null, talksJson: talks ? JSON.stringify(talks) : null },
    });
  }

  if (updated?.playoffSeriesId) {
    await recordPlayoffGameResult(updated.playoffSeriesId, result.homeScore, result.awayScore);
  }

  // Roster complet (pas filtré), une fois par équipe (les infrastructures
  // diffèrent d'une équipe à l'autre) : décompte les indisponibilités en
  // cours, ajuste le conditionnement physique, et tire de nouvelles
  // blessures parmi les joueurs valides.
  // Blessures, renommée, entraînement et fatigue écrivent toutes dans
  // `patches`, appliqué en une seule requête à la fin (voir
  // player-state-patches.ts) plutôt qu'une écriture par joueur et par étape.
  const patches = new PlayerStatePatches();
  const homeFocus = homeTeamState.trainingFocus as TrainingFocus | null;
  const awayFocus = awayTeamState.trainingFocus as TrainingFocus | null;
  const homeIntensity = homeTeamState.trainingIntensity as TrainingIntensity;
  const awayIntensity = awayTeamState.trainingIntensity as TrainingIntensity;
  // Intensité qui pèse vraiment sur les organismes (usure, risque, progrès) :
  // seulement quand un programme d'entraînement actif est en place.
  const homeLoad = homeFocus && homeFocus !== "rest" ? homeIntensity : null;
  const awayLoad = awayFocus && awayFocus !== "rest" ? awayIntensity : null;
  const [homeNewInjuries, awayNewInjuries] = await Promise.all([
    advanceRosterInjuries(patches, homeRoster, result.boxScore, homeTeamState.facilitiesLevel, {
      medicalLevel: homeStaff.medicalLevel,
      intensity: homeLoad,
      recoveryChance: homeStaff.injuryRecoveryChance,
    }),
    advanceRosterInjuries(patches, awayRoster, result.boxScore, awayTeamState.facilitiesLevel, {
      medicalLevel: awayStaff.medicalLevel,
      intensity: awayLoad,
      recoveryChance: awayStaff.injuryRecoveryChance,
    }),
  ]);

  // Ajuste le renommé de chaque joueur éligible : performance s'il a joué,
  // légère érosion sinon (voir data-access/renown.ts) — les blessés et les
  // joueuses en développement bloquées (hors homeEligibleRoster/
  // awayEligibleRoster) ne sont volontairement pas concernés.
  await advancePlayerRenown(patches, result.boxScore, [...homeEligibleRoster, ...awayEligibleRoster]);

  // Programme d'entraînement : fait dériver le bonus temporaire de chaque
  // joueur vers le plafond de l'intensité choisie (ou vers 0 si aucun focus
  // ciblant des attributs n'est actif).
  await Promise.all([
    advanceRosterTraining(patches, homeRoster, homeFocus, homeIntensity),
    advanceRosterTraining(patches, awayRoster, awayFocus, awayIntensity),
    advanceRosterDevelopment(patches, homeRoster, result.boxScore, homeFocus, homeLoad, homeStaff.developmentLevel),
    advanceRosterDevelopment(patches, awayRoster, result.boxScore, awayFocus, awayLoad, awayStaff.developmentLevel),
  ]);

  // Fatigue : récupération selon les jours de repos réels (accélérée par de
  // bonnes infrastructures) puis gain pour ceux qui ont joué, plus le coût
  // (ou le gain, pour un focus "repos") de l'entraînement en cours.
  await Promise.all([
    advanceRosterFatigue(
      patches,
      homeRoster,
      result.boxScore,
      homeRestDays,
      homeTeamState.facilitiesLevel,
      trainingFatigueDelta(homeFocus, homeIntensity),
      homeLoad,
      { ...homeStaff, gainFactor: tacticalLoad(homeTactics) }
    ),
    advanceRosterFatigue(
      patches,
      awayRoster,
      result.boxScore,
      awayRestDays,
      awayTeamState.facilitiesLevel,
      trainingFatigueDelta(awayFocus, awayIntensity),
      awayLoad,
      { ...awayStaff, gainFactor: tacticalLoad(awayTactics) }
    ),
  ]);
  // Moral individuel : résultat, temps de jeu, retour vers la normale.
  advanceRosterMorale(patches, homeRoster, result.boxScore, result.homeScore > result.awayScore, restingIds, homeStaff.moraleShift);
  advanceRosterMorale(patches, awayRoster, result.boxScore, result.awayScore > result.homeScore, restingIds, awayStaff.moraleShift);
  // Causeries : la réaction du vestiaire fait bouger le moral des joueurs
  // qui ont joué.
  if (talks) {
    const delta = (talks.pregame?.moraleDelta ?? 0) + (talks.halftime?.moraleDelta ?? 0);
    const roster = talks.side === "home" ? homeRoster : awayRoster;
    const played = new Set(result.boxScore.filter((e) => e.minutesPlayed > 0).map((e) => e.playerId));
    if (delta !== 0) {
      for (const player of roster) {
        if (!played.has(player.id)) continue;
        const current = patches.get(player.id)?.morale ?? player.morale ?? 60;
        patches.set(player.id, { morale: clampMorale(current + delta) });
      }
    }
  }
  // Le repos programmé ne vaut que pour ce match.
  for (const player of [...homeRoster, ...awayRoster]) {
    if (player.restNextGame) patches.set(player.id, { restNextGame: false });
  }
  await patches.apply(careerId);
  // Historique médical (toutes les équipes, IA comprises).
  const injuryRecords = [
    ...homeNewInjuries.map((i) => ({ ...i, teamId: game.homeTeamId })),
    ...awayNewInjuries.map((i) => ({ ...i, teamId: game.awayTeamId })),
  ];
  if (injuryRecords.length > 0) {
    await prisma.injuryRecord.createMany({
      data: injuryRecords.map((i) => ({
        careerId,
        playerId: i.playerId,
        teamId: i.teamId,
        season: game.season,
        injuryType: i.injuryType,
        severity: i.severity,
        gamesOut: i.durationGames,
        gameDate,
      })),
    });
  }

  // Chimie d'équipe : dérive vers sa cible (bilan à jour + QI basket moyen du
  // roster), plus le bonus si un focus "cohésion d'équipe" est actif.
  // Affluence : même principe, dérive vers une cible dominée par le bilan
  // (voir attendance-rules.ts) — pour les deux équipes, humaines ou IA,
  // comme la chimie.
  const standings = await getStandings(careerId, game.leagueId, game.season);
  const homeStandingsRow = standings.find((s) => s.teamId === game.homeTeamId);
  const awayStandingsRow = standings.find((s) => s.teamId === game.awayTeamId);
  const homeWinPct = winPctForStandings(homeStandingsRow?.wins ?? 0, homeStandingsRow?.losses ?? 0);
  const awayWinPct = winPctForStandings(awayStandingsRow?.wins ?? 0, awayStandingsRow?.losses ?? 0);
  await Promise.all([
    advanceTeamChemistry(
      careerId,
      game.homeTeamId,
      game.leagueId,
      homeWinPct,
      homeRoster,
      chemistryTrainingBonus(homeFocus, homeIntensity)
    ),
    advanceTeamChemistry(
      careerId,
      game.awayTeamId,
      game.leagueId,
      awayWinPct,
      awayRoster,
      chemistryTrainingBonus(awayFocus, awayIntensity)
    ),
    advanceAttendance(careerId, game.homeTeamId, game.leagueId, homeWinPct, homeTeam.marketAppeal),
    advanceAttendance(careerId, game.awayTeamId, game.leagueId, awayWinPct, awayTeam.marketAppeal),
  ]);

  // Conférence de presse aléatoire (au plus 1/semaine réelle) — seulement
  // pour les équipes gérées par un humain, jamais pour un match IA-vs-IA.
  const homeRankIndex = standings.findIndex((s) => s.teamId === game.homeTeamId);
  const awayRankIndex = standings.findIndex((s) => s.teamId === game.awayTeamId);
  const homeGameContext = pressContextFor({
    team: homeTeam,
    opponent: awayTeam,
    teamId: game.homeTeamId,
    teamScore: result.homeScore,
    opponentScore: result.awayScore,
    roster: homeRoster,
    boxScore: result.boxScore,
    standingsRow: homeStandingsRow,
    rank: homeRankIndex >= 0 ? homeRankIndex + 1 : standings.length,
    leagueSize: standings.length,
    newInjuries: homeNewInjuries,
    locale,
  });
  const awayGameContext = pressContextFor({
    team: awayTeam,
    opponent: homeTeam,
    teamId: game.awayTeamId,
    teamScore: result.awayScore,
    opponentScore: result.homeScore,
    roster: awayRoster,
    boxScore: result.boxScore,
    standingsRow: awayStandingsRow,
    rank: awayRankIndex >= 0 ? awayRankIndex + 1 : standings.length,
    leagueSize: standings.length,
    newInjuries: awayNewInjuries,
    locale,
  });
  await Promise.all([
    homeManager
      ? maybeCreatePressConference(careerId, game.homeTeamId, game.leagueId, game.season, gameDate, locale, homeGameContext, updated?.playoffSeriesId ?? null)
      : Promise.resolve(),
    awayManager
      ? maybeCreatePressConference(careerId, game.awayTeamId, game.leagueId, game.season, gameDate, locale, awayGameContext, updated?.playoffSeriesId ?? null)
      : Promise.resolve(),
  ]);

  // Nouvelle demande de trade éventuelle (cooldown + tirage, voir
  // maybeFlagTradeRequest) — même restriction aux équipes humaines.
  await Promise.all([
    homeManager
      ? maybeFlagTradeRequest(careerId, game.homeTeamId, game.leagueId, game.season, gameDate, locale)
      : Promise.resolve(),
    awayManager
      ? maybeFlagTradeRequest(careerId, game.awayTeamId, game.leagueId, game.season, gameDate, locale)
      : Promise.resolve(),
  ]);

  // Boîte de réception : blessures nouvelles, mouvement de classement, agent
  // libre notable — même restriction aux équipes humaines que ci-dessus.
  const homeRank = homeRankIndex >= 0 ? homeRankIndex + 1 : standings.length;
  const awayRank = awayRankIndex >= 0 ? awayRankIndex + 1 : standings.length;
  if (homeManager) {
    await notifyHumanTeamNews(
      careerId,
      game.homeTeamId,
      game.season,
      game.leagueId,
      locale,
      homeRoster,
      homeNewInjuries,
      homeRank,
      homeTeamState,
      gameDate
    );
  }
  if (awayManager) {
    await notifyHumanTeamNews(
      careerId,
      game.awayTeamId,
      game.season,
      game.leagueId,
      locale,
      awayRoster,
      awayNewInjuries,
      awayRank,
      awayTeamState,
      gameDate
    );
  }

  return updated;
}
