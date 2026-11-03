// Vrai nombre de matchs de saison régulière par équipe (NBA 82, WNBA 44 —
// format 2025+, voir generate-schedule.ts pour la répartition sur le calendrier).
export const REGULAR_SEASON_GAMES: Record<string, number> = {
  nba: 82,
  wnba: 44,
};

// Durée réelle approximative de la saison régulière, en jours — sert à étaler
// les matchs générés (plusieurs par jour plutôt qu'un tous les 2 jours
// strictement séquentiel, qui étalerait une saison NBA sur des années).
export const SEASON_LENGTH_DAYS: Record<string, number> = {
  nba: 170,
  wnba: 130,
};

// Nombre de tours de pré-saison (chaque tour = 1 match par équipe, sauf
// équipe au repos si nombre impair) et étalement en jours avant l'ouverture
// de la saison régulière — même esprit que les vrais camps d'entraînement /
// matchs de pré-saison NBA/WNBA, mais volontairement simple (pas besoin d'un
// calendrier équilibré pour des matchs qui ne comptent pour rien).
export const PRESEASON_ROUNDS = 5;
export const PRESEASON_SPAN_DAYS = 12;

// Suffixe qui garde les matchs de pré-saison hors du champ des requêtes de
// saison régulière (classement, calendrier, stats, date limite des
// échanges) sans aucune modification de ces requêtes — même convention que
// les matchs de playoffs (voir playoffSeason() dans data-access/playoffs.ts).
export function preseasonSeasonLabel(regularSeason: string): string {
  return `${regularSeason}-preseason`;
}

// Calendrier d'une saison. NBA : calé sur le vrai calendrier, quelle que soit
// la date réelle de création de la Career ou du passage à la saison
// suivante (pré-saison le 3 octobre, saison régulière du 20 octobre au
// 11 avril — dates officielles 2026-27, reprises chaque année). WNBA (en
// pause) : inchangé, la saison démarre à la date réelle du jour.
export interface SeasonCalendar {
  preseasonStart: Date;
  regularSeasonStart: Date;
  // Nombre de jours sur lesquels étaler la saison régulière (voir
  // generateCareerSchedule) : le dernier match tombe au plus tard le
  // dernier de ces jours.
  regularSeasonDays: number;
  // null : pas de date fixe (WNBA, voir TRADE_DEADLINE_SEASON_FRACTION).
  tradeDeadline: Date | null;
}

const DAY_MS = 86_400_000;

// Midi UTC : la même date calendaire quel que soit le fuseau d'affichage.
function calendarDate(year: number, monthIndex: number, day: number): Date {
  return new Date(Date.UTC(year, monthIndex, day, 12));
}

export function seasonStartYear(season: string): number {
  return Number(season.slice(0, 4));
}

// Date limite des échanges NBA : 2e jeudi de février (11 février 2027 pour
// 2026-27, date officielle ; même règle reprise pour les saisons suivantes).
export function nbaTradeDeadline(season: string): Date {
  const year = seasonStartYear(season) + 1;
  const firstOfFeb = calendarDate(year, 1, 1);
  const firstThursday = 1 + ((4 - firstOfFeb.getUTCDay() + 7) % 7);
  return calendarDate(year, 1, firstThursday + 7);
}

export function seasonCalendar(leagueId: string, season: string, today: Date): SeasonCalendar {
  if (leagueId === "nba") {
    const year = seasonStartYear(season);
    const regularSeasonStart = calendarDate(year, 9, 20);
    const regularSeasonEnd = calendarDate(year + 1, 3, 11);
    return {
      preseasonStart: calendarDate(year, 9, 3),
      regularSeasonStart,
      regularSeasonDays: Math.round((regularSeasonEnd.getTime() - regularSeasonStart.getTime()) / DAY_MS) + 1,
      tradeDeadline: nbaTradeDeadline(season),
    };
  }
  const regularSeasonStart = new Date(today.getTime() + PRESEASON_SPAN_DAYS * DAY_MS);
  return {
    preseasonStart: today,
    regularSeasonStart,
    regularSeasonDays: SEASON_LENGTH_DAYS[leagueId] ?? SEASON_LENGTH_DAYS.nba,
    tradeDeadline: null,
  };
}

// Même date calendaire (comparaison au jour près, pas à l'heure près).
export function calendarDay(date: Date | string): string {
  return new Date(date).toISOString().slice(0, 10);
}
