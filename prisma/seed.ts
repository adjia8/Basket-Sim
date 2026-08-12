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
    // Même raisonnement que pour Player plus bas : le catalogue Team est
    // statique côté gameplay, un re-seed doit répercuter les changements de
    // mock-data (ex. marketAppeal) sur les lignes déjà en base.
    const fields = {
      leagueId: team.leagueId,
      conferenceId: team.conferenceId,
      city: team.city,
      name: team.name,
      abbreviation: team.abbreviation,
      primaryColor: team.primaryColor,
      secondaryColor: team.secondaryColor,
      marketAppeal: team.marketAppeal,
    };
    await prisma.team.upsert({
      where: { id: team.id },
      update: fields,
      create: { id: team.id, ...fields },
    });
  }

  for (const player of [...playersNba, ...playersWnba]) {
    // `update` reprend les mêmes champs que `create` (plutôt que `{}`) : le
    // catalogue Player est statique côté gameplay (l'évolution en cours de
    // carrière passe par PlayerState, jamais par ces colonnes), donc un
    // re-seed doit pouvoir répercuter un changement dans les fichiers
    // mock-data (ex. injuryRisk) sur les lignes déjà en base.
    const fields = {
      teamId: player.teamId,
      leagueId: player.leagueId,
      firstName: player.firstName,
      lastName: player.lastName,
      position: player.position,
      jerseyNumber: player.jerseyNumber,
      heightCm: player.heightCm,
      age: player.age,
      overallRating: player.overallRating,
      scoringInside: player.ratings.scoringInside,
      scoringOutside: player.ratings.scoringOutside,
      playmaking: player.ratings.playmaking,
      defenseInside: player.ratings.defenseInside,
      defenseOutside: player.ratings.defenseOutside,
      rebounding: player.ratings.rebounding,
      athleticism: player.ratings.athleticism,
      basketballIQ: player.ratings.basketballIQ,
      clutch: player.ratings.clutch,
      stamina: player.ratings.stamina,
      injuryRisk: player.injuryRisk,
      nationality: player.nationality,
      realSalary: player.realSalary ?? null,
      realYearsRemaining: player.realYearsRemaining ?? null,
    };
    await prisma.player.upsert({
      where: { id: player.id },
      update: fields,
      create: { id: player.id, ...fields },
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
