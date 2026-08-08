import type { Player } from "@/lib/types";
import { mkPlayer } from "./player-helpers";

export const playersNba: Player[] = [
  // --- Lakers ---
  mkPlayer({ id: "lebron-james", teamId: "lal", leagueId: "nba", firstName: "LeBron", lastName: "James", position: "SF", jerseyNumber: 23, heightCm: 203, age: 40, overallRating: 94 }),
  mkPlayer({ id: "anthony-davis", teamId: "lal", leagueId: "nba", firstName: "Anthony", lastName: "Davis", position: "PF", jerseyNumber: 3, heightCm: 208, age: 32, overallRating: 93, injuryRisk: 75 }),
  mkPlayer({ id: "austin-reaves", teamId: "lal", leagueId: "nba", firstName: "Austin", lastName: "Reaves", position: "SG", jerseyNumber: 15, heightCm: 196, age: 27, overallRating: 82 }),
  mkPlayer({ id: "rui-hachimura", nationality: "Japon", teamId: "lal", leagueId: "nba", firstName: "Rui", lastName: "Hachimura", position: "PF", jerseyNumber: 28, heightCm: 203, age: 27, overallRating: 78 }),
  mkPlayer({ id: "gabe-vincent", teamId: "lal", leagueId: "nba", firstName: "Gabe", lastName: "Vincent", position: "PG", jerseyNumber: 7, heightCm: 188, age: 29, overallRating: 74 }),
  mkPlayer({ id: "jarred-vanderbilt", teamId: "lal", leagueId: "nba", firstName: "Jarred", lastName: "Vanderbilt", position: "PF", jerseyNumber: 2, heightCm: 201, age: 26, overallRating: 73 }),
  mkPlayer({ id: "max-christie", teamId: "lal", leagueId: "nba", firstName: "Max", lastName: "Christie", position: "SG", jerseyNumber: 10, heightCm: 196, age: 22, overallRating: 72 }),
  mkPlayer({ id: "jaxson-hayes", teamId: "lal", leagueId: "nba", firstName: "Jaxson", lastName: "Hayes", position: "C", jerseyNumber: 11, heightCm: 211, age: 25, overallRating: 71 }),

  // --- Celtics ---
  mkPlayer({ id: "jayson-tatum", teamId: "bos", leagueId: "nba", firstName: "Jayson", lastName: "Tatum", position: "SF", jerseyNumber: 0, heightCm: 203, age: 28, overallRating: 95 }),
  mkPlayer({ id: "jaylen-brown", teamId: "bos", leagueId: "nba", firstName: "Jaylen", lastName: "Brown", position: "SG", jerseyNumber: 7, heightCm: 198, age: 29, overallRating: 91 }),
  mkPlayer({ id: "kristaps-porzingis", nationality: "Lettonie", teamId: "bos", leagueId: "nba", firstName: "Kristaps", lastName: "Porzingis", position: "C", jerseyNumber: 8, heightCm: 221, age: 30, overallRating: 86, injuryRisk: 80 }),
  mkPlayer({ id: "derrick-white", teamId: "bos", leagueId: "nba", firstName: "Derrick", lastName: "White", position: "PG", jerseyNumber: 9, heightCm: 196, age: 31, overallRating: 85 }),
  mkPlayer({ id: "jrue-holiday", teamId: "bos", leagueId: "nba", firstName: "Jrue", lastName: "Holiday", position: "PG", jerseyNumber: 4, heightCm: 193, age: 35, overallRating: 84 }),
  mkPlayer({ id: "al-horford", teamId: "bos", leagueId: "nba", firstName: "Al", lastName: "Horford", position: "C", jerseyNumber: 42, heightCm: 206, age: 39, overallRating: 76 }),
  mkPlayer({ id: "sam-hauser", teamId: "bos", leagueId: "nba", firstName: "Sam", lastName: "Hauser", position: "SF", jerseyNumber: 30, heightCm: 201, age: 28, overallRating: 74 }),
  mkPlayer({ id: "payton-pritchard", teamId: "bos", leagueId: "nba", firstName: "Payton", lastName: "Pritchard", position: "PG", jerseyNumber: 11, heightCm: 185, age: 28, overallRating: 77 }),

  // --- Warriors ---
  mkPlayer({ id: "stephen-curry", teamId: "gsw", leagueId: "nba", firstName: "Stephen", lastName: "Curry", position: "PG", jerseyNumber: 30, heightCm: 188, age: 37, overallRating: 95, injuryRisk: 35 }),
  mkPlayer({ id: "draymond-green", teamId: "gsw", leagueId: "nba", firstName: "Draymond", lastName: "Green", position: "PF", jerseyNumber: 23, heightCm: 198, age: 35, overallRating: 82 }),
  mkPlayer({ id: "andrew-wiggins", nationality: "Canada", teamId: "gsw", leagueId: "nba", firstName: "Andrew", lastName: "Wiggins", position: "SF", jerseyNumber: 22, heightCm: 201, age: 31, overallRating: 79 }),
  mkPlayer({ id: "jonathan-kuminga", teamId: "gsw", leagueId: "nba", firstName: "Jonathan", lastName: "Kuminga", position: "PF", jerseyNumber: 0, heightCm: 201, age: 23, overallRating: 80 }),
  mkPlayer({ id: "buddy-hield", teamId: "gsw", leagueId: "nba", firstName: "Buddy", lastName: "Hield", position: "SG", jerseyNumber: 7, heightCm: 193, age: 32, overallRating: 78 }),
  mkPlayer({ id: "brandin-podziemski", teamId: "gsw", leagueId: "nba", firstName: "Brandin", lastName: "Podziemski", position: "SG", jerseyNumber: 2, heightCm: 193, age: 23, overallRating: 76 }),
  mkPlayer({ id: "kevon-looney", teamId: "gsw", leagueId: "nba", firstName: "Kevon", lastName: "Looney", position: "C", jerseyNumber: 5, heightCm: 206, age: 30, overallRating: 71 }),
  mkPlayer({ id: "moses-moody", teamId: "gsw", leagueId: "nba", firstName: "Moses", lastName: "Moody", position: "SG", jerseyNumber: 4, heightCm: 196, age: 24, overallRating: 74 }),

  // --- Bucks ---
  mkPlayer({ id: "giannis-antetokounmpo", nationality: "Grèce", teamId: "mil", leagueId: "nba", firstName: "Giannis", lastName: "Antetokounmpo", position: "PF", jerseyNumber: 34, heightCm: 211, age: 31, overallRating: 97, injuryRisk: 25 }),
  mkPlayer({ id: "damian-lillard", teamId: "mil", leagueId: "nba", firstName: "Damian", lastName: "Lillard", position: "PG", jerseyNumber: 0, heightCm: 188, age: 35, overallRating: 89, injuryRisk: 55 }),
  mkPlayer({ id: "khris-middleton", teamId: "mil", leagueId: "nba", firstName: "Khris", lastName: "Middleton", position: "SF", jerseyNumber: 22, heightCm: 201, age: 34, overallRating: 80 }),
  mkPlayer({ id: "brook-lopez", teamId: "mil", leagueId: "nba", firstName: "Brook", lastName: "Lopez", position: "C", jerseyNumber: 11, heightCm: 213, age: 38, overallRating: 79 }),
  mkPlayer({ id: "bobby-portis", teamId: "mil", leagueId: "nba", firstName: "Bobby", lastName: "Portis", position: "PF", jerseyNumber: 9, heightCm: 206, age: 31, overallRating: 78 }),
  mkPlayer({ id: "aj-green", teamId: "mil", leagueId: "nba", firstName: "AJ", lastName: "Green", position: "SG", jerseyNumber: 20, heightCm: 196, age: 26, overallRating: 73 }),
  mkPlayer({ id: "gary-trent-jr", teamId: "mil", leagueId: "nba", firstName: "Gary", lastName: "Trent Jr.", position: "SG", jerseyNumber: 2, heightCm: 196, age: 27, overallRating: 75 }),
  mkPlayer({ id: "pat-connaughton", teamId: "mil", leagueId: "nba", firstName: "Pat", lastName: "Connaughton", position: "SG", jerseyNumber: 24, heightCm: 196, age: 33, overallRating: 71 }),

  // --- Nuggets ---
  mkPlayer({ id: "nikola-jokic", nationality: "Serbie", teamId: "den", leagueId: "nba", firstName: "Nikola", lastName: "Jokic", position: "C", jerseyNumber: 15, heightCm: 211, age: 31, overallRating: 98, injuryRisk: 15 }),
  mkPlayer({ id: "jamal-murray", nationality: "Canada", teamId: "den", leagueId: "nba", firstName: "Jamal", lastName: "Murray", position: "PG", jerseyNumber: 27, heightCm: 191, age: 29, overallRating: 89, injuryRisk: 70 }),
  mkPlayer({ id: "michael-porter-jr", teamId: "den", leagueId: "nba", firstName: "Michael", lastName: "Porter Jr.", position: "SF", jerseyNumber: 1, heightCm: 208, age: 27, overallRating: 83 }),
  mkPlayer({ id: "aaron-gordon", teamId: "den", leagueId: "nba", firstName: "Aaron", lastName: "Gordon", position: "PF", jerseyNumber: 50, heightCm: 203, age: 30, overallRating: 82 }),
  mkPlayer({ id: "christian-braun", teamId: "den", leagueId: "nba", firstName: "Christian", lastName: "Braun", position: "SG", jerseyNumber: 0, heightCm: 196, age: 24, overallRating: 76 }),
  mkPlayer({ id: "russell-westbrook", teamId: "den", leagueId: "nba", firstName: "Russell", lastName: "Westbrook", position: "PG", jerseyNumber: 4, heightCm: 191, age: 37, overallRating: 77 }),
  mkPlayer({ id: "peyton-watson", teamId: "den", leagueId: "nba", firstName: "Peyton", lastName: "Watson", position: "SF", jerseyNumber: 8, heightCm: 203, age: 23, overallRating: 73 }),
  mkPlayer({ id: "zeke-nnaji", teamId: "den", leagueId: "nba", firstName: "Zeke", lastName: "Nnaji", position: "PF", jerseyNumber: 22, heightCm: 206, age: 25, overallRating: 70 }),

  // --- Knicks ---
  mkPlayer({ id: "jalen-brunson", teamId: "nyk", leagueId: "nba", firstName: "Jalen", lastName: "Brunson", position: "PG", jerseyNumber: 11, heightCm: 185, age: 29, overallRating: 92 }),
  mkPlayer({ id: "karl-anthony-towns", teamId: "nyk", leagueId: "nba", firstName: "Karl-Anthony", lastName: "Towns", position: "C", jerseyNumber: 32, heightCm: 213, age: 30, overallRating: 88, injuryRisk: 55 }),
  mkPlayer({ id: "og-anunoby", teamId: "nyk", leagueId: "nba", firstName: "OG", lastName: "Anunoby", position: "SF", jerseyNumber: 8, heightCm: 198, age: 28, overallRating: 84 }),
  mkPlayer({ id: "mikal-bridges", teamId: "nyk", leagueId: "nba", firstName: "Mikal", lastName: "Bridges", position: "SF", jerseyNumber: 25, heightCm: 198, age: 29, overallRating: 83, injuryRisk: 10 }),
  mkPlayer({ id: "josh-hart", teamId: "nyk", leagueId: "nba", firstName: "Josh", lastName: "Hart", position: "SG", jerseyNumber: 3, heightCm: 196, age: 30, overallRating: 80 }),
  mkPlayer({ id: "mitchell-robinson", teamId: "nyk", leagueId: "nba", firstName: "Mitchell", lastName: "Robinson", position: "C", jerseyNumber: 23, heightCm: 213, age: 28, overallRating: 75 }),
  mkPlayer({ id: "miles-mcbride", teamId: "nyk", leagueId: "nba", firstName: "Miles", lastName: "McBride", position: "PG", jerseyNumber: 2, heightCm: 185, age: 25, overallRating: 74 }),
  mkPlayer({ id: "precious-achiuwa", teamId: "nyk", leagueId: "nba", firstName: "Precious", lastName: "Achiuwa", position: "PF", jerseyNumber: 5, heightCm: 203, age: 26, overallRating: 71 }),

  // --- Heat ---
  mkPlayer({ id: "bam-adebayo", teamId: "mia", leagueId: "nba", firstName: "Bam", lastName: "Adebayo", position: "C", jerseyNumber: 13, heightCm: 206, age: 28, overallRating: 89 }),
  mkPlayer({ id: "tyler-herro", teamId: "mia", leagueId: "nba", firstName: "Tyler", lastName: "Herro", position: "SG", jerseyNumber: 14, heightCm: 196, age: 25, overallRating: 87 }),
  mkPlayer({ id: "norman-powell", teamId: "mia", leagueId: "nba", firstName: "Norman", lastName: "Powell", position: "SG", jerseyNumber: 24, heightCm: 191, age: 32, overallRating: 82 }),
  mkPlayer({ id: "davion-mitchell", teamId: "mia", leagueId: "nba", firstName: "Davion", lastName: "Mitchell", position: "PG", jerseyNumber: 45, heightCm: 188, age: 27, overallRating: 76 }),
  mkPlayer({ id: "kelel-ware", teamId: "mia", leagueId: "nba", firstName: "Kel'el", lastName: "Ware", position: "C", jerseyNumber: 7, heightCm: 213, age: 21, overallRating: 77 }),
  mkPlayer({ id: "nikola-jovic", nationality: "Serbie", teamId: "mia", leagueId: "nba", firstName: "Nikola", lastName: "Jovic", position: "SF", jerseyNumber: 5, heightCm: 208, age: 22, overallRating: 75 }),
  mkPlayer({ id: "duncan-robinson", teamId: "mia", leagueId: "nba", firstName: "Duncan", lastName: "Robinson", position: "SG", jerseyNumber: 55, heightCm: 201, age: 31, overallRating: 74 }),
  mkPlayer({ id: "pelle-larsson", nationality: "Suède", teamId: "mia", leagueId: "nba", firstName: "Pelle", lastName: "Larsson", position: "SG", jerseyNumber: 6, heightCm: 196, age: 24, overallRating: 70 }),

  // --- 76ers ---
  mkPlayer({ id: "joel-embiid", nationality: "Cameroun", teamId: "phi", leagueId: "nba", firstName: "Joel", lastName: "Embiid", position: "C", jerseyNumber: 21, heightCm: 213, age: 31, overallRating: 92, injuryRisk: 85 }),
  mkPlayer({ id: "tyrese-maxey", teamId: "phi", leagueId: "nba", firstName: "Tyrese", lastName: "Maxey", position: "PG", jerseyNumber: 0, heightCm: 185, age: 25, overallRating: 90 }),
  mkPlayer({ id: "paul-george", teamId: "phi", leagueId: "nba", firstName: "Paul", lastName: "George", position: "SF", jerseyNumber: 8, heightCm: 201, age: 35, overallRating: 85, injuryRisk: 65 }),
  mkPlayer({ id: "kelly-oubre-jr", teamId: "phi", leagueId: "nba", firstName: "Kelly", lastName: "Oubre Jr.", position: "SF", jerseyNumber: 9, heightCm: 201, age: 30, overallRating: 78 }),
  mkPlayer({ id: "andre-drummond", teamId: "phi", leagueId: "nba", firstName: "Andre", lastName: "Drummond", position: "C", jerseyNumber: 3, heightCm: 208, age: 32, overallRating: 74 }),
  mkPlayer({ id: "quentin-grimes", teamId: "phi", leagueId: "nba", firstName: "Quentin", lastName: "Grimes", position: "SG", jerseyNumber: 5, heightCm: 196, age: 25, overallRating: 76 }),
  mkPlayer({ id: "jared-mccain", teamId: "phi", leagueId: "nba", firstName: "Jared", lastName: "McCain", position: "SG", jerseyNumber: 0, heightCm: 188, age: 21, overallRating: 78 }),
  mkPlayer({ id: "guerschon-yabusele", nationality: "France", teamId: "phi", leagueId: "nba", firstName: "Guerschon", lastName: "Yabusele", position: "PF", jerseyNumber: 28, heightCm: 203, age: 29, overallRating: 74 }),

  // --- Cavaliers ---
  mkPlayer({ id: "donovan-mitchell", teamId: "cle", leagueId: "nba", firstName: "Donovan", lastName: "Mitchell", position: "PG", jerseyNumber: 45, heightCm: 185, age: 29, overallRating: 92 }),
  mkPlayer({ id: "darius-garland", teamId: "cle", leagueId: "nba", firstName: "Darius", lastName: "Garland", position: "PG", jerseyNumber: 10, heightCm: 188, age: 25, overallRating: 87 }),
  mkPlayer({ id: "evan-mobley", teamId: "cle", leagueId: "nba", firstName: "Evan", lastName: "Mobley", position: "PF", jerseyNumber: 4, heightCm: 211, age: 24, overallRating: 89 }),
  mkPlayer({ id: "jarrett-allen", teamId: "cle", leagueId: "nba", firstName: "Jarrett", lastName: "Allen", position: "C", jerseyNumber: 31, heightCm: 211, age: 27, overallRating: 84 }),
  mkPlayer({ id: "max-strus", teamId: "cle", leagueId: "nba", firstName: "Max", lastName: "Strus", position: "SG", jerseyNumber: 1, heightCm: 196, age: 29, overallRating: 78 }),
  mkPlayer({ id: "ty-jerome", teamId: "cle", leagueId: "nba", firstName: "Ty", lastName: "Jerome", position: "PG", jerseyNumber: 2, heightCm: 196, age: 28, overallRating: 76 }),
  mkPlayer({ id: "de-andre-hunter", teamId: "cle", leagueId: "nba", firstName: "De'Andre", lastName: "Hunter", position: "SF", jerseyNumber: 12, heightCm: 201, age: 28, overallRating: 78 }),
  mkPlayer({ id: "sam-merrill", teamId: "cle", leagueId: "nba", firstName: "Sam", lastName: "Merrill", position: "SG", jerseyNumber: 5, heightCm: 196, age: 29, overallRating: 72 }),

  // --- Magic ---
  mkPlayer({ id: "paolo-banchero", teamId: "orl", leagueId: "nba", firstName: "Paolo", lastName: "Banchero", position: "PF", jerseyNumber: 5, heightCm: 208, age: 23, overallRating: 89 }),
  mkPlayer({ id: "franz-wagner", nationality: "Allemagne", teamId: "orl", leagueId: "nba", firstName: "Franz", lastName: "Wagner", position: "SF", jerseyNumber: 22, heightCm: 203, age: 24, overallRating: 87 }),
  mkPlayer({ id: "desmond-bane", teamId: "orl", leagueId: "nba", firstName: "Desmond", lastName: "Bane", position: "SG", jerseyNumber: 1, heightCm: 196, age: 27, overallRating: 85 }),
  mkPlayer({ id: "jalen-suggs", teamId: "orl", leagueId: "nba", firstName: "Jalen", lastName: "Suggs", position: "PG", jerseyNumber: 4, heightCm: 196, age: 24, overallRating: 80 }),
  mkPlayer({ id: "wendell-carter-jr", teamId: "orl", leagueId: "nba", firstName: "Wendell", lastName: "Carter Jr.", position: "C", jerseyNumber: 34, heightCm: 208, age: 26, overallRating: 78 }),
  mkPlayer({ id: "anthony-black", teamId: "orl", leagueId: "nba", firstName: "Anthony", lastName: "Black", position: "PG", jerseyNumber: 0, heightCm: 196, age: 22, overallRating: 74 }),
  mkPlayer({ id: "goga-bitadze", nationality: "Géorgie", teamId: "orl", leagueId: "nba", firstName: "Goga", lastName: "Bitadze", position: "C", jerseyNumber: 35, heightCm: 213, age: 26, overallRating: 71 }),
  mkPlayer({ id: "tristan-da-silva", nationality: "Allemagne", teamId: "orl", leagueId: "nba", firstName: "Tristan", lastName: "da Silva", position: "SF", jerseyNumber: 13, heightCm: 203, age: 24, overallRating: 73 }),

  // --- Pacers ---
  mkPlayer({ id: "pascal-siakam", teamId: "ind", leagueId: "nba", firstName: "Pascal", lastName: "Siakam", position: "PF", jerseyNumber: 43, heightCm: 203, age: 31, overallRating: 87 }),
  mkPlayer({ id: "tyrese-haliburton", teamId: "ind", leagueId: "nba", firstName: "Tyrese", lastName: "Haliburton", position: "PG", jerseyNumber: 0, heightCm: 196, age: 25, overallRating: 89 }),
  mkPlayer({ id: "bennedict-mathurin", teamId: "ind", leagueId: "nba", firstName: "Bennedict", lastName: "Mathurin", position: "SG", jerseyNumber: 0, heightCm: 196, age: 23, overallRating: 81 }),
  mkPlayer({ id: "aaron-nesmith", teamId: "ind", leagueId: "nba", firstName: "Aaron", lastName: "Nesmith", position: "SF", jerseyNumber: 23, heightCm: 198, age: 26, overallRating: 79 }),
  mkPlayer({ id: "andrew-nembhard", teamId: "ind", leagueId: "nba", firstName: "Andrew", lastName: "Nembhard", position: "PG", jerseyNumber: 2, heightCm: 196, age: 25, overallRating: 77 }),
  mkPlayer({ id: "tj-mcconnell", teamId: "ind", leagueId: "nba", firstName: "T.J.", lastName: "McConnell", position: "PG", jerseyNumber: 9, heightCm: 185, age: 33, overallRating: 76 }),
  mkPlayer({ id: "obi-toppin", teamId: "ind", leagueId: "nba", firstName: "Obi", lastName: "Toppin", position: "PF", jerseyNumber: 1, heightCm: 206, age: 27, overallRating: 76 }),
  mkPlayer({ id: "jarace-walker", teamId: "ind", leagueId: "nba", firstName: "Jarace", lastName: "Walker", position: "PF", jerseyNumber: 5, heightCm: 203, age: 22, overallRating: 72 }),

  // --- Hawks ---
  mkPlayer({ id: "trae-young", teamId: "atl", leagueId: "nba", firstName: "Trae", lastName: "Young", position: "PG", jerseyNumber: 11, heightCm: 185, age: 27, overallRating: 88 }),
  mkPlayer({ id: "jalen-johnson", teamId: "atl", leagueId: "nba", firstName: "Jalen", lastName: "Johnson", position: "SF", jerseyNumber: 1, heightCm: 206, age: 23, overallRating: 85 }),
  mkPlayer({ id: "onyeka-okongwu", teamId: "atl", leagueId: "nba", firstName: "Onyeka", lastName: "Okongwu", position: "C", jerseyNumber: 17, heightCm: 206, age: 24, overallRating: 80 }),
  mkPlayer({ id: "dyson-daniels", nationality: "Australie", teamId: "atl", leagueId: "nba", firstName: "Dyson", lastName: "Daniels", position: "SG", jerseyNumber: 5, heightCm: 198, age: 22, overallRating: 78 }),
  mkPlayer({ id: "zaccharie-risacher", nationality: "France", teamId: "atl", leagueId: "nba", firstName: "Zaccharie", lastName: "Risacher", position: "SF", jerseyNumber: 10, heightCm: 206, age: 20, overallRating: 75 }),
  mkPlayer({ id: "nickeil-alexander-walker", nationality: "Canada", teamId: "atl", leagueId: "nba", firstName: "Nickeil", lastName: "Alexander-Walker", position: "SG", jerseyNumber: 21, heightCm: 196, age: 26, overallRating: 76 }),
  mkPlayer({ id: "clint-capela", nationality: "Suisse", teamId: "atl", leagueId: "nba", firstName: "Clint", lastName: "Capela", position: "C", jerseyNumber: 15, heightCm: 208, age: 31, overallRating: 76 }),
  mkPlayer({ id: "luke-kennard", teamId: "atl", leagueId: "nba", firstName: "Luke", lastName: "Kennard", position: "SG", jerseyNumber: 8, heightCm: 198, age: 29, overallRating: 74 }),

  // --- Bulls ---
  mkPlayer({ id: "josh-giddey", nationality: "Australie", teamId: "chi", leagueId: "nba", firstName: "Josh", lastName: "Giddey", position: "PG", jerseyNumber: 3, heightCm: 203, age: 23, overallRating: 82 }),
  mkPlayer({ id: "coby-white", teamId: "chi", leagueId: "nba", firstName: "Coby", lastName: "White", position: "PG", jerseyNumber: 0, heightCm: 193, age: 25, overallRating: 81 }),
  mkPlayer({ id: "nikola-vucevic", nationality: "Monténégro", teamId: "chi", leagueId: "nba", firstName: "Nikola", lastName: "Vucevic", position: "C", jerseyNumber: 9, heightCm: 211, age: 35, overallRating: 82 }),
  mkPlayer({ id: "ayo-dosunmu", teamId: "chi", leagueId: "nba", firstName: "Ayo", lastName: "Dosunmu", position: "SG", jerseyNumber: 12, heightCm: 193, age: 25, overallRating: 76 }),
  mkPlayer({ id: "matas-buzelis", teamId: "chi", leagueId: "nba", firstName: "Matas", lastName: "Buzelis", position: "SF", jerseyNumber: 14, heightCm: 208, age: 21, overallRating: 75 }),
  mkPlayer({ id: "patrick-williams", teamId: "chi", leagueId: "nba", firstName: "Patrick", lastName: "Williams", position: "PF", jerseyNumber: 44, heightCm: 203, age: 24, overallRating: 74 }),
  mkPlayer({ id: "kevin-huerter", teamId: "chi", leagueId: "nba", firstName: "Kevin", lastName: "Huerter", position: "SG", jerseyNumber: 30, heightCm: 198, age: 27, overallRating: 73 }),
  mkPlayer({ id: "tre-jones", teamId: "chi", leagueId: "nba", firstName: "Tre", lastName: "Jones", position: "PG", jerseyNumber: 33, heightCm: 188, age: 25, overallRating: 71 }),

  // --- Nets ---
  mkPlayer({ id: "cam-thomas", teamId: "bkn", leagueId: "nba", firstName: "Cam", lastName: "Thomas", position: "SG", jerseyNumber: 24, heightCm: 193, age: 24, overallRating: 80 }),
  mkPlayer({ id: "nic-claxton", teamId: "bkn", leagueId: "nba", firstName: "Nic", lastName: "Claxton", position: "C", jerseyNumber: 33, heightCm: 211, age: 26, overallRating: 77 }),
  mkPlayer({ id: "drake-powell", teamId: "bkn", leagueId: "nba", firstName: "Drake", lastName: "Powell", position: "SF", jerseyNumber: 22, heightCm: 198, age: 21, overallRating: 71 }),
  mkPlayer({ id: "egor-demin", nationality: "Russie", teamId: "bkn", leagueId: "nba", firstName: "Egor", lastName: "Demin", position: "PG", jerseyNumber: 3, heightCm: 201, age: 19, overallRating: 70 }),
  mkPlayer({ id: "noah-clowney", teamId: "bkn", leagueId: "nba", firstName: "Noah", lastName: "Clowney", position: "PF", jerseyNumber: 15, heightCm: 208, age: 21, overallRating: 71 }),
  mkPlayer({ id: "dayron-sharpe", teamId: "bkn", leagueId: "nba", firstName: "Day'Ron", lastName: "Sharpe", position: "C", jerseyNumber: 20, heightCm: 208, age: 23, overallRating: 71 }),
  mkPlayer({ id: "ziaire-williams", teamId: "bkn", leagueId: "nba", firstName: "Ziaire", lastName: "Williams", position: "SF", jerseyNumber: 8, heightCm: 201, age: 24, overallRating: 72 }),
  mkPlayer({ id: "terance-mann", teamId: "bkn", leagueId: "nba", firstName: "Terance", lastName: "Mann", position: "SG", jerseyNumber: 14, heightCm: 196, age: 29, overallRating: 71 }),

  // --- Raptors ---
  mkPlayer({ id: "scottie-barnes", teamId: "tor", leagueId: "nba", firstName: "Scottie", lastName: "Barnes", position: "SF", jerseyNumber: 4, heightCm: 203, age: 24, overallRating: 86 }),
  mkPlayer({ id: "brandon-ingram", teamId: "tor", leagueId: "nba", firstName: "Brandon", lastName: "Ingram", position: "SF", jerseyNumber: 14, heightCm: 203, age: 28, overallRating: 83 }),
  mkPlayer({ id: "rj-barrett", nationality: "Canada", teamId: "tor", leagueId: "nba", firstName: "RJ", lastName: "Barrett", position: "SG", jerseyNumber: 9, heightCm: 198, age: 25, overallRating: 82 }),
  mkPlayer({ id: "immanuel-quickley", teamId: "tor", leagueId: "nba", firstName: "Immanuel", lastName: "Quickley", position: "PG", jerseyNumber: 5, heightCm: 188, age: 26, overallRating: 79 }),
  mkPlayer({ id: "jakob-poeltl", nationality: "Autriche", teamId: "tor", leagueId: "nba", firstName: "Jakob", lastName: "Poeltl", position: "C", jerseyNumber: 19, heightCm: 213, age: 30, overallRating: 78 }),
  mkPlayer({ id: "gradey-dick", teamId: "tor", leagueId: "nba", firstName: "Gradey", lastName: "Dick", position: "SG", jerseyNumber: 1, heightCm: 198, age: 22, overallRating: 74 }),
  mkPlayer({ id: "ochai-agbaji", teamId: "tor", leagueId: "nba", firstName: "Ochai", lastName: "Agbaji", position: "SG", jerseyNumber: 2, heightCm: 196, age: 25, overallRating: 71 }),
  mkPlayer({ id: "jamal-shead", teamId: "tor", leagueId: "nba", firstName: "Jamal", lastName: "Shead", position: "PG", jerseyNumber: 23, heightCm: 183, age: 23, overallRating: 70 }),

  // --- Pistons ---
  mkPlayer({ id: "cade-cunningham", teamId: "det", leagueId: "nba", firstName: "Cade", lastName: "Cunningham", position: "PG", jerseyNumber: 2, heightCm: 201, age: 24, overallRating: 89 }),
  mkPlayer({ id: "jalen-duren", teamId: "det", leagueId: "nba", firstName: "Jalen", lastName: "Duren", position: "C", jerseyNumber: 0, heightCm: 208, age: 21, overallRating: 80 }),
  mkPlayer({ id: "ausar-thompson", teamId: "det", leagueId: "nba", firstName: "Ausar", lastName: "Thompson", position: "SF", jerseyNumber: 9, heightCm: 201, age: 22, overallRating: 78 }),
  mkPlayer({ id: "tobias-harris", teamId: "det", leagueId: "nba", firstName: "Tobias", lastName: "Harris", position: "SF", jerseyNumber: 12, heightCm: 203, age: 33, overallRating: 76 }),
  mkPlayer({ id: "jaden-ivey", teamId: "det", leagueId: "nba", firstName: "Jaden", lastName: "Ivey", position: "SG", jerseyNumber: 23, heightCm: 193, age: 23, overallRating: 77 }),
  mkPlayer({ id: "ron-holland", teamId: "det", leagueId: "nba", firstName: "Ron", lastName: "Holland II", position: "SF", jerseyNumber: 7, heightCm: 201, age: 20, overallRating: 73 }),
  mkPlayer({ id: "isaiah-stewart", teamId: "det", leagueId: "nba", firstName: "Isaiah", lastName: "Stewart", position: "C", jerseyNumber: 28, heightCm: 206, age: 24, overallRating: 74 }),
  mkPlayer({ id: "dennis-schroder", nationality: "Allemagne", teamId: "det", leagueId: "nba", firstName: "Dennis", lastName: "Schroder", position: "PG", jerseyNumber: 17, heightCm: 185, age: 32, overallRating: 74 }),

  // --- Hornets ---
  mkPlayer({ id: "lamelo-ball", teamId: "cha", leagueId: "nba", firstName: "LaMelo", lastName: "Ball", position: "PG", jerseyNumber: 1, heightCm: 198, age: 24, overallRating: 87 }),
  mkPlayer({ id: "brandon-miller", teamId: "cha", leagueId: "nba", firstName: "Brandon", lastName: "Miller", position: "SF", jerseyNumber: 24, heightCm: 203, age: 23, overallRating: 80 }),
  mkPlayer({ id: "miles-bridges", teamId: "cha", leagueId: "nba", firstName: "Miles", lastName: "Bridges", position: "SF", jerseyNumber: 0, heightCm: 198, age: 27, overallRating: 79 }),
  mkPlayer({ id: "kon-knueppel", teamId: "cha", leagueId: "nba", firstName: "Kon", lastName: "Knueppel", position: "SG", jerseyNumber: 4, heightCm: 198, age: 20, overallRating: 75 }),
  mkPlayer({ id: "josh-green", nationality: "Australie", teamId: "cha", leagueId: "nba", firstName: "Josh", lastName: "Green", position: "SG", jerseyNumber: 8, heightCm: 196, age: 24, overallRating: 73 }),
  mkPlayer({ id: "ryan-kalkbrenner", teamId: "cha", leagueId: "nba", firstName: "Ryan", lastName: "Kalkbrenner", position: "C", jerseyNumber: 34, heightCm: 216, age: 23, overallRating: 71 }),
  mkPlayer({ id: "tre-mann", teamId: "cha", leagueId: "nba", firstName: "Tre", lastName: "Mann", position: "PG", jerseyNumber: 23, heightCm: 193, age: 24, overallRating: 72 }),
  mkPlayer({ id: "grant-williams", teamId: "cha", leagueId: "nba", firstName: "Grant", lastName: "Williams", position: "PF", jerseyNumber: 3, heightCm: 201, age: 27, overallRating: 72 }),

  // --- Wizards ---
  mkPlayer({ id: "bilal-coulibaly", nationality: "France", teamId: "was", leagueId: "nba", firstName: "Bilal", lastName: "Coulibaly", position: "SF", jerseyNumber: 0, heightCm: 201, age: 21, overallRating: 77 }),
  mkPlayer({ id: "cj-mccollum", teamId: "was", leagueId: "nba", firstName: "CJ", lastName: "McCollum", position: "SG", jerseyNumber: 3, heightCm: 191, age: 34, overallRating: 79 }),
  mkPlayer({ id: "alex-sarr", nationality: "France", teamId: "was", leagueId: "nba", firstName: "Alex", lastName: "Sarr", position: "C", jerseyNumber: 20, heightCm: 213, age: 20, overallRating: 76 }),
  mkPlayer({ id: "bub-carrington", teamId: "was", leagueId: "nba", firstName: "Bub", lastName: "Carrington", position: "PG", jerseyNumber: 8, heightCm: 193, age: 20, overallRating: 73 }),
  mkPlayer({ id: "marvin-bagley-iii", teamId: "was", leagueId: "nba", firstName: "Marvin", lastName: "Bagley III", position: "PF", jerseyNumber: 35, heightCm: 208, age: 26, overallRating: 71 }),
  mkPlayer({ id: "corey-kispert", teamId: "was", leagueId: "nba", firstName: "Corey", lastName: "Kispert", position: "SF", jerseyNumber: 24, heightCm: 201, age: 26, overallRating: 72 }),
  mkPlayer({ id: "cam-whitmore", teamId: "was", leagueId: "nba", firstName: "Cam", lastName: "Whitmore", position: "SF", jerseyNumber: 7, heightCm: 198, age: 21, overallRating: 73 }),
  mkPlayer({ id: "tristan-vukcevic", nationality: "Serbie", teamId: "was", leagueId: "nba", firstName: "Tristan", lastName: "Vukcevic", position: "C", jerseyNumber: 15, heightCm: 211, age: 22, overallRating: 69 }),

  // --- Thunder ---
  mkPlayer({ id: "shai-gilgeous-alexander", nationality: "Canada", teamId: "okc", leagueId: "nba", firstName: "Shai", lastName: "Gilgeous-Alexander", position: "PG", jerseyNumber: 2, heightCm: 198, age: 27, overallRating: 98 }),
  mkPlayer({ id: "jalen-williams", teamId: "okc", leagueId: "nba", firstName: "Jalen", lastName: "Williams", position: "SF", jerseyNumber: 8, heightCm: 201, age: 24, overallRating: 89 }),
  mkPlayer({ id: "chet-holmgren", teamId: "okc", leagueId: "nba", firstName: "Chet", lastName: "Holmgren", position: "C", jerseyNumber: 7, heightCm: 213, age: 23, overallRating: 87 }),
  mkPlayer({ id: "luguentz-dort", nationality: "Canada", teamId: "okc", leagueId: "nba", firstName: "Luguentz", lastName: "Dort", position: "SG", jerseyNumber: 5, heightCm: 191, age: 26, overallRating: 78 }),
  mkPlayer({ id: "isaiah-hartenstein", nationality: "Allemagne", teamId: "okc", leagueId: "nba", firstName: "Isaiah", lastName: "Hartenstein", position: "C", jerseyNumber: 55, heightCm: 213, age: 27, overallRating: 78 }),
  mkPlayer({ id: "aaron-wiggins", teamId: "okc", leagueId: "nba", firstName: "Aaron", lastName: "Wiggins", position: "SG", jerseyNumber: 21, heightCm: 196, age: 26, overallRating: 74 }),
  mkPlayer({ id: "cason-wallace", teamId: "okc", leagueId: "nba", firstName: "Cason", lastName: "Wallace", position: "PG", jerseyNumber: 22, heightCm: 191, age: 22, overallRating: 75 }),
  mkPlayer({ id: "alex-caruso", teamId: "okc", leagueId: "nba", firstName: "Alex", lastName: "Caruso", position: "SG", jerseyNumber: 9, heightCm: 196, age: 31, overallRating: 76 }),

  // --- Timberwolves ---
  mkPlayer({ id: "anthony-edwards", teamId: "min", leagueId: "nba", firstName: "Anthony", lastName: "Edwards", position: "SG", jerseyNumber: 5, heightCm: 193, age: 24, overallRating: 94 }),
  mkPlayer({ id: "julius-randle", teamId: "min", leagueId: "nba", firstName: "Julius", lastName: "Randle", position: "PF", jerseyNumber: 30, heightCm: 203, age: 30, overallRating: 84 }),
  mkPlayer({ id: "rudy-gobert", nationality: "France", teamId: "min", leagueId: "nba", firstName: "Rudy", lastName: "Gobert", position: "C", jerseyNumber: 27, heightCm: 213, age: 33, overallRating: 84, injuryRisk: 18 }),
  mkPlayer({ id: "jaden-mcdaniels", teamId: "min", leagueId: "nba", firstName: "Jaden", lastName: "McDaniels", position: "SF", jerseyNumber: 3, heightCm: 203, age: 25, overallRating: 80 }),
  mkPlayer({ id: "mike-conley", teamId: "min", leagueId: "nba", firstName: "Mike", lastName: "Conley", position: "PG", jerseyNumber: 10, heightCm: 185, age: 37, overallRating: 76 }),
  mkPlayer({ id: "naz-reid", teamId: "min", leagueId: "nba", firstName: "Naz", lastName: "Reid", position: "C", jerseyNumber: 11, heightCm: 208, age: 26, overallRating: 78 }),
  mkPlayer({ id: "donte-divincenzo", teamId: "min", leagueId: "nba", firstName: "Donte", lastName: "DiVincenzo", position: "SG", jerseyNumber: 0, heightCm: 193, age: 28, overallRating: 76 }),
  mkPlayer({ id: "terrence-shannon-jr", teamId: "min", leagueId: "nba", firstName: "Terrence", lastName: "Shannon Jr.", position: "SG", jerseyNumber: 1, heightCm: 196, age: 24, overallRating: 73 }),

  // --- Mavericks ---
  mkPlayer({ id: "kyrie-irving", teamId: "dal", leagueId: "nba", firstName: "Kyrie", lastName: "Irving", position: "PG", jerseyNumber: 11, heightCm: 191, age: 33, overallRating: 90, injuryRisk: 60 }),
  mkPlayer({ id: "klay-thompson", teamId: "dal", leagueId: "nba", firstName: "Klay", lastName: "Thompson", position: "SG", jerseyNumber: 31, heightCm: 198, age: 35, overallRating: 79, injuryRisk: 68 }),
  mkPlayer({ id: "pj-washington", teamId: "dal", leagueId: "nba", firstName: "P.J.", lastName: "Washington", position: "PF", jerseyNumber: 25, heightCm: 203, age: 27, overallRating: 78 }),
  mkPlayer({ id: "daniel-gafford", teamId: "dal", leagueId: "nba", firstName: "Daniel", lastName: "Gafford", position: "C", jerseyNumber: 21, heightCm: 208, age: 27, overallRating: 78 }),
  mkPlayer({ id: "cooper-flagg", teamId: "dal", leagueId: "nba", firstName: "Cooper", lastName: "Flagg", position: "SF", jerseyNumber: 32, heightCm: 206, age: 19, overallRating: 83 }),
  mkPlayer({ id: "naji-marshall", teamId: "dal", leagueId: "nba", firstName: "Naji", lastName: "Marshall", position: "SF", jerseyNumber: 13, heightCm: 198, age: 27, overallRating: 74 }),
  mkPlayer({ id: "dereck-lively-ii", teamId: "dal", leagueId: "nba", firstName: "Dereck", lastName: "Lively II", position: "C", jerseyNumber: 2, heightCm: 213, age: 21, overallRating: 76 }),
  mkPlayer({ id: "dangelo-russell", teamId: "dal", leagueId: "nba", firstName: "D'Angelo", lastName: "Russell", position: "PG", jerseyNumber: 4, heightCm: 193, age: 29, overallRating: 75 }),

  // --- Clippers ---
  mkPlayer({ id: "kawhi-leonard", teamId: "lac", leagueId: "nba", firstName: "Kawhi", lastName: "Leonard", position: "SF", jerseyNumber: 2, heightCm: 201, age: 34, overallRating: 89, injuryRisk: 82 }),
  mkPlayer({ id: "james-harden", teamId: "lac", leagueId: "nba", firstName: "James", lastName: "Harden", position: "PG", jerseyNumber: 1, heightCm: 196, age: 36, overallRating: 86 }),
  mkPlayer({ id: "ivica-zubac", nationality: "Croatie", teamId: "lac", leagueId: "nba", firstName: "Ivica", lastName: "Zubac", position: "C", jerseyNumber: 40, heightCm: 216, age: 28, overallRating: 81 }),
  mkPlayer({ id: "derrick-jones-jr", teamId: "lac", leagueId: "nba", firstName: "Derrick", lastName: "Jones Jr.", position: "SF", jerseyNumber: 55, heightCm: 201, age: 28, overallRating: 75 }),
  mkPlayer({ id: "kris-dunn", teamId: "lac", leagueId: "nba", firstName: "Kris", lastName: "Dunn", position: "PG", jerseyNumber: 3, heightCm: 196, age: 31, overallRating: 73 }),
  mkPlayer({ id: "bogdan-bogdanovic", nationality: "Serbie", teamId: "lac", leagueId: "nba", firstName: "Bogdan", lastName: "Bogdanovic", position: "SG", jerseyNumber: 8, heightCm: 198, age: 33, overallRating: 77 }),
  mkPlayer({ id: "john-collins", teamId: "lac", leagueId: "nba", firstName: "John", lastName: "Collins", position: "PF", jerseyNumber: 20, heightCm: 203, age: 28, overallRating: 76 }),
  mkPlayer({ id: "nicolas-batum", nationality: "France", teamId: "lac", leagueId: "nba", firstName: "Nicolas", lastName: "Batum", position: "SF", jerseyNumber: 33, heightCm: 203, age: 36, overallRating: 71 }),

  // --- Suns ---
  mkPlayer({ id: "devin-booker", teamId: "phx", leagueId: "nba", firstName: "Devin", lastName: "Booker", position: "SG", jerseyNumber: 1, heightCm: 196, age: 29, overallRating: 91 }),
  mkPlayer({ id: "jalen-green", teamId: "phx", leagueId: "nba", firstName: "Jalen", lastName: "Green", position: "SG", jerseyNumber: 23, heightCm: 196, age: 23, overallRating: 79 }),
  mkPlayer({ id: "dillon-brooks", nationality: "Canada", teamId: "phx", leagueId: "nba", firstName: "Dillon", lastName: "Brooks", position: "SF", jerseyNumber: 9, heightCm: 198, age: 29, overallRating: 76 }),
  mkPlayer({ id: "mark-williams", teamId: "phx", leagueId: "nba", firstName: "Mark", lastName: "Williams", position: "C", jerseyNumber: 5, heightCm: 213, age: 24, overallRating: 77 }),
  mkPlayer({ id: "grayson-allen", teamId: "phx", leagueId: "nba", firstName: "Grayson", lastName: "Allen", position: "SG", jerseyNumber: 8, heightCm: 196, age: 30, overallRating: 76 }),
  mkPlayer({ id: "ryan-dunn", teamId: "phx", leagueId: "nba", firstName: "Ryan", lastName: "Dunn", position: "SF", jerseyNumber: 4, heightCm: 201, age: 21, overallRating: 72 }),
  mkPlayer({ id: "royce-oneale", teamId: "phx", leagueId: "nba", firstName: "Royce", lastName: "O'Neale", position: "PF", jerseyNumber: 0, heightCm: 198, age: 32, overallRating: 73 }),
  mkPlayer({ id: "collin-gillespie", teamId: "phx", leagueId: "nba", firstName: "Collin", lastName: "Gillespie", position: "PG", jerseyNumber: 2, heightCm: 185, age: 25, overallRating: 70 }),

  // --- Kings ---
  mkPlayer({ id: "domantas-sabonis", nationality: "Lituanie", teamId: "sac", leagueId: "nba", firstName: "Domantas", lastName: "Sabonis", position: "C", jerseyNumber: 10, heightCm: 211, age: 29, overallRating: 87, injuryRisk: 15 }),
  mkPlayer({ id: "zach-lavine", teamId: "sac", leagueId: "nba", firstName: "Zach", lastName: "LaVine", position: "SG", jerseyNumber: 8, heightCm: 196, age: 30, overallRating: 82 }),
  mkPlayer({ id: "demar-derozan", teamId: "sac", leagueId: "nba", firstName: "DeMar", lastName: "DeRozan", position: "SF", jerseyNumber: 10, heightCm: 201, age: 36, overallRating: 81 }),
  mkPlayer({ id: "malik-monk", teamId: "sac", leagueId: "nba", firstName: "Malik", lastName: "Monk", position: "SG", jerseyNumber: 0, heightCm: 191, age: 27, overallRating: 78 }),
  mkPlayer({ id: "keegan-murray", teamId: "sac", leagueId: "nba", firstName: "Keegan", lastName: "Murray", position: "SF", jerseyNumber: 13, heightCm: 203, age: 25, overallRating: 77 }),
  mkPlayer({ id: "devin-carter", teamId: "sac", leagueId: "nba", firstName: "Devin", lastName: "Carter", position: "PG", jerseyNumber: 6, heightCm: 191, age: 23, overallRating: 71 }),
  mkPlayer({ id: "doug-mcdermott", teamId: "sac", leagueId: "nba", firstName: "Doug", lastName: "McDermott", position: "SF", jerseyNumber: 17, heightCm: 203, age: 34, overallRating: 70 }),
  mkPlayer({ id: "trey-lyles", teamId: "sac", leagueId: "nba", firstName: "Trey", lastName: "Lyles", position: "PF", jerseyNumber: 41, heightCm: 208, age: 30, overallRating: 69 }),

  // --- Grizzlies ---
  mkPlayer({ id: "ja-morant", teamId: "mem", leagueId: "nba", firstName: "Ja", lastName: "Morant", position: "PG", jerseyNumber: 12, heightCm: 191, age: 26, overallRating: 89 }),
  mkPlayer({ id: "jaren-jackson-jr", teamId: "mem", leagueId: "nba", firstName: "Jaren", lastName: "Jackson Jr.", position: "PF", jerseyNumber: 13, heightCm: 208, age: 26, overallRating: 86 }),
  mkPlayer({ id: "zach-edey", nationality: "Canada", teamId: "mem", leagueId: "nba", firstName: "Zach", lastName: "Edey", position: "C", jerseyNumber: 15, heightCm: 224, age: 23, overallRating: 76 }),
  mkPlayer({ id: "santi-aldama", nationality: "Espagne", teamId: "mem", leagueId: "nba", firstName: "Santi", lastName: "Aldama", position: "PF", jerseyNumber: 7, heightCm: 211, age: 25, overallRating: 75 }),
  mkPlayer({ id: "cedric-coward", teamId: "mem", leagueId: "nba", firstName: "Cedric", lastName: "Coward", position: "SG", jerseyNumber: 21, heightCm: 201, age: 22, overallRating: 71 }),
  mkPlayer({ id: "scotty-pippen-jr", teamId: "mem", leagueId: "nba", firstName: "Scotty", lastName: "Pippen Jr.", position: "PG", jerseyNumber: 1, heightCm: 185, age: 25, overallRating: 72 }),
  mkPlayer({ id: "vince-williams-jr", teamId: "mem", leagueId: "nba", firstName: "Vince", lastName: "Williams Jr.", position: "SF", jerseyNumber: 5, heightCm: 198, age: 25, overallRating: 72 }),
  mkPlayer({ id: "gg-jackson-ii", teamId: "mem", leagueId: "nba", firstName: "GG", lastName: "Jackson II", position: "PF", jerseyNumber: 45, heightCm: 208, age: 21, overallRating: 73 }),

  // --- Pelicans ---
  mkPlayer({ id: "zion-williamson", teamId: "nop", leagueId: "nba", firstName: "Zion", lastName: "Williamson", position: "PF", jerseyNumber: 1, heightCm: 198, age: 25, overallRating: 85, injuryRisk: 88 }),
  mkPlayer({ id: "trey-murphy-iii", teamId: "nop", leagueId: "nba", firstName: "Trey", lastName: "Murphy III", position: "SF", jerseyNumber: 25, heightCm: 203, age: 25, overallRating: 80 }),
  mkPlayer({ id: "herbert-jones", teamId: "nop", leagueId: "nba", firstName: "Herbert", lastName: "Jones", position: "SF", jerseyNumber: 5, heightCm: 201, age: 27, overallRating: 76 }),
  mkPlayer({ id: "jordan-poole", teamId: "nop", leagueId: "nba", firstName: "Jordan", lastName: "Poole", position: "SG", jerseyNumber: 3, heightCm: 193, age: 26, overallRating: 76 }),
  mkPlayer({ id: "yves-missi", nationality: "Cameroun", teamId: "nop", leagueId: "nba", firstName: "Yves", lastName: "Missi", position: "C", jerseyNumber: 21, heightCm: 211, age: 21, overallRating: 73 }),
  mkPlayer({ id: "jose-alvarado", teamId: "nop", leagueId: "nba", firstName: "Jose", lastName: "Alvarado", position: "PG", jerseyNumber: 15, heightCm: 185, age: 27, overallRating: 73 }),
  mkPlayer({ id: "derik-queen", teamId: "nop", leagueId: "nba", firstName: "Derik", lastName: "Queen", position: "C", jerseyNumber: 8, heightCm: 208, age: 20, overallRating: 74 }),
  mkPlayer({ id: "saddiq-bey", teamId: "nop", leagueId: "nba", firstName: "Saddiq", lastName: "Bey", position: "SF", jerseyNumber: 41, heightCm: 201, age: 26, overallRating: 71 }),

  // --- Rockets ---
  mkPlayer({ id: "kevin-durant", teamId: "hou", leagueId: "nba", firstName: "Kevin", lastName: "Durant", position: "PF", jerseyNumber: 7, heightCm: 208, age: 37, overallRating: 93, injuryRisk: 58 }),
  mkPlayer({ id: "alperen-sengun", nationality: "Turquie", teamId: "hou", leagueId: "nba", firstName: "Alperen", lastName: "Sengun", position: "C", jerseyNumber: 28, heightCm: 211, age: 23, overallRating: 85 }),
  mkPlayer({ id: "amen-thompson", teamId: "hou", leagueId: "nba", firstName: "Amen", lastName: "Thompson", position: "SF", jerseyNumber: 1, heightCm: 201, age: 22, overallRating: 79 }),
  mkPlayer({ id: "fred-vanvleet", teamId: "hou", leagueId: "nba", firstName: "Fred", lastName: "VanVleet", position: "PG", jerseyNumber: 5, heightCm: 183, age: 31, overallRating: 79 }),
  mkPlayer({ id: "steven-adams", nationality: "Nouvelle-Zélande", teamId: "hou", leagueId: "nba", firstName: "Steven", lastName: "Adams", position: "C", jerseyNumber: 12, heightCm: 211, age: 32, overallRating: 73 }),
  mkPlayer({ id: "jabari-smith-jr", teamId: "hou", leagueId: "nba", firstName: "Jabari", lastName: "Smith Jr.", position: "PF", jerseyNumber: 10, heightCm: 208, age: 22, overallRating: 76 }),
  mkPlayer({ id: "reed-sheppard", teamId: "hou", leagueId: "nba", firstName: "Reed", lastName: "Sheppard", position: "PG", jerseyNumber: 15, heightCm: 188, age: 21, overallRating: 73 }),
  mkPlayer({ id: "tari-eason", teamId: "hou", leagueId: "nba", firstName: "Tari", lastName: "Eason", position: "PF", jerseyNumber: 17, heightCm: 203, age: 24, overallRating: 74 }),

  // --- Spurs ---
  mkPlayer({ id: "victor-wembanyama", nationality: "France", teamId: "sas", leagueId: "nba", firstName: "Victor", lastName: "Wembanyama", position: "C", jerseyNumber: 1, heightCm: 224, age: 21, overallRating: 95 }),
  mkPlayer({ id: "de-aaron-fox", teamId: "sas", leagueId: "nba", firstName: "De'Aaron", lastName: "Fox", position: "PG", jerseyNumber: 4, heightCm: 191, age: 27, overallRating: 87 }),
  mkPlayer({ id: "devin-vassell", teamId: "sas", leagueId: "nba", firstName: "Devin", lastName: "Vassell", position: "SG", jerseyNumber: 24, heightCm: 198, age: 25, overallRating: 79 }),
  mkPlayer({ id: "stephon-castle", teamId: "sas", leagueId: "nba", firstName: "Stephon", lastName: "Castle", position: "PG", jerseyNumber: 5, heightCm: 198, age: 20, overallRating: 78 }),
  mkPlayer({ id: "julian-champagnie", teamId: "sas", leagueId: "nba", firstName: "Julian", lastName: "Champagnie", position: "SF", jerseyNumber: 30, heightCm: 201, age: 23, overallRating: 73 }),
  mkPlayer({ id: "harrison-barnes", teamId: "sas", leagueId: "nba", firstName: "Harrison", lastName: "Barnes", position: "SF", jerseyNumber: 40, heightCm: 203, age: 33, overallRating: 74 }),
  mkPlayer({ id: "keldon-johnson", teamId: "sas", leagueId: "nba", firstName: "Keldon", lastName: "Johnson", position: "SF", jerseyNumber: 3, heightCm: 198, age: 26, overallRating: 74 }),
  mkPlayer({ id: "luke-kornet", teamId: "sas", leagueId: "nba", firstName: "Luke", lastName: "Kornet", position: "C", jerseyNumber: 6, heightCm: 216, age: 30, overallRating: 71 }),

  // --- Trail Blazers ---
  mkPlayer({ id: "deni-avdija", nationality: "Israël", teamId: "por", leagueId: "nba", firstName: "Deni", lastName: "Avdija", position: "SF", jerseyNumber: 8, heightCm: 206, age: 24, overallRating: 82 }),
  mkPlayer({ id: "scoot-henderson", teamId: "por", leagueId: "nba", firstName: "Scoot", lastName: "Henderson", position: "PG", jerseyNumber: 0, heightCm: 185, age: 21, overallRating: 76 }),
  mkPlayer({ id: "jerami-grant", teamId: "por", leagueId: "nba", firstName: "Jerami", lastName: "Grant", position: "SF", jerseyNumber: 9, heightCm: 206, age: 31, overallRating: 77 }),
  mkPlayer({ id: "donovan-clingan", teamId: "por", leagueId: "nba", firstName: "Donovan", lastName: "Clingan", position: "C", jerseyNumber: 25, heightCm: 216, age: 21, overallRating: 76 }),
  mkPlayer({ id: "shaedon-sharpe", nationality: "Canada", teamId: "por", leagueId: "nba", firstName: "Shaedon", lastName: "Sharpe", position: "SG", jerseyNumber: 17, heightCm: 196, age: 22, overallRating: 78 }),
  mkPlayer({ id: "toumani-camara", nationality: "Belgique", teamId: "por", leagueId: "nba", firstName: "Toumani", lastName: "Camara", position: "PF", jerseyNumber: 33, heightCm: 201, age: 24, overallRating: 74 }),
  mkPlayer({ id: "robert-williams-iii", teamId: "por", leagueId: "nba", firstName: "Robert", lastName: "Williams III", position: "C", jerseyNumber: 35, heightCm: 206, age: 28, overallRating: 71 }),
  mkPlayer({ id: "yang-hansen", nationality: "Chine", teamId: "por", leagueId: "nba", firstName: "Yang", lastName: "Hansen", position: "C", jerseyNumber: 16, heightCm: 216, age: 20, overallRating: 68 }),

  // --- Jazz ---
  mkPlayer({ id: "lauri-markkanen", nationality: "Finlande", teamId: "uta", leagueId: "nba", firstName: "Lauri", lastName: "Markkanen", position: "PF", jerseyNumber: 23, heightCm: 213, age: 28, overallRating: 84 }),
  mkPlayer({ id: "walker-kessler", teamId: "uta", leagueId: "nba", firstName: "Walker", lastName: "Kessler", position: "C", jerseyNumber: 24, heightCm: 213, age: 24, overallRating: 78 }),
  mkPlayer({ id: "keyonte-george", teamId: "uta", leagueId: "nba", firstName: "Keyonte", lastName: "George", position: "PG", jerseyNumber: 3, heightCm: 191, age: 22, overallRating: 76 }),
  mkPlayer({ id: "ace-bailey", teamId: "uta", leagueId: "nba", firstName: "Ace", lastName: "Bailey", position: "SF", jerseyNumber: 5, heightCm: 206, age: 19, overallRating: 76 }),
  mkPlayer({ id: "isaiah-collier", teamId: "uta", leagueId: "nba", firstName: "Isaiah", lastName: "Collier", position: "PG", jerseyNumber: 1, heightCm: 191, age: 20, overallRating: 72 }),
  mkPlayer({ id: "svi-mykhailiuk", nationality: "Ukraine", teamId: "uta", leagueId: "nba", firstName: "Svi", lastName: "Mykhailiuk", position: "SF", jerseyNumber: 19, heightCm: 201, age: 28, overallRating: 68 }),
  mkPlayer({ id: "kyle-filipowski", teamId: "uta", leagueId: "nba", firstName: "Kyle", lastName: "Filipowski", position: "PF", jerseyNumber: 22, heightCm: 211, age: 21, overallRating: 73 }),
  mkPlayer({ id: "taylor-hendricks", teamId: "uta", leagueId: "nba", firstName: "Taylor", lastName: "Hendricks", position: "PF", jerseyNumber: 0, heightCm: 206, age: 21, overallRating: 72 }),
];
