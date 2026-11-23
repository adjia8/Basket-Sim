// Joueurs d'Europe — règles pures : clause de rachat (buyout), prospects
// européens draftés et laissés en Europe (draft-and-stash), fin de contrat.
//
// Un joueur sous contrat en Europe ne peut pas signer en NBA comme un agent
// libre : l'équipe qui le veut paie d'abord sa clause de rachat à son club
// (sur la trésorerie de la franchise), obtient ainsi ses droits exclusifs,
// puis négocie son contrat. Un prospect européen drafté peut rester en
// Europe pour progresser (ses droits restent à l'équipe) et être rapatrié
// plus tard, contre le rachat de son contrat européen.

export const EUROPE_RENEW_YEARS = 2;
export const STASH_YEARS = 2;
export const MAX_BUYOUT = 6_000_000;

// Clause de rachat : selon la note, les années restantes et la jeunesse
// (un club européen vend cher un jeune talent). 0 en fin de contrat.
export function buyoutFor(overall: number, age: number, yearsLeft: number): number {
  if (yearsLeft <= 0) return 0;
  const base = Math.max(1, overall - 62) * 120_000 * Math.min(3, yearsLeft);
  const youth = age <= 22 ? 1.5 : age >= 32 ? 0.6 : 1;
  return Math.min(MAX_BUYOUT, Math.round((base * youth) / 50_000) * 50_000);
}

// Prospect qui joue en Europe (et non en NCAA) : « Real Madrid (Espagne) ».
export function europeanClubOf(scoutingNote: string | null | undefined): string | null {
  if (!scoutingNote) return null;
  if (/NCAA|G League|Overtime|lycée|high school/i.test(scoutingNote)) return null;
  return /\(.+\)/.test(scoutingNote) ? scoutingNote : null;
}

// Fin de saison en Europe : une année de moins ; en fin de contrat, il
// re-signe dans son club (nouvelle clause) s'il n'est pas parti en NBA.
export function europeAfterSeason(p: { overall: number; age: number; years: number }): { years: number; buyout: number } {
  const years = p.years - 1 <= 0 ? EUROPE_RENEW_YEARS : p.years - 1;
  return { years, buyout: buyoutFor(p.overall, p.age, years) };
}

// Qui peut négocier avec ce joueur sans contrat NBA ?
// - en Europe sans droits : personne (rachat d'abord) ;
// - droits détenus : seulement l'équipe qui les détient ;
// - sinon : agent libre ordinaire.
export function canNegotiateWith(state: { abroadClub: string | null; rightsTeamId: string | null } | null, teamId: string): boolean {
  if (!state) return true;
  if (state.abroadClub) return false;
  if (state.rightsTeamId) return state.rightsTeamId === teamId;
  return true;
}

// IA : un jeune prospect européen drafté tard reste souvent en Europe pour
// progresser (comme les Spurs, les Nuggets…).
export function aiShouldStash(p: { scoutingNote: string | null; age: number }, pickNumber: number | null, random: () => number = Math.random): boolean {
  if (!europeanClubOf(p.scoutingNote) || p.age > 21) return false;
  return (pickNumber ?? 60) > 20 && random() < 0.5;
}
