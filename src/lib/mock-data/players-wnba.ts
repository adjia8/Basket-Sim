import type { Player } from "@/lib/types";
import { mkPlayer } from "./player-helpers";

export const playersWnba: Player[] = [
  // --- Las Vegas Aces ---
  mkPlayer({ id: "aja-wilson", teamId: "las-vegas-aces", leagueId: "wnba", firstName: "A'ja", lastName: "Wilson", position: "PF", jerseyNumber: 22, heightCm: 193, age: 29, overallRating: 98, injuryRisk: 15 }),
  mkPlayer({ id: "kelsey-plum", teamId: "las-vegas-aces", leagueId: "wnba", firstName: "Kelsey", lastName: "Plum", position: "PG", jerseyNumber: 10, heightCm: 173, age: 31, overallRating: 90 }),
  mkPlayer({ id: "jackie-young", teamId: "las-vegas-aces", leagueId: "wnba", firstName: "Jackie", lastName: "Young", position: "SG", jerseyNumber: 0, heightCm: 180, age: 27, overallRating: 86 }),
  mkPlayer({ id: "chelsea-gray", teamId: "las-vegas-aces", leagueId: "wnba", firstName: "Chelsea", lastName: "Gray", position: "PG", jerseyNumber: 12, heightCm: 178, age: 33, overallRating: 85 }),
  mkPlayer({ id: "alysha-clark", teamId: "las-vegas-aces", leagueId: "wnba", firstName: "Alysha", lastName: "Clark", position: "SF", jerseyNumber: 32, heightCm: 180, age: 38, overallRating: 72 }),
  mkPlayer({ id: "nalyssa-smith", teamId: "las-vegas-aces", leagueId: "wnba", firstName: "NaLyssa", lastName: "Smith", position: "PF", jerseyNumber: 1, heightCm: 193, age: 25, overallRating: 79 }),
  mkPlayer({ id: "tiffany-hayes", teamId: "las-vegas-aces", leagueId: "wnba", firstName: "Tiffany", lastName: "Hayes", position: "SG", jerseyNumber: 15, heightCm: 175, age: 35, overallRating: 75 }),
  mkPlayer({ id: "megan-gustafson", teamId: "las-vegas-aces", leagueId: "wnba", firstName: "Megan", lastName: "Gustafson", position: "C", jerseyNumber: 13, heightCm: 193, age: 28, overallRating: 68 }),

  // --- New York Liberty ---
  mkPlayer({ id: "breanna-stewart", teamId: "new-york-liberty", leagueId: "wnba", firstName: "Breanna", lastName: "Stewart", position: "PF", jerseyNumber: 30, heightCm: 193, age: 31, overallRating: 97, injuryRisk: 68 }),
  mkPlayer({ id: "sabrina-ionescu", teamId: "new-york-liberty", leagueId: "wnba", firstName: "Sabrina", lastName: "Ionescu", position: "PG", jerseyNumber: 20, heightCm: 180, age: 28, overallRating: 92, injuryRisk: 20 }),
  mkPlayer({ id: "jonquel-jones", teamId: "new-york-liberty", leagueId: "wnba", firstName: "Jonquel", lastName: "Jones", position: "C", jerseyNumber: 35, heightCm: 201, age: 31, overallRating: 88 }),
  mkPlayer({ id: "betnijah-laney-hamilton", teamId: "new-york-liberty", leagueId: "wnba", firstName: "Betnijah", lastName: "Laney-Hamilton", position: "SG", jerseyNumber: 44, heightCm: 178, age: 31, overallRating: 80 }),
  mkPlayer({ id: "courtney-vandersloot", teamId: "new-york-liberty", leagueId: "wnba", firstName: "Courtney", lastName: "Vandersloot", position: "PG", jerseyNumber: 22, heightCm: 175, age: 37, overallRating: 78 }),
  mkPlayer({ id: "leonie-fiebich", teamId: "new-york-liberty", leagueId: "wnba", firstName: "Leonie", lastName: "Fiebich", position: "SF", jerseyNumber: 13, heightCm: 190, age: 25, overallRating: 77 }),
  mkPlayer({ id: "kennedy-burke", teamId: "new-york-liberty", leagueId: "wnba", firstName: "Kennedy", lastName: "Burke", position: "SG", jerseyNumber: 21, heightCm: 180, age: 29, overallRating: 71 }),
  mkPlayer({ id: "nyara-sabally", teamId: "new-york-liberty", leagueId: "wnba", firstName: "Nyara", lastName: "Sabally", position: "C", jerseyNumber: 0, heightCm: 196, age: 25, overallRating: 73 }),

  // --- Seattle Storm ---
  mkPlayer({ id: "jewell-loyd", teamId: "seattle-storm", leagueId: "wnba", firstName: "Jewell", lastName: "Loyd", position: "SG", jerseyNumber: 24, heightCm: 178, age: 31, overallRating: 90 }),
  mkPlayer({ id: "nneka-ogwumike", teamId: "seattle-storm", leagueId: "wnba", firstName: "Nneka", lastName: "Ogwumike", position: "PF", jerseyNumber: 3, heightCm: 188, age: 35, overallRating: 85 }),
  mkPlayer({ id: "skylar-diggins", teamId: "seattle-storm", leagueId: "wnba", firstName: "Skylar", lastName: "Diggins", position: "PG", jerseyNumber: 4, heightCm: 175, age: 35, overallRating: 84, injuryRisk: 25 }),
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
  mkPlayer({ id: "napheesa-collier", teamId: "minnesota-lynx", leagueId: "wnba", firstName: "Napheesa", lastName: "Collier", position: "PF", jerseyNumber: 24, heightCm: 188, age: 29, overallRating: 95, injuryRisk: 18 }),
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

  // --- Atlanta Dream ---
  mkPlayer({ id: "rhyne-howard", teamId: "atlanta-dream", leagueId: "wnba", firstName: "Rhyne", lastName: "Howard", position: "SG", jerseyNumber: 10, heightCm: 185, age: 25, overallRating: 84 }),
  mkPlayer({ id: "allisha-gray", teamId: "atlanta-dream", leagueId: "wnba", firstName: "Allisha", lastName: "Gray", position: "SF", jerseyNumber: 15, heightCm: 178, age: 30, overallRating: 85 }),
  mkPlayer({ id: "brittney-griner", teamId: "atlanta-dream", leagueId: "wnba", firstName: "Brittney", lastName: "Griner", position: "C", jerseyNumber: 42, heightCm: 206, age: 34, overallRating: 86, injuryRisk: 30 }),
  mkPlayer({ id: "jordin-canada", teamId: "atlanta-dream", leagueId: "wnba", firstName: "Jordin", lastName: "Canada", position: "PG", jerseyNumber: 21, heightCm: 170, age: 29, overallRating: 78 }),
  mkPlayer({ id: "naz-hillmon", teamId: "atlanta-dream", leagueId: "wnba", firstName: "Naz", lastName: "Hillmon", position: "PF", jerseyNumber: 5, heightCm: 185, age: 25, overallRating: 74 }),
  mkPlayer({ id: "te-hina-paopao", teamId: "atlanta-dream", leagueId: "wnba", firstName: "Te-Hina", lastName: "Paopao", position: "PG", jerseyNumber: 12, heightCm: 173, age: 22, overallRating: 71 }),
  mkPlayer({ id: "maya-caldwell", teamId: "atlanta-dream", leagueId: "wnba", firstName: "Maya", lastName: "Caldwell", position: "SG", jerseyNumber: 2, heightCm: 178, age: 24, overallRating: 70 }),
  mkPlayer({ id: "taylor-thierry", teamId: "atlanta-dream", leagueId: "wnba", firstName: "Taylor", lastName: "Thierry", position: "SF", jerseyNumber: 34, heightCm: 185, age: 22, overallRating: 69 }),

  // --- Chicago Sky ---
  mkPlayer({ id: "angel-reese", teamId: "chicago-sky", leagueId: "wnba", firstName: "Angel", lastName: "Reese", position: "PF", jerseyNumber: 5, heightCm: 190, age: 23, overallRating: 84 }),
  mkPlayer({ id: "kamilla-cardoso", teamId: "chicago-sky", leagueId: "wnba", firstName: "Kamilla", lastName: "Cardoso", position: "C", jerseyNumber: 10, heightCm: 201, age: 24, overallRating: 77 }),
  mkPlayer({ id: "ariel-atkins", teamId: "chicago-sky", leagueId: "wnba", firstName: "Ariel", lastName: "Atkins", position: "SG", jerseyNumber: 7, heightCm: 178, age: 28, overallRating: 78 }),
  mkPlayer({ id: "hailey-van-lith", teamId: "chicago-sky", leagueId: "wnba", firstName: "Hailey", lastName: "Van Lith", position: "PG", jerseyNumber: 11, heightCm: 178, age: 23, overallRating: 72 }),
  mkPlayer({ id: "michaela-onyenwere", teamId: "chicago-sky", leagueId: "wnba", firstName: "Michaela", lastName: "Onyenwere", position: "SF", jerseyNumber: 24, heightCm: 183, age: 25, overallRating: 70 }),
  mkPlayer({ id: "elizabeth-williams", teamId: "chicago-sky", leagueId: "wnba", firstName: "Elizabeth", lastName: "Williams", position: "C", jerseyNumber: 1, heightCm: 191, age: 32, overallRating: 71 }),
  mkPlayer({ id: "maddy-westbeld", teamId: "chicago-sky", leagueId: "wnba", firstName: "Maddy", lastName: "Westbeld", position: "PF", jerseyNumber: 24, heightCm: 188, age: 23, overallRating: 69 }),
  mkPlayer({ id: "rebecca-allen", teamId: "chicago-sky", leagueId: "wnba", firstName: "Rebecca", lastName: "Allen", position: "SF", jerseyNumber: 9, heightCm: 185, age: 32, overallRating: 68 }),

  // --- Washington Mystics ---
  mkPlayer({ id: "brittney-sykes", teamId: "washington-mystics", leagueId: "wnba", firstName: "Brittney", lastName: "Sykes", position: "SG", jerseyNumber: 42, heightCm: 175, age: 31, overallRating: 80 }),
  mkPlayer({ id: "shakira-austin", teamId: "washington-mystics", leagueId: "wnba", firstName: "Shakira", lastName: "Austin", position: "C", jerseyNumber: 0, heightCm: 193, age: 25, overallRating: 76 }),
  mkPlayer({ id: "kiki-iriafen", teamId: "washington-mystics", leagueId: "wnba", firstName: "Kiki", lastName: "Iriafen", position: "PF", jerseyNumber: 44, heightCm: 190, age: 22, overallRating: 76 }),
  mkPlayer({ id: "sonia-citron", teamId: "washington-mystics", leagueId: "wnba", firstName: "Sonia", lastName: "Citron", position: "SG", jerseyNumber: 3, heightCm: 183, age: 22, overallRating: 75 }),
  mkPlayer({ id: "aaliyah-edwards", teamId: "washington-mystics", leagueId: "wnba", firstName: "Aaliyah", lastName: "Edwards", position: "PF", jerseyNumber: 25, heightCm: 190, age: 22, overallRating: 74 }),
  mkPlayer({ id: "georgia-amoore", teamId: "washington-mystics", leagueId: "wnba", firstName: "Georgia", lastName: "Amoore", position: "PG", jerseyNumber: 14, heightCm: 170, age: 23, overallRating: 72 }),
  mkPlayer({ id: "jade-melbourne", teamId: "washington-mystics", leagueId: "wnba", firstName: "Jade", lastName: "Melbourne", position: "PG", jerseyNumber: 2, heightCm: 173, age: 21, overallRating: 68 }),
  mkPlayer({ id: "sug-sutton", teamId: "washington-mystics", leagueId: "wnba", firstName: "Sug", lastName: "Sutton", position: "PG", jerseyNumber: 4, heightCm: 175, age: 27, overallRating: 67 }),

  // --- Dallas Wings ---
  mkPlayer({ id: "paige-bueckers", teamId: "dallas-wings", leagueId: "wnba", firstName: "Paige", lastName: "Bueckers", position: "PG", jerseyNumber: 5, heightCm: 180, age: 23, overallRating: 86 }),
  mkPlayer({ id: "arike-ogunbowale", teamId: "dallas-wings", leagueId: "wnba", firstName: "Arike", lastName: "Ogunbowale", position: "SG", jerseyNumber: 24, heightCm: 175, age: 28, overallRating: 87 }),
  mkPlayer({ id: "myisha-hines-allen", teamId: "dallas-wings", leagueId: "wnba", firstName: "Myisha", lastName: "Hines-Allen", position: "PF", jerseyNumber: 2, heightCm: 188, age: 28, overallRating: 76 }),
  mkPlayer({ id: "maddy-siegrist", teamId: "dallas-wings", leagueId: "wnba", firstName: "Maddy", lastName: "Siegrist", position: "PF", jerseyNumber: 32, heightCm: 188, age: 24, overallRating: 72 }),
  mkPlayer({ id: "luisa-geiselsoder", teamId: "dallas-wings", leagueId: "wnba", firstName: "Luisa", lastName: "Geiselsoder", position: "PF", jerseyNumber: 21, heightCm: 191, age: 22, overallRating: 68 }),
  mkPlayer({ id: "jj-quinerly", teamId: "dallas-wings", leagueId: "wnba", firstName: "JJ", lastName: "Quinerly", position: "PG", jerseyNumber: 15, heightCm: 175, age: 23, overallRating: 70 }),
  mkPlayer({ id: "aziaha-james", teamId: "dallas-wings", leagueId: "wnba", firstName: "Aziaha", lastName: "James", position: "SG", jerseyNumber: 32, heightCm: 178, age: 22, overallRating: 69 }),
  mkPlayer({ id: "deyona-gaston", teamId: "dallas-wings", leagueId: "wnba", firstName: "DeYona", lastName: "Gaston", position: "SF", jerseyNumber: 11, heightCm: 185, age: 24, overallRating: 66 }),

  // --- Los Angeles Sparks ---
  mkPlayer({ id: "dearica-hamby", teamId: "los-angeles-sparks", leagueId: "wnba", firstName: "Dearica", lastName: "Hamby", position: "PF", jerseyNumber: 5, heightCm: 185, age: 31, overallRating: 80 }),
  mkPlayer({ id: "cameron-brink", teamId: "los-angeles-sparks", leagueId: "wnba", firstName: "Cameron", lastName: "Brink", position: "PF", jerseyNumber: 22, heightCm: 196, age: 23, overallRating: 78 }),
  mkPlayer({ id: "rickea-jackson", teamId: "los-angeles-sparks", leagueId: "wnba", firstName: "Rickea", lastName: "Jackson", position: "SF", jerseyNumber: 2, heightCm: 185, age: 23, overallRating: 77 }),
  mkPlayer({ id: "azura-stevens", teamId: "los-angeles-sparks", leagueId: "wnba", firstName: "Azura", lastName: "Stevens", position: "PF", jerseyNumber: 23, heightCm: 196, age: 27, overallRating: 76 }),
  mkPlayer({ id: "julie-vanloo", teamId: "los-angeles-sparks", leagueId: "wnba", firstName: "Julie", lastName: "Vanloo", position: "PG", jerseyNumber: 3, heightCm: 175, age: 30, overallRating: 72 }),
  mkPlayer({ id: "odyssey-sims", teamId: "los-angeles-sparks", leagueId: "wnba", firstName: "Odyssey", lastName: "Sims", position: "PG", jerseyNumber: 1, heightCm: 173, age: 33, overallRating: 71 }),
  mkPlayer({ id: "sarah-ashlee-barker", teamId: "los-angeles-sparks", leagueId: "wnba", firstName: "Sarah Ashlee", lastName: "Barker", position: "SG", jerseyNumber: 15, heightCm: 180, age: 23, overallRating: 68 }),
  mkPlayer({ id: "emily-engstler", teamId: "los-angeles-sparks", leagueId: "wnba", firstName: "Emily", lastName: "Engstler", position: "PF", jerseyNumber: 21, heightCm: 188, age: 24, overallRating: 68 }),

  // --- Phoenix Mercury ---
  mkPlayer({ id: "satou-sabally", teamId: "phoenix-mercury", leagueId: "wnba", firstName: "Satou", lastName: "Sabally", position: "PF", jerseyNumber: 0, heightCm: 196, age: 27, overallRating: 85 }),
  mkPlayer({ id: "kahleah-copper", teamId: "phoenix-mercury", leagueId: "wnba", firstName: "Kahleah", lastName: "Copper", position: "SG", jerseyNumber: 2, heightCm: 178, age: 31, overallRating: 83 }),
  mkPlayer({ id: "natasha-cloud", teamId: "phoenix-mercury", leagueId: "wnba", firstName: "Natasha", lastName: "Cloud", position: "PG", jerseyNumber: 9, heightCm: 180, age: 33, overallRating: 76 }),
  mkPlayer({ id: "sami-whitcomb", teamId: "phoenix-mercury", leagueId: "wnba", firstName: "Sami", lastName: "Whitcomb", position: "SG", jerseyNumber: 4, heightCm: 178, age: 36, overallRating: 71 }),
  mkPlayer({ id: "julie-allemand", teamId: "phoenix-mercury", leagueId: "wnba", firstName: "Julie", lastName: "Allemand", position: "PG", jerseyNumber: 20, heightCm: 173, age: 28, overallRating: 70 }),
  mkPlayer({ id: "monique-akoa-makani", teamId: "phoenix-mercury", leagueId: "wnba", firstName: "Monique", lastName: "Akoa Makani", position: "PG", jerseyNumber: 13, heightCm: 175, age: 26, overallRating: 68 }),
  mkPlayer({ id: "kalani-brown", teamId: "phoenix-mercury", leagueId: "wnba", firstName: "Kalani", lastName: "Brown", position: "C", jerseyNumber: 42, heightCm: 196, age: 28, overallRating: 69 }),
  mkPlayer({ id: "lorela-cubaj", teamId: "phoenix-mercury", leagueId: "wnba", firstName: "Lorela", lastName: "Cubaj", position: "PF", jerseyNumber: 34, heightCm: 191, age: 25, overallRating: 67 }),

  // --- Golden State Valkyries ---
  mkPlayer({ id: "kayla-thornton", teamId: "golden-state-valkyries", leagueId: "wnba", firstName: "Kayla", lastName: "Thornton", position: "SF", jerseyNumber: 6, heightCm: 188, age: 32, overallRating: 78 }),
  mkPlayer({ id: "veronica-burton", teamId: "golden-state-valkyries", leagueId: "wnba", firstName: "Veronica", lastName: "Burton", position: "PG", jerseyNumber: 22, heightCm: 178, age: 25, overallRating: 74 }),
  mkPlayer({ id: "cecilia-zandalasini", teamId: "golden-state-valkyries", leagueId: "wnba", firstName: "Cecilia", lastName: "Zandalasini", position: "SF", jerseyNumber: 5, heightCm: 185, age: 29, overallRating: 73 }),
  mkPlayer({ id: "monique-billings", teamId: "golden-state-valkyries", leagueId: "wnba", firstName: "Monique", lastName: "Billings", position: "PF", jerseyNumber: 25, heightCm: 193, age: 28, overallRating: 72 }),
  mkPlayer({ id: "kate-martin", teamId: "golden-state-valkyries", leagueId: "wnba", firstName: "Kate", lastName: "Martin", position: "SG", jerseyNumber: 20, heightCm: 183, age: 24, overallRating: 70 }),
  mkPlayer({ id: "janelle-salaun", teamId: "golden-state-valkyries", leagueId: "wnba", firstName: "Janelle", lastName: "Salaun", position: "SF", jerseyNumber: 13, heightCm: 188, age: 22, overallRating: 69 }),
  mkPlayer({ id: "carla-leite", teamId: "golden-state-valkyries", leagueId: "wnba", firstName: "Carla", lastName: "Leite", position: "SG", jerseyNumber: 8, heightCm: 178, age: 20, overallRating: 68 }),
  mkPlayer({ id: "iliana-rupert", teamId: "golden-state-valkyries", leagueId: "wnba", firstName: "Iliana", lastName: "Rupert", position: "C", jerseyNumber: 15, heightCm: 196, age: 24, overallRating: 67 }),
];
