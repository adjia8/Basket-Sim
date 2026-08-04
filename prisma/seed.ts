import { prisma } from "../src/lib/prisma";
import { conferences, leagues } from "../src/lib/mock-data/leagues";
import { teams } from "../src/lib/mock-data/teams";
import { playersNba } from "../src/lib/mock-data/players-nba";
import { playersWnba } from "../src/lib/mock-data/players-wnba";

async function main() {
  for (const league of leagues) {
    await prisma.league.upsert({
      where: { id: league.id },
      update: {},
      create: {
        id: league.id,
        code: league.code,
        name: league.name,
        season: league.season,
        salaryCap: league.salaryCap,
      },
    });
  }

  for (const conference of conferences) {
    await prisma.conference.upsert({
      where: { id: conference.id },
      update: {},
      create: {
        id: conference.id,
        leagueId: conference.leagueId,
        name: conference.name,
      },
    });
  }

  for (const team of teams) {
    await prisma.team.upsert({
      where: { id: team.id },
      update: {},
      create: {
        id: team.id,
        leagueId: team.leagueId,
        conferenceId: team.conferenceId,
        city: team.city,
        name: team.name,
        abbreviation: team.abbreviation,
        primaryColor: team.primaryColor,
        secondaryColor: team.secondaryColor,
      },
    });
  }

  for (const player of [...playersNba, ...playersWnba]) {
    await prisma.player.upsert({
      where: { id: player.id },
      update: {},
      create: {
        id: player.id,
        teamId: player.teamId,
        leagueId: player.leagueId,
        firstName: player.firstName,
        lastName: player.lastName,
        position: player.position,
        jerseyNumber: player.jerseyNumber,
        heightCm: player.heightCm,
        age: player.age,
        overallRating: player.overallRating,
        scoring: player.ratings.scoring,
        playmaking: player.ratings.playmaking,
        rebounding: player.ratings.rebounding,
        defense: player.ratings.defense,
        athleticism: player.ratings.athleticism,
      },
    });
  }

  console.log(
    `Seed OK: ${leagues.length} ligues, ${teams.length} équipes, ${
      playersNba.length + playersWnba.length
    } joueurs.`
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
