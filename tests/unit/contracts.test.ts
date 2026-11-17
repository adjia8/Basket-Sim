import { test } from "node:test";
import assert from "node:assert/strict";
import {
  counterOffer,
  evaluateOffer,
  perceivedValue,
  playerStance,
  validOffer,
} from "../../src/lib/careers/contract-negotiation-rules";
import { minAcceptableSalary } from "../../src/lib/careers/player-demands";
import { baseSalaryFloor, SALARY_RANGES } from "../../src/lib/careers/salary-rules";

const stance = () =>
  playerStance({ renown: 60, overallRating: 80, age: 27, potential: 81, leagueId: "nba", morale: 60, teamAppeal: 0.5 });

test("courbe des salaires calée sur les vrais contrats (médianes 2026-27)", () => {
  const nba = SALARY_RANGES.nba;
  const m = (o: number) => baseSalaryFloor(o, nba) / 1e6;
  assert.ok(m(70) > 2 && m(70) < 4, `70 → ${m(70)}`);
  assert.ok(m(84) > 28 && m(84) < 38, `84 → ${m(84)}`);
  assert.ok(m(88) > 38 && m(88) < 46, `88 → ${m(88)}`);
  assert.equal(baseSalaryFloor(99, nba), nba.max);
  // Monotone.
  for (let o = 60; o < 99; o++) assert.ok(baseSalaryFloor(o + 1, nba) >= baseSalaryFloor(o, nba));
});

test("prime de renommée plafonnée (+15 %) et jamais au-delà du maximum", () => {
  const base = minAcceptableSalary(50, 84, "nba");
  const famous = minAcceptableSalary(99, 84, "nba");
  assert.ok(famous <= base * 1.151);
  assert.ok(minAcceptableSalary(99, 99, "nba") <= SALARY_RANGES.nba.max);
});

test("une offre à la demande d'ouverture est acceptée", () => {
  const s = stance();
  const v = evaluateOffer(s, { salary: s.askSalary, years: s.preferredYears, option: s.preferredOption }, s.patience);
  assert.equal(v.kind, "accept");
});

test("une offre basse donne une contre-proposition, elle-même acceptable", () => {
  const s = stance();
  const v = evaluateOffer(s, { salary: Math.round(s.minSalary * 0.9), years: s.preferredYears, option: "none" }, s.patience);
  assert.equal(v.kind, "counter");
  if (v.kind !== "counter") return;
  assert.ok(perceivedValue(s, v.counter) >= s.minSalary);
  assert.equal(evaluateOffer(s, v.counter, v.patienceLeft).kind, "accept");
});

test("les contre-propositions baissent à mesure que la patience s'use, jusqu'au plancher", () => {
  const s = stance();
  const first = counterOffer(s, s.patience);
  const last = counterOffer(s, 0);
  assert.ok(first.salary >= last.salary);
  assert.ok(perceivedValue(s, last) >= s.minSalary);
});

test("des offres insultantes répétées font partir le joueur", () => {
  const s = stance();
  let patience = s.patience;
  let kind = "counter";
  for (let i = 0; i < 5 && kind === "counter"; i++) {
    const v = evaluateOffer(s, { salary: SALARY_RANGES.nba.min, years: 1, option: "team" }, patience);
    kind = v.kind;
    if (v.kind === "counter") patience = v.patienceLeft;
  }
  assert.equal(kind, "walk");
});

test("une option exige au moins 2 ans de contrat", () => {
  assert.equal(validOffer({ salary: 5_000_000, years: 1, option: "player" }, "nba"), false);
  assert.equal(validOffer({ salary: 5_000_000, years: 2, option: "player" }, "nba"), true);
});
