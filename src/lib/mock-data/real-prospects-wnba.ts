import type { ProspectSeed } from "./real-prospects-nba";

// Mêmes principes que real-prospects-nba.ts : 3 classes réelles (saisons
// "2027", "2028", "2029" — calculées depuis League.season="2026" côté
// WNBA), fiabilité décroissante avec l'horizon, complété jusqu'à la taille
// réelle de la classe (26) par le générateur fictif.
export const WNBA_REAL_PROSPECTS: Record<string, ProspectSeed[]> = {
  "2027": [
    { firstName: "JuJu", lastName: "Watkins", position: "SG", heightCm: 183, age: 20, overallRating: 88, scoutingNote: "USC (NCAA)" },
    { firstName: "Olivia", lastName: "Miles", position: "PG", heightCm: 180, age: 22, overallRating: 84, scoutingNote: "TCU (NCAA)" },
    { firstName: "Hannah", lastName: "Hidalgo", position: "PG", heightCm: 165, age: 20, overallRating: 84, scoutingNote: "Notre Dame (NCAA)" },
    { firstName: "Sarah", lastName: "Strong", position: "PF", heightCm: 191, age: 19, overallRating: 83, scoutingNote: "UConn (NCAA)" },
    { firstName: "Lauren", lastName: "Betts", position: "C", heightCm: 201, age: 20, overallRating: 82, scoutingNote: "UCLA (NCAA)" },
    { firstName: "Madison", lastName: "Booker", position: "SG", heightCm: 185, age: 20, overallRating: 82, scoutingNote: "Texas (NCAA)" },
    { firstName: "Mikaylah", lastName: "Williams", position: "SG", heightCm: 178, age: 19, overallRating: 81, scoutingNote: "LSU (NCAA)" },
    { firstName: "Azzi", lastName: "Fudd", position: "SG", heightCm: 178, age: 22, overallRating: 80, scoutingNote: "UConn (NCAA)" },
    { firstName: "Kiki", lastName: "Rice", position: "PG", heightCm: 180, age: 21, overallRating: 79, scoutingNote: "UCLA (NCAA)" },
    { firstName: "Ta'Niya", lastName: "Latson", position: "PG", heightCm: 170, age: 21, overallRating: 78, scoutingNote: "USC (NCAA)" },
    { firstName: "Georgia", lastName: "Amoore", position: "PG", heightCm: 170, age: 23, overallRating: 77, scoutingNote: "Kentucky (NCAA)" },
    { firstName: "Chance", lastName: "Gray", position: "SG", heightCm: 178, age: 21, overallRating: 75, scoutingNote: "USC (NCAA)" },
    { firstName: "Dominika", lastName: "Paurová", position: "SF", heightCm: 188, age: 20, overallRating: 74, scoutingNote: "Rutgers (NCAA) / Slovaquie", nationality: "Slovaquie" },
    { firstName: "Sania", lastName: "Feagin", position: "C", heightCm: 191, age: 21, overallRating: 76, scoutingNote: "South Carolina (NCAA)" },
    { firstName: "Kate", lastName: "Koval", position: "C", heightCm: 196, age: 20, overallRating: 74, scoutingNote: "Rutgers (NCAA) / Ukraine", nationality: "Ukraine" },
  ],
  "2028": [
    { firstName: "ZaZa", lastName: "Harrison", position: "PG", heightCm: 175, age: 19, overallRating: 76, scoutingNote: "South Carolina (NCAA)" },
    { firstName: "Jerzy", lastName: "Robinson", position: "SG", heightCm: 180, age: 19, overallRating: 74, scoutingNote: "South Carolina (NCAA)" },
    { firstName: "Aicha", lastName: "Coulibaly", position: "SF", heightCm: 185, age: 19, overallRating: 72, scoutingNote: "Ohio State (NCAA) / Mali", nationality: "Mali" },
    { firstName: "Syla", lastName: "Swords", position: "SG", heightCm: 180, age: 19, overallRating: 75, scoutingNote: "Michigan (NCAA)" },
    { firstName: "Justice", lastName: "Carlton", position: "PF", heightCm: 188, age: 19, overallRating: 72, scoutingNote: "Alabama (NCAA)" },
    { firstName: "Serena", lastName: "Sundell", position: "PG", heightCm: 178, age: 20, overallRating: 73, scoutingNote: "Kansas State (NCAA)" },
    { firstName: "Kennedy", lastName: "Smith", position: "SG", heightCm: 175, age: 19, overallRating: 71, scoutingNote: "Ole Miss (NCAA)" },
    { firstName: "Talaysia", lastName: "Cooper", position: "SF", heightCm: 183, age: 19, overallRating: 73, scoutingNote: "South Carolina (NCAA)" },
  ],
  "2029": [
    { firstName: "Kiyomi", lastName: "McMiller", position: "PG", heightCm: 175, age: 18, overallRating: 73, scoutingNote: "Rutgers (NCAA)" },
    { firstName: "Saniyah", lastName: "Hall", position: "SG", heightCm: 183, age: 18, overallRating: 71, scoutingNote: "Michigan State (NCAA)" },
    { firstName: "Jordan", lastName: "Lee", position: "SG", heightCm: 178, age: 18, overallRating: 71, scoutingNote: "LSU (NCAA)" },
    { firstName: "Amiyah", lastName: "Reynolds", position: "PG", heightCm: 173, age: 18, overallRating: 70, scoutingNote: "Ohio State (NCAA)" },
  ],
};
