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
  const firstForm = JSON.stringify(state.form);
  assert.ok(state.form && Object.keys(state.form).length === 26);
  for (const q of [2, 3]) {
    state = engine.simulateGame(h, hr, a, ar, { resumeFrom: state, stopAfterQuarter: q, restNextQuarter: ["h-0"] }).halftime!;
    assert.equal(state.quarter, q);
    // Forme du soir conservée d'un quart-temps à l'autre.
    assert.equal(JSON.stringify(state.form), firstForm);
  }
  // La reprise ne modifie jamais l'état transmis par l'appelant.
  const frozen = JSON.stringify(state);
  engine.simulateGame(h, hr, a, ar, { resumeFrom: state });
  assert.equal(JSON.stringify(state), frozen);
  const final = engine.simulateGame(h, hr, a, ar, { resumeFrom: state });
  assert.equal(final.halftime, undefined);
  assert.ok((final.quarterLog?.length ?? 0) >= 4);
  assertConsistent(final);
  const last = final.quarterLog!.at(-1)!;
  assert.equal(last.homeTotal, final.homeScore);
  assert.equal(last.awayTotal, final.awayScore);
});

// Effectif typé « NBA » : une star, un lieutenant, des titulaires, un banc,
// avec des profils de poste (intérieurs au rebond, meneur à la passe).
const CURVE = [90, 84, 80, 78, 76, 75, 74, 73, 72, 71, 70, 69, 68];
const realistic = (teamId: string): Player[] =>
  CURVE.map((r, i) => {
    const base = player(teamId, i, 0);
    const pos = (["PG", "SG", "SF", "PF", "C"] as const)[i % 5];
    const big = pos === "C" || pos === "PF";
    return {
      ...base,
      position: pos,
      overallRating: r,
      ratings: {
        scoringInside: r + (big ? 4 : -2),
        scoringOutside: r + (big ? -8 : 4),
        playmaking: r + (pos === "PG" ? 8 : big ? -10 : 0),
        defenseInside: r + (big ? 6 : -4),
        defenseOutside: r,
        rebounding: r + (big ? 10 : -8),
        athleticism: r,
        basketballIQ: r,
        clutch: r,
        stamina: 80,
      },
    };
  });

test("feuilles de stats proches de la NBA (tirs, rebonds, passes, grosses soirées, fautes)", () => {
  const N = 1200;
  let fortyPoint = 0;
  let foulOuts = 0;
  const per = { tpa: 0, reb: 0, ast: 0, tov: 0, fgm: 0, fga: 0, pf: 0, teams: 0 };
  for (let g = 0; g < N; g++) {
    const r = engine.simulateGame(team("h"), realistic("h"), team("a"), realistic("a"));
    for (const e of r.boxScore) {
      per.tpa += e.threePointersAttempted;
      per.reb += e.rebounds;
      per.ast += e.assists;
      per.tov += e.turnovers;
      per.pf += e.personalFouls;
      per.fgm += e.fieldGoalsMade;
      per.fga += e.fieldGoalsAttempted;
      if (e.points >= 40) fortyPoint++;
      if (e.disqualifiedReason === "fouled_out") foulOuts++;
    }
    per.teams += 2;
  }
  const avg = (v: number) => v / per.teams;
  if (process.env.DEBUG_STATS) console.log("fautes/équipe", avg(per.pf), "sorties/match", foulOuts / N);
  assert.ok(avg(per.tpa) > 30 && avg(per.tpa) < 44, `3PA ${avg(per.tpa)}`);
  assert.ok(avg(per.reb) > 40 && avg(per.reb) < 48, `rebonds ${avg(per.reb)}`);
  assert.ok(avg(per.ast) > 23 && avg(per.ast) < 30, `passes ${avg(per.ast)}`);
  assert.ok(avg(per.tov) > 11 && avg(per.tov) < 17, `pertes ${avg(per.tov)}`);
  const fgPct = per.fgm / per.fga;
  assert.ok(fgPct > 0.44 && fgPct < 0.5, `FG% ${fgPct}`);
  // Grosses soirées et sorties pour six fautes : rares mais présentes.
  assert.ok(fortyPoint / N > 0.01 && fortyPoint / N < 0.15, `40 pts+ par match ${fortyPoint / N}`);
  assert.ok(foulOuts / N > 0.04 && foulOuts / N < 0.25, `six fautes par match ${foulOuts / N}`);
  assert.ok(avg(per.pf) > 18 && avg(per.pf) < 24, `fautes par équipe ${avg(per.pf)}`);
});

test("retour progressif : minutes plafonnées, box score toujours cohérent", () => {
  for (let i = 0; i < 100; i++) {
    const r = engine.simulateGame(team("h"), roster("h", 80), team("a"), roster("a", 80), { minutesCap: { "h-0": 20 } });
    const star = r.boxScore.find((e) => e.playerId === "h-0")!;
    // 20 min sur 48, plus au plus 5 min par prolongation (un quart du plafond).
    const ot = Math.max(0, (r.quarterLog?.length ?? 4) - 4);
    assert.ok(star.minutesPlayed <= 20 + 5 * ot + 0.5, `${star.minutesPlayed} min`);
    assertConsistent(r);
  }
});
