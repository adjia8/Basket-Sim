import "server-only";
import { prisma } from "@/lib/prisma";
import type { Position } from "@/lib/types";

// Noms fictifs : le catalogue Player n'a que de vrais joueurs NBA/WNBA
// existants, il faut une petite banque à combiner pour les rookies.
const FIRST_NAMES = [
  "Marcus", "Devon", "Jaylen", "Tyrese", "Amara", "Zion", "Nia", "Cameron",
  "Malik", "Jada", "Trey", "Kayla", "Isaiah", "Simone", "Elijah", "Destiny",
];
const LAST_NAMES = [
  "Carter", "Reynolds", "Whitfield", "Osei", "Bergman", "Lawson", "Okafor",
  "Dubois", "Ferreira", "Kowalski", "Adeyemi", "Novak",
];
const POSITIONS: Position[] = ["PG", "SG", "SF", "PF", "C"];

function randomInt(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min + 1));
}

function pick<T>(items: T[]): T {
  return items[randomInt(0, items.length - 1)];
}

function spreadAround(overall: number): number {
  return Math.max(30, Math.min(99, overall + randomInt(-8, 8)));
}

export async function generateProspectClass(
  careerId: string,
  leagueId: string,
  classSize: number
): Promise<void> {
  const rows = Array.from({ length: classSize }, () => {
    const overallRating = randomInt(55, 82); // rookies, pas encore des stars
    return {
      careerId,
      leagueId,
      firstName: pick(FIRST_NAMES),
      lastName: pick(LAST_NAMES),
      position: pick(POSITIONS),
      heightCm: randomInt(180, 216),
      age: randomInt(19, 22),
      overallRating,
      scoringInside: spreadAround(overallRating),
      scoringOutside: spreadAround(overallRating),
      playmaking: spreadAround(overallRating),
      defenseInside: spreadAround(overallRating),
      defenseOutside: spreadAround(overallRating),
      rebounding: spreadAround(overallRating),
      athleticism: spreadAround(overallRating),
      basketballIQ: spreadAround(overallRating),
      clutch: spreadAround(overallRating),
      stamina: spreadAround(overallRating),
    };
  });

  await prisma.prospect.createMany({ data: rows });
}
