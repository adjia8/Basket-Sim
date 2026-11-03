// Argent mort réel au début de la saison 2026-27 (Basketball-Reference,
// pages contrats par équipe, 3 novembre 2026) : salaires encore payés par
// une équipe pour un joueur qui n'est plus dans son effectif (coupé,
// échangé avec rachat, contrat étalé). Inséré en DeadCap à la création
// d'une carrière NBA (voir actions/career.ts) — compte dans la masse
// salariale comme en vrai. playerId : id du catalogue quand le joueur y
// figure, sinon un identifiant dérivé de son nom (DeadCap ne référence pas
// Player).
export interface InitialDeadCap {
  teamId: string;
  playerId: string;
  playerName: string;
  salary: number;
  yearsRemaining: number;
}

export const NBA_INITIAL_DEAD_CAP: InitialDeadCap[] = [
  { teamId: "atl", playerId: "devin-carter", playerName: "Devin Carter", salary: 5158080, yearsRemaining: 2 },
  { teamId: "cha", playerId: "pat-connaughton", playerName: "Pat Connaughton", salary: 3815861, yearsRemaining: 2 },
  { teamId: "cha", playerId: "rob-dillingham", playerName: "Rob Dillingham", salary: 6889320, yearsRemaining: 2 },
  { teamId: "cha", playerId: "ryan-nembhard", playerName: "Ryan Nembhard", salary: 2150917, yearsRemaining: 2 },
  { teamId: "cle", playerId: "cam-whitmore", playerName: "Cam Whitmore", salary: 1819437, yearsRemaining: 3 },
  { teamId: "cle", playerId: "ricky-rubio", playerName: "Ricky Rubio", salary: 424672, yearsRemaining: 1 },
  { teamId: "dal", playerId: "javale-mcgee", playerName: "JaVale McGee", salary: 2208856, yearsRemaining: 2 },
  { teamId: "dal", playerId: "klay-thompson", playerName: "Klay Thompson", salary: 17460317, yearsRemaining: 2 },
  { teamId: "dal", playerId: "olivier-maxence-prosper", playerName: "Olivier-Maxence Prosper", salary: 1002360, yearsRemaining: 2 },
  { teamId: "det", playerId: "gary-harris", playerName: "Gary Harris", salary: 3815861, yearsRemaining: 2 },
  { teamId: "lac", playerId: "johni-broome", playerName: "Johni Broome", salary: 2150917, yearsRemaining: 2 },
  { teamId: "lac", playerId: "nicolas-batum", playerName: "Nicolas Batum", salary: 5881680, yearsRemaining: 1 },
  { teamId: "lal", playerId: "dalton-knecht", playerName: "Dalton Knecht", salary: 4201080, yearsRemaining: 2 },
  { teamId: "mem", playerId: "cole-anthony", playerName: "Cole Anthony", salary: 3700000, yearsRemaining: 3 },
  { teamId: "mem", playerId: "dangelo-russell", playerName: "D'Angelo Russell", salary: 5969250, yearsRemaining: 2 },
  { teamId: "mem", playerId: "jordan-hawkins", playerName: "Jordan Hawkins", salary: 7021895, yearsRemaining: 2 },
  { teamId: "mem", playerId: "kentavious-caldwell-pope", playerName: "Kentavious Caldwell-Pope", salary: 17744971, yearsRemaining: 2 },
  { teamId: "mem", playerId: "mamadi-diakite", playerName: "Mamadi Diakite", salary: 464050, yearsRemaining: 2 },
  { teamId: "mem", playerId: "micah-peavy", playerName: "Micah Peavy", salary: 2150917, yearsRemaining: 2 },
  { teamId: "mem", playerId: "walter-clayton-jr", playerName: "Walter Clayton", salary: 4190520, yearsRemaining: 2 },
  { teamId: "mil", playerId: "damian-lillard", playerName: "Damian Lillard", salary: 22516603, yearsRemaining: 4 },
  { teamId: "mil", playerId: "kevin-porter-jr", playerName: "Kevin Porter Jr.", salary: 5390700, yearsRemaining: 2 },
  { teamId: "mil", playerId: "vasilije-micic", playerName: "Vasilije Micić", salary: 666667, yearsRemaining: 3 },
  { teamId: "min", playerId: "john-konchar", playerName: "John Konchar", salary: 2055000, yearsRemaining: 3 },
  { teamId: "nop", playerId: "taj-gibson", playerName: "Taj Gibson", salary: 148828, yearsRemaining: 1 },
  { teamId: "phx", playerId: "bradley-beal", playerName: "Bradley Beal", salary: 19383010, yearsRemaining: 4 },
  { teamId: "phx", playerId: "ej-liddell", playerName: "E.J. Liddell", salary: 706898, yearsRemaining: 2 },
  { teamId: "phx", playerId: "haywood-highsmith", playerName: "Haywood Highsmith", salary: 1000000, yearsRemaining: 2 },
  { teamId: "phx", playerId: "nassir-little", playerName: "Nassir Little", salary: 3107143, yearsRemaining: 3 },
  { teamId: "por", playerId: "didi-louzada", playerName: "Didi Louzada", salary: 268032, yearsRemaining: 3 },
];
