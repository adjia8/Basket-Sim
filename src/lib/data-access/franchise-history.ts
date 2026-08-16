import "server-only";
import { prisma } from "@/lib/prisma";
import { getTeamById } from "@/lib/data-access/teams";
import type { BoxScoreEntry } from "@/lib/types";

// Championnats — dérivés à la volée depuis PlayoffSeries (jamais purgé
// entre saisons, voir season.ts/advanceSeason) : pas de table dédiée, le
// round "finals" avec un winnerTeamId EST le titre de la saison.
export interface ChampionshipHistory {
  count: number;
  seasons: string[]; // saison régulière (suffixe "-playoffs" retiré), plus récente d'abord
}

export async function getChampionshipsForTeam(careerId: string, teamId: string): Promise<ChampionshipHistory> {
  const finals = await prisma.playoffSeries.findMany({
    where: { careerId, round: "finals", winnerTeamId: teamId },
    orderBy: { season: "desc" },
    select: { season: true },
  });
  const seasons = finals.map((f) => f.season.replace(/-playoffs$/, ""));
  return { count: seasons.length, seasons };
}

// Légendes — joueuses retraitées, Hall of Fame, dont la dernière équipe
// active (capturée à la retraite, voir hallOfFameTeamId dans season.ts) est
// cette franchise.
export interface FranchiseLegend {
  playerId: string;
  firstName: string;
  lastName: string;
  position: string;
  peakOverallRating: number;
  retiredSeason: string | null;
}

export async function getLegendsForTeam(careerId: string, teamId: string): Promise<FranchiseLegend[]> {
  const states = await prisma.playerState.findMany({
    where: { careerId, hallOfFame: true, hallOfFameTeamId: teamId },
    include: { player: { select: { firstName: true, lastName: true, position: true } } },
    orderBy: { peakOverallRating: "desc" },
  });
  return states.map((s) => ({
    playerId: s.playerId,
    firstName: s.player.firstName,
    lastName: s.player.lastName,
    position: s.player.position,
    peakOverallRating: s.peakOverallRating,
    retiredSeason: s.retiredSeason,
  }));
}

// Records — un seul passage sur tous les matchs "final" de la franchise,
// toutes saisons confondues (jamais purgés, voir season.ts/advanceSeason).
// bestSeason/longestWinStreak/highestTeamScore ne touchent que
// homeScore/awayScore/season (pas de parsing JSON) ; highestPlayerGame est
// le seul champ qui parse le boxScore, mais borné aux matchs DE CETTE
// équipe (pas toute la ligue) — volontairement pas généralisé en "moteur de
// records", juste les quatre chiffres demandés.
export interface FranchiseRecords {
  bestSeason: { season: string; wins: number; losses: number } | null;
  longestWinStreak: number;
  highestTeamScore: { points: number; season: string; opponentAbbr: string } | null;
  highestPlayerGame: { playerName: string; points: number; season: string } | null;
}

export async function getFranchiseRecords(careerId: string, teamId: string): Promise<FranchiseRecords> {
  const games = await prisma.game.findMany({
    where: {
      careerId,
      status: "final",
      OR: [{ homeTeamId: teamId }, { awayTeamId: teamId }],
    },
    orderBy: { gameDate: "asc" },
    select: {
      season: true,
      gameDate: true,
      homeTeamId: true,
      awayTeamId: true,
      homeScore: true,
      awayScore: true,
      boxScore: true,
    },
  });

  // Bilan par saison régulière (les labels "-playoffs" comptent à part,
  // volontairement — un "meilleur bilan" mélangeant playoffs et saison
  // régulière n'aurait pas de sens). La pré-saison (matchs d'exhibition,
  // voir schedule-rules.ts) ne compte pour AUCUN record — un score record
  // marqué en amical n'a pas sa place dans l'histoire de la franchise.
  const recordBySeason = new Map<string, { wins: number; losses: number }>();
  let longestWinStreak = 0;
  let currentStreak = 0;
  let highestTeamScore: FranchiseRecords["highestTeamScore"] = null;
  let highestPlayerGame: FranchiseRecords["highestPlayerGame"] = null;
  const opponentAbbrCache = new Map<string, string>();

  for (const game of games) {
    if (game.season.endsWith("-preseason")) continue;
    if (game.homeScore == null || game.awayScore == null) continue;
    const isHome = game.homeTeamId === teamId;
    const teamScore = isHome ? game.homeScore : game.awayScore;
    const opponentScore = isHome ? game.awayScore : game.homeScore;
    const opponentTeamId = isHome ? game.awayTeamId : game.homeTeamId;
    const won = teamScore > opponentScore;

    if (!game.season.endsWith("-playoffs")) {
      const row = recordBySeason.get(game.season) ?? { wins: 0, losses: 0 };
      if (won) row.wins++;
      else row.losses++;
      recordBySeason.set(game.season, row);
    }

    currentStreak = won ? currentStreak + 1 : 0;
    longestWinStreak = Math.max(longestWinStreak, currentStreak);

    if (!highestTeamScore || teamScore > highestTeamScore.points) {
      let opponentAbbr = opponentAbbrCache.get(opponentTeamId);
      if (!opponentAbbr) {
        const opponent = await getTeamById(opponentTeamId);
        opponentAbbr = opponent?.abbreviation ?? "?";
        opponentAbbrCache.set(opponentTeamId, opponentAbbr);
      }
      highestTeamScore = { points: teamScore, season: game.season, opponentAbbr };
    }

    if (game.boxScore) {
      const entries = JSON.parse(game.boxScore) as BoxScoreEntry[];
      const best = entries
        .filter((e) => e.teamId === teamId)
        .reduce<BoxScoreEntry | null>((max, e) => (!max || e.points > max.points ? e : max), null);
      if (best && (!highestPlayerGame || best.points > highestPlayerGame.points)) {
        const player = await prisma.player.findUnique({
          where: { id: best.playerId },
          select: { firstName: true, lastName: true },
        });
        highestPlayerGame = {
          playerName: player ? `${player.firstName} ${player.lastName}` : "?",
          points: best.points,
          season: game.season,
        };
      }
    }
  }

  let bestSeason: FranchiseRecords["bestSeason"] = null;
  for (const [season, record] of recordBySeason) {
    if (!bestSeason || record.wins > bestSeason.wins) {
      bestSeason = { season, wins: record.wins, losses: record.losses };
    }
  }

  return { bestSeason, longestWinStreak, highestTeamScore, highestPlayerGame };
}
