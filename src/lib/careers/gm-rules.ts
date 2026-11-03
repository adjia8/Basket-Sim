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

// Libellés dans src/lib/i18n/dict/domain.ts (clé `domain.expectationTier.<valeur>`).

export function tierIndex(tier: ExpectationTier): number {
  return TIER_ORDER.indexOf(tier);
}

// Force d'un effectif pour fixer l'objectif : ses 8 meilleurs joueurs
// (ceux qui portent vraiment l'équipe), pondérés en faveur des stars —
// une moyenne sur tout l'effectif récompenserait la profondeur de banc
// (two-way, fins de rotation) plus que le talent réel. L'attractivité du
// marché ajoute une petite pression (±2 points au maximum) : un grand
// marché attend un peu plus, sans jamais passer devant un vrai écart de
// niveau.
const STRENGTH_WEIGHTS = [1.6, 1.4, 1.2, 1.0, 1.0, 0.8, 0.6, 0.4];

export function teamStrengthScore(ratings: number[], marketAppeal: number): number {
  const top = [...ratings].sort((a, b) => b - a).slice(0, STRENGTH_WEIGHTS.length);
  if (top.length === 0) return 0;
  const weights = STRENGTH_WEIGHTS.slice(0, top.length);
  const weighted = top.reduce((sum, r, i) => sum + r * weights[i], 0);
  const totalWeight = weights.reduce((sum, w) => sum + w, 0);
  return weighted / totalWeight + (marketAppeal - 50) * 0.04;
}

// Nombre d'équipes qui atteignent chaque tour dans le vrai format de
// chaque ligue (voir data-access/playoffs.ts) — NBA : 20 au play-in, 16 en
// playoffs, puis 8/4/2/1 ; WNBA : 8 en playoffs (pas de play-in ni de
// demi-finales de conférence), puis 4/2/1.
const ROUND_CAPACITY: Record<string, [number, ExpectationTier][]> = {
  nba: [
    [1, "champion"],
    [2, "nba_finals"],
    [4, "conf_finals"],
    [8, "conf_semis"],
    [16, "playoffs"],
    [20, "play_in"],
  ],
  wnba: [
    [1, "champion"],
    [2, "nba_finals"],
    [4, "conf_finals"],
    [8, "playoffs"],
  ],
};

// Objectif de chaque équipe = le tour qu'elle atteindrait si la hiérarchie
// de force de la ligue était respectée (la plus forte vise le titre, la
// 2e la finale, etc.) — un objectif relatif plutôt qu'un seuil absolu, qui
// dérivait dès que l'échelle des notes ou la taille des effectifs
// changeait. Fonctionne sans historique (nouvelle Career : catalogue).
export function expectationsByStrength(
  scores: Map<string, number>,
  leagueId: string
): Map<string, ExpectationTier> {
  const capacities = ROUND_CAPACITY[leagueId] ?? ROUND_CAPACITY.nba;
  const ranked = [...scores.entries()].sort((a, b) => b[1] - a[1]);
  const result = new Map<string, ExpectationTier>();
  ranked.forEach(([teamId], index) => {
    const tier = capacities.find(([capacity]) => index < capacity)?.[1] ?? "rebuild";
    result.set(teamId, tier);
  });
  return result;
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
// négatives en fin de saison (mauvaise gestion financière) et de la
// perception des dirigeants (issue des conférences de presse, voir
// press-rules.ts) : une mauvaise relation (< 30) aggrave d'un tier
// supplémentaire, une excellente relation (> 70) en absorbe un — chacune
// compte comme un tier de résultat en plus/moins. Un deuxième avertissement
// consécutif (déjà 1+ avertissement à ce poste) entraîne un licenciement
// plutôt qu'un nouvel avertissement.
export function evaluateGmSeason(
  expectation: ExpectationTier,
  result: ExpectationTier,
  financesNegative: boolean,
  currentWarnings: number,
  frontOfficeApproval = 50
): { gap: number; outcome: GmSeasonOutcome } {
  const approvalAdjustment = frontOfficeApproval < 30 ? -1 : frontOfficeApproval > 70 ? 1 : 0;
  const gap = tierIndex(result) - tierIndex(expectation) - (financesNegative ? 1 : 0) + approvalAdjustment;
  if (gap >= 1) return { gap, outcome: "exceeded" };
  if (gap === 0) return { gap, outcome: "met" };
  if (gap === -1) {
    return { gap, outcome: currentWarnings >= 1 ? "fired" : "warning" };
  }
  return { gap, outcome: "fired" };
}
