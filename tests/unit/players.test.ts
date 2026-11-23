import { evaluateOffer } from "../../src/lib/careers/contract-negotiation-rules";
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  isMentor,
  lockerRoom,
  personalityFor,
  personalityLabel,
  scaleMoraleDelta,
  technicalFoulMultiplier,
} from "../../src/lib/careers/personality-rules";
import {
  EXPECTED_MINUTES,
  marketRating,
  playerStatus,
  productionRating,
  promisableStatuses,
  roleValueMultiplier,
  rankInRoster,
} from "../../src/lib/careers/player-status-rules";
import { annualGrowth, estimateRating, growthFactor, initialPotential } from "../../src/lib/careers/potential-rules";

test("personnalité déterministe, traits entre 1 et 20", () => {
  assert.deepEqual(personalityFor("luka-doncic", 27), personalityFor("luka-doncic", 27));
  for (const id of ["a", "b", "c", "lebron-james", "victor-wembanyama"]) {
    for (const v of Object.values(personalityFor(id, 25))) assert.ok(v >= 1 && v <= 20);
  }
});

test("profils variés sur un grand échantillon", () => {
  const labels = new Set(Array.from({ length: 400 }, (_, i) => personalityLabel(personalityFor(`p${i}`, 26))));
  assert.ok(labels.size >= 8, `seulement ${labels.size} profils`);
});

test("tempérament : les sanguins prennent plus de techniques et vivent le moral plus fort", () => {
  const fiery = { professionalism: 10, ambition: 10, loyalty: 10, temperament: 3, leadership: 10 };
  const calm = { ...fiery, temperament: 18 };
  assert.ok(technicalFoulMultiplier(fiery) > technicalFoulMultiplier(calm));
  assert.equal(scaleMoraleDelta(-2, fiery, () => 0), -4);
  assert.equal(scaleMoraleDelta(-2, calm, () => 0.99), -1);
});

test("vestiaire : leaders et perturbateurs déplacent la cohésion, mentor = vétéran pro", () => {
  const base = { professionalism: 10, ambition: 10, loyalty: 10, temperament: 10, leadership: 10 };
  const room = lockerRoom([
    { id: "leader", age: 30, overall: 88, renown: 85, personality: { ...base, leadership: 18 } },
    { id: "hothead", age: 24, overall: 70, renown: 50, personality: { ...base, temperament: 3, professionalism: 5 } },
  ]);
  assert.deepEqual(room.leaders, ["leader"]);
  assert.deepEqual(room.disruptive, ["hothead"]);
  assert.equal(room.chemistryBonus, 2 - 3);
  assert.equal(isMentor({ ...base, professionalism: 16, leadership: 14 }, 32), true);
  assert.equal(isMentor({ ...base, professionalism: 16, leadership: 14 }, 25), false);
});

test("statut : un seul joueur franchise (le meilleur), les stars parmi les trois premiers", () => {
  const st = (overall: number, teamRank: number, renown = 60) => playerStatus({ overall, renown, age: 27, potential: overall, teamRank });
  assert.equal(st(90, 1), "franchise");
  assert.equal(st(90, 2), "star");
  assert.equal(st(90, 4, 90), "starter");
  assert.equal(st(70, 12), "bench");
  assert.equal(rankInRoster(80, [85, 82, 70]), 3);
  assert.ok(EXPECTED_MINUTES.franchise > EXPECTED_MINUTES.starter);
});

test("production : échelle large, plafond réservé aux saisons historiques", () => {
  const line = (ppg: number, rpg: number, apg: number) => ({ gamesPlayed: 50, ppg, rpg, apg, spg: 1, bpg: 0.5, tpg: 2.5 });
  assert.equal(productionRating({ ...line(30, 10, 10), gamesPlayed: 5 }), null);
  const role = productionRating(line(8, 4, 2))!;
  const star = productionRating(line(25, 6, 5))!;
  assert.ok(role > 60 && role < 78);
  assert.ok(star > 82 && star < 97);
  assert.equal(marketRating(80, null), 80);
  assert.equal(marketRating(80, 90), 84);
});

test("promesses : rôle actuel garanti ou jusqu'à trois crans au-dessus", () => {
  assert.deepEqual(promisableStatuses("bench"), ["star", "starter", "rotation"]);
  assert.deepEqual(promisableStatuses("rotation"), ["franchise", "star", "starter", "rotation"]);
  assert.deepEqual(promisableStatuses("star"), ["franchise", "star"]);
  assert.ok(!promisableStatuses("bench").includes("franchise"));
});

test("négociation : le rôle promis pèse sur la valeur de l'offre", () => {
  assert.equal(roleValueMultiplier("starter", null), 1);
  assert.ok(roleValueMultiplier("rotation", "starter") > roleValueMultiplier("rotation", "rotation"));
  assert.ok(roleValueMultiplier("rotation", "star") > roleValueMultiplier("rotation", "starter"));
  assert.ok(roleValueMultiplier("rotation", "franchise") < roleValueMultiplier("rotation", "star")); // il n'y croit pas
  assert.ok(roleValueMultiplier("starter", "bench") < 1);
  const stance = { minSalary: 10_000_000, askSalary: 12_000_000, preferredYears: 3, preferredOption: "none" as const, patience: 3, expectedRole: "rotation" as const };
  // 9,5 M$ sans engagement : refusé ; avec une place de titulaire : accepté.
  assert.equal(evaluateOffer(stance, { salary: 9_500_000, years: 3, option: "none" }, 3).kind, "counter");
  assert.equal(evaluateOffer(stance, { salary: 9_500_000, years: 3, option: "none", role: "starter" }, 3).kind, "accept");
  // La contre-proposition garde le rôle proposé.
  const v = evaluateOffer(stance, { salary: 6_000_000, years: 3, option: "none", role: "starter" }, 3);
  assert.ok(v.kind === "counter" && v.counter.role === "starter");
});

test("potentiel : jamais sous la note, progression nulle au plafond", () => {
  for (let i = 0; i < 50; i++) assert.ok(initialPotential(75, 20) >= 75);
  assert.equal(growthFactor(80, 80), 0);
  assert.ok(growthFactor(70, 85) > growthFactor(70, 75));
  assert.equal(annualGrowth(22, 80, 80, 1), 0);
  const e = estimateRating(85, 99, "seed");
  assert.ok(e.low <= 85 + 2 && e.high >= 85 - 2);
});

test("leaders : la stature d'abord (star, meilleurs joueurs, vétéran reconnu), puis le tempérament", () => {
  const base = { professionalism: 12, ambition: 10, loyalty: 10, temperament: 10, leadership: 12 };
  const room = lockerRoom([
    { id: "star", age: 27, overall: 96, renown: 95, personality: base },
    { id: "second", age: 28, overall: 88, renown: 80, personality: { ...base, leadership: 6 } }, // pas un meneur
    { id: "charismaticBench", age: 24, overall: 72, renown: 55, personality: { ...base, leadership: 19 } },
    { id: "veteran", age: 33, overall: 76, renown: 74, personality: { ...base, leadership: 15 } },
    { id: "hotheadStar", age: 26, overall: 86, renown: 82, personality: { ...base, temperament: 3, professionalism: 5, leadership: 17 } },
  ]);
  // Le remplaçant charismatique n'est pas leader ; la star tête brûlée non plus.
  assert.deepEqual(room.leaders, ["star", "veteran"]);
  assert.ok(room.leaders.length <= 2);
  assert.ok(room.disruptive.includes("hotheadStar"));
});

test("leaders : la star franchise mène d'office, même sans grand charisme", () => {
  const base = { professionalism: 12, ambition: 10, loyalty: 10, temperament: 10, leadership: 7 };
  const room = lockerRoom([
    { id: "franchise", age: 27, overall: 96, renown: 92, personality: base },
    { id: "second", age: 26, overall: 86, renown: 70, personality: { ...base, leadership: 5 } },
    { id: "role", age: 25, overall: 74, renown: 55, personality: { ...base, leadership: 18 } },
  ]);
  assert.deepEqual(room.leaders, ["franchise"]);
});

test("suggestion de l'adjoint : cinq équilibré, blessés et joueurs épuisés écartés, compétence = fiabilité", async () => {
  const { rotationAdvice } = await import("../../src/lib/careers/rotation-advice-rules");
  const mk = (id: string, position: string, overall: number, extra: object = {}) => ({
    id, position, overall, fatigue: 0, wear: 10, injured: false, ppg: overall / 6, rpg: 4, apg: 3, ...extra,
  });
  const players = [
    mk("pg1", "PG", 90), mk("pg2", "PG", 85), mk("sg1", "SG", 80), mk("sf1", "SF", 79), mk("pf1", "PF", 78),
    mk("c1", "C", 77), mk("c2", "C", 70), mk("sf2", "SF", 72), mk("sg2", "SG", 71), mk("pf2", "PF", 69),
    mk("hurt", "SF", 92, { injured: true, injurySeverity: "moderate", injuryGamesRemaining: 6 }),
    mk("tired", "PG", 88, { fatigue: 55 }), // énergie 45 % : repos conseillé
    mk("end", "SG", 60),
  ];
  const good = rotationAdvice(players, 90, "s");
  // Un titulaire par poste.
  const starters = good.order.slice(0, 5);
  const positions = starters.map((id) => (good.notes[id] as { pos: string }).pos);
  assert.deepEqual(positions, ["PG", "SG", "SF", "PF", "C"]);
  assert.equal(good.notes.pg1.kind, "starter");
  assert.equal(good.notes.c1.kind, "starter"); // le pivot plutôt qu'un 2e meneur mieux noté
  assert.equal(good.notes.hurt.kind, "injured");
  assert.equal(good.notes.tired.kind, "rest");
  assert.ok(good.order.indexOf("hurt") >= 10 && good.order.indexOf("tired") >= 10);
  assert.equal(good.notes[good.order[5]].kind, "sixth");
  assert.equal(good.confidence, "high");
  // Adjoint faible : avis approximatif, ne pense pas au repos.
  const weak = rotationAdvice(players, 20, "s");
  assert.equal(weak.confidence, "low");
  assert.notEqual(weak.notes.tired.kind, "rest");
  assert.equal(weak.notes.hurt.kind, "injured"); // un blessé reste un blessé
});

test("suggestion de l'adjoint : chacun à son poste quand c'est possible (combinaison globale)", async () => {
  const { rotationAdvice } = await import("../../src/lib/careers/rotation-advice-rules");
  const mk = (id: string, position: string, overall: number) => ({ id, position, overall, fatigue: 0, wear: 0, injured: false, ppg: 10, rpg: 4, apg: 3 });
  const advice = rotationAdvice([mk("pg", "PG", 90), mk("sg", "SG", 85), mk("sf", "SF", 80), mk("c", "C", 81), mk("pf", "PF", 76), mk("b1", "SG", 70)], 90);
  assert.equal((advice.notes.c as { pos: string }).pos, "C");
  assert.equal((advice.notes.pf as { pos: string }).pos, "PF");
});

test("rapport d'équipe : rangs, points forts / faibles, postes en manque, pistes", async () => {
  const { rankMetrics, strengthsAndWeaknesses, positionDepth, reportAdvice } = await import("../../src/lib/careers/team-report-rules");
  const league = new Map<string, Record<string, number>>();
  for (let i = 0; i < 30; i++) league.set(`t${i}`, { ppg: 100 + i, oppPpg: 100 + i, scoringOutside: 60 + i, defenseInside: 60 + i, bench: 60 + i });
  // Mon équipe : meilleure attaque et meilleur tir extérieur, pire défense (points encaissés et intérieure).
  league.set("me", { ppg: 140, oppPpg: 140, scoringOutside: 95, defenseInside: 50, bench: 50 });
  const ranked = rankMetrics("me", league);
  const by = Object.fromEntries(ranked.map((m) => [m.key, m]));
  assert.equal(by.ppg.rank, 1);
  assert.equal(by.oppPpg.rank, 31); // moins bien = plus de points encaissés
  const { strengths, weaknesses } = strengthsAndWeaknesses(ranked);
  assert.ok(strengths.some((m) => m.key === "ppg") && strengths.some((m) => m.key === "scoringOutside"));
  assert.ok(weaknesses.some((m) => m.key === "oppPpg") && weaknesses.some((m) => m.key === "defenseInside"));
  const depth = positionDepth([
    { position: "PG", overall: 90 }, { position: "PG", overall: 75 }, { position: "SG", overall: 80 }, { position: "SG", overall: 74 },
    { position: "SF", overall: 78 }, { position: "SF", overall: 70 }, { position: "PF", overall: 77 },
    { position: "C", overall: 70 }, { position: "C", overall: 68, injured: true },
  ]);
  const at = Object.fromEntries(depth.map((d) => [d.position, d]));
  assert.equal(at.C.need, "critical"); // meilleur pivot à 70
  assert.equal(at.PF.need, "thin"); // un seul ailier fort
  assert.equal(at.PG.need, null);
  const advice = reportAdvice(ranked, depth);
  assert.deepEqual(advice[0], { kind: "recruit", position: "C", critical: true });
  assert.ok(advice.some((a) => a.kind === "tactic" && a.tactic === "perimeter"));
  assert.ok(advice.length <= 4);
});

import { matchesFilters, parseFilters, sortCandidates, strengthValue, topStrengths } from "../../src/lib/careers/scouting-rules";

test("scouting : filtres poste / âge / note / point fort / contrat, tri", () => {
  const r = { scoringInside: 60, scoringOutside: 88, playmaking: 70, defenseInside: 50, defenseOutside: 70, rebounding: 40, athleticism: 75 };
  const shooter = { id: "a", teamId: "bos", position: "SG", age: 24, overall: 80, potential: 86, ratings: r, salary: 12_000_000, yearsRemaining: 1 };
  const fa = { ...shooter, id: "b", teamId: null, salary: 0, yearsRemaining: 0 };
  const f = parseFilters({ pos: "SG", ageMax: "26", ovrMin: "78", str: "shooting", strMin: "85", salMax: "15", status: "expiring" }, "lal");
  assert.equal(f.salaryMax, 15_000_000);
  assert.ok(matchesFilters(shooter, f));
  assert.ok(!matchesFilters({ ...shooter, position: "C" }, f));
  assert.ok(!matchesFilters({ ...shooter, age: 30 }, f));
  assert.ok(!matchesFilters({ ...shooter, salary: 20_000_000 }, f));
  assert.ok(!matchesFilters({ ...shooter, yearsRemaining: 3 }, f)); // pas en fin de contrat
  assert.ok(!matchesFilters(fa, f)); // agent libre exclu de « fin de contrat »
  assert.ok(matchesFilters(fa, { ...f, status: "free_agent" }));
  assert.ok(!matchesFilters({ ...shooter, teamId: "lal" }, f)); // mon équipe exclue par défaut
  assert.equal(strengthValue(r, "defense"), 60);
  assert.deepEqual(topStrengths(r), ["shooting", "athleticism"]);
  const sorted = sortCandidates([{ ...shooter, age: 30 }, { ...shooter, id: "y", age: 21 }], { ...f, sort: "age" });
  assert.equal(sorted[0].id, "y");
});
