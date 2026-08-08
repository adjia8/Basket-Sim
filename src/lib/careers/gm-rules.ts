// Règles pures du GM (objectifs, bonus d'équipe, évaluation de fin de
// saison) — aucun accès base de données ici, tout est piloté par
// src/lib/data-access/gm.ts et src/app/actions/season.ts.

export type ExpectationTier =
  | "rebuild"
  | "play_in"
  | "playoffs"
  | "conf_semis"
  | "conf_finals"
  | "nba_finals"
  | "champion";

const TIER_ORDER: ExpectationTier[] = [
  "rebuild",
  "play_in",
  "playoffs",
  "conf_semis",
  "conf_finals",
  "nba_finals",
  "champion",
];

export const EXPECTATION_LABELS: Record<ExpectationTier, string> = {
  rebuild: "Reconstruction",
  play_in: "Play-in",
  playoffs: "Playoffs",
  conf_semis: "Demi-finale de conférence",
  conf_finals: "Finale de conférence",
  nba_finals: "Finale (NBA/WNBA)",
  champion: "Champion",
};

export function tierIndex(tier: ExpectationTier): number {
  return TIER_ORDER.indexOf(tier);
}

// Objectif attendu à partir de la force du roster (moyenne overall pondérée
// avec l'attractivité du marché) — fonctionne même sans historique de saison
// (nouvelle Career : roster catalogue, pas encore de TeamState).
export function expectationForRoster(averageOverall: number, marketAppeal: number): ExpectationTier {
  const score = averageOverall * 0.8 + marketAppeal * 0.2;
  if (score >= 88) return "champion";
  if (score >= 84) return "nba_finals";
  if (score >= 80) return "conf_finals";
  if (score >= 76) return "conf_semis";
  if (score >= 71) return "playoffs";
  if (score >= 65) return "play_in";
  return "rebuild";
}

// Pool de points répartis à la création du GM entre offensif/défensif/
// physique/tactique/cohésion d'équipe.
export const GM_POINT_POOL = 20;
const GM_MAX_STRENGTH_BONUS = 5; // même échelle que le plafond d'intensité d'entraînement (BOOST_CAP.high)

function pointsToBonus(points: number): number {
  return Math.round((Math.max(0, Math.min(GM_POINT_POOL, points)) / GM_POINT_POOL) * GM_MAX_STRENGTH_BONUS);
}

// Combine offensif/défensif/physique/tactique en un seul bonus de force
// d'équipe, ajouté directement dans teamStrength (comme HOME_ADVANTAGE) —
// pas de granularité par joueur nécessaire ici (contrairement au système
// d'entraînement), donc pas besoin de dénormaliser sur Player.
export function gmStrengthBonus(points: {
  offense: number;
  defense: number;
  physical: number;
  tactical: number;
}): number {
  return (
    (pointsToBonus(points.offense) +
      pointsToBonus(points.defense) +
      pointsToBonus(points.physical) +
      pointsToBonus(points.tactical)) /
    4
  );
}

// Ajouté à TeamState.chemistry avant clamp (voir teamStrength, qui clampe déjà 0-99).
export function gmChemistryBonus(chemistryPoints: number): number {
  return pointsToBonus(chemistryPoints);
}

export type GmSeasonOutcome = "met" | "exceeded" | "warning" | "fired";

// Écart entre objectif et résultat, ajusté d'une pénalité si finances
// négatives en fin de saison (mauvaise gestion financière) : compte comme un
// tier de résultat en moins. Un deuxième avertissement consécutif (déjà
// 1+ avertissement à ce poste) entraîne un licenciement plutôt qu'un
// nouvel avertissement.
export function evaluateGmSeason(
  expectation: ExpectationTier,
  result: ExpectationTier,
  financesNegative: boolean,
  currentWarnings: number
): { gap: number; outcome: GmSeasonOutcome } {
  const gap = tierIndex(result) - tierIndex(expectation) - (financesNegative ? 1 : 0);
  if (gap >= 1) return { gap, outcome: "exceeded" };
  if (gap === 0) return { gap, outcome: "met" };
  if (gap === -1) {
    return { gap, outcome: currentWarnings >= 1 ? "fired" : "warning" };
  }
  return { gap, outcome: "fired" };
}
