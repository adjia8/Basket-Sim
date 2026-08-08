import type { BoxScoreEntry, Player, PlayerRatings, Team } from "@/lib/types";
import type { SimulationEngine, SimulationOptions, SimulationResult } from "./engine";
import {
  FLAGRANT_ONE_EJECTION_LIMIT,
  FOUL_CHECKS_PER_QUARTER,
  FOUL_OUT_LIMIT,
  TECHNICAL_EJECTION_LIMIT,
  rollsFlagrantFoul,
  rollsPersonalFoul,
  rollsTechnicalFoul,
} from "./foul-rules";
import { TRAINING_FOCUS_ATTRIBUTES } from "@/lib/careers/training-rules";

const HOME_ADVANTAGE = 2.5;
const ROTATION_SIZE = 8; // joueurs qui touchent des minutes significatives
const QUARTERS = 4;
// La force d'équipe pesait 0.9 sur le score total dans l'ancien calcul "en un
// coup" — répartie sur 4 quart-temps pour que l'effet cumulé sur la partie
// reste comparable.
const STRENGTH_COEFFICIENT = 0.9 / QUARTERS;

function average(values: number[]): number {
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

// Approxime une loi normale via la somme de deux tirages uniformes (loi triangulaire) :
// donne un effet "courbe en cloche" plus réaliste qu'un bruit purement uniforme.
function noise(spread: number): number {
  return (Math.random() + Math.random() - 1) * spread;
}

// Poids de chaque attribut dans la force brute (stamina exclue : elle ne
// pèse pas sur la force, elle détermine seulement la vitesse d'accumulation/
// récupération de fatigue, voir fatigue-rules.ts). Somment à 1 pour rester
// sur l'échelle 0-99, comparable à l'ancien overallRating qu'ils remplacent
// comme mesure de force de simulation (overallRating reste la valeur
// "front-office" : salaire, trade, draft — inchangée par ce moteur).
const IMPACT_WEIGHTS: Record<keyof PlayerRatings, number> = {
  scoringInside: 0.12,
  scoringOutside: 0.12,
  playmaking: 0.12,
  defenseInside: 0.12,
  defenseOutside: 0.12,
  rebounding: 0.1,
  athleticism: 0.1,
  basketballIQ: 0.1,
  clutch: 0.1,
  stamina: 0,
};

// Force brute d'un joueur sur le terrain — moyenne pondérée des attributs
// techniques, plus la contribution du bonus d'entraînement temporaire (voir
// training-rules.ts) sur les attributs actuellement ciblés par son focus.
function baseImpact(player: Player): number {
  const r = player.ratings;
  let sum = 0;
  for (const key of Object.keys(IMPACT_WEIGHTS) as (keyof PlayerRatings)[]) {
    sum += r[key] * IMPACT_WEIGHTS[key];
  }
  if (player.trainingBoostFocus) {
    const boostedAttrs = TRAINING_FOCUS_ATTRIBUTES[player.trainingBoostFocus] as (keyof PlayerRatings)[];
    for (const attr of boostedAttrs) {
      sum += player.trainingBoost * IMPACT_WEIGHTS[attr];
    }
  }
  return sum;
}

// Un joueur fatigué ou pas encore remis d'une blessure (conditionnement bas,
// voir conditioning-rules.ts) rend moins sur le terrain — jusqu'à -30% à
// fatigue maximale (99), jusqu'à -20% au plancher de conditionnement (20).
function playerImpact(player: Player): number {
  const fatigueFactor = 1 - (Math.max(0, Math.min(99, player.fatigue)) / 99) * 0.3;
  const conditioningFactor = 0.8 + (Math.max(0, Math.min(100, player.conditioning)) / 100) * 0.2;
  return baseImpact(player) * fatigueFactor * conditioningFactor;
}

// Rotation calculée à chaque quart-temps à partir du roster encore éligible
// (ni blessé en amont, ni sorti sur fautes/exclusion pendant le match) — un
// banc jusque-là hors rotation peut entrer en jeu si un titulaire sort.
function rotationOf(activeRoster: Player[]): Player[] {
  return [...activeRoster].sort((a, b) => playerImpact(b) - playerImpact(a)).slice(0, ROTATION_SIZE);
}

// gmBonus : bonus de force permanent apporté par le GM humain de l'équipe
// (voir gm-rules.ts/getGmBonusForTeam) — 0 pour une équipe gérée par l'IA.
// Ajouté après le multiplicateur de chimie, comme HOME_ADVANTAGE : un effet
// "front-office" constant, pas une mécanique de rotation par joueur (donc
// aucune dénormalisation sur Player nécessaire ici, contrairement au bonus
// d'entraînement).
function teamStrength(activeRoster: Player[], chemistry: number, gmBonus = 0): number {
  const rotation = rotationOf(activeRoster);
  if (rotation.length === 0) return 0;
  const starters = rotation.slice(0, 5);
  const bench = rotation.slice(5);
  const startersAvg = average(starters.map(playerImpact));
  const benchAvg = bench.length ? average(bench.map(playerImpact)) : startersAvg;
  const rawStrength = startersAvg * 0.75 + benchAvg * 0.25;
  // Chimie d'équipe : modificateur ±10% autour de la force brute.
  const chemistryMultiplier = 0.9 + (Math.max(0, Math.min(99, chemistry)) / 99) * 0.2;
  return rawStrength * chemistryMultiplier + gmBonus;
}

function averageClutch(activeRoster: Player[]): number {
  const rotation = rotationOf(activeRoster);
  return rotation.length ? average(rotation.map((p) => p.ratings.clutch)) : 50;
}

function basePointsForLeague(leagueId: string): number {
  return leagueId === "wnba" ? 82 : 112;
}

function emptyBoxEntry(playerId: string, teamId: string): BoxScoreEntry {
  return {
    playerId,
    teamId,
    points: 0,
    rebounds: 0,
    assists: 0,
    personalFouls: 0,
    technicalFouls: 0,
    flagrantFouls: 0,
  };
}

// Répartit le score du quart-temps parmi la rotation active de ce
// quart-temps et accumule dans le total par joueur sur toute la partie —
// un joueur sorti en cours de match garde ce qu'il a déjà accumulé dans les
// quart-temps précédents.
function applyQuarterBoxScore(
  totals: Map<string, BoxScoreEntry>,
  teamId: string,
  rotation: Player[],
  quarterScore: number
): void {
  if (rotation.length === 0) return;

  const weights = rotation.map((p) =>
    Math.max(p.ratings.scoringInside + p.ratings.scoringOutside + noise(3), 1)
  );
  const totalWeight = weights.reduce((sum, w) => sum + w, 0);

  const quarterPoints = rotation.map((_, i) => Math.round((weights[i] / totalWeight) * quarterScore));
  const distributed = quarterPoints.reduce((sum, p) => sum + p, 0);
  quarterPoints[0] = Math.max(0, quarterPoints[0] + (quarterScore - distributed));

  rotation.forEach((player, i) => {
    const entry = totals.get(player.id) ?? emptyBoxEntry(player.id, teamId);
    entry.points += quarterPoints[i];
    entry.rebounds += Math.max(0, Math.round((player.ratings.rebounding / 99) * 2.75 + noise(1)));
    entry.assists += Math.max(0, Math.round((player.ratings.playmaking / 99) * 2 + noise(1)));
    totals.set(player.id, entry);
  });
}

// Tire les événements de faute du quart-temps pour la rotation active et met
// à jour l'ensemble des joueurs exclus dès qu'un seuil réel NBA/WNBA est
// atteint (6 fautes personnelles, 2 techniques, flagrant 2, ou 2 flagrant 1).
function applyQuarterFouls(
  totals: Map<string, BoxScoreEntry>,
  teamId: string,
  rotation: Player[],
  disqualified: Set<string>
): void {
  for (const player of rotation) {
    const entry = totals.get(player.id) ?? emptyBoxEntry(player.id, teamId);
    totals.set(player.id, entry);

    for (let check = 0; check < FOUL_CHECKS_PER_QUARTER; check++) {
      if (rollsPersonalFoul(player.ratings.defenseInside, player.ratings.defenseOutside)) {
        entry.personalFouls += 1;
        if (entry.personalFouls >= FOUL_OUT_LIMIT) {
          entry.disqualifiedReason = "fouled_out";
          disqualified.add(player.id);
          break;
        }
      }
    }
    if (disqualified.has(player.id)) continue;

    if (rollsTechnicalFoul()) {
      entry.technicalFouls += 1;
      if (entry.technicalFouls >= TECHNICAL_EJECTION_LIMIT) {
        entry.disqualifiedReason = "ejected";
        disqualified.add(player.id);
        continue;
      }
    }

    const flagrant = rollsFlagrantFoul();
    if (flagrant !== "none") {
      entry.flagrantFouls += 1;
      if (flagrant === "flagrant2" || entry.flagrantFouls >= FLAGRANT_ONE_EJECTION_LIMIT) {
        entry.disqualifiedReason = "ejected";
        disqualified.add(player.id);
      }
    }
  }
}

export class MockSimulationEngine implements SimulationEngine {
  simulateGame(
    home: Team,
    homeRosterFull: Player[],
    away: Team,
    awayRosterFull: Player[],
    options?: SimulationOptions
  ): SimulationResult {
    const homeChemistry = options?.homeChemistry ?? 50;
    const awayChemistry = options?.awayChemistry ?? 50;
    const homeGmBonus = options?.homeGmBonus ?? 0;
    const awayGmBonus = options?.awayGmBonus ?? 0;
    const quarterBase = basePointsForLeague(home.leagueId) / QUARTERS;
    const quarterHomeAdvantage = HOME_ADVANTAGE / QUARTERS;

    const disqualified = new Set<string>();
    const totals = new Map<string, BoxScoreEntry>();
    let homeScore = 0;
    let awayScore = 0;

    for (let q = 0; q < QUARTERS; q++) {
      const homeActive = homeRosterFull.filter((p) => !disqualified.has(p.id));
      const awayActive = awayRosterFull.filter((p) => !disqualified.has(p.id));
      const homeRotation = rotationOf(homeActive);
      const awayRotation = rotationOf(awayActive);

      const homeStrength = teamStrength(homeActive, homeChemistry, homeGmBonus) + quarterHomeAdvantage;
      const awayStrength = teamStrength(awayActive, awayChemistry, awayGmBonus);

      const homeQuarterScore = Math.max(
        15,
        Math.round(quarterBase + (homeStrength - 75) * STRENGTH_COEFFICIENT + noise(4.5))
      );
      const awayQuarterScore = Math.max(
        15,
        Math.round(quarterBase + (awayStrength - 75) * STRENGTH_COEFFICIENT + noise(4.5))
      );
      homeScore += homeQuarterScore;
      awayScore += awayQuarterScore;

      applyQuarterBoxScore(totals, home.id, homeRotation, homeQuarterScore);
      applyQuarterBoxScore(totals, away.id, awayRotation, awayQuarterScore);
      applyQuarterFouls(totals, home.id, homeRotation, disqualified);
      applyQuarterFouls(totals, away.id, awayRotation, disqualified);
    }

    // Effet clutch : dans un match serré, léger avantage déterministe à
    // l'équipe dont la rotation (encore en jeu) a la meilleure moyenne de clutch.
    if (Math.abs(homeScore - awayScore) <= 3) {
      const homeClutch = averageClutch(homeRosterFull.filter((p) => !disqualified.has(p.id)));
      const awayClutch = averageClutch(awayRosterFull.filter((p) => !disqualified.has(p.id)));
      if (homeClutch > awayClutch) homeScore += 1;
      else if (awayClutch > homeClutch) awayScore += 1;
    }

    return {
      homeScore,
      awayScore,
      boxScore: [...totals.values()],
    };
  }
}

export const simulationEngine: SimulationEngine = new MockSimulationEngine();
