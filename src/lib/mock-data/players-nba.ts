import type { Player } from "@/lib/types";
import { mkPlayer } from "./player-helpers";

export const playersNba: Player[] = [
  // --- Lakers ---
  mkPlayer({ id: "lebron-james", teamId: "lal", leagueId: "nba", firstName: "LeBron", lastName: "James", position: "SF", jerseyNumber: 23, heightCm: 203, age: 40, overallRating: 94 }),
  mkPlayer({ id: "anthony-davis", teamId: "lal", leagueId: "nba", firstName: "Anthony", lastName: "Davis", position: "PF", jerseyNumber: 3, heightCm: 208, age: 32, overallRating: 93 }),
  mkPlayer({ id: "austin-reaves", teamId: "lal", leagueId: "nba", firstName: "Austin", lastName: "Reaves", position: "SG", jerseyNumber: 15, heightCm: 196, age: 27, overallRating: 82 }),
  mkPlayer({ id: "rui-hachimura", teamId: "lal", leagueId: "nba", firstName: "Rui", lastName: "Hachimura", position: "PF", jerseyNumber: 28, heightCm: 203, age: 27, overallRating: 78 }),
  mkPlayer({ id: "gabe-vincent", teamId: "lal", leagueId: "nba", firstName: "Gabe", lastName: "Vincent", position: "PG", jerseyNumber: 7, heightCm: 188, age: 29, overallRating: 74 }),
  mkPlayer({ id: "jarred-vanderbilt", teamId: "lal", leagueId: "nba", firstName: "Jarred", lastName: "Vanderbilt", position: "PF", jerseyNumber: 2, heightCm: 201, age: 26, overallRating: 73 }),
  mkPlayer({ id: "max-christie", teamId: "lal", leagueId: "nba", firstName: "Max", lastName: "Christie", position: "SG", jerseyNumber: 10, heightCm: 196, age: 22, overallRating: 72 }),
  mkPlayer({ id: "jaxson-hayes", teamId: "lal", leagueId: "nba", firstName: "Jaxson", lastName: "Hayes", position: "C", jerseyNumber: 11, heightCm: 211, age: 25, overallRating: 71 }),

  // --- Celtics ---
  mkPlayer({ id: "jayson-tatum", teamId: "bos", leagueId: "nba", firstName: "Jayson", lastName: "Tatum", position: "SF", jerseyNumber: 0, heightCm: 203, age: 28, overallRating: 95 }),
  mkPlayer({ id: "jaylen-brown", teamId: "bos", leagueId: "nba", firstName: "Jaylen", lastName: "Brown", position: "SG", jerseyNumber: 7, heightCm: 198, age: 29, overallRating: 91 }),
  mkPlayer({ id: "kristaps-porzingis", teamId: "bos", leagueId: "nba", firstName: "Kristaps", lastName: "Porzingis", position: "C", jerseyNumber: 8, heightCm: 221, age: 30, overallRating: 86 }),
  mkPlayer({ id: "derrick-white", teamId: "bos", leagueId: "nba", firstName: "Derrick", lastName: "White", position: "PG", jerseyNumber: 9, heightCm: 196, age: 31, overallRating: 85 }),
  mkPlayer({ id: "jrue-holiday", teamId: "bos", leagueId: "nba", firstName: "Jrue", lastName: "Holiday", position: "PG", jerseyNumber: 4, heightCm: 193, age: 35, overallRating: 84 }),
  mkPlayer({ id: "al-horford", teamId: "bos", leagueId: "nba", firstName: "Al", lastName: "Horford", position: "C", jerseyNumber: 42, heightCm: 206, age: 39, overallRating: 76 }),
  mkPlayer({ id: "sam-hauser", teamId: "bos", leagueId: "nba", firstName: "Sam", lastName: "Hauser", position: "SF", jerseyNumber: 30, heightCm: 201, age: 28, overallRating: 74 }),
  mkPlayer({ id: "payton-pritchard", teamId: "bos", leagueId: "nba", firstName: "Payton", lastName: "Pritchard", position: "PG", jerseyNumber: 11, heightCm: 185, age: 28, overallRating: 77 }),

  // --- Warriors ---
  mkPlayer({ id: "stephen-curry", teamId: "gsw", leagueId: "nba", firstName: "Stephen", lastName: "Curry", position: "PG", jerseyNumber: 30, heightCm: 188, age: 37, overallRating: 95 }),
  mkPlayer({ id: "draymond-green", teamId: "gsw", leagueId: "nba", firstName: "Draymond", lastName: "Green", position: "PF", jerseyNumber: 23, heightCm: 198, age: 35, overallRating: 82 }),
  mkPlayer({ id: "andrew-wiggins", teamId: "gsw", leagueId: "nba", firstName: "Andrew", lastName: "Wiggins", position: "SF", jerseyNumber: 22, heightCm: 201, age: 31, overallRating: 79 }),
  mkPlayer({ id: "jonathan-kuminga", teamId: "gsw", leagueId: "nba", firstName: "Jonathan", lastName: "Kuminga", position: "PF", jerseyNumber: 0, heightCm: 201, age: 23, overallRating: 80 }),
  mkPlayer({ id: "buddy-hield", teamId: "gsw", leagueId: "nba", firstName: "Buddy", lastName: "Hield", position: "SG", jerseyNumber: 7, heightCm: 193, age: 32, overallRating: 78 }),
  mkPlayer({ id: "brandin-podziemski", teamId: "gsw", leagueId: "nba", firstName: "Brandin", lastName: "Podziemski", position: "SG", jerseyNumber: 2, heightCm: 193, age: 23, overallRating: 76 }),
  mkPlayer({ id: "kevon-looney", teamId: "gsw", leagueId: "nba", firstName: "Kevon", lastName: "Looney", position: "C", jerseyNumber: 5, heightCm: 206, age: 30, overallRating: 71 }),
  mkPlayer({ id: "moses-moody", teamId: "gsw", leagueId: "nba", firstName: "Moses", lastName: "Moody", position: "SG", jerseyNumber: 4, heightCm: 196, age: 24, overallRating: 74 }),

  // --- Bucks ---
  mkPlayer({ id: "giannis-antetokounmpo", teamId: "mil", leagueId: "nba", firstName: "Giannis", lastName: "Antetokounmpo", position: "PF", jerseyNumber: 34, heightCm: 211, age: 31, overallRating: 97 }),
  mkPlayer({ id: "damian-lillard", teamId: "mil", leagueId: "nba", firstName: "Damian", lastName: "Lillard", position: "PG", jerseyNumber: 0, heightCm: 188, age: 35, overallRating: 89 }),
  mkPlayer({ id: "khris-middleton", teamId: "mil", leagueId: "nba", firstName: "Khris", lastName: "Middleton", position: "SF", jerseyNumber: 22, heightCm: 201, age: 34, overallRating: 80 }),
  mkPlayer({ id: "brook-lopez", teamId: "mil", leagueId: "nba", firstName: "Brook", lastName: "Lopez", position: "C", jerseyNumber: 11, heightCm: 213, age: 38, overallRating: 79 }),
  mkPlayer({ id: "bobby-portis", teamId: "mil", leagueId: "nba", firstName: "Bobby", lastName: "Portis", position: "PF", jerseyNumber: 9, heightCm: 206, age: 31, overallRating: 78 }),
  mkPlayer({ id: "aj-green", teamId: "mil", leagueId: "nba", firstName: "AJ", lastName: "Green", position: "SG", jerseyNumber: 20, heightCm: 196, age: 26, overallRating: 73 }),
  mkPlayer({ id: "gary-trent-jr", teamId: "mil", leagueId: "nba", firstName: "Gary", lastName: "Trent Jr.", position: "SG", jerseyNumber: 2, heightCm: 196, age: 27, overallRating: 75 }),
  mkPlayer({ id: "pat-connaughton", teamId: "mil", leagueId: "nba", firstName: "Pat", lastName: "Connaughton", position: "SG", jerseyNumber: 24, heightCm: 196, age: 33, overallRating: 71 }),

  // --- Nuggets ---
  mkPlayer({ id: "nikola-jokic", teamId: "den", leagueId: "nba", firstName: "Nikola", lastName: "Jokic", position: "C", jerseyNumber: 15, heightCm: 211, age: 31, overallRating: 98 }),
  mkPlayer({ id: "jamal-murray", teamId: "den", leagueId: "nba", firstName: "Jamal", lastName: "Murray", position: "PG", jerseyNumber: 27, heightCm: 191, age: 29, overallRating: 89 }),
  mkPlayer({ id: "michael-porter-jr", teamId: "den", leagueId: "nba", firstName: "Michael", lastName: "Porter Jr.", position: "SF", jerseyNumber: 1, heightCm: 208, age: 27, overallRating: 83 }),
  mkPlayer({ id: "aaron-gordon", teamId: "den", leagueId: "nba", firstName: "Aaron", lastName: "Gordon", position: "PF", jerseyNumber: 50, heightCm: 203, age: 30, overallRating: 82 }),
  mkPlayer({ id: "christian-braun", teamId: "den", leagueId: "nba", firstName: "Christian", lastName: "Braun", position: "SG", jerseyNumber: 0, heightCm: 196, age: 24, overallRating: 76 }),
  mkPlayer({ id: "russell-westbrook", teamId: "den", leagueId: "nba", firstName: "Russell", lastName: "Westbrook", position: "PG", jerseyNumber: 4, heightCm: 191, age: 37, overallRating: 77 }),
  mkPlayer({ id: "peyton-watson", teamId: "den", leagueId: "nba", firstName: "Peyton", lastName: "Watson", position: "SF", jerseyNumber: 8, heightCm: 203, age: 23, overallRating: 73 }),
  mkPlayer({ id: "zeke-nnaji", teamId: "den", leagueId: "nba", firstName: "Zeke", lastName: "Nnaji", position: "PF", jerseyNumber: 22, heightCm: 206, age: 25, overallRating: 70 }),

  // --- Knicks ---
  mkPlayer({ id: "jalen-brunson", teamId: "nyk", leagueId: "nba", firstName: "Jalen", lastName: "Brunson", position: "PG", jerseyNumber: 11, heightCm: 185, age: 29, overallRating: 92 }),
  mkPlayer({ id: "karl-anthony-towns", teamId: "nyk", leagueId: "nba", firstName: "Karl-Anthony", lastName: "Towns", position: "C", jerseyNumber: 32, heightCm: 213, age: 30, overallRating: 88 }),
  mkPlayer({ id: "og-anunoby", teamId: "nyk", leagueId: "nba", firstName: "OG", lastName: "Anunoby", position: "SF", jerseyNumber: 8, heightCm: 198, age: 28, overallRating: 84 }),
  mkPlayer({ id: "mikal-bridges", teamId: "nyk", leagueId: "nba", firstName: "Mikal", lastName: "Bridges", position: "SF", jerseyNumber: 25, heightCm: 198, age: 29, overallRating: 83 }),
  mkPlayer({ id: "josh-hart", teamId: "nyk", leagueId: "nba", firstName: "Josh", lastName: "Hart", position: "SG", jerseyNumber: 3, heightCm: 196, age: 30, overallRating: 80 }),
  mkPlayer({ id: "mitchell-robinson", teamId: "nyk", leagueId: "nba", firstName: "Mitchell", lastName: "Robinson", position: "C", jerseyNumber: 23, heightCm: 213, age: 28, overallRating: 75 }),
  mkPlayer({ id: "miles-mcbride", teamId: "nyk", leagueId: "nba", firstName: "Miles", lastName: "McBride", position: "PG", jerseyNumber: 2, heightCm: 185, age: 25, overallRating: 74 }),
  mkPlayer({ id: "precious-achiuwa", teamId: "nyk", leagueId: "nba", firstName: "Precious", lastName: "Achiuwa", position: "PF", jerseyNumber: 5, heightCm: 203, age: 26, overallRating: 71 }),
];
