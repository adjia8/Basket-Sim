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
      scoring: row.scoring,
      playmaking: row.playmaking,
      rebounding: row.rebounding,
      defense: row.defense,
      athleticism: row.athleticism,
    },
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
      scoring: state?.scoring ?? row.scoring,
      playmaking: state?.playmaking ?? row.playmaking,
      rebounding: state?.rebounding ?? row.rebounding,
      defense: state?.defense ?? row.defense,
      athleticism: state?.athleticism ?? row.athleticism,
    },
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
      scoring: row.scoring,
      playmaking: row.playmaking,
      rebounding: row.rebounding,
      defense: row.defense,
      athleticism: row.athleticism,
    },
  };
}

export function toDomainContract(row: PrismaContract): Contract {
  return {
    id: row.id,
    playerId: row.playerId,
    teamId: row.teamId,
    salary: row.salary,
    yearsRemaining: row.yearsRemaining,
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
  };
}
