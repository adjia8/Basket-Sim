import type {
  Conference as PrismaConference,
  Contract as PrismaContract,
  Game as PrismaGame,
  League as PrismaLeague,
  Player as PrismaPlayer,
  PlayerState as PrismaPlayerState,
  Prospect as PrismaProspect,
  Team as PrismaTeam,
} from "@prisma/client";
import type {
  BoxScoreEntry,
  Contract,
  Game,
  League,
  Player,
  Prospect,
  Team,
} from "@/lib/types";
import { initialRenown } from "@/lib/careers/renown-rules";

export function toDomainLeague(
  row: PrismaLeague & { conferences?: PrismaConference[] }
): League {
  return {
    id: row.id,
    code: row.code as League["code"],
    name: row.name,
    season: row.season,
    salaryCap: row.salaryCap,
    conferenceIds: row.conferences?.map((c) => c.id) ?? [],
  };
}

export function toDomainTeam(row: PrismaTeam): Team {
  return {
    id: row.id,
    leagueId: row.leagueId,
    conferenceId: row.conferenceId,
    city: row.city,
    name: row.name,
    abbreviation: row.abbreviation,
    primaryColor: row.primaryColor,
    secondaryColor: row.secondaryColor,
    marketAppeal: row.marketAppeal,
  };
}

export function toDomainPlayer(row: PrismaPlayer): Player {
  return {
    id: row.id,
    teamId: row.teamId,
    leagueId: row.leagueId,
    firstName: row.firstName,
    lastName: row.lastName,
    position: row.position as Player["position"],
    jerseyNumber: row.jerseyNumber,
    heightCm: row.heightCm,
    age: row.age,
    overallRating: row.overallRating,
    ratings: {
      scoringInside: row.scoringInside,
      scoringOutside: row.scoringOutside,
      playmaking: row.playmaking,
      defenseInside: row.defenseInside,
      defenseOutside: row.defenseOutside,
      rebounding: row.rebounding,
      athleticism: row.athleticism,
      basketballIQ: row.basketballIQ,
      clutch: row.clutch,
      stamina: row.stamina,
    },
    injuryRisk: row.injuryRisk,
    injured: false,
    injuryGamesRemaining: 0,
    playingThroughInjury: false,
    renown: initialRenown(row.overallRating),
    fatigue: 0,
    conditioning: 100,
    trainingBoost: 0,
    nationality: row.nationality,
  };
}

// Fusionne l'état par-Career (âge/ratings actuels) par-dessus la bio fixe du
// catalogue. `state` absent = pas encore de PlayerState pour cette Career
// (ne devrait arriver qu'aux tout premiers instants avant génération) : on
// retombe alors sur les valeurs de catalogue.
export function toDomainPlayerWithState(
  row: PrismaPlayer,
  state?: PrismaPlayerState
): Player {
  return {
    id: row.id,
    teamId: row.teamId,
    leagueId: row.leagueId,
    firstName: row.firstName,
    lastName: row.lastName,
    position: row.position as Player["position"],
    jerseyNumber: row.jerseyNumber,
    heightCm: row.heightCm,
    age: state?.age ?? row.age,
    overallRating: state?.overallRating ?? row.overallRating,
    ratings: {
      scoringInside: state?.scoringInside ?? row.scoringInside,
      scoringOutside: state?.scoringOutside ?? row.scoringOutside,
      playmaking: state?.playmaking ?? row.playmaking,
      defenseInside: state?.defenseInside ?? row.defenseInside,
      defenseOutside: state?.defenseOutside ?? row.defenseOutside,
      rebounding: state?.rebounding ?? row.rebounding,
      athleticism: state?.athleticism ?? row.athleticism,
      basketballIQ: state?.basketballIQ ?? row.basketballIQ,
      clutch: state?.clutch ?? row.clutch,
      stamina: state?.stamina ?? row.stamina,
    },
    injuryRisk: row.injuryRisk,
    injured: state?.injured ?? false,
    injuryGamesRemaining: state?.injuryGamesRemaining ?? 0,
    injurySeverity: (state?.injurySeverity as Player["injurySeverity"]) ?? undefined,
    playingThroughInjury: state?.playingThroughInjury ?? false,
    renown: state?.renown ?? initialRenown(row.overallRating),
    fatigue: state?.fatigue ?? 0,
    conditioning: state?.conditioning ?? 100,
    trainingBoost: state?.trainingBoost ?? 0,
    trainingBoostFocus: (state?.trainingBoostFocus as Player["trainingBoostFocus"]) ?? undefined,
    nationality: row.nationality,
  };
}

export function toDomainProspect(row: PrismaProspect): Prospect {
  return {
    id: row.id,
    firstName: row.firstName,
    lastName: row.lastName,
    position: row.position as Prospect["position"],
    heightCm: row.heightCm,
    age: row.age,
    overallRating: row.overallRating,
    ratings: {
      scoringInside: row.scoringInside,
      scoringOutside: row.scoringOutside,
      playmaking: row.playmaking,
      defenseInside: row.defenseInside,
      defenseOutside: row.defenseOutside,
      rebounding: row.rebounding,
      athleticism: row.athleticism,
      basketballIQ: row.basketballIQ,
      clutch: row.clutch,
      stamina: row.stamina,
    },
    scoutingNote: row.scoutingNote ?? undefined,
    nationality: row.nationality,
  };
}

export function toDomainContract(row: PrismaContract): Contract {
  return {
    id: row.id,
    playerId: row.playerId,
    teamId: row.teamId,
    salary: row.salary,
    yearsRemaining: row.yearsRemaining,
    guaranteed: row.guaranteed,
    contractType: row.contractType as Contract["contractType"],
    isRookieScale: row.isRookieScale,
    developmentGamesActivated: row.developmentGamesActivated,
  };
}

export function toDomainGame(row: PrismaGame): Game {
  return {
    id: row.id,
    leagueId: row.leagueId,
    season: row.season,
    gameDate: row.gameDate.toISOString().slice(0, 10),
    homeTeamId: row.homeTeamId,
    awayTeamId: row.awayTeamId,
    status: row.status as Game["status"],
    homeScore: row.homeScore ?? undefined,
    awayScore: row.awayScore ?? undefined,
    boxScore: row.boxScore
      ? (JSON.parse(row.boxScore) as BoxScoreEntry[])
      : undefined,
    homeReady: row.homeReady,
    awayReady: row.awayReady,
    playoffSeriesId: row.playoffSeriesId ?? undefined,
  };
}
