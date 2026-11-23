// Scouting : recherche de joueurs dans toute la ligue selon des critères —
// règles pures (filtres, tri), voir data-access/scouting.ts.

export type Strength = "shooting" | "inside" | "playmaking" | "defense" | "rebounding" | "athleticism";
export const STRENGTHS: Strength[] = ["shooting", "inside", "playmaking", "defense", "rebounding", "athleticism"];
export type ContractStatus = "any" | "contract" | "expiring" | "free_agent";
export type ScoutSort = "overall" | "potential" | "age" | "salary" | "strength";

export interface ScoutFilters {
  position: string | null; // "PG" | "SG" | "SF" | "PF" | "C" | null
  ageMin: number;
  ageMax: number;
  ovrMin: number;
  ovrMax: number;
  potMin: number; // potentiel estimé minimum
  strength: Strength | null;
  strengthMin: number;
  salaryMin: number; // dollars
  salaryMax: number;
  yearsMax: number; // années de contrat restantes au plus (0 = sans limite)
  status: ContractStatus;
  excludeTeamId: string | null; // mon équipe
  sort: ScoutSort;
}

export const DEFAULT_FILTERS: ScoutFilters = {
  position: null,
  ageMin: 18,
  ageMax: 40,
  ovrMin: 70,
  ovrMax: 99,
  potMin: 0,
  strength: null,
  strengthMin: 70,
  salaryMin: 0,
  salaryMax: 0,
  yearsMax: 0,
  status: "any",
  excludeTeamId: null,
  sort: "overall",
};

export interface ScoutRatings {
  scoringInside: number;
  scoringOutside: number;
  playmaking: number;
  defenseInside: number;
  defenseOutside: number;
  rebounding: number;
  athleticism: number;
}

export function strengthValue(r: ScoutRatings, s: Strength): number {
  switch (s) {
    case "shooting":
      return r.scoringOutside;
    case "inside":
      return r.scoringInside;
    case "playmaking":
      return r.playmaking;
    case "defense":
      return Math.round((r.defenseInside + r.defenseOutside) / 2);
    case "rebounding":
      return r.rebounding;
    case "athleticism":
      return r.athleticism;
  }
}

// Points forts d'un joueur (ses deux meilleurs domaines).
export function topStrengths(r: ScoutRatings): Strength[] {
  return [...STRENGTHS].sort((a, b) => strengthValue(r, b) - strengthValue(r, a)).slice(0, 2);
}

export interface ScoutCandidate {
  id: string;
  teamId: string | null; // null = agent libre
  position: string;
  age: number;
  overall: number;
  potential: number; // estimé (selon le niveau de mes recruteurs)
  ratings: ScoutRatings;
  salary: number;
  yearsRemaining: number;
}

export function matchesFilters(c: ScoutCandidate, f: ScoutFilters): boolean {
  if (f.position && c.position !== f.position) return false;
  if (c.age < f.ageMin || c.age > f.ageMax) return false;
  if (c.overall < f.ovrMin || c.overall > f.ovrMax) return false;
  if (c.potential < f.potMin) return false;
  if (f.strength && strengthValue(c.ratings, f.strength) < f.strengthMin) return false;
  if (f.excludeTeamId && c.teamId === f.excludeTeamId) return false;
  const fa = c.teamId === null;
  if (f.status === "free_agent" && !fa) return false;
  if (f.status === "contract" && fa) return false;
  if (f.status === "expiring" && (fa || c.yearsRemaining > 1)) return false;
  if (!fa) {
    if (f.salaryMin > 0 && c.salary < f.salaryMin) return false;
    if (f.salaryMax > 0 && c.salary > f.salaryMax) return false;
    if (f.yearsMax > 0 && c.yearsRemaining > f.yearsMax) return false;
  }
  return true;
}

export function sortCandidates<T extends ScoutCandidate>(list: T[], f: ScoutFilters): T[] {
  const key = (c: T): number => {
    switch (f.sort) {
      case "potential":
        return -c.potential;
      case "age":
        return c.age;
      case "salary":
        return c.teamId === null ? 0 : c.salary;
      case "strength":
        return -(f.strength ? strengthValue(c.ratings, f.strength) : c.overall);
      default:
        return -c.overall;
    }
  };
  return [...list].sort((a, b) => key(a) - key(b) || b.overall - a.overall);
}

const num = (v: string | undefined, d: number, lo: number, hi: number) => {
  const n = Number(v);
  return v === undefined || v === "" || Number.isNaN(n) ? d : Math.max(lo, Math.min(hi, n));
};

// Filtres depuis les paramètres d'URL (salaires saisis en millions).
export function parseFilters(q: Record<string, string | undefined>, myTeamId: string): ScoutFilters {
  const pos = q.pos && ["PG", "SG", "SF", "PF", "C"].includes(q.pos) ? q.pos : null;
  const strength = q.str && (STRENGTHS as string[]).includes(q.str) ? (q.str as Strength) : null;
  const status = q.status && ["any", "contract", "expiring", "free_agent"].includes(q.status) ? (q.status as ContractStatus) : "any";
  const sort = q.sort && ["overall", "potential", "age", "salary", "strength"].includes(q.sort) ? (q.sort as ScoutSort) : "overall";
  return {
    position: pos,
    ageMin: num(q.ageMin, DEFAULT_FILTERS.ageMin, 18, 45),
    ageMax: num(q.ageMax, DEFAULT_FILTERS.ageMax, 18, 45),
    ovrMin: num(q.ovrMin, DEFAULT_FILTERS.ovrMin, 40, 99),
    ovrMax: num(q.ovrMax, DEFAULT_FILTERS.ovrMax, 40, 99),
    potMin: num(q.potMin, 0, 0, 99),
    strength,
    strengthMin: num(q.strMin, DEFAULT_FILTERS.strengthMin, 40, 99),
    salaryMin: num(q.salMin, 0, 0, 80) * 1_000_000,
    salaryMax: num(q.salMax, 0, 0, 80) * 1_000_000,
    yearsMax: num(q.yearsMax, 0, 0, 5),
    status,
    excludeTeamId: q.mine === "1" ? null : myTeamId,
    sort,
  };
}
