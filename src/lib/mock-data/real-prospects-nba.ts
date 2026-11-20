import type { Position } from "@/lib/types";

// Vrais prospects NCAA/Europe/lycées pour les trois premières classes de
// draft NBA d'une Career (saisons "2027-2028", "2028-2029" et "2029-2030",
// soit les drafts de juin 2027, 2028 et 2029 — calculées à partir de
// League.season="2026-2027" et de nextSeasonLabel()). Chaque classe suit un
// classement publié (voir sa note). La classe 2026 (Dybantsa, Peterson, Boozer…) a été
// retirée : ces joueurs sont désormais dans le catalogue Player. Complété
// jusqu'à la taille réelle de la classe (60) par le générateur fictif dans
// generate-prospects.ts.
export interface ProspectSeed {
  firstName: string;
  lastName: string;
  position: Position;
  heightCm: number;
  age: number;
  overallRating: number;
  scoutingNote: string;
  // Renseignée pour les prospects internationaux repérables via le club dans
  // scoutingNote (best-effort, non vérifié en direct) ; sinon "États-Unis"
  // par défaut (voir generate-prospects.ts) — ce sont de vraies personnes
  // identifiables, jamais de tirage aléatoire ici.
  nationality?: string;
}

// Notes à l'échelle NBA 2K27 : les meilleurs rookies 2026 y sont à 79
// (Dybantsa, Peterson, Boozer) — cette classe, jugée plus faible, plafonne
// donc vers 79 (conversion de l'ancienne note maison : 65 + (note − 60) × 0,65).
export const NBA_REAL_PROSPECTS: Record<string, ProspectSeed[]> = {
  // Draft 2027 : top 30 du classement ESPN (Jeremy Woo, 25 juin 2026) — taille
  // et âge publiés pour le top 10, estimés d'après le poste et l'année
  // universitaire au-delà. Classe jugée faible par la presse : pas de
  // prospect au niveau d'un Dybantsa, d'où des notes plus basses.
  "2027-2028": [
    { firstName: "Tyran", lastName: "Stokes", position: "SF", heightCm: 201, age: 19, overallRating: 79, scoutingNote: "Kansas (NCAA)" },
    { firstName: "Jordan", lastName: "Smith Jr.", position: "PG", heightCm: 188, age: 19, overallRating: 78, scoutingNote: "Arkansas (NCAA)" },
    { firstName: "Caleb", lastName: "Holt", position: "SG", heightCm: 196, age: 19, overallRating: 78, scoutingNote: "Arizona (NCAA)" },
    { firstName: "Bruce", lastName: "Branch III", position: "SF", heightCm: 201, age: 18, overallRating: 77, scoutingNote: "BYU (NCAA)" },
    { firstName: "Stefan", lastName: "Joksimović", position: "PG", heightCm: 201, age: 18, overallRating: 77, scoutingNote: "Baskonia (Espagne)", nationality: "Serbie" },
    { firstName: "Braylon", lastName: "Mullins", position: "SG", heightCm: 198, age: 20, overallRating: 77, scoutingNote: "UConn (NCAA)" },
    { firstName: "Thomas", lastName: "Haugh", position: "PF", heightCm: 206, age: 23, overallRating: 76, scoutingNote: "Florida (NCAA)" },
    { firstName: "Jason", lastName: "Crowe Jr.", position: "PG", heightCm: 191, age: 18, overallRating: 76, scoutingNote: "Missouri (NCAA)" },
    { firstName: "Anthony", lastName: "Thompson", position: "PF", heightCm: 206, age: 18, overallRating: 75, scoutingNote: "Ohio State (NCAA)" },
    { firstName: "Cameron", lastName: "Williams", position: "C", heightCm: 211, age: 19, overallRating: 75, scoutingNote: "Duke (NCAA)" },
    { firstName: "Caleb", lastName: "Gaskins", position: "PF", heightCm: 206, age: 19, overallRating: 75, scoutingNote: "Miami (NCAA)" },
    { firstName: "Miikka", lastName: "Muurinen", position: "PF", heightCm: 208, age: 19, overallRating: 75, scoutingNote: "Arkansas (NCAA)", nationality: "Finlande" },
    { firstName: "Austin", lastName: "Goosby", position: "SG", heightCm: 193, age: 19, overallRating: 74, scoutingNote: "Texas (NCAA)" },
    { firstName: "Motiejus", lastName: "Krivas", position: "C", heightCm: 218, age: 22, overallRating: 74, scoutingNote: "Arizona (NCAA)", nationality: "Lituanie" },
    { firstName: "Luigi", lastName: "Suigo", position: "C", heightCm: 216, age: 19, overallRating: 74, scoutingNote: "Villanova (NCAA)", nationality: "Italie" },
    { firstName: "Matt", lastName: "Able", position: "SG", heightCm: 196, age: 20, overallRating: 73, scoutingNote: "North Carolina (NCAA)" },
    { firstName: "Alex", lastName: "Condon", position: "C", heightCm: 211, age: 22, overallRating: 73, scoutingNote: "Florida (NCAA)", nationality: "Australie" },
    { firstName: "Dame", lastName: "Sarr", position: "SG", heightCm: 198, age: 20, overallRating: 73, scoutingNote: "Duke (NCAA)", nationality: "Italie" },
    { firstName: "Cameron", lastName: "Houindo", position: "PF", heightCm: 206, age: 19, overallRating: 73, scoutingNote: "Cedevita (Croatie)", nationality: "France" },
    { firstName: "Christian", lastName: "Collins", position: "SF", heightCm: 203, age: 19, overallRating: 73, scoutingNote: "USC (NCAA)" },
    { firstName: "Babatunde", lastName: "Oladotun", position: "SF", heightCm: 201, age: 19, overallRating: 73, scoutingNote: "Maryland (NCAA)" },
    { firstName: "Jaxon", lastName: "Richardson", position: "SF", heightCm: 201, age: 19, overallRating: 72, scoutingNote: "Alabama (NCAA)" },
    { firstName: "Brandon", lastName: "McCoy", position: "SG", heightCm: 193, age: 19, overallRating: 72, scoutingNote: "Michigan (NCAA)" },
    { firstName: "Hugo", lastName: "Yimga-Moukouri", position: "SF", heightCm: 201, age: 19, overallRating: 72, scoutingNote: "Nanterre (France)", nationality: "France" },
    { firstName: "Sayon", lastName: "Keita", position: "C", heightCm: 211, age: 19, overallRating: 72, scoutingNote: "North Carolina (NCAA)" },
    { firstName: "Amari", lastName: "Allen", position: "SF", heightCm: 201, age: 20, overallRating: 72, scoutingNote: "Alabama (NCAA)" },
    { firstName: "Ivan", lastName: "Kharchenkov", position: "SF", heightCm: 201, age: 20, overallRating: 72, scoutingNote: "Arizona (NCAA)", nationality: "Allemagne" },
    { firstName: "Patrick", lastName: "Ngongba II", position: "C", heightCm: 211, age: 20, overallRating: 72, scoutingNote: "Duke (NCAA)" },
    { firstName: "Juke", lastName: "Harris", position: "SG", heightCm: 198, age: 20, overallRating: 72, scoutingNote: "Tennessee (NCAA)" },
    { firstName: "Tyler", lastName: "Tanner", position: "PG", heightCm: 183, age: 21, overallRating: 72, scoutingNote: "Vanderbilt (NCAA)" },
  ],
  // Draft 2028 : tête de classe d'après ESPN (Jeremy Woo, « Early players to
  // watch from the 2027, 2028 classes », 20 août 2026 : Boumtje Boumtje en
  // n° 1 pressenti, Kusturica), Spears Jr. (reclassé, à Texas, éligible en
  // 2028 — Hoops Rumors), puis la promotion de lycée 2027 dans l'ordre du
  // classement ESPN SCNEXT (une saison universitaire avant la draft).
  // Notes : estimations du jeu à l'échelle 2K, décroissantes selon ce rang.
  "2028-2029": [
    { firstName: "Joaquim", lastName: "Boumtje Boumtje", position: "PF", heightCm: 218, age: 19, overallRating: 79, scoutingNote: "Duke (NCAA) — ex-FC Barcelone, MVP Coupe du monde U17" },
    { firstName: "Nikola", lastName: "Kusturica", position: "SF", heightCm: 201, age: 19, overallRating: 78, scoutingNote: "UCLA (NCAA) — ex-FC Barcelone", nationality: "Serbie" },
    { firstName: "Marcus", lastName: "Spears Jr.", position: "PF", heightCm: 208, age: 19, overallRating: 76, scoutingNote: "Texas (NCAA)" },
    { firstName: "Beckham", lastName: "Black", position: "PG", heightCm: 191, age: 19, overallRating: 77, scoutingNote: "lycée Southeastern Prep (USA), promo 2027" },
    { firstName: "Demarcus", lastName: "Henry", position: "SF", heightCm: 201, age: 19, overallRating: 77, scoutingNote: "North Carolina (engagé), promo 2027" },
    { firstName: "C.J.", lastName: "Rosser", position: "PF", heightCm: 206, age: 19, overallRating: 76, scoutingNote: "lycée Southeastern Prep (USA), promo 2027" },
    { firstName: "Cayden", lastName: "Daughtry", position: "PG", heightCm: 180, age: 19, overallRating: 75, scoutingNote: "Arkansas (engagé), promo 2027" },
    { firstName: "A.J.", lastName: "Williams", position: "SF", heightCm: 198, age: 18, overallRating: 75, scoutingNote: "lycée Eagles Landing (USA), promo 2027" },
    { firstName: "Lewis", lastName: "Uvwo", position: "C", heightCm: 208, age: 19, overallRating: 74, scoutingNote: "Providence (engagé), promo 2027" },
    { firstName: "Asa", lastName: "Montgomery", position: "SF", heightCm: 198, age: 19, overallRating: 74, scoutingNote: "Duke (engagé), promo 2027" },
    { firstName: "Cherif", lastName: "Millogo", position: "C", heightCm: 226, age: 19, overallRating: 73, scoutingNote: "Kentucky (engagé), promo 2027" },
    { firstName: "NaVorro", lastName: "Bowman Jr.", position: "PG", heightCm: 193, age: 19, overallRating: 73, scoutingNote: "UConn (engagé), promo 2027" },
    { firstName: "Adan", lastName: "Diggs", position: "SG", heightCm: 193, age: 19, overallRating: 72, scoutingNote: "Arizona (engagé), promo 2027" },
    { firstName: "Jordan", lastName: "Page", position: "SF", heightCm: 198, age: 19, overallRating: 72, scoutingNote: "UConn (engagé), promo 2027" },
    { firstName: "Darius", lastName: "Wabbington", position: "C", heightCm: 211, age: 19, overallRating: 72, scoutingNote: "Indiana (engagé), promo 2027" },
    { firstName: "Reese", lastName: "Alston", position: "PG", heightCm: 188, age: 19, overallRating: 71, scoutingNote: "LSU (engagé), promo 2027" },
    { firstName: "King", lastName: "Gibson", position: "SG", heightCm: 196, age: 19, overallRating: 71, scoutingNote: "LSU (engagé), promo 2027" },
    { firstName: "Nasir", lastName: "Anderson", position: "PG", heightCm: 193, age: 19, overallRating: 71, scoutingNote: "lycée Prolific Prep (USA), promo 2027" },
    { firstName: "Zion", lastName: "Green", position: "PF", heightCm: 206, age: 19, overallRating: 70, scoutingNote: "Alabama (engagé), promo 2027" },
    { firstName: "Isaiah", lastName: "Hill", position: "C", heightCm: 213, age: 19, overallRating: 70, scoutingNote: "Purdue (engagé), promo 2027" },
    { firstName: "Xavier", lastName: "Young", position: "C", heightCm: 206, age: 19, overallRating: 70, scoutingNote: "LSU (engagé), promo 2027" },
    { firstName: "Moussa", lastName: "Kamissoko", position: "PF", heightCm: 203, age: 19, overallRating: 69, scoutingNote: "Syracuse (engagé), promo 2027" },
    { firstName: "Kager", lastName: "Knueppel", position: "PF", heightCm: 208, age: 19, overallRating: 69, scoutingNote: "Duke (engagé), promo 2027" },
    { firstName: "Malachi", lastName: "Jordan", position: "SF", heightCm: 196, age: 19, overallRating: 69, scoutingNote: "St. John's (engagé), promo 2027" },
    { firstName: "Ahmed", lastName: "Nur", position: "PF", heightCm: 203, age: 19, overallRating: 68, scoutingNote: "Ole Miss (engagé), promo 2027" },
    { firstName: "Jarvis", lastName: "Hayes", position: "SG", heightCm: 196, age: 19, overallRating: 68, scoutingNote: "Georgia (engagé), promo 2027" },
    { firstName: "Chase", lastName: "Lumpkin", position: "SG", heightCm: 196, age: 19, overallRating: 68, scoutingNote: "Alabama (engagé), promo 2027" },
    { firstName: "Antonio", lastName: "Pemberton", position: "PG", heightCm: 185, age: 19, overallRating: 67, scoutingNote: "Michigan State (engagé), promo 2027" },
    { firstName: "Ahmad", lastName: "Hudson", position: "PF", heightCm: 201, age: 19, overallRating: 67, scoutingNote: "LSU (engagé), promo 2027" },
    { firstName: "Dooney", lastName: "Johnson", position: "PG", heightCm: 196, age: 19, overallRating: 67, scoutingNote: "Gonzaga (engagé), promo 2027" },
  ],
  // Draft 2029 : promotion de lycée 2028, top 30 du classement ESPN SCNEXT 60
  // (une saison universitaire avant la draft). Même principe de notes.
  "2029-2030": [
    { firstName: "Yann", lastName: "Kamagate", position: "C", heightCm: 213, age: 19, overallRating: 78, scoutingNote: "lycée Saint Francis (USA), promo 2028" },
    { firstName: "Benjamin", lastName: "Berrouet", position: "PF", heightCm: 203, age: 19, overallRating: 77, scoutingNote: "lycée Dynamic Prep (USA), promo 2028" },
    { firstName: "Mason", lastName: "Collins", position: "SF", heightCm: 198, age: 19, overallRating: 76, scoutingNote: "lycée Tatnall (USA), promo 2028" },
    { firstName: "Colton", lastName: "Hiller", position: "SF", heightCm: 198, age: 19, overallRating: 76, scoutingNote: "lycée Coatesville (USA), promo 2028" },
    { firstName: "Erick", lastName: "Dampier Jr.", position: "C", heightCm: 206, age: 19, overallRating: 75, scoutingNote: "lycée Madison-Ridgeland (USA), promo 2028" },
    { firstName: "Bamba", lastName: "Touray", position: "C", heightCm: 213, age: 19, overallRating: 75, scoutingNote: "lycée Prolific Prep (USA), promo 2028" },
    { firstName: "Josiah", lastName: "Rose", position: "PG", heightCm: 191, age: 19, overallRating: 74, scoutingNote: "lycée Faith Family (USA), promo 2028" },
    { firstName: "Evan", lastName: "Willis", position: "PF", heightCm: 201, age: 19, overallRating: 74, scoutingNote: "lycée Utah Prep (USA), promo 2028" },
    { firstName: "Myles", lastName: "Hayes", position: "SG", heightCm: 196, age: 19, overallRating: 73, scoutingNote: "lycée Woodward Academy (USA), promo 2028" },
    { firstName: "Brady", lastName: "Pettigrew", position: "SG", heightCm: 191, age: 19, overallRating: 73, scoutingNote: "lycée Bolingbrook (USA), promo 2028" },
    { firstName: "Bentley", lastName: "Lusakueno", position: "PF", heightCm: 208, age: 19, overallRating: 73, scoutingNote: "IMG Academy (USA), promo 2028" },
    { firstName: "Jordan", lastName: "Mize", position: "SF", heightCm: 196, age: 19, overallRating: 72, scoutingNote: "lycée Sierra Canyon (USA), promo 2028" },
    { firstName: "Blaze", lastName: "Johnson", position: "SG", heightCm: 196, age: 19, overallRating: 72, scoutingNote: "lycée Dynamic Prep (USA), promo 2028" },
    { firstName: "Mateen", lastName: "Cleaves Jr.", position: "PG", heightCm: 191, age: 19, overallRating: 72, scoutingNote: "lycée Dream City Christian (USA), promo 2028" },
    { firstName: "Dylan", lastName: "Betts", position: "C", heightCm: 221, age: 19, overallRating: 71, scoutingNote: "IMG Academy (USA), promo 2028" },
    { firstName: "Isaiah", lastName: "Hamilton", position: "SF", heightCm: 201, age: 19, overallRating: 71, scoutingNote: "Montverde Academy (USA), promo 2028", nationality: "Canada" },
    { firstName: "Xavier", lastName: "Skipworth", position: "SF", heightCm: 196, age: 19, overallRating: 71, scoutingNote: "Montverde Academy (USA), promo 2028" },
    { firstName: "Liam", lastName: "Mitakaro", position: "SG", heightCm: 191, age: 19, overallRating: 70, scoutingNote: "CIA Bella Vista Prep (USA), promo 2028", nationality: "Canada" },
    { firstName: "Tai", lastName: "Bell", position: "SG", heightCm: 191, age: 19, overallRating: 70, scoutingNote: "lycée Christopher Columbus (USA), promo 2028" },
    { firstName: "Martin", lastName: "Sibal", position: "C", heightCm: 218, age: 19, overallRating: 70, scoutingNote: "lycée Christopher Columbus (USA), promo 2028" },
    { firstName: "Logan", lastName: "Chwastyk", position: "C", heightCm: 206, age: 19, overallRating: 69, scoutingNote: "lycée Malvern Prep (USA), promo 2028" },
    { firstName: "Michai", lastName: "White", position: "PG", heightCm: 185, age: 19, overallRating: 69, scoutingNote: "lycée Prolific Prep (USA), promo 2028" },
    { firstName: "Kevin", lastName: "Wheatley", position: "SF", heightCm: 198, age: 19, overallRating: 69, scoutingNote: "lycée Iowa United Prep (USA), promo 2028" },
    { firstName: "Anthony", lastName: "Spratt", position: "SG", heightCm: 193, age: 19, overallRating: 68, scoutingNote: "lycée Benton (USA), promo 2028" },
    { firstName: "JJ", lastName: "Sati-Grier", position: "PG", heightCm: 178, age: 19, overallRating: 68, scoutingNote: "lycée Sierra Canyon (USA), promo 2028" },
    { firstName: "Nash", lastName: "Avery", position: "PF", heightCm: 203, age: 19, overallRating: 68, scoutingNote: "lycée Archbishop Spalding (USA), promo 2028" },
    { firstName: "Shalen", lastName: "Sheppard", position: "PF", heightCm: 203, age: 19, overallRating: 67, scoutingNote: "lycée Crossroads (USA), promo 2028" },
    { firstName: "Darren", lastName: "Ford", position: "SG", heightCm: 188, age: 19, overallRating: 67, scoutingNote: "AZ Compass Prep (USA), promo 2028" },
    { firstName: "Josh", lastName: "Lowery", position: "SF", heightCm: 193, age: 19, overallRating: 67, scoutingNote: "lycée Sierra Canyon (USA), promo 2028" },
    { firstName: "Will", lastName: "Brunson", position: "SF", heightCm: 196, age: 19, overallRating: 67, scoutingNote: "IMG Academy (USA), promo 2028" },
  ],
};
