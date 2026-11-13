// Règles pures du calendrier réel NBA : NBA Cup (tournoi de début de saison)
// et pause du All-Star Game — aucun accès base de données ici (voir
// data-access/nba-cup.ts et generate-schedule.ts).
//
// Sources (édition 2026, ESPN / NBA) : 6 groupes de 5 équipes (3 par
// conférence), 4 matchs de groupe par équipe les soirs de Cup (vendredis du
// 30 octobre au 27 novembre), qualification des 3 premiers de groupe et du
// meilleur deuxième de chaque conférence, quarts de finale les 4-5
// décembre et demi-finales les 8-9 décembre chez la mieux classée, finale le
// 11 décembre au Hinkle Fieldhouse d'Indianapolis.
//
// Simplification assumée : les matchs de groupe comptent dans la saison
// régulière (comme en vrai), mais les matchs à élimination directe sont à
// part (libellé "<saison>-cup") pour garder exactement 82 matchs par équipe
// — en vrai, les quarts et demies comptent aussi au classement et la NBA
// recale les calendriers des éliminés.

export type CupStage = "group" | "qf" | "sf" | "final";

export const CUP_FINAL_VENUE = "Hinkle Fieldhouse, Indianapolis";

// Groupes officiels 2026-27 (tirage NBA d'après le bilan 2025-26).
export const NBA_CUP_GROUPS_2026: Record<string, string[]> = {
  "Est A": ["det", "tor", "orl", "mil", "bkn"],
  "Est B": ["nyk", "cle", "phi", "mia", "ind"],
  "Est C": ["bos", "atl", "cha", "chi", "was"],
  "Ouest A": ["den", "hou", "phx", "dal", "uta"],
  "Ouest B": ["okc", "min", "lac", "nop", "mem"],
  "Ouest C": ["sas", "lal", "por", "gsw", "sac"],
};

export function cupSeasonLabel(regularSeason: string): string {
  return `${regularSeason}-cup`;
}

export function groupConference(group: string): "east" | "west" {
  return group.startsWith("Est") ? "east" : "west";
}

const DAY_MS = 86_400_000;

function utcNoon(year: number, monthIndex: number, day: number): Date {
  return new Date(Date.UTC(year, monthIndex, day, 12));
}

function addDaysUtc(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS);
}

export interface CupCalendar {
  groupNights: Date[]; // 5 soirs de groupe (un tour chacun)
  quarterfinals: [Date, Date]; // [Est, Ouest]
  semifinals: [Date, Date]; // [Est, Ouest]
  final: Date;
}

// Premier vendredi à partir du 28 octobre, puis chaque vendredi (5 tours) —
// pour 2026 : 30 oct., 6, 13, 20 et 27 nov., dates officielles. Phase finale
// calée sur le dernier soir de groupe (4-5, 8-9 et 11 décembre en 2026).
export function cupCalendar(season: string): CupCalendar {
  const year = Number(season.slice(0, 4));
  const oct28 = utcNoon(year, 9, 28);
  const firstFriday = addDaysUtc(oct28, (5 - oct28.getUTCDay() + 7) % 7);
  const groupNights = [0, 1, 2, 3, 4].map((w) => addDaysUtc(firstFriday, w * 7));
  const last = groupNights[4];
  return {
    groupNights,
    quarterfinals: [addDaysUtc(last, 7), addDaysUtc(last, 8)],
    semifinals: [addDaysUtc(last, 11), addDaysUtc(last, 12)],
    final: addDaysUtc(last, 14),
  };
}

// All-Star Game : 3e dimanche de février (15 février 2026, 21 février 2027 à
// Phoenix). Pause : du vendredi précédent au mercredi suivant, sans match.
export function allStarGameDate(season: string): Date {
  const year = Number(season.slice(0, 4)) + 1;
  const feb1 = utcNoon(year, 1, 1);
  const firstSunday = 1 + ((7 - feb1.getUTCDay()) % 7);
  return utcNoon(year, 1, firstSunday + 14);
}

export const ALL_STAR_HOSTS: Record<string, string> = {
  "2026-2027": "Phoenix",
};

export function allStarBreakDays(season: string): Date[] {
  const game = allStarGameDate(season);
  return [-2, -1, 0, 1, 2, 3].map((d) => addDaysUtc(game, d));
}

// Jours sans aucun match de saison régulière (NBA) : soirs de Cup (réservés
// aux matchs de groupe), jours de phase finale et pause du All-Star.
export function reservedCalendarDays(season: string): Set<string> {
  const cup = cupCalendar(season);
  const days = [
    ...cup.groupNights,
    ...cup.quarterfinals,
    ...cup.semifinals,
    cup.final,
    ...allStarBreakDays(season),
  ];
  return new Set(days.map((d) => d.toISOString().slice(0, 10)));
}

// Tours d'un groupe de 5 (méthode du cercle) : 5 tours de 2 matchs, chaque
// équipe exempte une fois — 4 matchs chacune, chaque adversaire une fois.
export function groupRounds(teams: string[]): [string, string][][] {
  const slots = [...teams, null];
  const rounds: [string, string][][] = [];
  for (let r = 0; r < slots.length - 1; r++) {
    const games: [string, string][] = [];
    for (let i = 0; i < slots.length / 2; i++) {
      const a = slots[i];
      const b = slots[slots.length - 1 - i];
      if (a && b) games.push(r % 2 === 0 ? [a, b] : [b, a]);
    }
    rounds.push(games);
    slots.splice(1, 0, slots.pop()!);
  }
  return rounds;
}

// Tirage façon NBA pour les saisons suivantes : par conférence, 5 chapeaux de
// 3 d'après le bilan de la saison précédente (meilleurs d'abord), une équipe
// de chaque chapeau par groupe.
export function drawCupGroups(
  rankedByConference: { east: string[]; west: string[] },
  random: () => number = Math.random
): Record<string, string[]> {
  const groups: Record<string, string[]> = {};
  for (const [conf, prefix] of [
    ["east", "Est"],
    ["west", "Ouest"],
  ] as const) {
    const ranked = rankedByConference[conf];
    const names = ["A", "B", "C"].map((l) => `${prefix} ${l}`);
    names.forEach((n) => (groups[n] = []));
    for (let pot = 0; pot * 3 < ranked.length; pot++) {
      const potTeams = ranked.slice(pot * 3, pot * 3 + 3);
      const shuffled = potTeams
        .map((t) => ({ t, k: random() }))
        .sort((a, b) => a.k - b.k)
        .map((x) => x.t);
      shuffled.forEach((t, i) => groups[names[i]].push(t));
    }
  }
  return groups;
}

export interface CupGameResult {
  homeTeamId: string;
  awayTeamId: string;
  homeScore: number;
  awayScore: number;
}

export interface GroupRow {
  teamId: string;
  wins: number;
  losses: number;
  pointDiff: number;
  pointsFor: number;
}

// Classement d'un groupe : victoires, puis confrontation directe (égalité à
// deux), différence de points, points marqués — critères officiels.
export function groupStandings(teams: string[], games: CupGameResult[]): GroupRow[] {
  const rows = new Map(teams.map((t) => [t, { teamId: t, wins: 0, losses: 0, pointDiff: 0, pointsFor: 0 }]));
  for (const g of games) {
    const home = rows.get(g.homeTeamId);
    const away = rows.get(g.awayTeamId);
    if (!home || !away) continue;
    const homeWon = g.homeScore > g.awayScore;
    home.wins += homeWon ? 1 : 0;
    home.losses += homeWon ? 0 : 1;
    away.wins += homeWon ? 0 : 1;
    away.losses += homeWon ? 1 : 0;
    home.pointDiff += g.homeScore - g.awayScore;
    away.pointDiff += g.awayScore - g.homeScore;
    home.pointsFor += g.homeScore;
    away.pointsFor += g.awayScore;
  }
  const headToHead = (a: string, b: string): number => {
    const game = games.find(
      (g) => (g.homeTeamId === a && g.awayTeamId === b) || (g.homeTeamId === b && g.awayTeamId === a)
    );
    if (!game) return 0;
    const winner = game.homeScore > game.awayScore ? game.homeTeamId : game.awayTeamId;
    return winner === a ? -1 : 1;
  };
  const list = [...rows.values()];
  return list.sort((a, b) => {
    if (b.wins !== a.wins) return b.wins - a.wins;
    const tied = list.filter((r) => r.wins === a.wins);
    if (tied.length === 2) {
      const h = headToHead(a.teamId, b.teamId);
      if (h !== 0) return h;
    }
    if (b.pointDiff !== a.pointDiff) return b.pointDiff - a.pointDiff;
    return b.pointsFor - a.pointsFor;
  });
}

function compareRows(a: GroupRow, b: GroupRow): number {
  if (b.wins !== a.wins) return b.wins - a.wins;
  if (b.pointDiff !== a.pointDiff) return b.pointDiff - a.pointDiff;
  return b.pointsFor - a.pointsFor;
}

// Qualifiés d'une conférence, têtes de série 1 à 4 : les 3 premiers de
// groupe classés entre eux, puis le meilleur deuxième (wild card).
export function conferenceQualifiers(groupTables: GroupRow[][]): GroupRow[] {
  const winners = groupTables.map((t) => t[0]).sort(compareRows);
  const wildcard = groupTables.map((t) => t[1]).sort(compareRows)[0];
  return [...winners, wildcard];
}

// Options de calendrier NBA (jours réservés + groupes de Cup) pour une
// saison : groupes officiels en 2026-27, tirage par chapeaux ensuite
// (`rankedByConference` : bilan de la saison précédente, meilleurs d'abord).
export function nbaScheduleExtras(
  leagueId: string,
  season: string,
  rankedByConference: { east: string[]; west: string[] } | null
): { reservedDays?: Set<string>; cup?: { groups: Record<string, string[]>; nights: Date[] } } {
  if (leagueId !== "nba") return {};
  const groups =
    season === "2026-2027" || !rankedByConference ? NBA_CUP_GROUPS_2026 : drawCupGroups(rankedByConference);
  return { reservedDays: reservedCalendarDays(season), cup: { groups, nights: cupCalendar(season).groupNights } };
}

// Sélection des All-Stars NBA : ~2 semaines et demie avant le match (comme
// l'annonce réelle des remplaçants), d'après la date du dernier match joué.
export function allStarSelectionDue(season: string, lastPlayed: Date | null): boolean {
  return !!lastPlayed && lastPlayed.getTime() >= allStarGameDate(season).getTime() - 17 * DAY_MS;
}
