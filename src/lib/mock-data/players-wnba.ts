import type { Player } from "@/lib/types";
import { mkPlayer } from "./player-helpers";

export const playersWnba: Player[] = [
  // --- Las Vegas Aces ---
  mkPlayer({ id: "aja-wilson", teamId: "las-vegas-aces", leagueId: "wnba", firstName: "A'ja", lastName: "Wilson", position: "PF", jerseyNumber: 22, heightCm: 193, age: 29, overallRating: 98 }),
  mkPlayer({ id: "kelsey-plum", teamId: "las-vegas-aces", leagueId: "wnba", firstName: "Kelsey", lastName: "Plum", position: "PG", jerseyNumber: 10, heightCm: 173, age: 31, overallRating: 90 }),
  mkPlayer({ id: "jackie-young", teamId: "las-vegas-aces", leagueId: "wnba", firstName: "Jackie", lastName: "Young", position: "SG", jerseyNumber: 0, heightCm: 180, age: 27, overallRating: 86 }),
  mkPlayer({ id: "chelsea-gray", teamId: "las-vegas-aces", leagueId: "wnba", firstName: "Chelsea", lastName: "Gray", position: "PG", jerseyNumber: 12, heightCm: 178, age: 33, overallRating: 85 }),
  mkPlayer({ id: "alysha-clark", teamId: "las-vegas-aces", leagueId: "wnba", firstName: "Alysha", lastName: "Clark", position: "SF", jerseyNumber: 32, heightCm: 180, age: 38, overallRating: 72 }),
  mkPlayer({ id: "nalyssa-smith", teamId: "las-vegas-aces", leagueId: "wnba", firstName: "NaLyssa", lastName: "Smith", position: "PF", jerseyNumber: 1, heightCm: 193, age: 25, overallRating: 79 }),
  mkPlayer({ id: "tiffany-hayes", teamId: "las-vegas-aces", leagueId: "wnba", firstName: "Tiffany", lastName: "Hayes", position: "SG", jerseyNumber: 15, heightCm: 175, age: 35, overallRating: 75 }),
  mkPlayer({ id: "megan-gustafson", teamId: "las-vegas-aces", leagueId: "wnba", firstName: "Megan", lastName: "Gustafson", position: "C", jerseyNumber: 13, heightCm: 193, age: 28, overallRating: 68 }),

  // --- New York Liberty ---
  mkPlayer({ id: "breanna-stewart", teamId: "new-york-liberty", leagueId: "wnba", firstName: "Breanna", lastName: "Stewart", position: "PF", jerseyNumber: 30, heightCm: 193, age: 31, overallRating: 97 }),
  mkPlayer({ id: "sabrina-ionescu", teamId: "new-york-liberty", leagueId: "wnba", firstName: "Sabrina", lastName: "Ionescu", position: "PG", jerseyNumber: 20, heightCm: 180, age: 28, overallRating: 92 }),
  mkPlayer({ id: "jonquel-jones", teamId: "new-york-liberty", leagueId: "wnba", firstName: "Jonquel", lastName: "Jones", position: "C", jerseyNumber: 35, heightCm: 201, age: 31, overallRating: 88 }),
  mkPlayer({ id: "betnijah-laney-hamilton", teamId: "new-york-liberty", leagueId: "wnba", firstName: "Betnijah", lastName: "Laney-Hamilton", position: "SG", jerseyNumber: 44, heightCm: 178, age: 31, overallRating: 80 }),
  mkPlayer({ id: "courtney-vandersloot", teamId: "new-york-liberty", leagueId: "wnba", firstName: "Courtney", lastName: "Vandersloot", position: "PG", jerseyNumber: 22, heightCm: 175, age: 37, overallRating: 78 }),
  mkPlayer({ id: "leonie-fiebich", teamId: "new-york-liberty", leagueId: "wnba", firstName: "Leonie", lastName: "Fiebich", position: "SF", jerseyNumber: 13, heightCm: 190, age: 25, overallRating: 77 }),
  mkPlayer({ id: "kennedy-burke", teamId: "new-york-liberty", leagueId: "wnba", firstName: "Kennedy", lastName: "Burke", position: "SG", jerseyNumber: 21, heightCm: 180, age: 29, overallRating: 71 }),
  mkPlayer({ id: "nyara-sabally", teamId: "new-york-liberty", leagueId: "wnba", firstName: "Nyara", lastName: "Sabally", position: "C", jerseyNumber: 0, heightCm: 196, age: 25, overallRating: 73 }),

  // --- Seattle Storm ---
  mkPlayer({ id: "jewell-loyd", teamId: "seattle-storm", leagueId: "wnba", firstName: "Jewell", lastName: "Loyd", position: "SG", jerseyNumber: 24, heightCm: 178, age: 31, overallRating: 90 }),
  mkPlayer({ id: "nneka-ogwumike", teamId: "seattle-storm", leagueId: "wnba", firstName: "Nneka", lastName: "Ogwumike", position: "PF", jerseyNumber: 3, heightCm: 188, age: 35, overallRating: 85 }),
  mkPlayer({ id: "skylar-diggins", teamId: "seattle-storm", leagueId: "wnba", firstName: "Skylar", lastName: "Diggins", position: "PG", jerseyNumber: 4, heightCm: 175, age: 35, overallRating: 84 }),
  mkPlayer({ id: "gabby-williams", teamId: "seattle-storm", leagueId: "wnba", firstName: "Gabby", lastName: "Williams", position: "SF", jerseyNumber: 5, heightCm: 178, age: 28, overallRating: 81 }),
  mkPlayer({ id: "ezi-magbegor", teamId: "seattle-storm", leagueId: "wnba", firstName: "Ezi", lastName: "Magbegor", position: "C", jerseyNumber: 13, heightCm: 196, age: 26, overallRating: 80 }),
  mkPlayer({ id: "katie-lou-samuelson", teamId: "seattle-storm", leagueId: "wnba", firstName: "Katie Lou", lastName: "Samuelson", position: "SF", jerseyNumber: 33, heightCm: 190, age: 28, overallRating: 72 }),
  mkPlayer({ id: "erica-wheeler", teamId: "seattle-storm", leagueId: "wnba", firstName: "Erica", lastName: "Wheeler", position: "PG", jerseyNumber: 17, heightCm: 170, age: 34, overallRating: 68 }),
  mkPlayer({ id: "victoria-vivians", teamId: "seattle-storm", leagueId: "wnba", firstName: "Victoria", lastName: "Vivians", position: "SG", jerseyNumber: 35, heightCm: 180, age: 29, overallRating: 71 }),

  // --- Connecticut Sun ---
  mkPlayer({ id: "alyssa-thomas", teamId: "connecticut-sun", leagueId: "wnba", firstName: "Alyssa", lastName: "Thomas", position: "PF", jerseyNumber: 25, heightCm: 183, age: 33, overallRating: 90 }),
  mkPlayer({ id: "dewanna-bonner", teamId: "connecticut-sun", leagueId: "wnba", firstName: "DeWanna", lastName: "Bonner", position: "SF", jerseyNumber: 24, heightCm: 190, age: 37, overallRating: 84 }),
  mkPlayer({ id: "dijonai-carrington", teamId: "connecticut-sun", leagueId: "wnba", firstName: "DiJonai", lastName: "Carrington", position: "SG", jerseyNumber: 21, heightCm: 180, age: 27, overallRating: 81 }),
  mkPlayer({ id: "tyasha-harris", teamId: "connecticut-sun", leagueId: "wnba", firstName: "Tyasha", lastName: "Harris", position: "PG", jerseyNumber: 52, heightCm: 173, age: 27, overallRating: 74 }),
  mkPlayer({ id: "brionna-jones", teamId: "connecticut-sun", leagueId: "wnba", firstName: "Brionna", lastName: "Jones", position: "C", jerseyNumber: 42, heightCm: 188, age: 29, overallRating: 78 }),
  mkPlayer({ id: "rachel-banham", teamId: "connecticut-sun", leagueId: "wnba", firstName: "Rachel", lastName: "Banham", position: "PG", jerseyNumber: 1, heightCm: 178, age: 32, overallRating: 68 }),
  mkPlayer({ id: "leigha-brown", teamId: "connecticut-sun", leagueId: "wnba", firstName: "Leigha", lastName: "Brown", position: "SF", jerseyNumber: 4, heightCm: 180, age: 25, overallRating: 66 }),
  mkPlayer({ id: "olivia-nelson-ododa", teamId: "connecticut-sun", leagueId: "wnba", firstName: "Olivia", lastName: "Nelson-Ododa", position: "C", jerseyNumber: 0, heightCm: 196, age: 25, overallRating: 65 }),

  // --- Minnesota Lynx ---
  mkPlayer({ id: "napheesa-collier", teamId: "minnesota-lynx", leagueId: "wnba", firstName: "Napheesa", lastName: "Collier", position: "PF", jerseyNumber: 24, heightCm: 188, age: 29, overallRating: 95 }),
  mkPlayer({ id: "kayla-mcbride", teamId: "minnesota-lynx", leagueId: "wnba", firstName: "Kayla", lastName: "McBride", position: "SG", jerseyNumber: 21, heightCm: 178, age: 33, overallRating: 84 }),
  mkPlayer({ id: "courtney-williams", teamId: "minnesota-lynx", leagueId: "wnba", firstName: "Courtney", lastName: "Williams", position: "PG", jerseyNumber: 10, heightCm: 173, age: 31, overallRating: 82 }),
  mkPlayer({ id: "bridget-carleton", teamId: "minnesota-lynx", leagueId: "wnba", firstName: "Bridget", lastName: "Carleton", position: "SF", jerseyNumber: 15, heightCm: 188, age: 29, overallRating: 75 }),
  mkPlayer({ id: "alanna-smith", teamId: "minnesota-lynx", leagueId: "wnba", firstName: "Alanna", lastName: "Smith", position: "PF", jerseyNumber: 8, heightCm: 193, age: 29, overallRating: 76 }),
  mkPlayer({ id: "natisha-hiedeman", teamId: "minnesota-lynx", leagueId: "wnba", firstName: "Natisha", lastName: "Hiedeman", position: "PG", jerseyNumber: 2, heightCm: 173, age: 30, overallRating: 70 }),
  mkPlayer({ id: "diamond-miller", teamId: "minnesota-lynx", leagueId: "wnba", firstName: "Diamond", lastName: "Miller", position: "SG", jerseyNumber: 14, heightCm: 185, age: 25, overallRating: 73 }),
  mkPlayer({ id: "alissa-pili", teamId: "minnesota-lynx", leagueId: "wnba", firstName: "Alissa", lastName: "Pili", position: "SF", jerseyNumber: 32, heightCm: 183, age: 24, overallRating: 72 }),

  // --- Indiana Fever ---
  mkPlayer({ id: "caitlin-clark", teamId: "indiana-fever", leagueId: "wnba", firstName: "Caitlin", lastName: "Clark", position: "PG", jerseyNumber: 22, heightCm: 183, age: 24, overallRating: 89 }),
  mkPlayer({ id: "aliyah-boston", teamId: "indiana-fever", leagueId: "wnba", firstName: "Aliyah", lastName: "Boston", position: "C", jerseyNumber: 7, heightCm: 193, age: 24, overallRating: 86 }),
  mkPlayer({ id: "kelsey-mitchell", teamId: "indiana-fever", leagueId: "wnba", firstName: "Kelsey", lastName: "Mitchell", position: "SG", jerseyNumber: 0, heightCm: 173, age: 30, overallRating: 83 }),
  mkPlayer({ id: "sophie-cunningham", teamId: "indiana-fever", leagueId: "wnba", firstName: "Sophie", lastName: "Cunningham", position: "SF", jerseyNumber: 8, heightCm: 183, age: 29, overallRating: 70 }),
  mkPlayer({ id: "damiris-dantas", teamId: "indiana-fever", leagueId: "wnba", firstName: "Damiris", lastName: "Dantas", position: "PF", jerseyNumber: 21, heightCm: 193, age: 32, overallRating: 68 }),
  mkPlayer({ id: "lexie-hull", teamId: "indiana-fever", leagueId: "wnba", firstName: "Lexie", lastName: "Hull", position: "SG", jerseyNumber: 10, heightCm: 183, age: 25, overallRating: 72 }),
  mkPlayer({ id: "grace-berger", teamId: "indiana-fever", leagueId: "wnba", firstName: "Grace", lastName: "Berger", position: "PG", jerseyNumber: 15, heightCm: 185, age: 25, overallRating: 66 }),
  mkPlayer({ id: "temi-fagbenle", teamId: "indiana-fever", leagueId: "wnba", firstName: "Temi", lastName: "Fagbenle", position: "C", jerseyNumber: 4, heightCm: 196, age: 32, overallRating: 65 }),
];
