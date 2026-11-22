import { test } from "node:test";
import assert from "node:assert/strict";
import {
  homeGameRevenue,
  luxuryTaxBill,
  nationalTvForSeason,
  perGameExpenses,
  perGameShares,
  priceDemand,
} from "../../src/lib/careers/finance-rules";

// Saison complète d'une équipe : 82 parts de saison, 41 matchs à domicile.
function season(market: number, winPct: number, attendance: number, ticket = 100, concession = 100) {
  const shares = perGameShares({ leagueId: "nba", season: "2025-2026", marketAppeal: market, winPct, publicOpinion: 50 });
  const home = homeGameRevenue({ leagueId: "nba", attendance, marketAppeal: market, ticketLevel: ticket, concessionLevel: concession, arenaLevel: 50, starRenown: 70 });
  const perGame = shares.nationalTv + shares.localMedia + shares.sponsors;
  const homeTotal = home.tickets + home.premium + home.concessions + home.merchandise;
  return { total: perGame * 82 + homeTotal * 41, gate: (home.tickets + home.premium) * 41, home };
}

test("revenu d'une saison à l'échelle réelle (moyenne NBA ≈ 456 M$, de 339 à 895 M$)", () => {
  const average = season(50, 0.5, 90).total;
  assert.ok(average > 330e6 && average < 560e6, `moyenne ${Math.round(average / 1e6)} M$`);
  const small = season(15, 0.3, 75).total;
  const big = season(95, 0.7, 98).total;
  assert.ok(small < average && average < big);
  assert.ok(small > 250e6, `petit marché ${Math.round(small / 1e6)} M$`);
});

test("billetterie et loges ≈ 30 % du revenu, TV nationale 143 M$ puis +7 %/an", () => {
  const s = season(50, 0.5, 90);
  const share = s.gate / s.total;
  assert.ok(share > 0.2 && share < 0.4, `billetterie ${Math.round(share * 100)} %`);
  assert.equal(nationalTvForSeason("nba", "2025-2026"), 143_000_000);
  assert.equal(nationalTvForSeason("nba", "2026-2027"), Math.round(143_000_000 * 1.07));
});

test("prix des billets : plus cher = moins de spectateurs, recette optimale entre les deux", () => {
  assert.ok(priceDemand(150) < priceDemand(100) && priceDemand(100) < priceDemand(70));
  const gate = (lvl: number) => {
    const h = homeGameRevenue({ leagueId: "nba", attendance: 95, marketAppeal: 50, ticketLevel: lvl, concessionLevel: 100, arenaLevel: 50, starRenown: 60 });
    return { revenue: h.tickets + h.premium, fill: h.fillRate };
  };
  assert.ok(gate(150).fill < gate(100).fill);
  // Trop cher finit par rapporter moins qu'un prix modéré.
  assert.ok(gate(150).revenue < Math.max(gate(110).revenue, gate(120).revenue));
});

test("dépenses par match et taxe de luxe au barème progressif", () => {
  const home = perGameExpenses({ leagueId: "nba", payroll: 164e6, staffCost: 12e6, home: true });
  assert.equal(home.payroll, Math.round(164e6 / 82));
  assert.ok(home.operations > 0);
  assert.equal(perGameExpenses({ leagueId: "nba", payroll: 164e6, staffCost: 12e6, home: false }).operations, 0);
  assert.equal(luxuryTaxBill(190e6, 200e6), 0);
  assert.equal(luxuryTaxBill(205e6, 200e6), 7_500_000); // 5 M$ × 1,50
  assert.equal(luxuryTaxBill(210e6, 200e6), 7_500_000 + 8_750_000); // + 5 M$ × 1,75
});

test("affluence : stars de l'effectif et forme récente relèvent la cible, le bilan reste dominant", async () => {
  const { attendanceTarget, starPower } = await import("../../src/lib/careers/attendance-rules");
  assert.equal(starPower([65, 60, 55]), 0); // pas de star = aucun effet
  const superstar = starPower([96, 72, 68]);
  assert.ok(superstar > 0.8 && superstar <= 1);
  assert.ok(starPower([90]) < starPower([90, 85]));
  const base = attendanceTarget(0.5, 50, 50, 0);
  assert.ok(attendanceTarget(0.5, 50, 50, superstar) > base + 8);
  // Bonne série récente à bilan égal : plus de monde.
  assert.ok(attendanceTarget(0.5, 50, 50, 0, 0.9) > base + 5);
  // Une superstar dans une équipe qui perd ne vaut pas une équipe qui gagne.
  assert.ok(attendanceTarget(0.25, 50, 50, 1) < attendanceTarget(0.7, 50, 50, 0));
});

test("soir de match : star absente = moins de spectateurs, star adverse = plus", () => {
  const gate = (stars: { homeAvailable: number; homeMissing: number; awayAvailable: number }) =>
    homeGameRevenue({ leagueId: "nba", attendance: 80, marketAppeal: 50, ticketLevel: 100, concessionLevel: 100, arenaLevel: 50, starRenown: 70, stars }).attendees;
  const normal = gate({ homeAvailable: 0.8, homeMissing: 0, awayAvailable: 0 });
  const starOut = gate({ homeAvailable: 0, homeMissing: 0.8, awayAvailable: 0 });
  const bigVisitor = gate({ homeAvailable: 0.8, homeMissing: 0, awayAvailable: 1 });
  assert.ok(starOut < normal * 0.9, `star absente ${starOut} vs ${normal}`);
  assert.ok(bigVisitor > normal);
  // Jamais au-delà de la capacité.
  assert.ok(gate({ homeAvailable: 1, homeMissing: 0, awayAvailable: 1 }) <= 18_500);
});

import {
  chargeLoans,
  dueProjects,
  facilityBonuses,
  financingPlan,
  ownersAcceptChance,
  parsePlan,
  projectOptions,
  withFacilityBonuses,
  type FacilityPlan,
} from "../../src/lib/careers/facility-projects-rules";

test("projets d'infrastructure : paliers, exclusivité, chantiers simultanés", () => {
  const reno = { training: 20_000_000, arena: 30_000_000 };
  const plan: FacilityPlan = { projects: [], loans: [], ownersRequestSeason: null };
  let opts = projectOptions(plan, "nba", reno);
  const suites = opts.find((o) => o.def.key === "premium_suites")!;
  assert.equal(suites.next?.tier, 1);
  assert.equal(suites.blockedBy, null);
  // Loges construites → tribune populaire impossible.
  plan.projects.push({ key: "premium_suites", tier: 1, status: "done", startedOn: "2026-10-01T00:00:00Z", completesOn: "2027-01-01T00:00:00Z", cost: 1, financing: "cash" });
  opts = projectOptions(plan, "nba", reno);
  assert.equal(opts.find((o) => o.def.key === "fan_stand")!.blockedBy, "exclusive");
  assert.equal(opts.find((o) => o.def.key === "premium_suites")!.next?.tier, 2);
  // Deux chantiers en cours → les autres attendent.
  for (const key of ["recovery_center", "video_board"] as const) {
    plan.projects.push({ key, tier: 1, status: "building", startedOn: "2026-10-01T00:00:00Z", completesOn: "2026-12-01T00:00:00Z", cost: 1, financing: "cash" });
  }
  opts = projectOptions(plan, "nba", reno);
  assert.equal(opts.find((o) => o.def.key === "medical_center")!.blockedBy, "concurrent");
  // Rénovation : coût selon le niveau, relançable.
  assert.equal(opts.find((o) => o.def.key === "arena_renovation")!.next?.cost, 30_000_000);
  // Livraison à la date prévue.
  assert.equal(dueProjects(plan, "2026-11-30T00:00:00Z").length, 0);
  assert.equal(dueProjects(plan, "2026-12-01T00:00:00Z").length, 2);
  // Effets : seuls les projets livrés comptent ; travaux dans la salle signalés.
  const b = facilityBonuses(plan, "nba");
  assert.equal(b.premium, 0.15);
  assert.equal(b.recovery, 0);
  assert.equal(b.arenaWorks, true);
});

test("financement, effets et recettes des projets", () => {
  const loan = financingPlan(20_000_000, "loan");
  assert.equal(loan.now, 5_000_000);
  assert.equal(loan.seasons, 3);
  assert.ok(loan.perSeason * 3 > 15_000_000); // intérêts
  assert.equal(financingPlan(20_000_000, "owners").ownersPay, 10_000_000);
  assert.ok(ownersAcceptChance(90, 0.5) > ownersAcceptChance(20, 0.5));
  // Emprunt payé saison après saison puis soldé.
  let json: string | null = JSON.stringify({ projects: [], loans: [{ key: "fan_zone", tier: 1, perSeason: 100, seasonsLeft: 2 }], ownersRequestSeason: null });
  let r = chargeLoans(json);
  assert.equal(r.paid, 100);
  r = chargeLoans(r.json);
  assert.equal(r.paid, 100);
  assert.equal(parsePlan(r.json).loans.length, 0);
  json = r.json;
  assert.equal(chargeLoans(json).paid, 0);
  // Staff corrigé : récupération et ambiance à domicile seulement.
  const staff = { fatigueRecoveryFactor: 1, wearFactor: 1, medicalLevel: 50, developmentLevel: 50, strengthBonus: 0 };
  const fx = { recovery: 0.1, medical: 10, development: 5, tactical: 0.3, homeCourt: 0.5 };
  assert.equal(withFacilityBonuses(staff, fx, true).strengthBonus, 0.8);
  assert.equal(withFacilityBonuses(staff, fx, false).strengthBonus, 0.3);
  assert.equal(withFacilityBonuses(staff, fx, true).wearFactor, 0.9);
  // Recettes : loges +30 %, travaux = moins de spectateurs.
  const base = { leagueId: "nba", attendance: 80, marketAppeal: 60, ticketLevel: 100, concessionLevel: 100, arenaLevel: 60, starRenown: 60 };
  const plain = homeGameRevenue(base);
  const boosted = homeGameRevenue({ ...base, boost: { fill: 0, premium: 0.3, concessions: 0.3, merch: 0, works: false } });
  assert.ok(boosted.premium > plain.premium * 1.25);
  assert.ok(boosted.concessions > plain.concessions);
  const works = homeGameRevenue({ ...base, boost: { fill: 0, premium: 0, concessions: 0, merch: 0, works: true } });
  assert.ok(works.attendees < plain.attendees);
});

import { baselineTiers, effectiveTier, projectDef as defOf, projectStars, PROJECTS } from "../../src/lib/careers/facility-projects-rules";
import { desiredFacility, facilityRequestOutcome } from "../../src/lib/careers/facility-request-rules";

test("installations existantes : jamais au maximum, une seule tribune, étoiles", () => {
  for (const id of ["wnba-a", "wnba-b", "wnba-c", "wnba-d", "wnba-e"]) {
    for (const market of [10, 50, 95]) {
      const b = baselineTiers(id, market);
      for (const def of PROJECTS) if (!def.repeatable) assert.ok((b[def.key] ?? 0) < def.tiers.length);
      assert.ok(!((b.premium_suites ?? 0) > 0 && (b.fan_stand ?? 0) > 0));
    }
  }
  // Un grand marché est mieux équipé en moyenne.
  const sum = (m: number) =>
    ["a", "b", "c", "d", "e", "f"].reduce((s, id) => s + Object.values(baselineTiers(id, m)).reduce((x, y) => x + (y ?? 0), 0), 0);
  assert.ok(sum(95) > sum(10));
  // Construit > existant.
  const plan = { projects: [{ key: "medical_center" as const, tier: 3, status: "done" as const, startedOn: "", completesOn: "", cost: 0, financing: "cash" as const }], loans: [], ownersRequestSeason: null };
  assert.equal(effectiveTier(plan, "medical_center", { medical_center: 1 }), 3);
  assert.equal(effectiveTier(plan, "recovery_center", { recovery_center: 2 }), 2);
  const med = defOf("medical_center")!;
  assert.equal(projectStars(med, 0, 50), 1);
  assert.equal(projectStars(med, 3, 50), 5);
  assert.equal(projectStars(defOf("arena_renovation")!, 0, 70), 3.5);
  // Équipes NBA : installations réelles (nba-facilities.ts).
  const det = baselineTiers("det", 50);
  const mia = baselineTiers("mia", 50);
  assert.equal(det.medical_center, 3); // Henry Ford : centre médical au maximum
  assert.equal(mia.recovery_center, 0); // le Heat s'entraîne encore dans sa salle
  assert.ok((baselineTiers("sac", 50).video_board ?? 0) > (baselineTiers("sas", 50).video_board ?? 0)); // Golden 1 Center > Frost Bank Center
});

test("demandes d'installations : besoin selon le profil, issue", () => {
  const tierOf = () => 0;
  const maxOf = () => 3;
  const star = { age: 27, renown: 80, overall: 85, potential: 86, wear: 20, injuriesThisSeason: 0 };
  assert.equal(desiredFacility(star, tierOf, maxOf), null); // rien de particulier
  assert.equal(desiredFacility({ ...star, injuriesThisSeason: 2 }, tierOf, maxOf)?.key, "medical_center");
  assert.equal(desiredFacility({ ...star, age: 33 }, tierOf, maxOf)?.key, "recovery_center");
  assert.equal(desiredFacility({ ...star, age: 22, overall: 78, potential: 88 }, tierOf, maxOf)?.key, "performance_lab");
  assert.equal(desiredFacility({ ...star, age: 33, renown: 40 }, tierOf, maxOf), null); // pas assez renommé
  assert.equal(desiredFacility({ ...star, age: 33 }, () => 2, maxOf), null); // déjà bien équipé
  const today = new Date("2027-01-10");
  assert.equal(facilityRequestOutcome({ currentTier: 2, wantedTier: 2, building: false, promiseBy: null, today }), "delivered");
  assert.equal(facilityRequestOutcome({ currentTier: 1, wantedTier: 2, building: true, promiseBy: null, today }), "started");
  assert.equal(facilityRequestOutcome({ currentTier: 1, wantedTier: 2, building: false, promiseBy: new Date("2027-01-01"), today }), "broken");
  assert.equal(facilityRequestOutcome({ currentTier: 1, wantedTier: 2, building: false, promiseBy: new Date("2027-02-01"), today }), "waiting");
});
