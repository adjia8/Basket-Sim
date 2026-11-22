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

import {
  assetValueFor,
  capSalary,
  evaluateTradeForAi,
  rosterMoveAllowed,
  teamOutlook,
  type TradeAsset,
} from "../../src/lib/careers/trade-rules";

const TAX = 200_428_000;
const vet = (overall: number, salary = 20_000_000, age = 32): TradeAsset => ({ kind: "player", overall, age, salary, standard: true });
const young = (overall: number, salary = 3_000_000): TradeAsset => ({ kind: "player", overall, age: 21, salary, standard: true });
const firstRound: TradeAsset = { kind: "pick", round: 1, pickNumber: null };

test("profil : bilan après 15 matchs, objectif de début de saison avant", () => {
  assert.equal(teamOutlook({ winPct: 0.7, gamesPlayed: 30, expectation: "rebuild" }), "contender");
  assert.equal(teamOutlook({ winPct: 0.3, gamesPlayed: 30, expectation: "champion" }), "rebuild");
  assert.equal(teamOutlook({ winPct: 1, gamesPlayed: 3, expectation: "rebuild" }), "rebuild");
  assert.equal(teamOutlook({ winPct: 0.5, gamesPlayed: 3, expectation: "nba_finals" }), "contender");
});

test("une équipe en reconstruction paie plus cher les choix de draft et les jeunes, moins les vétérans", () => {
  assert.ok(assetValueFor("rebuild", firstRound, 30) > assetValueFor("contender", firstRound, 30));
  assert.ok(assetValueFor("rebuild", young(74), 30) > assetValueFor("contender", young(74), 30));
  assert.ok(assetValueFor("rebuild", vet(80), 30) < assetValueFor("contender", vet(80), 30));
});

test("vétéran contre choix de draft : accepté par une équipe en reconstruction, refusé par un prétendant", () => {
  // L'IA cède un titulaire de 82 (29 ans) ; on lui offre un 1er tour et un jeune.
  const deal = { received: [firstRound, young(72, 4_000_000)], given: [vet(82, 18_000_000, 29)], picksPerRound: 30, payrollBefore: 150_000_000, taxLine: TAX };
  assert.equal(evaluateTradeForAi({ ...deal, outlook: "rebuild" }).accept, true);
  const contender = evaluateTradeForAi({ ...deal, outlook: "contender" });
  assert.equal(contender.accept, false);
  assert.equal(contender.reason, "contender");
});

test("une équipe en reconstruction refuse d'absorber un gros salaire de vétéran", () => {
  const d = evaluateTradeForAi({
    outlook: "rebuild",
    received: [vet(80, 40_000_000)],
    given: [young(70, 2_000_000), { kind: "pick", round: 2, pickNumber: null }],
    picksPerRound: 30,
    payrollBefore: 140_000_000,
    taxLine: TAX,
  });
  assert.equal(d.accept, false);
});

test("passer la taxe de luxe coûte : un échange équitable devient refusé", () => {
  const base = { outlook: "contender" as const, received: [vet(80, 35_000_000)], given: [vet(80, 10_000_000)], picksPerRound: 30, taxLine: TAX };
  assert.equal(evaluateTradeForAi({ ...base, payrollBefore: 120_000_000 }).accept, true);
  const taxed = evaluateTradeForAi({ ...base, payrollBefore: 195_000_000 });
  assert.equal(taxed.accept, false);
  assert.equal(taxed.reason, "salary");
});

test("effectif : contrats standard et places two-way contrôlés séparément", () => {
  const m = { standardBefore: 15, altBefore: 3, standardOut: 1, altOut: 0, standardIn: 1, altIn: 0 };
  assert.equal(rosterMoveAllowed(m, 13, 15, 3), true);
  assert.equal(rosterMoveAllowed({ ...m, standardIn: 2 }, 13, 15, 3), false); // 16 standard
  assert.equal(rosterMoveAllowed({ ...m, altIn: 1 }, 13, 15, 3), false); // 4 two-way
  assert.equal(rosterMoveAllowed({ ...m, standardBefore: 13, standardOut: 2, standardIn: 1 }, 13, 15, 3), false); // 12
  assert.equal(capSalary([{ salary: 5, contractType: "standard" }, { salary: 1, contractType: "two_way" }]), 5);
});

test("effectif : 21 contrats en intersaison, retour aux bornes de saison avant le premier match", async () => {
  const { OFFSEASON_MAX_ROSTER_SIZE, rosterIssue, releaseOrder } = await import("../../src/lib/careers/roster-rules");
  assert.equal(OFFSEASON_MAX_ROSTER_SIZE.nba, 21);
  assert.equal(rosterIssue(17, "nba"), "over");
  assert.equal(rosterIssue(12, "nba"), "under");
  assert.equal(rosterIssue(14, "nba"), null);
  const order = releaseOrder([
    { id: "star", overall: 85, guaranteed: true, salary: 40_000_000 },
    { id: "rookie2", overall: 62, guaranteed: false, salary: 1_200_000 },
    { id: "vet", overall: 62, guaranteed: true, salary: 3_000_000 },
  ]);
  // À niveau égal, on coupe d'abord le contrat non garanti (pas d'argent mort).
  assert.deepEqual(order.map((p) => p.id), ["rookie2", "vet", "star"]);
});

test("centre des transferts : jauge d'intérêt et plus petit ajout suffisant", async () => {
  const { tradeInterest, smallestSufficientAddition, evaluateTradeForAi } = await import("../../src/lib/careers/trade-rules");
  assert.equal(tradeInterest({ received: 150, given: 100 }), "high");
  assert.equal(tradeInterest({ received: 95, given: 100 }), "medium");
  assert.equal(tradeInterest({ received: 80, given: 100 }), "low");
  assert.equal(tradeInterest({ received: 40, given: 100 }), "none");

  // Équipe en reconstruction : on lui demande un bon jeune contre un remplaçant.
  const base = { outlook: "rebuild" as const, picksPerRound: 30, payrollBefore: 150e6, taxLine: 200e6 };
  const received = [{ kind: "player" as const, overall: 72, age: 27, salary: 5e6, standard: true }];
  const given = [{ kind: "player" as const, overall: 80, age: 22, salary: 5e6, standard: true }];
  assert.equal(evaluateTradeForAi({ ...base, received, given }).accept, false);
  const pick1 = { id: "pick:1", asset: { kind: "pick" as const, round: 1, pickNumber: null }, allowed: true };
  const pick2 = { id: "pick:2", asset: { kind: "pick" as const, round: 2, pickNumber: null }, allowed: true };
  const star = { id: "player:s", asset: { kind: "player" as const, overall: 90, age: 26, salary: 5e6, standard: true }, allowed: false };
  const best = smallestSufficientAddition({ ...base, received, given, candidates: [star, pick1, pick2] });
  assert.ok(best, "une suggestion existe");
  // Jamais un élément interdit (effectif / règles salariales).
  assert.notEqual(best!.id, "player:s");
  // Si le 2e tour suffit, il passe avant le 1er tour (moins cher).
  const with2 = evaluateTradeForAi({ ...base, received: [...received, pick2.asset], given }).accept;
  assert.equal(best!.id, with2 ? "pick:2" : "pick:1");
});
