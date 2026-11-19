import { test } from "node:test";
import assert from "node:assert/strict";
import { MockSimulationEngine } from "../../src/lib/simulation/mockEngine";
import type { SimulationResult } from "../../src/lib/simulation/engine";
import type { Player, Team } from "../../src/lib/types";

// Moteur de match sur des équipes fictives (aucune base de données) :
// cohérence du box score, réalisme statistique, match en direct.

const team = (id: string): Team => ({
  id,
  leagueId: "nba",
  conferenceId: "x",
  city: id,
  name: id,
  abbreviation: id.toUpperCase(),
  primaryColor: "#000000",
  secondaryColor: "#ffffff",
  marketAppeal: 50,
});

const player = (teamId: string, i: number, base: number): Player => {
  const r = base - i * 1.5;
  return {
    id: `${teamId}-${i}`,
    teamId,
    leagueId: "nba",
    firstName: "P",
    lastName: `${i}`,
    position: (["PG", "SG", "SF", "PF", "C"] as const)[i % 5],
    jerseyNumber: i,
    heightCm: 200,
    age: 26,
    overallRating: Math.round(r),
    ratings: {
      scoringInside: r, scoringOutside: r, playmaking: r, defenseInside: r, defenseOutside: r,
      rebounding: r, athleticism: r, basketballIQ: r, clutch: r, stamina: 80,
    },
    injuryRisk: 20,
    injured: false,
    injuryGamesRemaining: 0,
    playingThroughInjury: false,
    renown: 50,
    fatigue: 0,
    conditioning: 100,
    trainingBoost: 0,
    nationality: "US",
  };
};
const roster = (id: string, base: number) => Array.from({ length: 13 }, (_, i) => player(id, i, base));
const engine = new MockSimulationEngine();
const play = (homeBase: number, awayBase: number) =>
  engine.simulateGame(team("h"), roster("h", homeBase), team("a"), roster("a", awayBase));

function assertConsistent(r: SimulationResult) {
  const pts = (teamId: string) => r.boxScore.filter((e) => e.teamId === teamId).reduce((s, e) => s + e.points, 0);
  assert.equal(pts("h"), r.homeScore);
  assert.equal(pts("a"), r.awayScore);
  assert.notEqual(r.homeScore, r.awayScore); // jamais de nul
  for (const e of r.boxScore) {
    assert.ok(e.fieldGoalsMade <= e.fieldGoalsAttempted);
    assert.ok(e.personalFouls <= 6);
  }
}

test("box score cohérent et jamais de match nul", () => {
  for (let i = 0; i < 300; i++) assertConsistent(play(80, 80));
});

test("réalisme statistique (≈ NBA) entre équipes égales", () => {
  const N = 1200;
  let homeWins = 0;
  let overtime = 0;
  const margins: number[] = [];
  const scores: number[] = [];
  for (let i = 0; i < N; i++) {
    const r = play(80, 80);
    if (r.homeScore > r.awayScore) homeWins++;
    if ((r.quarterLog?.length ?? 4) > 4) overtime++;
    margins.push(r.homeScore - r.awayScore);
    scores.push(r.homeScore, r.awayScore);
  }
  const mean = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length;
  const sd = Math.sqrt(mean(margins.map((m) => (m - mean(margins)) ** 2)));
  assert.ok(sd > 9 && sd < 16, `écart-type des écarts ${sd.toFixed(1)}`);
  assert.ok(homeWins / N > 0.5 && homeWins / N < 0.64, `victoires à domicile ${homeWins / N}`);
  assert.ok(overtime / N > 0.02 && overtime / N < 0.13, `prolongations ${overtime / N}`);
  assert.ok(mean(scores) > 100 && mean(scores) < 130, `score moyen ${mean(scores)}`);
});

test("la meilleure équipe gagne nettement plus souvent, sans être invincible", () => {
  let wins = 0;
  for (let i = 0; i < 600; i++) {
    const r = engine.simulateGame(team("h"), roster("h", 76), team("a"), roster("a", 84));
    if (r.awayScore > r.homeScore) wins++;
  }
  assert.ok(wins / 600 > 0.7 && wins / 600 < 0.97, `victoires de la meilleure équipe ${wins / 600}`);
});

test("match en direct : arrêt après chaque quart-temps puis reprise jusqu'au bout", () => {
  const h = team("h");
  const a = team("a");
  const hr = roster("h", 80);
  const ar = roster("a", 80);
  let state = engine.simulateGame(h, hr, a, ar, { stopAfterQuarter: 1 }).halftime!;
  assert.equal(state.quarter, 1);
  assert.equal(state.quarterLog?.length, 1);
  for (const q of [2, 3]) {
    state = engine.simulateGame(h, hr, a, ar, { resumeFrom: state, stopAfterQuarter: q, restNextQuarter: ["h-0"] }).halftime!;
    assert.equal(state.quarter, q);
  }
  const final = engine.simulateGame(h, hr, a, ar, { resumeFrom: state });
  assert.equal(final.halftime, undefined);
  assert.ok((final.quarterLog?.length ?? 0) >= 4);
  assertConsistent(final);
  const last = final.quarterLog!.at(-1)!;
  assert.equal(last.homeTotal, final.homeScore);
  assert.equal(last.awayTotal, final.awayScore);
});
