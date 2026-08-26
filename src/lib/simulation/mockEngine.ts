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
// Exportée : l'UI de gestion de rotation (RotationOrderFormClient.tsx) en a
// besoin pour savoir où s'arrête le "banc qui joue" et où commence le "hors
// rotation" — une seule source de vérité, pas de valeur dupliquée côté UI.
export const ROTATION_SIZE = 10; // joueurs qui touchent des minutes significatives
const QUARTERS = 4;
const QUARTER_MINUTES: Record<string, number> = { wnba: 10, nba: 12 };
// La force d'équipe pesait 0.9 sur le score total dans l'ancien calcul "en un
// coup" — répartie sur 4 quart-temps pour que l'effet cumulé sur la partie
// reste comparable.
const STRENGTH_COEFFICIENT = 0.9 / QUARTERS;
// Le basket ne finit jamais sur une égalité — durée réelle d'une
// prolongation (5 minutes, WNBA comme NBA), bien plus courte qu'un
// quart-temps de 10-12 minutes (voir simulateGame : tous les paramètres
// d'une prolongation — score attendu, avantage du terrain, bruit, plancher
// de score — sont dérivés de ceux d'un quart-temps au prorata de cette
// durée, pas une nouvelle échelle inventée).
const OVERTIME_MINUTES: Record<string, number> = { wnba: 5, nba: 5 };
// Garde-fou : avec des scores entiers, une prolongation peut retomber sur
// une nouvelle égalité exacte (improbable, pas impossible) — au-delà de ce
// nombre de prolongations, un vrai dernier mot est forcé (voir la fin de
// simulateGame) plutôt que de boucler indéfiniment.
const MAX_OVERTIME_PERIODS = 10;

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
//
// rotationOrder (optionnel) = ordre de profondeur de banc choisi par le GM
// (voir TeamState.rotationOrderJson) : quand présent, prime sur playerImpact
// pour les joueuses qu'il liste, dans l'ordre donné ; les joueuses non
// listées (nouvelles signatures pas encore classées) suivent, départagées
// entre elles par playerImpact comme avant. Comme activeRoster est déjà
// filtré des disqualifiées CE match, une titulaire sortie sur fautes est
// automatiquement remplacée au quart-temps suivant par la joueuse suivante
// de rotationOrder — aucune logique supplémentaire nécessaire pour ça.
function rotationOf(activeRoster: Player[], rotationOrder?: string[]): Player[] {
  if (!rotationOrder || rotationOrder.length === 0) {
    return [...activeRoster].sort((a, b) => playerImpact(b) - playerImpact(a)).slice(0, ROTATION_SIZE);
  }
  const orderIndex = new Map(rotationOrder.map((id, i) => [id, i]));
  return [...activeRoster]
    .sort((a, b) => {
      const ai = orderIndex.get(a.id) ?? Infinity;
      const bi = orderIndex.get(b.id) ?? Infinity;
      if (ai !== bi) return ai - bi;
      return playerImpact(b) - playerImpact(a);
    })
    .slice(0, ROTATION_SIZE);
}

// gmBonus : bonus de force permanent apporté par le GM humain de l'équipe
// (voir gm-rules.ts/getGmBonusForTeam) — 0 pour une équipe gérée par l'IA.
// Ajouté après le multiplicateur de chimie, comme HOME_ADVANTAGE : un effet
// "front-office" constant, pas une mécanique de rotation par joueur (donc
// aucune dénormalisation sur Player nécessaire ici, contrairement au bonus
// d'entraînement).
function teamStrength(
  activeRoster: Player[],
  chemistry: number,
  gmBonus = 0,
  rotationOrder?: string[]
): number {
  const rotation = rotationOf(activeRoster, rotationOrder);
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

function averageClutch(activeRoster: Player[], rotationOrder?: string[]): number {
  const rotation = rotationOf(activeRoster, rotationOrder);
  return rotation.length ? average(rotation.map((p) => p.ratings.clutch)) : 50;
}

// Crédite le point décisif de fin de match serré (voir plus bas) à la
// joueuse la plus "clutch" de la rotation encore en jeu — sous forme de
// lancer franc réussi (seul moyen d'ajouter exactement 1 point) — pour que
// le score final reste toujours égal à la somme du box score, jamais un
// point fantôme attribué à personne.
function creditClutchPoint(
  totals: Map<string, BoxScoreEntry>,
  teamId: string,
  activeRoster: Player[],
  rotationOrder?: string[]
): void {
  const rotation = rotationOf(activeRoster, rotationOrder);
  if (rotation.length === 0) return;
  const clutchPlayer = [...rotation].sort((a, b) => b.ratings.clutch - a.ratings.clutch)[0];
  const entry = totals.get(clutchPlayer.id) ?? emptyBoxEntry(clutchPlayer.id, teamId);
  entry.points += 1;
  entry.freeThrowsMade += 1;
  entry.freeThrowsAttempted += 1;
  totals.set(clutchPlayer.id, entry);
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
    fieldGoalsMade: 0,
    fieldGoalsAttempted: 0,
    threePointersMade: 0,
    threePointersAttempted: 0,
    freeThrowsMade: 0,
    freeThrowsAttempted: 0,
    steals: 0,
    blocks: 0,
    turnovers: 0,
    minutesPlayed: 0,
  };
}

// Pourcentage de réussite "de la joueuse" pour un type de tir donné, dérivé
// d'une note (0-99) : centré sur `base`, module de ±`spread` selon la note
// (50 = moyenne de ligue), plus un peu de variance match par match.
function shootingPct(rating: number, base: number, spread: number): number {
  const raw = base + ((rating - 50) / 49) * spread + noise(spread * 0.4);
  return Math.max(base - spread, Math.min(base + spread, raw));
}

// Reconstitue une décomposition plausible des points déjà attribués à une
// joueuse ce quart-temps (3 points / 2 points / lancers francs), PUIS des
// tentatives cohérentes avec un pourcentage de réussite dérivé de ses notes
// — jamais l'inverse : le score du match ne dépend en rien de cette fonction,
// elle ne fait qu'expliquer après coup des points déjà décidés plus haut.
function deriveShotStats(
  points: number,
  ratings: PlayerRatings
): Pick<
  BoxScoreEntry,
  | "fieldGoalsMade"
  | "fieldGoalsAttempted"
  | "threePointersMade"
  | "threePointersAttempted"
  | "freeThrowsMade"
  | "freeThrowsAttempted"
> {
  if (points <= 0) {
    // Aucun point ce quart-temps : peut tout de même avoir manqué quelques
    // tirs, proportionnellement au volume de tir habituel de la joueuse.
    const missVolume = Math.max(
      0,
      Math.round(((ratings.scoringInside + ratings.scoringOutside) / 198) * 2 + noise(1))
    );
    return {
      fieldGoalsMade: 0,
      fieldGoalsAttempted: missVolume,
      threePointersMade: 0,
      threePointersAttempted: 0,
      freeThrowsMade: 0,
      freeThrowsAttempted: 0,
    };
  }

  // Part des points venant du tir à 3 points — plus une joueuse est orientée
  // extérieur (scoringOutside > scoringInside), plus cette part grandit.
  const threeTendency = Math.max(
    0.05,
    Math.min(0.6, 0.18 + ((ratings.scoringOutside - ratings.scoringInside) / 99) * 0.45)
  );
  const threeMade = Math.min(Math.floor(points / 3), Math.round((points * threeTendency) / 3));
  const remaining = points - threeMade * 3;

  // Part des points restants venant des lancers francs, ajustée pour que le
  // reliquat (qui ira aux paniers à 2 points) soit toujours un nombre pair.
  let ftMade = Math.min(remaining, Math.round(remaining * 0.18));
  if ((remaining - ftMade) % 2 !== 0) {
    if (ftMade < remaining) ftMade += 1;
    else ftMade -= 1;
  }
  const twoMade = (remaining - ftMade) / 2;

  const threePct = shootingPct(ratings.scoringOutside, 0.34, 0.09);
  const twoPct = shootingPct(ratings.scoringInside, 0.48, 0.09);
  const ftPct = shootingPct((ratings.clutch + ratings.basketballIQ) / 2, 0.76, 0.1);

  const threeAttempted = threeMade > 0 ? Math.max(threeMade, Math.round(threeMade / threePct)) : 0;
  const twoAttempted = twoMade > 0 ? Math.max(twoMade, Math.round(twoMade / twoPct)) : 0;
  const ftAttempted = ftMade > 0 ? Math.max(ftMade, Math.round(ftMade / ftPct)) : 0;

  return {
    fieldGoalsMade: threeMade + twoMade,
    fieldGoalsAttempted: threeAttempted + twoAttempted,
    threePointersMade: threeMade,
    threePointersAttempted: threeAttempted,
    freeThrowsMade: ftMade,
    freeThrowsAttempted: ftAttempted,
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

  // Méthode des plus grands restes (comme la répartition de sièges en
  // élection à la proportionnelle) : arrondit chaque part à l'entier
  // inférieur, puis distribue le reliquat un point à la fois aux joueuses
  // dont la part arrondie a perdu le plus. Garantit TOUJOURS que la somme
  // distribuée vaut exactement quarterScore — l'ancien correctif (tout
  // l'écart d'arrondi concentré sur une seule joueuse, plafonné à 0)
  // pouvait perdre des points dès que cet écart dépassait sa propre part,
  // cassant l'invariant "somme du box score = score final de l'équipe".
  const rawShares = rotation.map((_, i) => (weights[i] / totalWeight) * quarterScore);
  const quarterPoints = rawShares.map((share) => Math.floor(share));
  let remainder = quarterScore - quarterPoints.reduce((sum, p) => sum + p, 0);
  const byLeftoverFraction = rawShares
    .map((share, i) => ({ i, fraction: share - quarterPoints[i] }))
    .sort((a, b) => b.fraction - a.fraction);
  for (let k = 0; k < byLeftoverFraction.length && remainder > 0; k++, remainder--) {
    quarterPoints[byLeftoverFraction[k].i] += 1;
  }

  rotation.forEach((player, i) => {
    const entry = totals.get(player.id) ?? emptyBoxEntry(player.id, teamId);
    entry.points += quarterPoints[i];
    entry.rebounds += Math.max(0, Math.round((player.ratings.rebounding / 99) * 2.75 + noise(1)));
    entry.assists += Math.max(0, Math.round((player.ratings.playmaking / 99) * 2 + noise(1)));
    entry.steals += Math.max(0, Math.round((player.ratings.defenseOutside / 99) * 1.2 + noise(0.8)));
    entry.blocks += Math.max(0, Math.round((player.ratings.defenseInside / 99) * 1.0 + noise(0.7)));
    entry.turnovers += Math.max(
      0,
      Math.round((player.ratings.playmaking / 99) * 1.5 - (player.ratings.basketballIQ / 99) * 0.5 + noise(0.8))
    );

    totals.set(player.id, entry);
  });
}

// Dérive les tirs (voir deriveShotStats) une seule fois, à partir du TOTAL de
// points sur l'ensemble du match — et non quart-temps par quart-temps, où de
// petits totaux (3-5 points) arrondissaient presque toujours les 3 points à
// zéro (round(petit_total × tendance / 3) tombe à 0 bien plus souvent que la
// vraie fréquence de tirs à 3 points sur un match complet). Appelée après la
// boucle de quart-temps, avant l'ajustement clutch (qui s'additionne par-
// dessus, voir creditClutchPoint).
function applyShotStats(totals: Map<string, BoxScoreEntry>, playersById: Map<string, Player>): void {
  for (const entry of totals.values()) {
    const player = playersById.get(entry.playerId);
    if (!player) continue;
    const shots = deriveShotStats(entry.points, player.ratings);
    entry.fieldGoalsMade = shots.fieldGoalsMade;
    entry.fieldGoalsAttempted = shots.fieldGoalsAttempted;
    entry.threePointersMade = shots.threePointersMade;
    entry.threePointersAttempted = shots.threePointersAttempted;
    entry.freeThrowsMade = shots.freeThrowsMade;
    entry.freeThrowsAttempted = shots.freeThrowsAttempted;
  }
}

// Répartit les minutes du quart-temps entre la rotation active — 5 joueuses
// sur le terrain à tout instant, donc quarterMinutes×5 "minutes-joueuse" à
// distribuer. Titulaires (5 meilleurs impacts) et banc se partagent un
// budget 75/25 (même logique que teamStrength), puis au sein de chaque
// groupe au prorata de playerImpact — une joueuse qui pèse plus lourd sur
// la force de l'équipe joue aussi plus de minutes.
function applyQuarterMinutes(
  totals: Map<string, BoxScoreEntry>,
  teamId: string,
  rotation: Player[],
  periodMinutes: number
): void {
  if (rotation.length === 0) return;
  const totalPlayerMinutes = periodMinutes * 5;

  const starters = rotation.slice(0, 5);
  const bench = rotation.slice(5);
  const startersBudget = bench.length > 0 ? totalPlayerMinutes * 0.75 : totalPlayerMinutes;
  const benchBudget = totalPlayerMinutes - startersBudget;

  function distribute(group: Player[], budget: number): void {
    if (group.length === 0) return;
    const weights = group.map((p) => Math.max(playerImpact(p), 1));
    const totalWeight = weights.reduce((sum, w) => sum + w, 0);
    group.forEach((player, i) => {
      const entry = totals.get(player.id) ?? emptyBoxEntry(player.id, teamId);
      entry.minutesPlayed += Math.round(((weights[i] / totalWeight) * budget) * 10) / 10;
      totals.set(player.id, entry);
    });
  }

  distribute(starters, startersBudget);
  distribute(bench, benchBudget);
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

interface PeriodTeamsContext {
  home: Team;
  away: Team;
  homeRosterFull: Player[];
  awayRosterFull: Player[];
  homeChemistry: number;
  awayChemistry: number;
  homeGmBonus: number;
  awayGmBonus: number;
  homeRotationOrder?: string[];
  awayRotationOrder?: string[];
  disqualified: Set<string>;
  totals: Map<string, BoxScoreEntry>;
}

// Simule une période de jeu (un quart-temps, ou une prolongation avec des
// paramètres réduits au prorata — voir simulateGame) : force d'équipe ->
// score de la période -> répartition dans le box score/les minutes/les
// fautes. Extraite de l'ancienne boucle de quart-temps pour être réutilisée
// telle quelle par les prolongations, sans dupliquer cette mécanique.
function simulatePeriod(
  ctx: PeriodTeamsContext,
  periodBase: number,
  periodHomeAdvantage: number,
  noiseSpread: number,
  minScore: number,
  periodMinutes: number
): { homeScore: number; awayScore: number } {
  const homeActive = ctx.homeRosterFull.filter((p) => !ctx.disqualified.has(p.id));
  const awayActive = ctx.awayRosterFull.filter((p) => !ctx.disqualified.has(p.id));
  const homeRotation = rotationOf(homeActive, ctx.homeRotationOrder);
  const awayRotation = rotationOf(awayActive, ctx.awayRotationOrder);

  const homeStrength =
    teamStrength(homeActive, ctx.homeChemistry, ctx.homeGmBonus, ctx.homeRotationOrder) + periodHomeAdvantage;
  const awayStrength = teamStrength(awayActive, ctx.awayChemistry, ctx.awayGmBonus, ctx.awayRotationOrder);

  const homeScore = Math.max(
    minScore,
    Math.round(periodBase + (homeStrength - 75) * STRENGTH_COEFFICIENT + noise(noiseSpread))
  );
  const awayScore = Math.max(
    minScore,
    Math.round(periodBase + (awayStrength - 75) * STRENGTH_COEFFICIENT + noise(noiseSpread))
  );

  applyQuarterBoxScore(ctx.totals, ctx.home.id, homeRotation, homeScore);
  applyQuarterBoxScore(ctx.totals, ctx.away.id, awayRotation, awayScore);
  applyQuarterFouls(ctx.totals, ctx.home.id, homeRotation, ctx.disqualified);
  applyQuarterFouls(ctx.totals, ctx.away.id, awayRotation, ctx.disqualified);
  applyQuarterMinutes(ctx.totals, ctx.home.id, homeRotation, periodMinutes);
  applyQuarterMinutes(ctx.totals, ctx.away.id, awayRotation, periodMinutes);

  return { homeScore, awayScore };
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
    const homeRotationOrder = options?.homeRotationOrder;
    const awayRotationOrder = options?.awayRotationOrder;
    const quarterMinutes = QUARTER_MINUTES[home.leagueId] ?? QUARTER_MINUTES.nba;
    const quarterBase = basePointsForLeague(home.leagueId) / QUARTERS;
    const quarterHomeAdvantage = HOME_ADVANTAGE / QUARTERS;

    const disqualified = new Set<string>();
    const totals = new Map<string, BoxScoreEntry>();
    const playersById = new Map(
      [...homeRosterFull, ...awayRosterFull].map((p) => [p.id, p] as const)
    );
    const ctx: PeriodTeamsContext = {
      home,
      away,
      homeRosterFull,
      awayRosterFull,
      homeChemistry,
      awayChemistry,
      homeGmBonus,
      awayGmBonus,
      homeRotationOrder,
      awayRotationOrder,
      disqualified,
      totals,
    };
    let homeScore = 0;
    let awayScore = 0;

    for (let q = 0; q < QUARTERS; q++) {
      const period = simulatePeriod(ctx, quarterBase, quarterHomeAdvantage, 4.5, 15, quarterMinutes);
      homeScore += period.homeScore;
      awayScore += period.awayScore;
    }

    // Le basket ne finit jamais sur une égalité — prolongations successives
    // (même mécanique qu'un quart-temps, voir simulatePeriod, mais tous les
    // paramètres réduits au prorata d'une durée réelle de 5 minutes plutôt
    // que 10-12) jusqu'à ce que les scores se départagent. Avant la dérive
    // des tirs (applyShotStats, plus bas) : les points de prolongation sont
    // du vrai jeu, pas un point synthétique — ils doivent compter dans le
    // volume de tir dérivé comme n'importe quel quart-temps.
    const overtimeMinutes = OVERTIME_MINUTES[home.leagueId] ?? OVERTIME_MINUTES.nba;
    const overtimeRatio = overtimeMinutes / quarterMinutes;
    const overtimeBase = quarterBase * overtimeRatio;
    const overtimeHomeAdvantage = quarterHomeAdvantage * overtimeRatio;
    const overtimeNoiseSpread = 4.5 * overtimeRatio;
    const overtimeMinScore = Math.max(3, Math.round(15 * overtimeRatio));

    let overtimePeriods = 0;
    while (homeScore === awayScore && overtimePeriods < MAX_OVERTIME_PERIODS) {
      const period = simulatePeriod(
        ctx,
        overtimeBase,
        overtimeHomeAdvantage,
        overtimeNoiseSpread,
        overtimeMinScore,
        overtimeMinutes
      );
      homeScore += period.homeScore;
      awayScore += period.awayScore;
      overtimePeriods++;
    }

    applyShotStats(totals, playersById);

    // Effet clutch : dans un match serré, léger avantage déterministe à
    // l'équipe dont la rotation (encore en jeu) a la meilleure moyenne de clutch.
    if (Math.abs(homeScore - awayScore) <= 3) {
      const homeActive = homeRosterFull.filter((p) => !disqualified.has(p.id));
      const awayActive = awayRosterFull.filter((p) => !disqualified.has(p.id));
      const homeClutch = averageClutch(homeActive, homeRotationOrder);
      const awayClutch = averageClutch(awayActive, awayRotationOrder);
      if (homeClutch > awayClutch) {
        homeScore += 1;
        creditClutchPoint(totals, home.id, homeActive, homeRotationOrder);
      } else if (awayClutch > homeClutch) {
        awayScore += 1;
        creditClutchPoint(totals, away.id, awayActive, awayRotationOrder);
      }
    }

    // Garde-fou ultime (probabilité quasi nulle en pratique) : si le nombre
    // maximal de prolongations est épuisé sans départage, ou si l'effet
    // clutch ci-dessus n'a rien tranché (moyennes de clutch strictement
    // égales), un dernier mot est forcé sur la force d'équipe — jamais un
    // match nul rendu, jamais un point fantôme (même mécanique que le point
    // clutch : crédité à une joueuse via creditClutchPoint).
    if (homeScore === awayScore) {
      const homeActive = homeRosterFull.filter((p) => !disqualified.has(p.id));
      const awayActive = awayRosterFull.filter((p) => !disqualified.has(p.id));
      const homeFinalStrength = teamStrength(homeActive, homeChemistry, homeGmBonus, homeRotationOrder);
      const awayFinalStrength = teamStrength(awayActive, awayChemistry, awayGmBonus, awayRotationOrder);
      if (homeFinalStrength >= awayFinalStrength) {
        homeScore += 1;
        creditClutchPoint(totals, home.id, homeActive, homeRotationOrder);
      } else {
        awayScore += 1;
        creditClutchPoint(totals, away.id, awayActive, awayRotationOrder);
      }
    }

    return {
      homeScore,
      awayScore,
      boxScore: [...totals.values()],
    };
  }
}

export const simulationEngine: SimulationEngine = new MockSimulationEngine();
