// Règles pures de blessure — aucun accès base de données ici, tout est piloté
// par src/lib/data-access/injuries.ts.

const BASE_INJURY_CHANCE_PER_GAME = 0.0015; // risque ≈ 0
const MAX_INJURY_CHANCE_PER_GAME = 0.02; // risque ≈ 99

// Chance de se blesser à l'occasion d'un match donné, interpolée linéairement
// sur l'échelle 0-99 du risque. Calibré pour qu'un risque ~99 corresponde à
// environ 1,5 blessure/saison en espérance (82 matchs), et un risque par
// défaut (~30) à environ une blessure tous les deux ans — ordre de grandeur
// plausible, pas une vérité statistique. `facilitiesLevel` (0-100, 50 =
// neutre) module ce risque de ±20% — de meilleures infrastructures
// d'entraînement réduisent les blessures.
export function injuryChanceForGame(injuryRisk: number, facilitiesLevel = 50): number {
  const t = Math.max(0, Math.min(99, injuryRisk)) / 99;
  const base = BASE_INJURY_CHANCE_PER_GAME + t * (MAX_INJURY_CHANCE_PER_GAME - BASE_INJURY_CHANCE_PER_GAME);
  const facilitiesFactor = 1 - ((Math.max(0, Math.min(100, facilitiesLevel)) - 50) / 50) * 0.2;
  return base * facilitiesFactor;
}

export function rollsInjury(injuryRisk: number, facilitiesLevel = 50): boolean {
  return Math.random() < injuryChanceForGame(injuryRisk, facilitiesLevel);
}

// Durée d'indisponibilité (en matchs de l'équipe) tirée aléatoirement,
// pondérée vers les blessures mineures avec une traîne vers les blessures
// sévères.
export function rollInjuryDurationGames(): number {
  const r = Math.random();
  if (r < 0.6) return 1 + Math.floor(Math.random() * 4); // 1-4 matchs (mineure)
  if (r < 0.9) return 5 + Math.floor(Math.random() * 10); // 5-14 matchs (modérée)
  return 15 + Math.floor(Math.random() * 20); // 15-34 matchs (sévère)
}

export type InjurySeverity = "minor" | "moderate" | "severe";

// Mêmes seuils que les tranches de rollInjuryDurationGames ci-dessus.
export function severityForDuration(duration: number): InjurySeverity {
  if (duration <= 4) return "minor";
  if (duration <= 14) return "moderate";
  return "severe";
}

export function escalateSeverity(severity: InjurySeverity): InjurySeverity {
  if (severity === "minor") return "moderate";
  if (severity === "moderate") return "severe";
  return "severe";
}

export type PlayThroughOutcome = "none" | "aggravation" | "reinjury";

// Risque encouru en jouant sur une blessure non guérie — plus élevé si le
// conditionnement est déjà bas. "aggravation" (plus probable) alourdit la
// MÊME blessure ; "reinjury" (plus rare) simule une nouvelle blessure
// distincte contractée en compensant.
export function rollsPlayThroughSetback(conditioning: number): PlayThroughOutcome {
  const lowConditioningFactor = 1 - Math.max(0, Math.min(100, conditioning)) / 100;
  const reinjuryChance = 0.03 + lowConditioningFactor * 0.05; // 3% à 8%
  const aggravationChance = 0.08 + lowConditioningFactor * 0.12; // 8% à 20%
  const r = Math.random();
  if (r < reinjuryChance) return "reinjury";
  if (r < reinjuryChance + aggravationChance) return "aggravation";
  return "none";
}

// --- Façon Football Manager : blessures nommées et risque du jour ---

// Types de blessure (libellés dans domain.ts, clé `domain.injuryType.<clé>`)
// avec leur fourchette réaliste d'indisponibilité, en matchs de l'équipe, et
// leur fréquence relative au sein de leur gravité.
export const INJURY_TYPES = {
  // Légères (1-4 matchs)
  ankle_sprain: { severity: "minor", minGames: 1, maxGames: 4, weight: 5 },
  back_spasms: { severity: "minor", minGames: 1, maxGames: 3, weight: 3 },
  knee_contusion: { severity: "minor", minGames: 1, maxGames: 3, weight: 3 },
  finger_dislocation: { severity: "minor", minGames: 1, maxGames: 4, weight: 2 },
  illness: { severity: "minor", minGames: 1, maxGames: 2, weight: 3 },
  // Modérées (5-14)
  hamstring_strain: { severity: "moderate", minGames: 5, maxGames: 12, weight: 4 },
  calf_strain: { severity: "moderate", minGames: 5, maxGames: 10, weight: 3 },
  groin_strain: { severity: "moderate", minGames: 5, maxGames: 10, weight: 2 },
  high_ankle_sprain: { severity: "moderate", minGames: 7, maxGames: 14, weight: 2 },
  mcl_sprain: { severity: "moderate", minGames: 8, maxGames: 14, weight: 2 },
  // Sévères (15+)
  stress_fracture: { severity: "severe", minGames: 15, maxGames: 30, weight: 3 },
  broken_hand: { severity: "severe", minGames: 15, maxGames: 25, weight: 2 },
  torn_meniscus: { severity: "severe", minGames: 20, maxGames: 40, weight: 2 },
  torn_acl: { severity: "severe", minGames: 60, maxGames: 82, weight: 1 },
  ruptured_achilles: { severity: "severe", minGames: 70, maxGames: 82, weight: 1 },
} as const satisfies Record<string, { severity: InjurySeverity; minGames: number; maxGames: number; weight: number }>;

export type InjuryType = keyof typeof INJURY_TYPES;

function randomInt(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min + 1));
}

// Tire une blessure : gravité (60 % légère, 30 % modérée, 10 % sévère, comme
// rollInjuryDurationGames), puis un type de cette gravité selon sa
// fréquence, puis une durée dans la fourchette du type.
export function rollInjury(): { type: InjuryType; games: number; severity: InjurySeverity } {
  const r = Math.random();
  const severity: InjurySeverity = r < 0.6 ? "minor" : r < 0.9 ? "moderate" : "severe";
  const candidates = (Object.entries(INJURY_TYPES) as [InjuryType, (typeof INJURY_TYPES)[InjuryType]][]).filter(
    ([, spec]) => spec.severity === severity
  );
  let pick = Math.random() * candidates.reduce((sum, [, spec]) => sum + spec.weight, 0);
  for (const [type, spec] of candidates) {
    pick -= spec.weight;
    if (pick <= 0) return { type, games: randomInt(spec.minGames, spec.maxGames), severity };
  }
  const [type, spec] = candidates[0];
  return { type, games: randomInt(spec.minGames, spec.maxGames), severity };
}

export interface InjuryRiskFactors {
  injuryRisk: number; // 0-99, prédisposition (historique réel)
  fatigue: number; // 0-99
  wear: number; // 0-99
  age: number;
  facilitiesLevel: number; // 0-100
  medicalLevel: number; // 0-100, staff (TeamState.trainingStaffLevel)
  intensity: "low" | "medium" | "high" | null;
  played: boolean; // false : entraînement seulement
}

const INTENSITY_RISK = { low: 0.9, medium: 1, high: 1.25 } as const;

// Risque de blessure du jour : la prédisposition du joueur, multipliée par
// l'état du moment — fatigue (jusqu'à ×1,8), usure (jusqu'à ×2,2), âge,
// intensité d'entraînement et staff médical (±20 %). Un joueur qui ne joue
// pas ne court que le risque de l'entraînement (×0,25).
export function injuryChance(f: InjuryRiskFactors): number {
  const base = injuryChanceForGame(f.injuryRisk, f.facilitiesLevel);
  const fatigueFactor = 1 + (Math.max(0, Math.min(99, f.fatigue)) / 99) * 0.8;
  const wearFactor = 1 + (Math.max(0, Math.min(99, f.wear)) / 99) * 1.2;
  const ageFactor = f.age >= 35 ? 1.4 : f.age >= 32 ? 1.2 : f.age <= 22 ? 0.9 : 1;
  const intensityFactor = f.intensity ? INTENSITY_RISK[f.intensity] : 1;
  const medicalFactor = 1 - ((Math.max(0, Math.min(100, f.medicalLevel)) - 50) / 50) * 0.2;
  const playFactor = f.played ? 1 : 0.25;
  return base * fatigueFactor * wearFactor * ageFactor * intensityFactor * medicalFactor * playFactor;
}

export type InjuryRiskLevel = "low" | "medium" | "high";

// Niveau affiché au manager (seuils par match : ~1 blessure / 2 saisons en
// dessous de « faible », ~1,5 / saison au-dessus de « élevé »).
export function injuryRiskLevel(chance: number): InjuryRiskLevel {
  if (chance < 0.008) return "low";
  if (chance < 0.018) return "medium";
  return "high";
}

// Coupure estivale (~4 mois, l'équivalent d'environ 50 matchs) : les
// blessures continuent de guérir pendant l'intersaison, façon Football
// Manager. Seules les grosses blessures de fin de saison (croisés, Achille)
// débordent sur la saison suivante. Un joueur rétabli reprend avec énergie
// et condition au maximum ; un joueur encore blessé garde sa condition.
export const OFFSEASON_HEALING_GAMES = 50;

export interface OffseasonHealthState {
  injured: boolean;
  injuryGamesRemaining: number;
  conditioning: number;
}

export function offseasonRecovery(state: OffseasonHealthState): {
  fatigue: number;
  injured: boolean;
  injuryGamesRemaining: number;
  conditioning: number;
  healed: boolean;
} {
  const remaining = state.injured ? Math.max(0, state.injuryGamesRemaining - OFFSEASON_HEALING_GAMES) : 0;
  const stillInjured = state.injured && remaining > 0;
  return {
    fatigue: 0,
    injured: stillInjured,
    injuryGamesRemaining: remaining,
    conditioning: stillInjured ? state.conditioning : 100,
    healed: state.injured && !stillInjured,
  };
}
