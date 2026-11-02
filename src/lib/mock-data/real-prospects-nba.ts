import type { Position } from "@/lib/types";

// Vrais prospects NCAA/Europe pour les premières classes de draft NBA d'une
// Career (saisons "2027-2028" et "2028-2029" — calculées à partir de
// League.season="2026-2027" et de nextSeasonLabel()). La classe 2027 suit un
// classement publié (voir sa note) ; la classe 2028, rédigée de mémoire, est
// plus spéculative. La classe 2026 (Dybantsa, Peterson, Boozer…) a été
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

export const NBA_REAL_PROSPECTS: Record<string, ProspectSeed[]> = {
  // Draft 2027 : top 30 du classement ESPN (Jeremy Woo, 25 juin 2026) — taille
  // et âge publiés pour le top 10, estimés d'après le poste et l'année
  // universitaire au-delà. Classe jugée faible par la presse : pas de
  // prospect au niveau d'un Dybantsa, d'où des notes plus basses.
  "2027-2028": [
    { firstName: "Tyran", lastName: "Stokes", position: "SF", heightCm: 201, age: 19, overallRating: 82, scoutingNote: "Kansas (NCAA)" },
    { firstName: "Jordan", lastName: "Smith Jr.", position: "PG", heightCm: 188, age: 19, overallRating: 80, scoutingNote: "Arkansas (NCAA)" },
    { firstName: "Caleb", lastName: "Holt", position: "SG", heightCm: 196, age: 19, overallRating: 80, scoutingNote: "Arizona (NCAA)" },
    { firstName: "Bruce", lastName: "Branch III", position: "SF", heightCm: 201, age: 18, overallRating: 79, scoutingNote: "BYU (NCAA)" },
    { firstName: "Stefan", lastName: "Joksimović", position: "PG", heightCm: 201, age: 18, overallRating: 78, scoutingNote: "Baskonia (Espagne)", nationality: "Serbie" },
    { firstName: "Braylon", lastName: "Mullins", position: "SG", heightCm: 198, age: 20, overallRating: 78, scoutingNote: "UConn (NCAA)" },
    { firstName: "Thomas", lastName: "Haugh", position: "PF", heightCm: 206, age: 23, overallRating: 77, scoutingNote: "Florida (NCAA)" },
    { firstName: "Jason", lastName: "Crowe Jr.", position: "PG", heightCm: 191, age: 18, overallRating: 77, scoutingNote: "Missouri (NCAA)" },
    { firstName: "Anthony", lastName: "Thompson", position: "PF", heightCm: 206, age: 18, overallRating: 76, scoutingNote: "Ohio State (NCAA)" },
    { firstName: "Cameron", lastName: "Williams", position: "C", heightCm: 211, age: 19, overallRating: 76, scoutingNote: "Duke (NCAA)" },
    { firstName: "Caleb", lastName: "Gaskins", position: "PF", heightCm: 206, age: 19, overallRating: 75, scoutingNote: "Miami (NCAA)" },
    { firstName: "Miikka", lastName: "Muurinen", position: "PF", heightCm: 208, age: 19, overallRating: 75, scoutingNote: "Arkansas (NCAA)", nationality: "Finlande" },
    { firstName: "Austin", lastName: "Goosby", position: "SG", heightCm: 193, age: 19, overallRating: 74, scoutingNote: "Texas (NCAA)" },
    { firstName: "Motiejus", lastName: "Krivas", position: "C", heightCm: 218, age: 22, overallRating: 74, scoutingNote: "Arizona (NCAA)", nationality: "Lituanie" },
    { firstName: "Luigi", lastName: "Suigo", position: "C", heightCm: 216, age: 19, overallRating: 74, scoutingNote: "Villanova (NCAA)", nationality: "Italie" },
    { firstName: "Matt", lastName: "Able", position: "SG", heightCm: 196, age: 20, overallRating: 73, scoutingNote: "North Carolina (NCAA)" },
    { firstName: "Alex", lastName: "Condon", position: "C", heightCm: 211, age: 22, overallRating: 73, scoutingNote: "Florida (NCAA)", nationality: "Australie" },
    { firstName: "Dame", lastName: "Sarr", position: "SG", heightCm: 198, age: 20, overallRating: 73, scoutingNote: "Duke (NCAA)", nationality: "Italie" },
    { firstName: "Cameron", lastName: "Houindo", position: "PF", heightCm: 206, age: 19, overallRating: 72, scoutingNote: "Cedevita (Croatie)", nationality: "France" },
    { firstName: "Christian", lastName: "Collins", position: "SF", heightCm: 203, age: 19, overallRating: 72, scoutingNote: "USC (NCAA)" },
    { firstName: "Babatunde", lastName: "Oladotun", position: "SF", heightCm: 201, age: 19, overallRating: 72, scoutingNote: "Maryland (NCAA)" },
    { firstName: "Jaxon", lastName: "Richardson", position: "SF", heightCm: 201, age: 19, overallRating: 71, scoutingNote: "Alabama (NCAA)" },
    { firstName: "Brandon", lastName: "McCoy", position: "SG", heightCm: 193, age: 19, overallRating: 71, scoutingNote: "Michigan (NCAA)" },
    { firstName: "Hugo", lastName: "Yimga-Moukouri", position: "SF", heightCm: 201, age: 19, overallRating: 71, scoutingNote: "Nanterre (France)", nationality: "France" },
    { firstName: "Sayon", lastName: "Keita", position: "C", heightCm: 211, age: 19, overallRating: 71, scoutingNote: "North Carolina (NCAA)" },
    { firstName: "Amari", lastName: "Allen", position: "SF", heightCm: 201, age: 20, overallRating: 70, scoutingNote: "Alabama (NCAA)" },
    { firstName: "Ivan", lastName: "Kharchenkov", position: "SF", heightCm: 201, age: 20, overallRating: 70, scoutingNote: "Arizona (NCAA)", nationality: "Allemagne" },
    { firstName: "Patrick", lastName: "Ngongba II", position: "C", heightCm: 211, age: 20, overallRating: 70, scoutingNote: "Duke (NCAA)" },
    { firstName: "Juke", lastName: "Harris", position: "SG", heightCm: 198, age: 20, overallRating: 70, scoutingNote: "Tennessee (NCAA)" },
    { firstName: "Tyler", lastName: "Tanner", position: "PG", heightCm: 183, age: 21, overallRating: 70, scoutingNote: "Vanderbilt (NCAA)" },
  ],
  "2028-2029": [
    { firstName: "A.J.", lastName: "Swinton", position: "SG", heightCm: 193, age: 17, overallRating: 73, scoutingNote: "lycée (USA)" },
    { firstName: "Ian", lastName: "Jackson", position: "SG", heightCm: 196, age: 20, overallRating: 74, scoutingNote: "North Carolina (NCAA)" },
    { firstName: "Dean", lastName: "Connor", position: "SF", heightCm: 201, age: 17, overallRating: 71, scoutingNote: "lycée (USA)" },
    { firstName: "Chris", lastName: "Ellis Jr.", position: "PF", heightCm: 203, age: 17, overallRating: 71, scoutingNote: "lycée (USA)" },
    { firstName: "Faizon", lastName: "Fields", position: "PG", heightCm: 188, age: 17, overallRating: 70, scoutingNote: "lycée (USA)" },
  ],
};
