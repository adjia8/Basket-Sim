import { test } from "node:test";
import assert from "node:assert/strict";
import { contrast, teamAccent } from "../../src/lib/theme/team-accent";
import { chooseBoardObjectives, objectiveMet } from "../../src/lib/careers/board-objectives-rules";

test("accent de franchise lisible sur les deux thèmes", () => {
  const teams: [string, string][] = [
    ["#552583", "#FDB927"], // Lakers
    ["#007A33", "#BA9653"], // Celtics
    ["#006BB6", "#F58426"], // Knicks
    ["#0E2240", "#FEC524"], // Nuggets
  ];
  for (const [p, s] of teams) {
    for (const [surface, dark] of [["#0e1528", true], ["#ffffff", false]] as const) {
      const a = teamAccent(p, s, surface, dark)!;
      assert.ok(contrast(a.accent, surface) >= 3, `${p} sur ${surface}`);
      assert.ok(contrast(a.accentText, surface) >= 4.5);
      assert.ok(contrast(a.accent, a.accentFg) >= 4.5);
    }
  }
  // Noir/blanc/argent : on garde l'accent du thème.
  assert.equal(teamAccent("#000000", "#777D84", "#0e1528", true), null);
});

test("objectifs des propriétaires : bilan borné, jeunes ou affluence selon l'effectif", () => {
  const withYouth = chooseBoardObjectives({ winPct: 0.9, youngPlayers: 3, attendance: 70 });
  assert.equal(withYouth[0].target, 0.65);
  assert.equal(withYouth[1].type, "develop_youth");
  const noYouth = chooseBoardObjectives({ winPct: 0.2, youngPlayers: 0, attendance: 70 });
  assert.equal(noYouth[0].target, 0.35);
  assert.equal(noYouth[1].type, "attendance");
  assert.equal(objectiveMet(noYouth[1], 76), true);
  assert.equal(objectiveMet(noYouth[1], 74), false);
});

import { mergeSeasonRows } from "../../src/lib/careers/season-lines-rules";

test("joueur échangé : une seule ligne de saison, totaux additionnés, équipe actuelle", () => {
  const zero = { minutes: 0, rebounds: 0, assists: 0, steals: 0, blocks: 0, turnovers: 0, fgm: 0, fga: 0, tpm: 0, tpa: 0, ftm: 0, fta: 0 };
  const rows = [
    { playerId: "p", teamId: "old", gamesPlayed: 30, points: 600, ...zero },
    { playerId: "p", teamId: "new", gamesPlayed: 20, points: 500, ...zero },
    { playerId: "q", teamId: "new", gamesPlayed: 50, points: 400, ...zero },
  ];
  const merged = mergeSeasonRows(rows, (id) => (id === "p" ? "new" : undefined));
  const p = merged.find((r) => r.playerId === "p")!;
  assert.equal(merged.length, 2);
  assert.equal(p.gamesPlayed, 50);
  assert.equal(p.points, 1100);
  assert.equal(p.teamId, "new");
  // Équipe inconnue : celle où il a joué le plus.
  assert.equal(mergeSeasonRows(rows, () => undefined).find((r) => r.playerId === "p")!.teamId, "old");
});

import { NBA_REAL_PROSPECTS } from "../../src/lib/mock-data/real-prospects-nba";
import { playersNba } from "../../src/lib/mock-data/players-nba";

test("classes de prospects réels : 3 drafts, pas de doublon, absents du catalogue NBA, données plausibles", () => {
  assert.deepEqual(Object.keys(NBA_REAL_PROSPECTS).sort(), ["2027-2028", "2028-2029", "2029-2030"]);
  const inCatalog = new Set(playersNba.map((p) => `${p.firstName} ${p.lastName}`));
  const seen = new Set<string>();
  for (const [season, list] of Object.entries(NBA_REAL_PROSPECTS)) {
    assert.ok(list.length >= 10, `${season} : ${list.length}`);
    for (const p of list) {
      const name = `${p.firstName} ${p.lastName}`;
      assert.ok(!seen.has(name), `doublon ${name}`);
      seen.add(name);
      assert.ok(!inCatalog.has(name), `${name} déjà dans le catalogue NBA`);
      assert.ok(["PG", "SG", "SF", "PF", "C"].includes(p.position));
      assert.ok(p.heightCm >= 170 && p.heightCm <= 230, `${name} ${p.heightCm} cm`);
      assert.ok(p.age >= 17 && p.age <= 23, `${name} ${p.age} ans`);
      assert.ok(p.overallRating >= 60 && p.overallRating <= 82, `${name} ${p.overallRating}`);
    }
  }
});

import {
  attributeEvolution,
  clubStanding,
  extensionOffer,
  gmRating,
  gmSalary,
  interestedTeams,
  poachChance,
  purchase,
  reputationAfterSeason,
  sell,
  severancePay,
} from "../../src/lib/careers/gm-career-rules";

test("carrière du GM : note, évolution selon le style, réputation", () => {
  const p = { offense: 4, defense: 4, physical: 4, tactical: 4, chemistry: 4 };
  assert.equal(gmRating(p), 52);
  const style = { offenseRank: 2, defenseRank: 28, teams: 30, chemistry: 75, pace: "fast", offenseStyle: "perimeter", defenseStyle: "man", outcome: "exceeded" as const };
  const d = attributeEvolution(p, style);
  assert.equal(d.offense, 2); // top 3 en attaque
  assert.equal(d.defense, -1); // défense parmi les pires
  assert.equal(d.physical, 1); // rythme rapide
  assert.equal(d.tactical, 2); // système + objectifs dépassés
  assert.equal(d.chemistry, 1);
  // Bornes 0-20.
  assert.equal(attributeEvolution({ ...p, offense: 20 }, style).offense, 0);
  assert.equal(attributeEvolution({ ...p, defense: 0 }, style).defense, 0);
  const standing = clubStanding({ board: 80, players: 70, press: 60, fans: 70 });
  assert.equal(standing, 71);
  assert.ok(reputationAfterSeason({ reputation: 50, standing, outcome: "exceeded", champion: true, prestige: 0 }) > 60);
  assert.ok(reputationAfterSeason({ reputation: 50, standing: 30, outcome: "fired", champion: false, prestige: 0 }) < 42);
});

test("carrière du GM : contrat, marché de l'emploi, train de vie", () => {
  assert.ok(gmSalary("nba", 90, 90) > gmSalary("nba", 20, 30));
  assert.equal(extensionOffer({ salary: 3_000_000, yearsLeft: 2, outcome: "met", marketSalary: 0 }), null);
  assert.equal(extensionOffer({ salary: 3_000_000, yearsLeft: 1, outcome: "warning", marketSalary: 0 }), null);
  assert.equal(extensionOffer({ salary: 3_000_000, yearsLeft: 1, outcome: "exceeded", marketSalary: 0 })?.salary, 3_450_000);
  assert.equal(severancePay(4_000_000, 2), 4_000_000);
  assert.equal(poachChance("warning", 90), 0);
  assert.ok(poachChance("exceeded", 80) > poachChance("exceeded", 20));
  const teams = [10, 30, 50, 70, 90, 95].map((m, i) => ({ id: `t${i}`, marketAppeal: m }));
  assert.equal(interestedTeams(teams, 80).length, 6);
  assert.deepEqual(interestedTeams(teams, 10).map((t) => t.id), ["t0", "t1", "t2", "t3"]); // au moins 4 clubs
  // Achats : un seul logement (l'ancien revendu 60 %), garage limité, fonds.
  const a = purchase([], "apartment", 500_000);
  assert.ok(a.ok);
  const b = purchase(a.ok ? a.owned : [], "family_house", 1_000_000);
  assert.ok(b.ok && !b.owned.includes("apartment") && b.cashDelta === 270_000 - 1_200_000);
  assert.deepEqual(purchase([], "yacht", 1_000), { ok: false, error: "funds" });
  assert.deepEqual(purchase(["city_car", "sedan", "electric_suv", "sports_car"], "supercar", 1e9), { ok: false, error: "garage" });
  assert.equal(sell(["villa"], "villa")?.cashDelta, 3_600_000);
});

import { seriesTally } from "../../src/lib/careers/playoff-rules";

test("playoffs : la série crédite le vainqueur réel, à domicile comme à l'extérieur", () => {
  const series = { homeTeamId: "phi", awayTeamId: "bkn", bestOf: 7 };
  const g = (home: string, hs: number, away: string, as: number) => ({ homeTeamId: home, homeScore: hs, awayTeamId: away, awayScore: as });
  // 2-2-1-1-1 : les 76ers gagnent les 4 premiers, dont 2 à Brooklyn.
  const four = [g("phi", 110, "bkn", 100), g("phi", 105, "bkn", 99), g("bkn", 98, "phi", 112), g("bkn", 101, "phi", 120)];
  assert.deepEqual(seriesTally(series, four), { homeWins: 4, awayWins: 0, winnerTeamId: "phi", extraGames: 0 });
  // Victoires partagées.
  const split = [g("phi", 90, "bkn", 100), g("phi", 105, "bkn", 99), g("bkn", 98, "phi", 112), g("bkn", 121, "phi", 120)];
  assert.deepEqual(seriesTally(series, split), { homeWins: 2, awayWins: 2, winnerTeamId: null, extraGames: 0 });
  // Matchs de trop après la décision : ignorés.
  assert.equal(seriesTally(series, [...four, g("phi", 100, "bkn", 90)]).extraGames, 1);
});

import { finalsTotals, ownerMood, pickFinalsMvp, planEffects, shiftTier } from "../../src/lib/careers/offseason-rules";

test("fin de saison : MVP des Finales, cap annoncé, humeur de la direction", () => {
  const e = (playerId: string, teamId: string, points: number, rebounds = 5, assists = 3) => ({
    playerId, teamId, points, rebounds, assists, steals: 1, blocks: 0, turnovers: 2, minutesPlayed: 35,
  });
  const games = [
    [e("star", "phi", 30), e("big", "phi", 14, 14), e("opp", "bkn", 45)],
    [e("star", "phi", 28), e("big", "phi", 16, 12), e("opp", "bkn", 40)],
  ];
  const totals = finalsTotals(games, "phi");
  assert.equal(totals.length, 2); // joueurs du champion seulement
  assert.equal(pickFinalsMvp(totals)?.playerId, "star");
  assert.equal(pickFinalsMvp([]), null);
  assert.equal(shiftTier("rebuild", -1), "rebuild");
  assert.equal(shiftTier("playoffs", 1), "conf_semis");
  assert.equal(shiftTier("champion", 1), "champion");
  assert.deepEqual(planEffects("contend", "met"), { tierShift: 1, approval: 4 });
  assert.ok(planEffects("rebuild", "warning").approval > planEffects("rebuild", "met").approval);
  assert.equal(ownerMood("met", true), "delighted");
  assert.equal(ownerMood("warning", false), "concerned");
  assert.equal(ownerMood("fired", false), "furious");
  assert.equal(ownerMood("met", false, true), "lenient"); // sauvé par la confiance de la direction
});

import { retirementPlanned } from "../../src/lib/careers/aging-rules";

test("retraites : 40 ans au plus tard, vétérans en déclin avant, décision stable", () => {
  assert.equal(retirementPlanned({ age: 39, overallRating: 90 }, "a"), true);
  assert.equal(retirementPlanned({ age: 30, overallRating: 40 }, "a"), false);
  assert.equal(retirementPlanned({ age: 36, overallRating: 65 }, "a"), true); // 37 ans, plus le niveau
  assert.equal(retirementPlanned({ age: 34, overallRating: 55 }, "a"), true);
  // Stable pour une même graine.
  assert.equal(retirementPlanned({ age: 36, overallRating: 80 }, "x:y"), retirementPlanned({ age: 36, overallRating: 80 }, "x:y"));
  // Un vétéran encore fort de 37 ans continue le plus souvent.
  const keepGoing = Array.from({ length: 200 }, (_, i) => retirementPlanned({ age: 36, overallRating: 80 }, `s${i}`)).filter((r) => !r).length;
  assert.ok(keepGoing > 110 && keepGoing < 170, String(keepGoing));
});
