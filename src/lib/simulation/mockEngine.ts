import type { BoxScoreEntry, Player, Team } from "@/lib/types";
import type { SimulationEngine, SimulationOptions, SimulationResult } from "./engine";

const HOME_ADVANTAGE = 2.5;
const ROTATION_SIZE = 8; // joueurs qui touchent des minutes significatives

function average(values: number[]): number {
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

// Approxime une loi normale via la somme de deux tirages uniformes (loi triangulaire) :
// donne un effet "courbe en cloche" plus réaliste qu'un bruit purement uniforme.
function noise(spread: number): number {
  return (Math.random() + Math.random() - 1) * spread;
}

// Force brute d'un joueur sur le terrain — moyenne pondérée de 9 des 10
// attributs techniques (stamina exclue : elle ne pèse pas sur la force, elle
// détermine seulement la vitesse d'accumulation/récupération de fatigue, voir
// fatigue-rules.ts). Les poids somment à 1 pour rester sur l'échelle 0-99,
// comparable à l'ancien overallRating qu'elle remplace comme mesure de force
// de simulation (overallRating reste la valeur "front-office" : salaire,
// trade, draft — inchangée par ce moteur).
function baseImpact(player: Player): number {
  const r = player.ratings;
  return (
    r.scoringInside * 0.12 +
    r.scoringOutside * 0.12 +
    r.playmaking * 0.12 +
    r.defenseInside * 0.12 +
    r.defenseOutside * 0.12 +
    r.rebounding * 0.1 +
    r.athleticism * 0.1 +
    r.basketballIQ * 0.1 +
    r.clutch * 0.1
  );
}

// Un joueur fatigué rend moins sur le terrain — jusqu'à -30% à fatigue
// maximale (99).
function playerImpact(player: Player): number {
  const fatigueFactor = 1 - (Math.max(0, Math.min(99, player.fatigue)) / 99) * 0.3;
  return baseImpact(player) * fatigueFactor;
}

function rotationOf(roster: Player[]): Player[] {
  return [...roster].sort((a, b) => playerImpact(b) - playerImpact(a)).slice(0, ROTATION_SIZE);
}

function teamStrength(roster: Player[], chemistry: number): number {
  const rotation = rotationOf(roster);
  const starters = rotation.slice(0, 5);
  const bench = rotation.slice(5);
  const startersAvg = average(starters.map(playerImpact));
  const benchAvg = bench.length ? average(bench.map(playerImpact)) : startersAvg;
  const rawStrength = startersAvg * 0.75 + benchAvg * 0.25;
  // Chimie d'équipe : modificateur ±10% autour de la force brute.
  const chemistryMultiplier = 0.9 + (Math.max(0, Math.min(99, chemistry)) / 99) * 0.2;
  return rawStrength * chemistryMultiplier;
}

function averageClutch(roster: Player[]): number {
  const rotation = rotationOf(roster);
  return rotation.length ? average(rotation.map((p) => p.ratings.clutch)) : 50;
}

function basePointsForLeague(leagueId: string): number {
  return leagueId === "wnba" ? 82 : 112;
}

function distributeBoxScore(
  teamId: string,
  roster: Player[],
  teamScore: number
): BoxScoreEntry[] {
  const rotation = rotationOf(roster);
  if (rotation.length === 0) return [];

  const weights = rotation.map((p) =>
    Math.max(p.ratings.scoringInside + p.ratings.scoringOutside + noise(6), 1)
  );
  const totalWeight = weights.reduce((sum, w) => sum + w, 0);

  let distributedPoints = 0;
  const entries: BoxScoreEntry[] = rotation.map((player, index) => {
    const points = Math.round((weights[index] / totalWeight) * teamScore);
    distributedPoints += points;
    return {
      playerId: player.id,
      teamId,
      points,
      rebounds: Math.max(
        0,
        Math.round((player.ratings.rebounding / 99) * 11 + noise(2))
      ),
      assists: Math.max(
        0,
        Math.round((player.ratings.playmaking / 99) * 8 + noise(2))
      ),
    };
  });

  // Ajuste le premier joueur pour que la somme colle exactement au score d'équipe.
  entries[0].points = Math.max(0, entries[0].points + (teamScore - distributedPoints));

  return entries;
}

export class MockSimulationEngine implements SimulationEngine {
  simulateGame(
    home: Team,
    homeRoster: Player[],
    away: Team,
    awayRoster: Player[],
    options?: SimulationOptions
  ): SimulationResult {
    const base = basePointsForLeague(home.leagueId);
    const homeChemistry = options?.homeChemistry ?? 50;
    const awayChemistry = options?.awayChemistry ?? 50;
    const homeStrength = teamStrength(homeRoster, homeChemistry) + HOME_ADVANTAGE;
    const awayStrength = teamStrength(awayRoster, awayChemistry);

    let homeScore = Math.max(
      60,
      Math.round(base + (homeStrength - 75) * 0.9 + noise(9))
    );
    let awayScore = Math.max(
      60,
      Math.round(base + (awayStrength - 75) * 0.9 + noise(9))
    );

    // Effet clutch : dans un match serré, léger avantage déterministe à
    // l'équipe dont la rotation a la meilleure moyenne de clutch.
    if (Math.abs(homeScore - awayScore) <= 3) {
      const homeClutch = averageClutch(homeRoster);
      const awayClutch = averageClutch(awayRoster);
      if (homeClutch > awayClutch) homeScore += 1;
      else if (awayClutch > homeClutch) awayScore += 1;
    }

    return {
      homeScore,
      awayScore,
      boxScore: [
        ...distributeBoxScore(home.id, homeRoster, homeScore),
        ...distributeBoxScore(away.id, awayRoster, awayScore),
      ],
    };
  }
}

export const simulationEngine: SimulationEngine = new MockSimulationEngine();
