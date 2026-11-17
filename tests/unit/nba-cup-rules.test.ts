import { test } from "node:test";
import assert from "node:assert/strict";
import {
  NBA_CUP_GROUPS_2026,
  allStarBreakDays,
  allStarGameDate,
  conferenceQualifiers,
  cupCalendar,
  drawCupGroups,
  groupRounds,
  groupStandings,
  reservedCalendarDays,
} from "../../src/lib/careers/nba-cup-rules";

const day = (d: Date) => d.toISOString().slice(0, 10);

test("calendrier officiel de la NBA Cup 2026", () => {
  const c = cupCalendar("2026-2027");
  assert.deepEqual(c.groupNights.map(day), ["2026-10-30", "2026-11-06", "2026-11-13", "2026-11-20", "2026-11-27"]);
  assert.deepEqual(c.quarterfinals.map(day), ["2026-12-04", "2026-12-05"]);
  assert.deepEqual(c.semifinals.map(day), ["2026-12-08", "2026-12-09"]);
  assert.equal(day(c.final), "2026-12-11");
});

test("All-Star Game 2027 le 21 février, pause du vendredi au mercredi", () => {
  assert.equal(day(allStarGameDate("2026-2027")), "2027-02-21");
  assert.deepEqual(allStarBreakDays("2026-2027").map(day), [
    "2027-02-19", "2027-02-20", "2027-02-21", "2027-02-22", "2027-02-23", "2027-02-24",
  ]);
  assert.equal(reservedCalendarDays("2026-2027").has("2027-02-21"), true);
});

test("groupes 2026 : 30 équipes distinctes, 6 groupes de 5", () => {
  const all = Object.values(NBA_CUP_GROUPS_2026).flat();
  assert.equal(Object.keys(NBA_CUP_GROUPS_2026).length, 6);
  assert.equal(new Set(all).size, 30);
});

test("un groupe de 5 : 4 matchs par équipe, chaque adversaire une fois, jamais deux matchs le même soir", () => {
  const rounds = groupRounds(["a", "b", "c", "d", "e"]);
  assert.equal(rounds.length, 5);
  const games = new Map<string, number>();
  const pairs = new Set<string>();
  for (const round of rounds) {
    const seen = new Set<string>();
    for (const [h, a] of round) {
      assert.ok(!seen.has(h) && !seen.has(a));
      seen.add(h);
      seen.add(a);
      games.set(h, (games.get(h) ?? 0) + 1);
      games.set(a, (games.get(a) ?? 0) + 1);
      pairs.add([h, a].sort().join());
    }
  }
  assert.deepEqual([...games.values()], [4, 4, 4, 4, 4]);
  assert.equal(pairs.size, 10);
});

test("départage : confrontation directe à deux, puis différence de points", () => {
  const h2h = groupStandings(["a", "b"], [{ homeTeamId: "a", awayTeamId: "b", homeScore: 100, awayScore: 101 }]);
  assert.equal(h2h[0].teamId, "b");
  const threeWay = groupStandings(["a", "b", "c"], [
    { homeTeamId: "a", awayTeamId: "b", homeScore: 100, awayScore: 90 },
    { homeTeamId: "b", awayTeamId: "c", homeScore: 120, awayScore: 90 },
    { homeTeamId: "c", awayTeamId: "a", homeScore: 110, awayScore: 100 },
  ]);
  assert.deepEqual(threeWay.map((r) => r.teamId), ["b", "a", "c"]);
});

test("qualifiés : 3 premiers de groupe classés entre eux, puis le meilleur deuxième", () => {
  const row = (teamId: string, wins: number, pointDiff: number) => ({ teamId, wins, losses: 4 - wins, pointDiff, pointsFor: 400 });
  const q = conferenceQualifiers([
    [row("a1", 4, 30), row("a2", 3, 20)],
    [row("b1", 3, 10), row("b2", 3, 5)],
    [row("c1", 4, 10), row("c2", 2, 0)],
  ]);
  assert.deepEqual(q.map((r) => r.teamId), ["a1", "c1", "b1", "a2"]);
});

test("tirage par chapeaux : une équipe de chaque chapeau par groupe", () => {
  const groups = drawCupGroups({ east: "ABCDEFGHIJKLMNO".split(""), west: "abcdefghijklmno".split("") }, () => 0.5);
  for (const teams of Object.values(groups)) assert.equal(teams.length, 5);
  const pots = (t: string) => Math.floor("ABCDEFGHIJKLMNO".indexOf(t) / 3);
  assert.deepEqual(groups["Est A"].map(pots), [0, 1, 2, 3, 4]);
});
