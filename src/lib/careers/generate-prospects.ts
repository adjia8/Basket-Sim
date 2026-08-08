import "server-only";
import { prisma } from "@/lib/prisma";
import type { Position } from "@/lib/types";
import { NBA_REAL_PROSPECTS, type ProspectSeed } from "@/lib/mock-data/real-prospects-nba";
import { WNBA_REAL_PROSPECTS } from "@/lib/mock-data/real-prospects-wnba";
import { randomNationality } from "@/lib/careers/nationality-rules";

const REAL_PROSPECTS_BY_LEAGUE: Record<string, Record<string, ProspectSeed[]>> = {
  nba: NBA_REAL_PROSPECTS,
  wnba: WNBA_REAL_PROSPECTS,
};

// Noms fictifs : le catalogue Player n'a que de vrais joueurs NBA/WNBA
// existants, il faut une petite banque à combiner pour les rookies générés
// (au-delà des 3 classes de vrais prospects, voir real-prospects-*.ts).
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
  classSize: number,
  season: string
): Promise<void> {
  // Les 3 premières classes de draft de la carrière utilisent de vrais
  // prospects NCAA/Europe (voir real-prospects-nba.ts/real-prospects-wnba.ts)
  // — complétées jusqu'à la taille réelle de la classe par le générateur
  // fictif ci-dessous. Au-delà, aucune classe réelle n'existe pour cette
  // saison et tout est généré, comme avant.
  const realProspects = REAL_PROSPECTS_BY_LEAGUE[leagueId]?.[season] ?? [];
  const realRows = realProspects.slice(0, classSize).map((p) => ({
    careerId,
    leagueId,
    firstName: p.firstName,
    lastName: p.lastName,
    position: p.position,
    heightCm: p.heightCm,
    age: p.age,
    overallRating: p.overallRating,
    scoringInside: spreadAround(p.overallRating),
    scoringOutside: spreadAround(p.overallRating),
    playmaking: spreadAround(p.overallRating),
    defenseInside: spreadAround(p.overallRating),
    defenseOutside: spreadAround(p.overallRating),
    rebounding: spreadAround(p.overallRating),
    athleticism: spreadAround(p.overallRating),
    basketballIQ: spreadAround(p.overallRating),
    clutch: spreadAround(p.overallRating),
    stamina: spreadAround(p.overallRating),
    scoutingNote: p.scoutingNote,
    // Vraies personnes identifiables : pas de tirage aléatoire, "États-Unis"
    // par défaut (dominante NCAA de ces listes) sauf annotation explicite.
    nationality: p.nationality ?? "États-Unis",
  }));

  const remaining = Math.max(0, classSize - realRows.length);
  const generatedRows = Array.from({ length: remaining }, (_, i) => {
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
      scoutingNote: null as string | null,
      // Prospect entièrement fictif : tirage pondéré déterministe (pas de
      // vraie personne à mal représenter).
      nationality: randomNationality(`${careerId}-${leagueId}-${season}-generated-${i}`),
    };
  });

  await prisma.prospect.createMany({ data: [...realRows, ...generatedRows] });
}
