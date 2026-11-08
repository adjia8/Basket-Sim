// Règles pures des tactiques d'équipe, façon Football Manager — aucun accès
// base de données ici (voir simulation/mockEngine.ts et actions/tactics.ts).
//
// Quatre réglages : rythme, style offensif, défense, profondeur de rotation.
// Leur effet en match (en points par match, appliqués quart-temps par
// quart-temps par le moteur) vient de trois sources :
// - l'ADÉQUATION du style aux qualités de l'effectif (des shooteurs pour un
//   jeu extérieur, des intérieurs pour un jeu au poste, une star dominante
//   pour jouer autour d'elle…) ;
// - le DUEL entre l'attaque d'une équipe et la défense adverse (le tir
//   extérieur punit la zone, le switch neutralise le pick-and-roll…) ;
// - l'EXÉCUTION, amplifiée par la compétence tactique de l'entraîneur
//   principal (voir staff-rules.ts).
// Le rythme et le pressing coûtent de la fatigue ; une rotation courte donne
// plus de minutes (et d'usure) aux titulaires.

import type { Player, PlayerRatings } from "@/lib/types";

export type Pace = "slow" | "balanced" | "fast";
export type OffenseStyle = "balanced" | "inside" | "perimeter" | "pick_and_roll" | "star";
export type DefenseScheme = "man" | "zone" | "switch" | "press";
export type RotationDepth = "short" | "normal" | "deep";

export interface Tactics {
  pace: Pace;
  offense: OffenseStyle;
  defense: DefenseScheme;
  depth: RotationDepth;
}

export const PACES: Pace[] = ["slow", "balanced", "fast"];
export const OFFENSE_STYLES: OffenseStyle[] = ["balanced", "inside", "perimeter", "pick_and_roll", "star"];
export const DEFENSE_SCHEMES: DefenseScheme[] = ["man", "zone", "switch", "press"];
export const ROTATION_DEPTHS: RotationDepth[] = ["short", "normal", "deep"];

export const DEFAULT_TACTICS: Tactics = { pace: "balanced", offense: "balanced", defense: "man", depth: "normal" };

export function parseTactics(json: string | null | undefined): Tactics {
  if (!json) return DEFAULT_TACTICS;
  try {
    const raw = JSON.parse(json) as Partial<Tactics>;
    return {
      pace: PACES.includes(raw.pace as Pace) ? (raw.pace as Pace) : DEFAULT_TACTICS.pace,
      offense: OFFENSE_STYLES.includes(raw.offense as OffenseStyle) ? (raw.offense as OffenseStyle) : DEFAULT_TACTICS.offense,
      defense: DEFENSE_SCHEMES.includes(raw.defense as DefenseScheme) ? (raw.defense as DefenseScheme) : DEFAULT_TACTICS.defense,
      depth: ROTATION_DEPTHS.includes(raw.depth as RotationDepth) ? (raw.depth as RotationDepth) : DEFAULT_TACTICS.depth,
    };
  } catch {
    return DEFAULT_TACTICS;
  }
}

// ---------------------------------------------------------------------------
// Profondeur de rotation

// Joueurs qui touchent des minutes et part des minutes (et du poids dans la
// force d'équipe) réservée aux titulaires.
export const DEPTH_SETTINGS: Record<RotationDepth, { rotationSize: number; startersShare: number }> = {
  short: { rotationSize: 8, startersShare: 0.82 },
  normal: { rotationSize: 10, startersShare: 0.75 },
  deep: { rotationSize: 11, startersShare: 0.68 },
};

// ---------------------------------------------------------------------------
// Rythme et charge physique

// Multiplicateur du volume de points des DEUX équipes (moyenne des rythmes).
export const PACE_SCORING: Record<Pace, number> = { slow: 0.94, balanced: 1, fast: 1.06 };

// Multiplicateur de la fatigue et de l'usure gagnées pendant le match.
export function tacticalLoad(t: Tactics): number {
  const pace = t.pace === "fast" ? 1.12 : t.pace === "slow" ? 0.92 : 1;
  const press = t.defense === "press" ? 1.1 : 1;
  return Math.round(pace * press * 100) / 100;
}

// ---------------------------------------------------------------------------
// Adéquation à l'effectif

type Weights = Partial<Record<keyof PlayerRatings, number>>;

const OFFENSE_BASELINE: Weights = { scoringInside: 1, scoringOutside: 1, playmaking: 1, basketballIQ: 1 };
const OFFENSE_WEIGHTS: Record<Exclude<OffenseStyle, "star" | "balanced">, Weights> = {
  inside: { scoringInside: 2, rebounding: 1, athleticism: 1 },
  perimeter: { scoringOutside: 2.5, basketballIQ: 1, playmaking: 0.5 },
  pick_and_roll: { playmaking: 2, scoringInside: 1, athleticism: 1 },
};

const DEFENSE_BASELINE: Weights = { defenseInside: 1, defenseOutside: 1, athleticism: 1, rebounding: 1 };
const DEFENSE_WEIGHTS: Record<Exclude<DefenseScheme, "man">, Weights> = {
  zone: { defenseInside: 1.5, rebounding: 1, basketballIQ: 1 },
  switch: { defenseOutside: 1.5, athleticism: 1.5 },
  press: { athleticism: 2, defenseOutside: 1, stamina: 1 },
};

// Moyenne pondérée d'attributs sur la rotation (titulaires comptés double).
function weightedScore(rotation: Player[], weights: Weights): number {
  if (rotation.length === 0) return 50;
  let total = 0;
  let totalWeight = 0;
  rotation.forEach((p, i) => {
    const playerWeight = i < 5 ? 2 : 1;
    for (const [attr, w] of Object.entries(weights) as [keyof PlayerRatings, number][]) {
      total += p.ratings[attr] * w * playerWeight;
      totalWeight += w * playerWeight;
    }
  });
  return total / totalWeight;
}

// Les attributs détaillés étant dérivés de la note globale selon le poste,
// certains styles ressortaient systématiquement favorisés ou pénalisés pour
// toute la ligue (pick-and-roll toujours négatif, switch toujours positif).
// On centre donc chaque style sur sa moyenne mesurée sur les 30 effectifs
// NBA (8 novembre 2026) : seule compte la différence d'un effectif à l'autre.
const OFFENSE_LEAGUE_MEAN: Record<OffenseStyle, number> = {
  balanced: 0,
  inside: 0.07,
  perimeter: 0.11,
  pick_and_roll: -0.29,
  star: 0,
};
const DEFENSE_LEAGUE_MEAN: Record<DefenseScheme, number> = { man: 0, zone: -0.05, switch: 0.26, press: 0.23 };

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

// Points par match apportés (ou coûtés) par le style offensif, selon
// l'effectif seul. « Équilibré » est toujours neutre : sans risque, sans
// bonus. « Star » rapporte si un joueur domine nettement les autres.
export function offenseFit(rotation: Player[], style: OffenseStyle): number {
  if (style === "balanced" || rotation.length === 0) return 0;
  if (style === "star") {
    const sorted = [...rotation].sort((a, b) => b.overallRating - a.overallRating);
    // Écart entre la star et les 4 suivants : rentable au-delà de ~12 points
    // (une vraie star dominante), coûteux sans star.
    const gap = sorted[0].overallRating - average(sorted.slice(1, 5).map((p) => p.overallRating));
    return clamp((gap - 12) * 0.25, -1.5, 1.5);
  }
  const diff = weightedScore(rotation, OFFENSE_WEIGHTS[style]) - weightedScore(rotation, OFFENSE_BASELINE);
  return clamp(diff * 0.3 - OFFENSE_LEAGUE_MEAN[style], -2, 2);
}

export function defenseFit(rotation: Player[], scheme: DefenseScheme): number {
  if (scheme === "man" || rotation.length === 0) return 0;
  const diff = weightedScore(rotation, DEFENSE_WEIGHTS[scheme]) - weightedScore(rotation, DEFENSE_BASELINE);
  return clamp(diff * 0.3 - DEFENSE_LEAGUE_MEAN[scheme], -2, 2);
}

// Rythme : courir profite à l'équipe la plus athlétique, ralentir à la plus
// intelligente (comparées à la moyenne de la ligue, 50… soit l'adversaire).
export function paceFit(rotation: Player[], pace: Pace, opponent?: Player[]): number {
  if (pace === "balanced" || rotation.length === 0) return 0;
  const attr: keyof PlayerRatings = pace === "fast" ? "athleticism" : "basketballIQ";
  const mine = weightedScore(rotation, { [attr]: 1 });
  const theirs = opponent && opponent.length > 0 ? weightedScore(opponent, { [attr]: 1 }) : weightedScore(rotation, { athleticism: 0.5, basketballIQ: 0.5 });
  return clamp((mine - theirs) * 0.15, -1.5, 1.5);
}

// Rotation courte : les titulaires jouent plus — avantage si le banc est
// nettement plus faible ; rotation longue : avantage si le banc est solide.
export function depthFit(rotation: Player[], depth: RotationDepth): number {
  if (depth === "normal" || rotation.length < 6) return 0;
  const starters = average(rotation.slice(0, 5).map((p) => p.overallRating));
  const bench = average(rotation.slice(5, 9).map((p) => p.overallRating));
  const gap = starters - bench;
  return depth === "short" ? clamp((gap - 8) * 0.12, -1, 1) : clamp((6 - gap) * 0.12, -1, 1);
}

function average(values: number[]): number {
  return values.length ? values.reduce((s, v) => s + v, 0) / values.length : 0;
}

// ---------------------------------------------------------------------------
// Duel attaque / défense (points par match pour l'ATTAQUE)

const MATCHUP: Record<OffenseStyle, Record<DefenseScheme, number>> = {
  balanced: { man: 0, zone: 0, switch: 0, press: 0 },
  inside: { man: 0.5, zone: -1.5, switch: 1, press: 0.5 },
  perimeter: { man: 0, zone: 1.5, switch: -0.5, press: 0 },
  pick_and_roll: { man: 1, zone: 0, switch: -1.5, press: 0.5 },
  star: { man: -0.5, zone: 0.5, switch: 1, press: 0 },
};

export function matchupEdge(offense: OffenseStyle, defense: DefenseScheme): number {
  return MATCHUP[offense][defense];
}

// Le pressing coûte cher à une attaque qui manque de meneurs.
function pressPenalty(offenseRotation: Player[], defense: DefenseScheme): number {
  if (defense !== "press" || offenseRotation.length === 0) return 0;
  const playmaking = weightedScore(offenseRotation, { playmaking: 1 });
  return clamp((playmaking - 60) * 0.1, -1.5, 0.5);
}

// ---------------------------------------------------------------------------
// Bilan tactique d'une équipe face à un adversaire

// Dosage global : une tactique idéale vaut ~+7 points de pourcentage de
// victoires face à une tactique équilibrée, une tactique à contre-emploi
// autant en moins (mesuré sur 3 000 matchs simulés).
const EDGE_SCALE = 0.6;

// Exécution : un entraîneur principal compétent tire plus de ses choix
// (×0,8 sans entraîneur, ×1 pour un coach moyen, jusqu'à ×1,4).
export function coachExecution(coachTactics: number): number {
  return Math.round((0.6 + (Math.max(0, Math.min(99, coachTactics)) / 99) * 0.8) * 100) / 100;
}

export interface TacticalEdge {
  offense: number; // adéquation du style offensif
  defense: number; // adéquation du schéma défensif
  pace: number;
  depth: number;
  matchup: number; // mon attaque contre leur défense, moins leur attaque contre la mienne
  total: number; // points par match, exécution comprise
}

export function tacticalEdge(
  mine: { rotation: Player[]; tactics: Tactics; coachTactics: number },
  theirs: { rotation: Player[]; tactics: Tactics }
): TacticalEdge {
  const offense = offenseFit(mine.rotation, mine.tactics.offense);
  const defense = defenseFit(mine.rotation, mine.tactics.defense);
  const pace = paceFit(mine.rotation, mine.tactics.pace, theirs.rotation);
  const depth = depthFit(mine.rotation, mine.tactics.depth);
  const matchup =
    matchupEdge(mine.tactics.offense, theirs.tactics.defense) +
    pressPenalty(mine.rotation, theirs.tactics.defense) -
    (matchupEdge(theirs.tactics.offense, mine.tactics.defense) + pressPenalty(theirs.rotation, mine.tactics.defense));
  const raw = offense + defense + pace + depth + matchup / 2;
  const round1 = (v: number) => Math.round(v * 10) / 10;
  return {
    offense: round1(offense),
    defense: round1(defense),
    pace: round1(pace),
    depth: round1(depth),
    matchup: round1(matchup / 2),
    total: round1(raw * EDGE_SCALE * coachExecution(mine.coachTactics)),
  };
}

// ---------------------------------------------------------------------------
// Effets sur le box score

// Part des points venant du tir à 3 points (décalage de la tendance).
export function threePointShift(style: OffenseStyle): number {
  return style === "perimeter" ? 0.1 : style === "inside" ? -0.05 : 0;
}

// Le meilleur joueur prend beaucoup plus de tirs en « jeu pour la star ».
export const STAR_USAGE_BOOST = 1.7;

// ---------------------------------------------------------------------------
// Choix de l'IA (et suggestion de l'assistant)

// Tactique la mieux adaptée à l'effectif (sans connaître l'adversaire).
export function bestTactics(rotation: Player[]): Tactics {
  const bestBy = <T extends string>(options: T[], fit: (o: T) => number, fallback: T): T => {
    let best = fallback;
    let bestValue = fit(fallback) + 0.3; // léger biais pour l'option sûre
    for (const o of options) {
      const v = fit(o);
      if (v > bestValue) {
        best = o;
        bestValue = v;
      }
    }
    return best;
  };
  return {
    pace: bestBy(PACES, (p) => paceFit(rotation, p), "balanced"),
    offense: bestBy(OFFENSE_STYLES, (o) => offenseFit(rotation, o), "balanced"),
    defense: bestBy(DEFENSE_SCHEMES, (d) => defenseFit(rotation, d), "man"),
    depth: bestBy(ROTATION_DEPTHS, (d) => depthFit(rotation, d), "normal"),
  };
}

// Note d'adéquation affichée (0 à 5 étoiles) à partir des points par match.
// 3 étoiles = neutre ; chaque ±0,4 point par match ≈ une étoile.
export function fitStars(points: number): number {
  return Math.max(1, Math.min(5, Math.round(3 + points * 2.5)));
}

// Contre-tactique face à un adversaire connu : garde rythme et profondeur
// adaptés à l'effectif, et choisit l'attaque et la défense qui maximisent
// adéquation + duel (voir MATCHUP).
export function counterTactics(rotation: Player[], theirs: Tactics): Tactics {
  const base = bestTactics(rotation);
  const pick = <T extends string>(options: T[], score: (o: T) => number): T =>
    options.reduce((best, o) => (score(o) > score(best) ? o : best), options[0]);
  return {
    ...base,
    offense: pick(OFFENSE_STYLES, (o) => offenseFit(rotation, o) + matchupEdge(o, theirs.defense) + (o === "balanced" ? 0.2 : 0)),
    defense: pick(DEFENSE_SCHEMES, (d) => defenseFit(rotation, d) - matchupEdge(theirs.offense, d) + (d === "man" ? 0.2 : 0)),
  };
}
