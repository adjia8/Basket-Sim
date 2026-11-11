// Règles pures du staff, façon Football Manager — aucun accès base de
// données ici (voir data-access/staff.ts).
//
// Chaque équipe (IA comprise) a un staff de membres fictifs :
// - l'entraîneur principal (tactique + motivation) ;
// - des assistants spécialisés (attaque, défense, développement) ;
// - des préparateurs physiques ;
// - un staff médical.
// Leur compétence (0-99) se traduit en effets concrets sur l'équipe (force
// en match, cohésion, moral, progression des jeunes, usure, fatigue,
// blessures). Les salaires sont en dollars réels et doivent tenir dans le
// budget staff alloué chaque saison par les propriétaires.

export type StaffRole = "head_coach" | "assistant_coach" | "strength_coach" | "medical" | "scout";
export type AssistantSpecialty = "offense" | "defense" | "development";

export const STAFF_ROLES: StaffRole[] = ["head_coach", "assistant_coach", "strength_coach", "medical", "scout"];
export const ASSISTANT_SPECIALTIES: AssistantSpecialty[] = ["offense", "defense", "development"];

// Postes par équipe.
export const STAFF_SLOTS: Record<string, Record<StaffRole, number>> = {
  nba: { head_coach: 1, assistant_coach: 3, strength_coach: 2, medical: 2, scout: 2 },
  wnba: { head_coach: 1, assistant_coach: 2, strength_coach: 1, medical: 1, scout: 1 },
};

export function staffSlots(leagueId: string): Record<StaffRole, number> {
  return STAFF_SLOTS[leagueId] ?? STAFF_SLOTS.nba;
}

// Fourchettes de salaire annuel (dollars), de la compétence 30 à 99.
const SALARY_SCALE: Record<string, Record<StaffRole, [number, number]>> = {
  nba: {
    head_coach: [2_000_000, 12_000_000],
    assistant_coach: [300_000, 2_000_000],
    strength_coach: [150_000, 800_000],
    medical: [200_000, 1_000_000],
    scout: [150_000, 700_000],
  },
  wnba: {
    head_coach: [200_000, 1_500_000],
    assistant_coach: [60_000, 250_000],
    strength_coach: [50_000, 160_000],
    medical: [60_000, 180_000],
    scout: [40_000, 120_000],
  },
};

function roundTo(value: number, step: number): number {
  return Math.round(value / step) * step;
}

// Salaire « de marché » d'un membre du staff : croît plus que linéairement
// avec la compétence (les meilleurs coûtent très cher). `variance` (≈ ±15 %)
// fait varier les exigences d'un candidat à l'autre.
export function staffSalary(leagueId: string, role: StaffRole, rating: number, variance = 1): number {
  const [min, max] = (SALARY_SCALE[leagueId] ?? SALARY_SCALE.nba)[role];
  const t = Math.max(0, Math.min(1, (rating - 30) / 69));
  const step = leagueId === "wnba" ? 5_000 : 10_000;
  return Math.max(min, roundTo((min + Math.pow(t, 1.6) * (max - min)) * variance, step));
}

// Budget staff de la saison, alloué par les propriétaires : selon le marché,
// la relation avec la direction (conférences de presse, bilan du GM) et le
// bilan de la saison précédente.
const STAFF_BUDGET_BASE: Record<string, number> = { nba: 10_000_000, wnba: 1_000_000 };

export function staffBudget(leagueId: string, marketAppeal: number, frontOfficeApproval = 50, winPct = 0.5): number {
  const base = STAFF_BUDGET_BASE[leagueId] ?? STAFF_BUDGET_BASE.nba;
  const market = 0.8 + (Math.max(0, Math.min(99, marketAppeal)) / 99) * 0.6;
  const approval = 0.92 + (Math.max(0, Math.min(99, frontOfficeApproval)) / 99) * 0.16;
  const results = 0.95 + Math.max(0, Math.min(1, winPct)) * 0.1;
  return roundTo(base * market * approval * results, leagueId === "wnba" ? 10_000 : 100_000);
}

// Demande de rallonge (une par saison) : plus la direction t'apprécie, plus
// elle a de chances d'accepter (+10 % de budget).
export const BUDGET_INCREASE_RATE = 0.1;
export function budgetIncreaseChance(frontOfficeApproval: number): number {
  return 0.2 + (Math.max(0, Math.min(99, frontOfficeApproval)) / 99) * 0.6;
}

// Indemnités de licenciement : la moitié du salaire restant dû.
export function severanceCost(salary: number, yearsRemaining: number): number {
  return Math.round(salary * Math.max(0, yearsRemaining) * 0.5);
}

// Prolongation : un membre compétent demande une augmentation.
export function renewalSalary(salary: number, rating: number): number {
  return roundTo(salary * (rating >= 70 ? 1.15 : rating >= 50 ? 1.07 : 1), 5_000);
}

// ---------------------------------------------------------------------------
// Génération

const FIRST_NAMES = [
  "Adrian", "Alicia", "Andre", "Ben", "Brandon", "Brian", "Carla", "Carlos", "Chris", "Dana",
  "Daniel", "Darius", "Derek", "Diane", "Elena", "Eric", "Felix", "Frank", "Gary", "Grace",
  "Greg", "Hector", "Ian", "Isabel", "Jamal", "Jason", "Jen", "Joel", "Jordan", "Julia",
  "Karim", "Keith", "Kevin", "Laura", "Leon", "Lisa", "Luis", "Marc", "Maria", "Mark",
  "Matt", "Mike", "Monica", "Nadia", "Nate", "Nicole", "Omar", "Paul", "Rachel", "Ray",
  "Rob", "Rosa", "Sam", "Sandra", "Scott", "Sean", "Simone", "Steve", "Tanya", "Terry",
  "Tom", "Tyrone", "Vince", "Wes", "Yves", "Zach",
];

const LAST_NAMES = [
  "Abbott", "Alvarez", "Barrett", "Bishop", "Brennan", "Calloway", "Castillo", "Chambers", "Collier", "Crane",
  "Dalton", "Delgado", "Donovan", "Ellison", "Ferris", "Fleming", "Garrity", "Gentry", "Haldane", "Hargrove",
  "Holloway", "Ibarra", "Jansen", "Kessler", "Kowalski", "Lacroix", "Lambert", "Lindqvist", "Lowery", "Maddox",
  "Marchetti", "McCready", "Mendez", "Morrow", "Navarro", "Novak", "Okafor", "Ortega", "Pace", "Petrov",
  "Prescott", "Quinlan", "Ramsey", "Reyes", "Rourke", "Salazar", "Santoro", "Shepherd", "Sloane", "Sorensen",
  "Stroud", "Talbot", "Thornton", "Torres", "Underwood", "Valdez", "Vance", "Voss", "Wakefield", "Whitaker",
  "Wilder", "Yates", "Zeller",
];

const AGE_RANGE: Record<StaffRole, [number, number]> = {
  head_coach: [38, 66],
  assistant_coach: [28, 60],
  strength_coach: [26, 55],
  medical: [30, 62],
  scout: [28, 65],
};

export interface GeneratedStaff {
  role: StaffRole;
  specialty: AssistantSpecialty | null;
  firstName: string;
  lastName: string;
  age: number;
  rating: number;
  motivation: number | null;
  salary: number;
  yearsRemaining: number;
}

function randomInt(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min + 1));
}

function clampRating(value: number): number {
  return Math.max(15, Math.min(95, Math.round(value)));
}

// Un membre du staff autour d'une compétence cible (±12).
export function generateStaffMember(
  leagueId: string,
  role: StaffRole,
  targetRating: number,
  specialty: AssistantSpecialty | null = null
): GeneratedStaff {
  const [minAge, maxAge] = AGE_RANGE[role];
  const rating = clampRating(targetRating + randomInt(-12, 12));
  return {
    role,
    specialty: role === "assistant_coach" ? (specialty ?? ASSISTANT_SPECIALTIES[randomInt(0, 2)]) : null,
    firstName: FIRST_NAMES[randomInt(0, FIRST_NAMES.length - 1)],
    lastName: LAST_NAMES[randomInt(0, LAST_NAMES.length - 1)],
    age: randomInt(minAge, maxAge),
    rating,
    motivation: role === "head_coach" ? clampRating(rating + randomInt(-20, 20)) : null,
    salary: staffSalary(leagueId, role, rating, 0.9 + Math.random() * 0.25),
    yearsRemaining: randomInt(1, 4),
  };
}

// Staff complet d'une équipe au démarrage d'une carrière, autour d'un niveau
// cible (le niveau de staff historique de la franchise) — un assistant de
// chaque spécialité tant qu'il y a des postes.
export function generateTeamStaff(leagueId: string, level: number): GeneratedStaff[] {
  const slots = staffSlots(leagueId);
  const staff: GeneratedStaff[] = [generateStaffMember(leagueId, "head_coach", level + 5)];
  const specialties: AssistantSpecialty[] = ["offense", "defense", "development"];
  for (let i = 0; i < slots.assistant_coach; i++) {
    staff.push(generateStaffMember(leagueId, "assistant_coach", level, specialties[i % specialties.length]));
  }
  for (let i = 0; i < slots.strength_coach; i++) staff.push(generateStaffMember(leagueId, "strength_coach", level));
  for (let i = 0; i < slots.scout; i++) staff.push(generateStaffMember(leagueId, "scout", level));
  for (let i = 0; i < slots.medical; i++) staff.push(generateStaffMember(leagueId, "medical", level));
  return staff;
}

// Candidats libres sur le marché : tous les profils, des plus modestes aux
// (rares) très bons.
export function generateStaffPool(leagueId: string, count: number): GeneratedStaff[] {
  const pool: GeneratedStaff[] = [];
  for (let i = 0; i < count; i++) {
    const r = Math.random();
    const role: StaffRole =
      r < 0.13 ? "head_coach" : r < 0.48 ? "assistant_coach" : r < 0.66 ? "strength_coach" : r < 0.84 ? "medical" : "scout";
    const target = 30 + Math.pow(Math.random(), 1.4) * 55; // surtout 30-60, quelques 75-85
    pool.push(generateStaffMember(leagueId, role, target));
  }
  return pool;
}

// Évolution annuelle : les jeunes progressent, les plus âgés déclinent puis
// prennent leur retraite.
export function staffAfterSeason(member: { age: number; rating: number; motivation: number | null }): {
  age: number;
  rating: number;
  motivation: number | null;
  retires: boolean;
} {
  const age = member.age + 1;
  const delta =
    age < 35 ? randomInt(1, 3) : age < 45 ? randomInt(0, 2) : age < 55 ? randomInt(-1, 1) : age < 62 ? randomInt(-2, 0) : randomInt(-3, -1);
  const retires = age >= 72 || (age >= 66 && Math.random() < (age - 64) * 0.15);
  return {
    age,
    rating: clampRating(member.rating + delta),
    motivation: member.motivation === null ? null : clampRating(member.motivation + randomInt(-1, 1)),
    retires,
  };
}

// ---------------------------------------------------------------------------
// Profil et effets

export interface StaffMemberLike {
  role: string;
  specialty: string | null;
  rating: number;
  motivation: number | null;
}

// Niveaux 0-99 de chaque domaine (50 ≈ un staff moyen et complet). Un poste
// vacant pèse lourd : un préparateur manquant compte comme un niveau 20.
export interface StaffProfile {
  tactics: number;
  motivation: number;
  offense: number;
  defense: number;
  development: number;
  fitness: number;
  medical: number;
  scouting: number; // recruteurs : précision des estimations (potentiel, prospects)
  overall: number;
}

export const NEUTRAL_STAFF_PROFILE: StaffProfile = {
  tactics: 50,
  motivation: 50,
  offense: 50,
  defense: 50,
  development: 50,
  fitness: 50,
  medical: 50,
  scouting: 50,
  overall: 50,
};

const VACANT_ASSISTANT = 30;
const VACANT_SPECIALIST = 20;
const VACANT_HEAD_COACH = 25;

function slotAverage(ratings: number[], slots: number): number {
  const sorted = [...ratings].sort((a, b) => b - a).slice(0, slots);
  while (sorted.length < slots) sorted.push(VACANT_SPECIALIST);
  return sorted.reduce((sum, r) => sum + r, 0) / Math.max(1, slots);
}

export function staffProfile(members: StaffMemberLike[], leagueId: string): StaffProfile {
  const slots = staffSlots(leagueId);
  const head = members.filter((m) => m.role === "head_coach").sort((a, b) => b.rating - a.rating)[0];
  const tactics = head?.rating ?? VACANT_HEAD_COACH;
  const motivation = head?.motivation ?? head?.rating ?? VACANT_HEAD_COACH;
  // Spécialiste du domaine ; à défaut, les autres assistants le couvrent en
  // partie (70 % de leur niveau moyen).
  const assistants = members.filter((m) => m.role === "assistant_coach");
  const bestAssistant = (specialty: AssistantSpecialty) => {
    const specialists = assistants.filter((m) => m.specialty === specialty).map((m) => m.rating);
    if (specialists.length > 0) return Math.max(...specialists);
    const average = assistants.length > 0 ? assistants.reduce((sum, m) => sum + m.rating, 0) / assistants.length : 0;
    return Math.max(VACANT_ASSISTANT, Math.round(average * 0.7));
  };
  const blend = (assistant: number) => Math.round(assistant * 0.65 + tactics * 0.35);
  const offense = blend(bestAssistant("offense"));
  const defense = blend(bestAssistant("defense"));
  const development = blend(bestAssistant("development"));
  const fitness = Math.round(
    slotAverage(members.filter((m) => m.role === "strength_coach").map((m) => m.rating), slots.strength_coach)
  );
  const medical = Math.round(slotAverage(members.filter((m) => m.role === "medical").map((m) => m.rating), slots.medical));
  const scouting = Math.round(slotAverage(members.filter((m) => m.role === "scout").map((m) => m.rating), slots.scout));
  return {
    tactics,
    motivation,
    offense,
    defense,
    development,
    fitness,
    medical,
    scouting,
    // Niveau global « encadrement » (ancien TeamState.trainingStaffLevel,
    // encore lu par les promesses et l'attractivité pour les agents libres).
    overall: Math.round((development + fitness + medical) / 3),
  };
}

export interface StaffEffects {
  strengthBonus: number; // ajouté à la force d'équipe en match (même échelle que le bonus du GM)
  chemistryBonus: number; // ajouté à la chimie transmise au moteur
  moraleShift: number; // décale le moral « normal » des joueurs (±5)
  developmentLevel: number; // progression des jeunes, vieillissement (0-100)
  medicalLevel: number; // risque de blessure (0-100, voir injuryChance)
  injuryRecoveryChance: number; // chance par match de guérir un match plus vite
  wearFactor: number; // multiplicateur de l'usure accumulée
  fatigueRecoveryFactor: number; // multiplicateur de la récupération d'énergie
}

export function staffEffects(p: StaffProfile): StaffEffects {
  const centered = (v: number) => (Math.max(0, Math.min(99, v)) - 50) / 50;
  return {
    strengthBonus: Math.round((centered(p.tactics) * 1.5 + centered(p.offense) * 0.75 + centered(p.defense) * 0.75) * 100) / 100,
    chemistryBonus: Math.round(centered(p.motivation) * 3),
    moraleShift: Math.round(centered(p.motivation) * 5),
    developmentLevel: p.development,
    medicalLevel: Math.round(p.medical * 0.7 + p.fitness * 0.3),
    injuryRecoveryChance: Math.max(0, (p.medical - 50) / 100),
    wearFactor: Math.round((1.15 - (Math.max(0, Math.min(99, p.fitness)) / 99) * 0.3) * 100) / 100,
    fatigueRecoveryFactor: Math.round((0.9 + (Math.max(0, Math.min(99, p.fitness)) / 99) * 0.2) * 100) / 100,
  };
}

// Valeur estimée d'un candidat pour un poste, du point de vue de l'IA :
// compétence d'abord, à salaire raisonnable.
export function staffValue(member: { rating: number; salary: number }, leagueId: string, role: StaffRole): number {
  const [, max] = (SALARY_SCALE[leagueId] ?? SALARY_SCALE.nba)[role];
  return member.rating - (member.salary / max) * 15;
}

// Effets concrets à afficher (page Staff), dérivés des mêmes formules que
// la simulation : force en match, % de progression, d'usure, de risque…
export interface StaffImpact {
  tacticsStrength: number;
  offenseStrength: number;
  defenseStrength: number;
  developmentPct: number;
  wearPct: number;
  fatigueRecoveryPct: number;
  injuryRiskPct: number;
  fasterRecoveryPct: number;
  chemistry: number;
  moraleShift: number;
}

export function staffImpact(p: StaffProfile): StaffImpact {
  const fx = staffEffects(p);
  const centered = (v: number) => (Math.max(0, Math.min(99, v)) - 50) / 50;
  const round1 = (v: number) => Math.round(v * 10) / 10;
  return {
    tacticsStrength: round1(centered(p.tactics) * 1.5),
    offenseStrength: round1(centered(p.offense) * 0.75),
    defenseStrength: round1(centered(p.defense) * 0.75),
    developmentPct: Math.round(centered(p.development) * 20),
    wearPct: Math.round((fx.wearFactor - 1) * 100),
    fatigueRecoveryPct: Math.round((fx.fatigueRecoveryFactor - 1) * 100),
    injuryRiskPct: Math.round(-((Math.max(0, Math.min(100, fx.medicalLevel)) - 50) / 50) * 20),
    fasterRecoveryPct: Math.round(fx.injuryRecoveryChance * 100),
    chemistry: fx.chemistryBonus,
    moraleShift: fx.moraleShift,
  };
}
