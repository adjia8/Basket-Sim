// Grille de calendrier mensuel (semaines du lundi au dimanche) — règles pures,
// dates en UTC au format AAAA-MM-JJ (comme le reste du calendrier du jeu).

const DAY_MS = 86_400_000;

const iso = (d: Date) => d.toISOString().slice(0, 10);
const parse = (day: string) => new Date(`${day}T12:00:00Z`);

// Lundi de la semaine qui contient ce jour.
export function mondayOf(day: string): string {
  const d = parse(day);
  const offset = (d.getUTCDay() + 6) % 7; // lundi = 0 … dimanche = 6
  return iso(new Date(d.getTime() - offset * DAY_MS));
}

// Semaines complètes (lundi → dimanche) qui couvrent [start, end].
export function weeksCovering(start: string, end: string): string[][] {
  const weeks: string[][] = [];
  let cursor = parse(mondayOf(start));
  const last = parse(end).getTime();
  while (cursor.getTime() <= last) {
    const week: string[] = [];
    for (let i = 0; i < 7; i++) week.push(iso(new Date(cursor.getTime() + i * DAY_MS)));
    weeks.push(week);
    cursor = new Date(cursor.getTime() + 7 * DAY_MS);
  }
  return weeks;
}

// Mois au format « AAAA-MM ».
export const monthKey = (day: string) => day.slice(0, 7);

export function shiftMonth(key: string, delta: number): string {
  const [y, m] = key.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1, 12));
  return iso(d).slice(0, 7);
}

// Semaines du mois (jours des mois voisins inclus pour compléter les lignes).
export function weeksOfMonth(key: string): string[][] {
  const [y, m] = key.split("-").map(Number);
  const first = iso(new Date(Date.UTC(y, m - 1, 1, 12)));
  const last = iso(new Date(Date.UTC(y, m, 0, 12)));
  return weeksCovering(first, last);
}

// Mois de `first` à `last` inclus.
export function monthsBetween(first: string, last: string): string[] {
  const months: string[] = [];
  for (let k = monthKey(first); k <= monthKey(last); k = shiftMonth(k, 1)) months.push(k);
  return months;
}
