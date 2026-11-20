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
