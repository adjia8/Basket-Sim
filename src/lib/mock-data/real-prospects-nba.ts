import type { Position } from "@/lib/types";

// Vrais prospects NCAA/Europe pour les 3 premières classes de draft NBA
// d'une Career (saisons "2026-2027", "2027-2028", "2028-2029" — calculées à
// partir de League.season="2025-2026" et de nextSeasonLabel()). Rédigé à
// partir de ma connaissance d'entraînement (pas une vérification live) : la
// fiabilité décroît avec l'horizon — la classe 1 (la plus proche) est la
// plus fiable, la classe 3 (joueurs encore au lycée/en début de fac
// aujourd'hui, projetés à 3 ans) la plus spéculative. Complété jusqu'à la
// taille réelle de la classe (60) par le générateur fictif dans
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
  "2026-2027": [
    { firstName: "AJ", lastName: "Dybantsa", position: "SF", heightCm: 203, age: 19, overallRating: 88, scoutingNote: "BYU (NCAA)" },
    { firstName: "Cameron", lastName: "Boozer", position: "PF", heightCm: 206, age: 19, overallRating: 87, scoutingNote: "Duke (NCAA)" },
    { firstName: "Cayden", lastName: "Boozer", position: "PG", heightCm: 191, age: 19, overallRating: 78, scoutingNote: "Duke (NCAA)" },
    { firstName: "Darryn", lastName: "Peterson", position: "SG", heightCm: 196, age: 19, overallRating: 86, scoutingNote: "Kansas (NCAA)" },
    { firstName: "Chris", lastName: "Cenac Jr.", position: "C", heightCm: 211, age: 19, overallRating: 82, scoutingNote: "Houston (NCAA)" },
    { firstName: "Caleb", lastName: "Wilson", position: "PF", heightCm: 206, age: 19, overallRating: 82, scoutingNote: "North Carolina (NCAA)" },
    { firstName: "Jasper", lastName: "Johnson", position: "SG", heightCm: 193, age: 19, overallRating: 81, scoutingNote: "Kentucky (NCAA)" },
    { firstName: "Mikel", lastName: "Brown Jr.", position: "PG", heightCm: 188, age: 19, overallRating: 81, scoutingNote: "Louisville (NCAA)" },
    { firstName: "Koa", lastName: "Peat", position: "PF", heightCm: 206, age: 19, overallRating: 80, scoutingNote: "Arizona (NCAA)" },
    { firstName: "Tounde", lastName: "Yessoufou", position: "SF", heightCm: 198, age: 19, overallRating: 80, scoutingNote: "Baylor (NCAA)" },
    { firstName: "Nate", lastName: "Ament", position: "SF", heightCm: 206, age: 19, overallRating: 79, scoutingNote: "Tennessee (NCAA)" },
    { firstName: "Alijah", lastName: "Arenas", position: "SG", heightCm: 196, age: 19, overallRating: 79, scoutingNote: "USC (NCAA)" },
    { firstName: "Meleek", lastName: "Thomas", position: "SG", heightCm: 191, age: 19, overallRating: 78, scoutingNote: "Arkansas (NCAA)" },
    { firstName: "Baye", lastName: "Fall", position: "C", heightCm: 211, age: 19, overallRating: 77, scoutingNote: "Arkansas (NCAA)" },
    { firstName: "Darius", lastName: "Acuff Jr.", position: "PG", heightCm: 188, age: 19, overallRating: 77, scoutingNote: "Arkansas (NCAA)" },
    { firstName: "Isiah", lastName: "Harwell", position: "SG", heightCm: 196, age: 19, overallRating: 76, scoutingNote: "Houston (NCAA)" },
    { firstName: "Braylon", lastName: "Mullins", position: "SG", heightCm: 193, age: 19, overallRating: 76, scoutingNote: "UConn (NCAA)" },
    { firstName: "Labaron", lastName: "Philon", position: "PG", heightCm: 191, age: 20, overallRating: 76, scoutingNote: "Alabama (NCAA)" },
    { firstName: "Isaiah", lastName: "Elohim", position: "SF", heightCm: 198, age: 19, overallRating: 75, scoutingNote: "UCLA (NCAA)" },
    { firstName: "Bryson", lastName: "Warren", position: "PG", heightCm: 188, age: 19, overallRating: 74, scoutingNote: "Illinois (NCAA)" },
    { firstName: "Hugo", lastName: "González", position: "SF", heightCm: 201, age: 20, overallRating: 79, scoutingNote: "Real Madrid (Espagne)", nationality: "Espagne" },
    { firstName: "Nolan", lastName: "Traoré", position: "PG", heightCm: 193, age: 19, overallRating: 78, scoutingNote: "Saint-Quentin (France)", nationality: "France" },
    { firstName: "Ben", lastName: "Saraf", position: "PG", heightCm: 196, age: 19, overallRating: 77, scoutingNote: "Ratiopharm Ulm (Allemagne)", nationality: "Israël" },
    { firstName: "Noa", lastName: "Essengue", position: "PF", heightCm: 206, age: 19, overallRating: 77, scoutingNote: "Ratiopharm Ulm (Allemagne)", nationality: "France" },
    { firstName: "Karim", lastName: "Lopez", position: "SF", heightCm: 201, age: 19, overallRating: 74, scoutingNote: "Baskonia (Espagne)", nationality: "Espagne" },
    { firstName: "Nikola", lastName: "Djurisic", position: "SF", heightCm: 201, age: 19, overallRating: 73, scoutingNote: "Mega Basket (Serbie)", nationality: "Serbie" },
    { firstName: "Aday", lastName: "Mara", position: "C", heightCm: 216, age: 20, overallRating: 76, scoutingNote: "Michigan (NCAA)", nationality: "Espagne" },
    { firstName: "Adou", lastName: "Thiero", position: "SF", heightCm: 198, age: 21, overallRating: 76, scoutingNote: "Arkansas (NCAA)" },
    { firstName: "Rasheer", lastName: "Fleming", position: "PF", heightCm: 206, age: 21, overallRating: 74, scoutingNote: "Saint Joseph's (NCAA)" },
    { firstName: "Sergio", lastName: "De Larrea", position: "PG", heightCm: 193, age: 19, overallRating: 74, scoutingNote: "Valencia (Espagne)", nationality: "Espagne" },
  ],
  "2027-2028": [
    { firstName: "Tajh", lastName: "Ariza", position: "SF", heightCm: 201, age: 18, overallRating: 78, scoutingNote: "lycée (USA)" },
    { firstName: "Jasiah", lastName: "Wagoner", position: "SG", heightCm: 191, age: 18, overallRating: 76, scoutingNote: "Oregon (NCAA, engagé)" },
    { firstName: "Kiyan", lastName: "Anthony", position: "SG", heightCm: 196, age: 19, overallRating: 75, scoutingNote: "Syracuse (NCAA)" },
    { firstName: "Cameron", lastName: "Holmes", position: "PF", heightCm: 203, age: 18, overallRating: 75, scoutingNote: "Duke (NCAA, engagé)" },
    { firstName: "Chris", lastName: "Nwuli", position: "C", heightCm: 211, age: 18, overallRating: 74, scoutingNote: "lycée (USA)" },
    { firstName: "Deniz", lastName: "Kececi", position: "PF", heightCm: 206, age: 18, overallRating: 74, scoutingNote: "Turquie", nationality: "Turquie" },
    { firstName: "Kayden", lastName: "Mingo", position: "SG", heightCm: 193, age: 18, overallRating: 73, scoutingNote: "lycée (USA)" },
    { firstName: "Jasper", lastName: "Wilson", position: "PG", heightCm: 188, age: 18, overallRating: 73, scoutingNote: "lycée (USA)" },
    { firstName: "Brayden", lastName: "Burries", position: "SG", heightCm: 196, age: 19, overallRating: 76, scoutingNote: "Arizona (NCAA)" },
    { firstName: "Malachi", lastName: "Moreno", position: "C", heightCm: 213, age: 19, overallRating: 74, scoutingNote: "Kentucky (NCAA)" },
    { firstName: "Somto", lastName: "Cyril", position: "PF", heightCm: 206, age: 19, overallRating: 72, scoutingNote: "Baylor (NCAA)" },
    { firstName: "Davis", lastName: "Fogle", position: "SG", heightCm: 193, age: 19, overallRating: 71, scoutingNote: "Wake Forest (NCAA)" },
    { firstName: "Elzie", lastName: "Harrington", position: "SG", heightCm: 191, age: 19, overallRating: 71, scoutingNote: "Texas Tech (NCAA)" },
    { firstName: "Karter", lastName: "Knox", position: "SG", heightCm: 196, age: 19, overallRating: 73, scoutingNote: "Arkansas (NCAA)" },
    { firstName: "Jerry", lastName: "Easter II", position: "SG", heightCm: 193, age: 18, overallRating: 72, scoutingNote: "Duke (NCAA, engagé)" },
  ],
  "2028-2029": [
    { firstName: "A.J.", lastName: "Swinton", position: "SG", heightCm: 193, age: 17, overallRating: 73, scoutingNote: "lycée (USA)" },
    { firstName: "Ian", lastName: "Jackson", position: "SG", heightCm: 196, age: 20, overallRating: 74, scoutingNote: "North Carolina (NCAA)" },
    { firstName: "Dean", lastName: "Connor", position: "SF", heightCm: 201, age: 17, overallRating: 71, scoutingNote: "lycée (USA)" },
    { firstName: "Chris", lastName: "Ellis Jr.", position: "PF", heightCm: 203, age: 17, overallRating: 71, scoutingNote: "lycée (USA)" },
    { firstName: "Faizon", lastName: "Fields", position: "PG", heightCm: 188, age: 17, overallRating: 70, scoutingNote: "lycée (USA)" },
  ],
};
