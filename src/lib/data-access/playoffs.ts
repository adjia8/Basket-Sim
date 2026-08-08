import "server-only";
import { prisma } from "@/lib/prisma";
import type { PlayoffSeries as PlayoffSeriesRow } from "@prisma/client";
import { getScheduleForCareer } from "./schedule";
import { getStandings } from "./standings";
import { getTeamsByLeague } from "./teams";
import {
  NBA_CONFERENCE_ROUNDS,
  NBA_FINALS_ROUND,
  WNBA_ROUNDS,
  higherSeedHostsGame,
  nextRoundPairs,
  seedingPairs,
  winsNeeded,
  type RoundSpec,
} from "@/lib/careers/playoff-rules";
import type { ExpectationTier } from "@/lib/careers/gm-rules";

export interface PlayoffsState {
  series: PlayoffSeriesRow[];
  champion: string | null;
}

// Suffixe qui garde les matchs de playoffs hors du champ des requêtes de
// saison régulière (classement, calendrier, date limite des échanges) sans
// aucune modification de ces requêtes — mêmes convention que les picks de
// draft futurs qui utilisent des labels de saison pas encore courants.
function playoffSeason(regularSeason: string): string {
  return `${regularSeason}-playoffs`;
}

type Seeded = { seed: number; teamId: string };

async function conferenceSeeds(
  careerId: string,
  leagueId: string,
  regularSeason: string,
  conferenceTeamIds: string[]
): Promise<Seeded[]> {
  const standings = await getStandings(careerId, leagueId, regularSeason);
  return standings
    .filter((s) => conferenceTeamIds.includes(s.teamId))
    .sort(
      (a, b) =>
        b.wins - a.wins || b.pointsFor - b.pointsAgainst - (a.pointsFor - a.pointsAgainst)
    )
    .map((s, i) => ({ seed: i + 1, teamId: s.teamId }));
}

async function createPlayoffSeries(
  careerId: string,
  season: string,
  conference: string | null,
  round: string,
  slotIndex: number,
  bestOf: number,
  higherSeed: Seeded,
  lowerSeed: Seeded,
  leagueId: string
): Promise<PlayoffSeriesRow> {
  const series = await prisma.playoffSeries.create({
    data: {
      careerId,
      season,
      conference,
      round,
      slotIndex,
      bestOf,
      homeSeed: higherSeed.seed,
      homeTeamId: higherSeed.teamId,
      awaySeed: lowerSeed.seed,
      awayTeamId: lowerSeed.teamId,
    },
  });
  await ensureNextGameForSeries(series, leagueId);
  return series;
}

// Crée le prochain match de la série si elle n'est pas décidée et qu'aucun
// match "scheduled" n'existe déjà pour elle — sûr à rappeler (même principe
// que getCurrentDraftPick).
async function ensureNextGameForSeries(
  series: PlayoffSeriesRow,
  leagueId: string
): Promise<void> {
  if (series.winnerTeamId) return;
  const games = await prisma.game.findMany({ where: { playoffSeriesId: series.id } });
  if (games.some((g) => g.status === "scheduled")) return;

  const nextGameNumber = games.length + 1;
  const higherHosts = higherSeedHostsGame(nextGameNumber, series.bestOf);
  const homeTeamId = higherHosts ? series.homeTeamId : series.awayTeamId;
  const awayTeamId = higherHosts ? series.awayTeamId : series.homeTeamId;

  await prisma.game.create({
    data: {
      careerId: series.careerId,
      leagueId,
      season: series.season,
      gameDate: new Date(),
      homeTeamId,
      awayTeamId,
      status: "scheduled",
      playoffSeriesId: series.id,
      gameNumber: nextGameNumber,
    },
  });
}

// Vainqueur d'une série + son seed d'origine (nécessaire pour reconstruire le
// bracket du tour suivant via seedingPairs/nextRoundPairs).
function winnerSeed(series: PlayoffSeriesRow): Seeded {
  const isHome = series.winnerTeamId === series.homeTeamId;
  return {
    teamId: series.winnerTeamId!,
    seed: isHome ? series.homeSeed : series.awaySeed,
  };
}

// Fait avancer un bracket à élimination directe d'un tour à l'autre (utilisé
// pour round-1 -> conf-semis -> conf-finals en NBA, par conférence, et pour
// round-1 -> semifinals -> finals en WNBA) : une fois toutes les séries du
// tour `fromRound` décidées, apparie les vainqueurs par position de slot
// (slot i contre le dernier slot) et crée le tour suivant. Idempotent.
async function advanceBracketRound(
  careerId: string,
  season: string,
  conference: string | null,
  rounds: RoundSpec[],
  fromIndex: number,
  leagueId: string
): Promise<void> {
  const fromRound = rounds[fromIndex];
  const toRound = rounds[fromIndex + 1];
  if (!toRound) return;

  const fromSeries = await prisma.playoffSeries.findMany({
    where: { careerId, season, conference, round: fromRound.round },
    orderBy: { slotIndex: "asc" },
  });
  if (fromSeries.length === 0 || fromSeries.some((s) => !s.winnerTeamId)) return;

  const alreadyExists = await prisma.playoffSeries.count({
    where: { careerId, season, conference, round: toRound.round },
  });
  if (alreadyExists > 0) return;

  const winners = fromSeries.map(winnerSeed);
  const pairs = nextRoundPairs(winners);
  for (let i = 0; i < pairs.length; i++) {
    const [a, b] = pairs[i];
    const [high, low] = a.seed <= b.seed ? [a, b] : [b, a];
    await createPlayoffSeries(careerId, season, conference, toRound.round, i, toRound.bestOf, high, low, leagueId);
  }
}

async function seedNbaPlayInIfNeeded(
  careerId: string,
  leagueId: string,
  regularSeason: string,
  season: string,
  conferenceId: string,
  conferenceTeamIds: string[]
): Promise<void> {
  const existing = await prisma.playoffSeries.count({
    where: { careerId, season, conference: conferenceId },
  });
  if (existing > 0) return;

  const seeds = await conferenceSeeds(careerId, leagueId, regularSeason, conferenceTeamIds);
  await createPlayoffSeries(careerId, season, conferenceId, "play-in-7-8", 0, 1, seeds[6], seeds[7], leagueId);
  await createPlayoffSeries(careerId, season, conferenceId, "play-in-9-10", 0, 1, seeds[8], seeds[9], leagueId);
}

async function advanceNbaConferencePlayIn(
  careerId: string,
  leagueId: string,
  regularSeason: string,
  season: string,
  conferenceId: string,
  conferenceTeamIds: string[]
): Promise<void> {
  const [playin78, playin910] = await Promise.all([
    prisma.playoffSeries.findFirst({
      where: { careerId, season, conference: conferenceId, round: "play-in-7-8" },
    }),
    prisma.playoffSeries.findFirst({
      where: { careerId, season, conference: conferenceId, round: "play-in-9-10" },
    }),
  ]);
  if (!playin78 || !playin910) return;

  if (playin78.winnerTeamId && playin910.winnerTeamId) {
    const existingFinal = await prisma.playoffSeries.count({
      where: { careerId, season, conference: conferenceId, round: "play-in-final" },
    });
    if (existingFinal === 0) {
      const isHomeWinner78 = playin78.winnerTeamId === playin78.homeTeamId;
      // Le perdant du 7v8 a toujours un meilleur seed (7 ou 8) que le
      // vainqueur du 9v10 (9 ou 10) : il reçoit la finale du play-in.
      const loser78: Seeded = isHomeWinner78
        ? { seed: playin78.awaySeed, teamId: playin78.awayTeamId }
        : { seed: playin78.homeSeed, teamId: playin78.homeTeamId };
      await createPlayoffSeries(
        careerId,
        season,
        conferenceId,
        "play-in-final",
        0,
        1,
        loser78,
        winnerSeed(playin910),
        leagueId
      );
    }
  }

  const playinFinal = await prisma.playoffSeries.findFirst({
    where: { careerId, season, conference: conferenceId, round: "play-in-final" },
  });
  if (playin78.winnerTeamId && playinFinal?.winnerTeamId) {
    const existingRound1 = await prisma.playoffSeries.count({
      where: { careerId, season, conference: conferenceId, round: "round-1" },
    });
    if (existingRound1 === 0) {
      const seeds = await conferenceSeeds(careerId, leagueId, regularSeason, conferenceTeamIds);
      const top6 = seeds.slice(0, 6);
      const seed7: Seeded = { seed: 7, teamId: playin78.winnerTeamId! };
      const seed8: Seeded = { seed: 8, teamId: playinFinal.winnerTeamId! };
      const pairs = seedingPairs([...top6, seed7, seed8]);
      for (let i = 0; i < pairs.length; i++) {
        const [high, low] = pairs[i];
        await createPlayoffSeries(careerId, season, conferenceId, "round-1", i, 7, high, low, leagueId);
      }
    }
  }
}

async function advanceNbaFinals(
  careerId: string,
  leagueId: string,
  regularSeason: string,
  season: string
): Promise<void> {
  const [east, west] = await Promise.all([
    prisma.playoffSeries.findFirst({
      where: { careerId, season, conference: "nba-east", round: "conf-finals" },
    }),
    prisma.playoffSeries.findFirst({
      where: { careerId, season, conference: "nba-west", round: "conf-finals" },
    }),
  ]);
  if (!east?.winnerTeamId || !west?.winnerTeamId) return;

  const existing = await prisma.playoffSeries.count({
    where: { careerId, season, round: NBA_FINALS_ROUND.round },
  });
  if (existing > 0) return;

  const standings = await getStandings(careerId, leagueId, regularSeason);
  const record = (teamId: string) => standings.find((s) => s.teamId === teamId)!;
  const eastChamp = east.winnerTeamId!;
  const westChamp = west.winnerTeamId!;
  const eastRow = record(eastChamp);
  const westRow = record(westChamp);
  const eastBetter =
    eastRow.wins !== westRow.wins
      ? eastRow.wins > westRow.wins
      : eastRow.pointsFor - eastRow.pointsAgainst >= westRow.pointsFor - westRow.pointsAgainst;

  const higher: Seeded = eastBetter ? { seed: 1, teamId: eastChamp } : { seed: 1, teamId: westChamp };
  const lower: Seeded = eastBetter ? { seed: 2, teamId: westChamp } : { seed: 2, teamId: eastChamp };
  await createPlayoffSeries(careerId, season, null, NBA_FINALS_ROUND.round, 0, NBA_FINALS_ROUND.bestOf, higher, lower, leagueId);
}

async function seedWnbaIfNeeded(
  careerId: string,
  leagueId: string,
  regularSeason: string,
  season: string
): Promise<void> {
  const existing = await prisma.playoffSeries.count({
    where: { careerId, season, round: "round-1" },
  });
  if (existing > 0) return;

  const standings = await getStandings(careerId, leagueId, regularSeason);
  const top8 = [...standings]
    .sort(
      (a, b) =>
        b.wins - a.wins || b.pointsFor - b.pointsAgainst - (a.pointsFor - a.pointsAgainst)
    )
    .slice(0, 8)
    .map((s, i) => ({ seed: i + 1, teamId: s.teamId }));

  const pairs = seedingPairs(top8);
  for (let i = 0; i < pairs.length; i++) {
    const [high, low] = pairs[i];
    await createPlayoffSeries(careerId, season, null, WNBA_ROUNDS[0].round, i, WNBA_ROUNDS[0].bestOf, high, low, leagueId);
  }
}

// Appelé juste après la résolution d'un match de playoffs (route
// simulate-game) : incrémente le compteur de victoires du camp gagnant et
// clôt la série dès qu'il atteint la majorité requise par bestOf. Le
// prochain match (s'il en faut un) est créé au prochain appel de
// getOrAdvancePlayoffs, pas ici — garde cette route simple.
export async function recordPlayoffGameResult(
  playoffSeriesId: string,
  homeScore: number,
  awayScore: number
): Promise<void> {
  const series = await prisma.playoffSeries.findUnique({ where: { id: playoffSeriesId } });
  if (!series || series.winnerTeamId) return;

  const homeWon = homeScore > awayScore;
  const homeWins = series.homeWins + (homeWon ? 1 : 0);
  const awayWins = series.awayWins + (homeWon ? 0 : 1);
  const needed = winsNeeded(series.bestOf);
  const winnerTeamId =
    homeWins >= needed ? series.homeTeamId : awayWins >= needed ? series.awayTeamId : null;

  await prisma.playoffSeries.update({
    where: { id: playoffSeriesId },
    data: { homeWins, awayWins, winnerTeamId },
  });
}

// Lecture paresseuse et idempotente de l'état des playoffs — même principe
// que getCurrentDraftPick : sûr à rappeler à chaque chargement de page,
// avance le bracket d'exactement ce qui est prêt à l'être, ne fait rien de
// plus. Retourne `null` tant que la saison régulière n'est pas terminée.
export async function getOrAdvancePlayoffs(
  careerId: string,
  regularSeason: string,
  leagueId: string
): Promise<PlayoffsState | null> {
  const regularSeasonGames = await getScheduleForCareer(careerId, regularSeason);
  const regularSeasonComplete =
    regularSeasonGames.length > 0 && regularSeasonGames.every((g) => g.status === "final");
  if (!regularSeasonComplete) return null;

  const season = playoffSeason(regularSeason);

  if (leagueId === "nba") {
    const teams = await getTeamsByLeague(leagueId);
    const eastTeamIds = teams.filter((t) => t.conferenceId === "nba-east").map((t) => t.id);
    const westTeamIds = teams.filter((t) => t.conferenceId === "nba-west").map((t) => t.id);

    await seedNbaPlayInIfNeeded(careerId, leagueId, regularSeason, season, "nba-east", eastTeamIds);
    await seedNbaPlayInIfNeeded(careerId, leagueId, regularSeason, season, "nba-west", westTeamIds);
    await advanceNbaConferencePlayIn(careerId, leagueId, regularSeason, season, "nba-east", eastTeamIds);
    await advanceNbaConferencePlayIn(careerId, leagueId, regularSeason, season, "nba-west", westTeamIds);
    await advanceBracketRound(careerId, season, "nba-east", NBA_CONFERENCE_ROUNDS, 0, leagueId);
    await advanceBracketRound(careerId, season, "nba-east", NBA_CONFERENCE_ROUNDS, 1, leagueId);
    await advanceBracketRound(careerId, season, "nba-west", NBA_CONFERENCE_ROUNDS, 0, leagueId);
    await advanceBracketRound(careerId, season, "nba-west", NBA_CONFERENCE_ROUNDS, 1, leagueId);
    await advanceNbaFinals(careerId, leagueId, regularSeason, season);
  } else {
    await seedWnbaIfNeeded(careerId, leagueId, regularSeason, season);
    await advanceBracketRound(careerId, season, null, WNBA_ROUNDS, 0, leagueId);
    await advanceBracketRound(careerId, season, null, WNBA_ROUNDS, 1, leagueId);
  }

  const allSeries = await prisma.playoffSeries.findMany({ where: { careerId, season } });
  for (const series of allSeries) {
    await ensureNextGameForSeries(series, leagueId);
  }

  const champion = allSeries.find((s) => s.round === "finals")?.winnerTeamId ?? null;
  return { series: allSeries, champion };
}

// Résultat réel d'une équipe dans les playoffs d'une saison, sur la même
// échelle que les objectifs GM (gm-rules.ts) — utilisé par l'évaluation de
// fin de saison. Aucune série (pas atteint le play-in/les playoffs) →
// "rebuild". La WNBA n'a que 3 tours (round-1/semifinals/finals, pas de
// play-in ni de conf-semis) : "semifinals" est tassé sur "conf_finals" (même
// profondeur relative dans un bracket à 3 tours qu'un conf-finals NBA dans
// un bracket à 4 tours) — limite assumée, WNBA ne peut jamais atterrir
// exactement sur "play_in"/"conf_semis" comme résultat réel.
export async function getPlayoffResultTier(
  careerId: string,
  regularSeason: string,
  teamId: string
): Promise<ExpectationTier> {
  const season = playoffSeason(regularSeason);
  const series = await prisma.playoffSeries.findMany({
    where: { careerId, season, OR: [{ homeTeamId: teamId }, { awayTeamId: teamId }] },
  });
  if (series.length === 0) return "rebuild";

  const finals = series.find((s) => s.round === "finals");
  if (finals) return finals.winnerTeamId === teamId ? "champion" : "nba_finals";
  if (series.some((s) => s.round === "conf-finals" || s.round === "semifinals")) return "conf_finals";
  if (series.some((s) => s.round === "conf-semis")) return "conf_semis";
  if (series.some((s) => s.round === "round-1")) return "playoffs";
  if (series.some((s) => s.round.startsWith("play-in"))) return "play_in";
  return "rebuild";
}
