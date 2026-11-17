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
