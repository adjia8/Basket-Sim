// Projets d'infrastructure (centre d'entraînement et salle) — règles pures.
//
// Au lieu d'un simple « +5 au niveau », le GM choisit des PROJETS précis,
// chacun avec ses paliers, son coût, sa durée de chantier, son coût
// d'entretien annuel et un effet ciblé (récupération, blessures,
// progression, ambiance, recettes…). Certains s'excluent (on ne peut pas
// transformer la même tribune en loges ET en virage populaire). Chaque
// palier terminé fait aussi monter le niveau global (facilitiesLevel /
// arenaLevel) déjà utilisé partout (attractivité, affluence, fatigue…).
//
// Financement au choix : comptant, emprunt sur 3 saisons (intérêts), ou
// demande de co-financement aux propriétaires (selon leur confiance).

import { NBA_FACILITIES } from "@/lib/mock-data/nba-facilities";

export type FacilityDomain = "training" | "arena";

export type ProjectKey =
  | "training_renovation"
  | "recovery_center"
  | "medical_center"
  | "performance_lab"
  | "video_room"
  | "player_residence"
  | "arena_renovation"
  | "premium_suites"
  | "fan_stand"
  | "video_board"
  | "food_court"
  | "fan_zone";

export interface ProjectEffects {
  recovery?: number; // fraction : récupération d'énergie +, usure −
  medical?: number; // points ajoutés au niveau médical (risque de blessure)
  development?: number; // points ajoutés au niveau de progression des joueurs
  tactical?: number; // bonus de force en match (préparation vidéo)
  homeCourt?: number; // bonus de force à domicile (ambiance)
  fill?: number; // fraction de remplissage en plus
  premium?: number; // fraction de recettes loges/premium en plus
  concessions?: number; // fraction restauration en plus
  merch?: number; // fraction boutique en plus
  sponsors?: number; // fraction sponsors en plus
}

export interface ProjectTier {
  cost: number; // NBA, en dollars (WNBA : ×0,12)
  days: number; // durée du chantier
  upkeep: number; // entretien par saison
  level: number; // points de niveau global gagnés à la livraison
  opinion?: number; // effet ponctuel sur l'opinion des fans à la livraison
  effects: ProjectEffects;
}

export interface ProjectDef {
  key: ProjectKey;
  domain: FacilityDomain;
  tiers: ProjectTier[]; // paliers successifs
  repeatable?: boolean; // rénovation : relançable à l'infini (palier unique)
  exclusiveWith?: ProjectKey; // choix : l'un OU l'autre
}

const M = 1_000_000;

export const PROJECTS: ProjectDef[] = [
  {
    key: "training_renovation",
    domain: "training",
    repeatable: true,
    tiers: [{ cost: 0, days: 30, upkeep: 0, level: 5, effects: {} }], // coût = upgradeCost (selon le niveau)
  },
  {
    key: "recovery_center",
    domain: "training",
    tiers: [
      { cost: 8 * M, days: 60, upkeep: 1 * M, level: 3, effects: { recovery: 0.04 } },
      { cost: 14 * M, days: 90, upkeep: 1.5 * M, level: 3, effects: { recovery: 0.08 } },
      { cost: 22 * M, days: 120, upkeep: 2.5 * M, level: 4, effects: { recovery: 0.12 } },
    ],
  },
  {
    key: "medical_center",
    domain: "training",
    tiers: [
      { cost: 10 * M, days: 75, upkeep: 1.2 * M, level: 3, effects: { medical: 5 } },
      { cost: 16 * M, days: 100, upkeep: 2 * M, level: 3, effects: { medical: 10 } },
      { cost: 25 * M, days: 140, upkeep: 3 * M, level: 4, effects: { medical: 15 } },
    ],
  },
  {
    key: "performance_lab",
    domain: "training",
    tiers: [
      { cost: 9 * M, days: 60, upkeep: 1 * M, level: 3, effects: { development: 4 } },
      { cost: 15 * M, days: 90, upkeep: 1.8 * M, level: 3, effects: { development: 8 } },
      { cost: 24 * M, days: 120, upkeep: 2.8 * M, level: 4, effects: { development: 12 } },
    ],
  },
  {
    key: "video_room",
    domain: "training",
    tiers: [
      { cost: 6 * M, days: 45, upkeep: 0.8 * M, level: 2, effects: { tactical: 0.3 } },
      { cost: 11 * M, days: 75, upkeep: 1.4 * M, level: 2, effects: { tactical: 0.6 } },
    ],
  },
  {
    key: "player_residence",
    domain: "training",
    tiers: [
      { cost: 20 * M, days: 150, upkeep: 2 * M, level: 8, effects: { development: 2 } },
      { cost: 32 * M, days: 180, upkeep: 3 * M, level: 10, effects: { development: 4 } },
    ],
  },
  {
    key: "arena_renovation",
    domain: "arena",
    repeatable: true,
    tiers: [{ cost: 0, days: 45, upkeep: 0, level: 5, effects: {} }],
  },
  {
    key: "premium_suites",
    domain: "arena",
    exclusiveWith: "fan_stand",
    tiers: [
      { cost: 25 * M, days: 120, upkeep: 2 * M, level: 4, opinion: -2, effects: { premium: 0.15 } },
      { cost: 40 * M, days: 160, upkeep: 3 * M, level: 4, opinion: -2, effects: { premium: 0.3 } },
    ],
  },
  {
    key: "fan_stand",
    domain: "arena",
    exclusiveWith: "premium_suites",
    tiers: [
      { cost: 18 * M, days: 120, upkeep: 1.5 * M, level: 4, opinion: 3, effects: { fill: 0.04, homeCourt: 0.3 } },
      { cost: 30 * M, days: 160, upkeep: 2.2 * M, level: 4, opinion: 3, effects: { fill: 0.08, homeCourt: 0.6 } },
    ],
  },
  {
    key: "video_board",
    domain: "arena",
    tiers: [
      { cost: 12 * M, days: 60, upkeep: 1 * M, level: 3, effects: { fill: 0.02, homeCourt: 0.2, sponsors: 0.03 } },
      { cost: 20 * M, days: 90, upkeep: 1.6 * M, level: 3, effects: { fill: 0.04, homeCourt: 0.4, sponsors: 0.06 } },
    ],
  },
  {
    key: "food_court",
    domain: "arena",
    tiers: [
      { cost: 10 * M, days: 75, upkeep: 1 * M, level: 2, effects: { concessions: 0.15, merch: 0.2 } },
      { cost: 18 * M, days: 100, upkeep: 1.6 * M, level: 3, effects: { concessions: 0.3, merch: 0.4 } },
    ],
  },
  {
    key: "fan_zone",
    domain: "arena",
    tiers: [
      { cost: 8 * M, days: 60, upkeep: 0.8 * M, level: 2, opinion: 4, effects: { sponsors: 0.05 } },
      { cost: 14 * M, days: 90, upkeep: 1.2 * M, level: 2, opinion: 4, effects: { sponsors: 0.1, fill: 0.02 } },
    ],
  },
];

export const projectDef = (key: string): ProjectDef | undefined => PROJECTS.find((p) => p.key === key);

// Chantiers simultanés autorisés (un seul par domaine en même temps de plus).
export const MAX_CONCURRENT_PROJECTS = 2;
// Pendant des travaux dans la salle, le remplissage baisse.
export const ARENA_WORKS_FILL_PENALTY = 0.08;

export type Financing = "cash" | "loan" | "owners";
export const LOAN_DOWN_PAYMENT = 0.25; // part payée tout de suite
export const LOAN_INTEREST = 0.15; // surcoût total des intérêts
export const LOAN_SEASONS = 3;
export const OWNERS_SHARE = 0.5; // part prise en charge si les propriétaires acceptent

export interface ProjectRecord {
  key: ProjectKey;
  tier: number; // 1 = premier palier
  status: "building" | "done";
  startedOn: string; // ISO (date du jeu)
  completesOn: string; // ISO
  cost: number;
  financing: Financing;
}

export interface LoanRecord {
  key: ProjectKey;
  tier: number;
  perSeason: number;
  seasonsLeft: number;
}

export interface FacilityPlan {
  projects: ProjectRecord[];
  loans: LoanRecord[];
  ownersRequestSeason: string | null; // une demande de financement par saison
}

export function parsePlan(json: string | null | undefined): FacilityPlan {
  try {
    const p = json ? JSON.parse(json) : null;
    if (p && Array.isArray(p.projects)) {
      return { projects: p.projects, loans: Array.isArray(p.loans) ? p.loans : [], ownersRequestSeason: p.ownersRequestSeason ?? null };
    }
  } catch {
    // plan illisible : on repart de zéro
  }
  return { projects: [], loans: [], ownersRequestSeason: null };
}

const leagueScale = (leagueId: string) => (leagueId === "wnba" ? 0.12 : 1);

// Palier déjà livré d'un projet (0 = rien).
export function builtTier(plan: FacilityPlan, key: ProjectKey): number {
  return plan.projects.filter((p) => p.key === key && p.status === "done").reduce((m, p) => Math.max(m, p.tier), 0);
}
export const isBuilding = (plan: FacilityPlan, key: ProjectKey) => plan.projects.some((p) => p.key === key && p.status === "building");

// Installations existantes au départ : chaque franchise a déjà un centre
// médical, une salle vidéo… plus ou moins modernes selon son marché (avec
// une part de hasard stable par équipe). Jamais au palier maximum : il reste
// toujours une amélioration possible.
export type Baseline = Partial<Record<ProjectKey, number>>;
function hash01(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 1000) / 999;
}
// Palier correspondant à une note sur 5 (1 étoile = rien, 5 = maximum).
function tierFromStars(stars: number, maxTier: number): number {
  return Math.max(0, Math.min(maxTier, Math.round(((stars - 1) / 4) * maxTier)));
}

// Équipes NBA : installations réelles (voir nba-facilities.ts) ; les autres
// (WNBA…) d'après le marché, avec une part de hasard stable.
export function baselineTiers(teamId: string, marketAppeal: number): Baseline {
  const real = NBA_FACILITIES[teamId];
  if (real) {
    const out: Baseline = {};
    const t = (key: ProjectKey, stars: number) => {
      out[key] = tierFromStars(Math.max(1, Math.min(5, stars)), projectDef(key)!.tiers.length);
    };
    t("recovery_center", real.training);
    t("medical_center", real.training + (real.medical ?? 0));
    t("performance_lab", real.training);
    t("video_room", real.training);
    t("player_residence", real.training - 1); // le « campus » reste un luxe
    // Salles haut de gamme : loges premium ; les autres n'ont ni loges
    // modernes ni tribune populaire.
    t("premium_suites", real.arena >= 3 ? real.arena : 1);
    out.fan_stand = 0;
    t("video_board", real.arena);
    t("food_court", real.arena);
    t("fan_zone", real.arena - 0.5);
    return out;
  }
  const out: Baseline = {};
  for (const def of PROJECTS) {
    if (def.repeatable) continue;
    const q = (Math.max(0, Math.min(99, marketAppeal)) / 99) * 0.55 + hash01(`${teamId}:${def.key}`) * 0.45;
    out[def.key] = Math.max(0, Math.min(def.tiers.length - 1, Math.floor(q * def.tiers.length)));
  }
  // Loges premium et tribune populaire s'excluent : une seule des deux existe.
  if ((out.premium_suites ?? 0) > 0 && (out.fan_stand ?? 0) > 0) {
    if (hash01(`${teamId}:seating`) < 0.5) out.fan_stand = 0;
    else out.premium_suites = 0;
  }
  return out;
}

// Palier effectif : existant au départ ou construit depuis.
export function effectiveTier(plan: FacilityPlan, key: ProjectKey, baseline: Baseline = {}): number {
  return Math.max(builtTier(plan, key), baseline[key] ?? 0);
}

// Note sur 5 (demi-étoiles) d'une installation : 1 étoile sans rien,
// 5 au palier maximum. Rénovations : d'après le niveau global (0-99).
export function projectStars(def: ProjectDef, tier: number, domainLevel: number): number {
  const raw = def.repeatable ? Math.max(0.5, domainLevel / 20) : 1 + (4 * tier) / def.tiers.length;
  return Math.max(0.5, Math.min(5, Math.round(raw * 2) / 2));
}

export interface ProjectOption {
  def: ProjectDef;
  built: number;
  next: (ProjectTier & { tier: number; cost: number; upkeep: number }) | null; // palier suivant, coûts à l'échelle de la ligue
  building: ProjectRecord | null;
  blockedBy: "exclusive" | "concurrent" | "maxed" | null;
}

// Palier suivant proposé pour chaque projet, avec ce qui le bloque.
// `renovationCost` : coût d'une rénovation générale selon le niveau actuel.
export function projectOptions(
  plan: FacilityPlan,
  leagueId: string,
  renovationCost: { training: number; arena: number },
  baseline: Baseline = {}
): ProjectOption[] {
  const scale = leagueScale(leagueId);
  const buildingCount = plan.projects.filter((p) => p.status === "building").length;
  return PROJECTS.map((def) => {
    const built = def.repeatable ? 0 : effectiveTier(plan, def.key, baseline);
    const building = plan.projects.find((p) => p.key === def.key && p.status === "building") ?? null;
    const tierIdx = def.repeatable ? 0 : built;
    const tier = def.tiers[tierIdx];
    const next = tier
      ? {
          ...tier,
          tier: tierIdx + 1,
          cost: def.repeatable ? renovationCost[def.domain] : Math.round(tier.cost * scale),
          upkeep: Math.round(tier.upkeep * scale),
        }
      : null;
    let blockedBy: ProjectOption["blockedBy"] = null;
    if (!next) blockedBy = "maxed";
    else if (def.exclusiveWith && (effectiveTier(plan, def.exclusiveWith, baseline) > 0 || isBuilding(plan, def.exclusiveWith))) blockedBy = "exclusive";
    else if (!building && buildingCount >= MAX_CONCURRENT_PROJECTS) blockedBy = "concurrent";
    return { def, built, next, building, blockedBy };
  });
}

const DAY = 86_400_000;
export function addDays(iso: string, days: number): string {
  return new Date(new Date(iso).getTime() + days * DAY).toISOString();
}

// Coût immédiat et échéancier selon le financement.
export function financingPlan(cost: number, financing: Financing): { now: number; perSeason: number; seasons: number; ownersPay: number } {
  if (financing === "loan") {
    const now = Math.round(cost * LOAN_DOWN_PAYMENT);
    const rest = (cost - now) * (1 + LOAN_INTEREST);
    return { now, perSeason: Math.round(rest / LOAN_SEASONS), seasons: LOAN_SEASONS, ownersPay: 0 };
  }
  if (financing === "owners") {
    const ownersPay = Math.round(cost * OWNERS_SHARE);
    return { now: cost - ownersPay, perSeason: 0, seasons: 0, ownersPay };
  }
  return { now: cost, perSeason: 0, seasons: 0, ownersPay: 0 };
}

// Les propriétaires acceptent de co-financer selon leur confiance (0-99) :
// ~15 % à 0, ~50 % à 50, ~85 % à 99. Plus prudents si la trésorerie est déjà
// confortable (« payez-le vous-mêmes »).
export function ownersAcceptChance(approval: number, cashRatio: number): number {
  const base = 0.15 + (Math.max(0, Math.min(99, approval)) / 99) * 0.7;
  const rich = cashRatio > 2 ? 0.15 : 0;
  return Math.max(0.05, Math.min(0.9, base - rich));
}

// Livraisons : projets dont la date de fin est atteinte.
export function dueProjects(plan: FacilityPlan, todayIso: string): ProjectRecord[] {
  const today = new Date(todayIso).getTime();
  return plan.projects.filter((p) => p.status === "building" && new Date(p.completesOn).getTime() <= today);
}

export interface FacilityBonuses extends Required<ProjectEffects> {
  upkeep: number; // entretien annuel total
  arenaWorks: boolean; // travaux en cours dans la salle
}

// Effets cumulés des projets livrés (le meilleur palier de chaque projet).
export function facilityBonuses(plan: FacilityPlan, leagueId: string, baseline: Baseline = {}): FacilityBonuses {
  const out: FacilityBonuses = {
    recovery: 0,
    medical: 0,
    development: 0,
    tactical: 0,
    homeCourt: 0,
    fill: 0,
    premium: 0,
    concessions: 0,
    merch: 0,
    sponsors: 0,
    upkeep: 0,
    arenaWorks: plan.projects.some((p) => p.status === "building" && projectDef(p.key)?.domain === "arena"),
  };
  const scale = leagueScale(leagueId);
  for (const def of PROJECTS) {
    if (def.repeatable) continue;
    const t = effectiveTier(plan, def.key, baseline);
    if (t === 0) continue;
    const tier = def.tiers[t - 1];
    for (const [k, v] of Object.entries(tier.effects) as [keyof ProjectEffects, number][]) out[k] += v;
    // Entretien : celui du palier atteint (il remplace les précédents), dû
    // seulement pour ce qui a été construit au-delà de l'existant.
    if (builtTier(plan, def.key) > (baseline[def.key] ?? 0)) out.upkeep += Math.round(tier.upkeep * scale);
  }
  return out;
}

// Effets du staff corrigés par les installations (match, fatigue…).
export function withFacilityBonuses<
  S extends { fatigueRecoveryFactor: number; wearFactor: number; medicalLevel: number; developmentLevel: number; strengthBonus: number },
>(staff: S, b: Pick<FacilityBonuses, "recovery" | "medical" | "development" | "tactical" | "homeCourt">, home: boolean): S {
  return {
    ...staff,
    fatigueRecoveryFactor: Math.round(staff.fatigueRecoveryFactor * (1 + b.recovery) * 100) / 100,
    wearFactor: Math.round(staff.wearFactor * (1 - b.recovery) * 100) / 100,
    medicalLevel: Math.min(100, staff.medicalLevel + b.medical),
    developmentLevel: Math.min(100, staff.developmentLevel + b.development),
    strengthBonus: Math.round((staff.strengthBonus + b.tactical + (home ? b.homeCourt : 0)) * 100) / 100,
  };
}

// Échéances d'emprunt payées à la clôture de la saison.
export function chargeLoans(json: string | null): { json: string | null; paid: number } {
  if (!json) return { json, paid: 0 };
  const plan = parsePlan(json);
  let paid = 0;
  for (const l of plan.loans) {
    if (l.seasonsLeft <= 0) continue;
    paid += l.perSeason;
    l.seasonsLeft -= 1;
  }
  plan.loans = plan.loans.filter((l) => l.seasonsLeft > 0);
  return { json: JSON.stringify(plan), paid };
}
