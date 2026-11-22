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

test("promesses : au plus deux crans au-dessus du rôle actuel", () => {
  assert.deepEqual(promisableStatuses("bench"), ["rotation"]);
  assert.deepEqual(promisableStatuses("rotation"), ["star", "starter"]);
  assert.ok(!promisableStatuses("bench").includes("franchise"));
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
