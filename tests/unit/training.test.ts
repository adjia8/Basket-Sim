import { test } from "node:test";
import assert from "node:assert/strict";
import { autoSession, sessionsBetween, summarizeSessions } from "../../src/lib/careers/training-calendar-rules";

test("modèle : récupération le lendemain d'un match, tactique la veille", () => {
  assert.equal(autoSession("balanced", 1, 3), "recovery");
  assert.equal(autoSession("balanced", 3, 3), "tactical");
  assert.equal(autoSession("light", 1, 1), "recovery");
});

test("back-to-back : aucune séance, donc repos", () => {
  const cal = { template: "balanced" as const, overrides: {} };
  assert.deepEqual(sessionsBetween(cal, new Date("2026-11-10T12:00:00Z"), 1), []);
  assert.deepEqual(summarizeSessions([], "high"), { focus: "rest", intensity: "low" });
});

test("les choix du GM priment sur le modèle, aux bonnes dates", () => {
  const cal = { template: "heavy" as const, overrides: { "2026-11-08": "physical" as const } };
  // Match le 10, précédent le 6 : jours libres 7, 8, 9.
  const s = sessionsBetween(cal, new Date("2026-11-10T12:00:00Z"), 4);
  assert.equal(s.length, 3);
  assert.equal(s[0], "recovery");
  assert.equal(s[1], "physical");
  assert.equal(s[2], "tactical");
});

test("résumé : axe dominant et intensité selon la charge", () => {
  const hard = summarizeSessions(["physical", "physical", "shooting"], "medium");
  assert.equal(hard.focus, "physical");
  assert.equal(hard.intensity, "high");
  const easy = summarizeSessions(["recovery", "tactical", "rest"], "medium");
  assert.equal(easy.focus, "tactical");
  assert.equal(easy.intensity, "low");
  // L'intensité choisie par le GM module la charge.
  assert.equal(summarizeSessions(["shooting", "defense"], "low").intensity, "medium");
  assert.equal(summarizeSessions(["shooting", "defense"], "high").intensity, "high");
});

test("semaine chargée plus douce qu'une semaine légère", () => {
  const cal = (template: "heavy" | "light") => ({ template, overrides: {} });
  const load = (t: "heavy" | "light") => summarizeSessions(sessionsBetween(cal(t), new Date("2026-11-20T12:00:00Z"), 6), "medium").intensity;
  const order = { low: 0, medium: 1, high: 2 };
  assert.ok(order[load("heavy")] < order[load("light")]);
});

import { planDays } from "../../src/lib/careers/training-calendar-rules";

test("affichage : jours de match repérés, séances du modèle et choix du GM", () => {
  const cal = { template: "balanced" as const, overrides: { "2026-11-12": "rest" as const } };
  const days = planDays(new Date("2026-11-10T12:00:00Z"), 5, ["2026-11-10", "2026-11-14"], cal);
  assert.deepEqual(days.map((d) => d.game), [true, false, false, false, true]);
  assert.equal(days[1].session, "recovery"); // lendemain de match
  assert.equal(days[2].session, "rest");
  assert.equal(days[2].custom, true);
  assert.equal(days[3].session, "tactical"); // veille de match
});

import { capMinutes, protocolAllowed, protocolRiskMultiplier, rushedRemaining } from "../../src/lib/careers/return-protocol-rules";

test("retour de blessure : accéléré plus tôt mais plus risqué, progressif plus sûr", () => {
  assert.equal(rushedRemaining(10), 7);
  assert.equal(rushedRemaining(1), 1);
  assert.ok(protocolRiskMultiplier("rushed", 3) > 1);
  assert.ok(protocolRiskMultiplier("progressive", 3) < 1);
  assert.equal(protocolRiskMultiplier("rushed", 0), 1);
  assert.equal(protocolAllowed("minor"), false);
  assert.equal(protocolAllowed("severe"), true);
});

test("plafond de minutes : l'excédent va aux autres, total inchangé", () => {
  const out = capMinutes(["a", "b", "c"], [10, 6, 4], (id) => (id === "a" ? 5 : undefined));
  assert.equal(out[0], 5);
  assert.ok(Math.abs(out.reduce((s, x) => s + x, 0) - 20) < 1e-9);
  assert.ok(out[1] > 6 && out[2] > 4);
});

import { effectiveMinutesCap, parseLoadPlan, planRests } from "../../src/lib/careers/load-plan-rules";

test("plan de charge : repos sur back-to-back et au-delà d'une usure, plafond le plus strict", () => {
  const plan = parseLoadPlan(JSON.stringify({ restOnBackToBacks: true, minutesLimit: 28, autoRestWear: 70 }))!;
  assert.equal(planRests(plan, { restDays: 1, wear: 10 }), true);
  assert.equal(planRests(plan, { restDays: 2, wear: 75 }), true);
  assert.equal(planRests(plan, { restDays: 2, wear: 40 }), false);
  assert.equal(effectiveMinutesCap(plan, 20), 20);
  assert.equal(effectiveMinutesCap(plan, null), 28);
  assert.equal(effectiveMinutesCap(null, null), null);
  // Valeurs hors liste ignorées, plan vide = pas de plan.
  assert.equal(parseLoadPlan(JSON.stringify({ minutesLimit: 7 })), null);
  assert.equal(planRests(null, { restDays: 0, wear: 99 }), false);
});

import { fatigueAtTipOff, fatigueGainForGame } from "../../src/lib/careers/fatigue-rules";
import { clampWear as clampWearT, wearGainForGame as wearGainT, wearRecovery as wearRecoveryT } from "../../src/lib/careers/wear-rules";

test("énergie au coup d'envoi : le repos compte avant le match", () => {
  // Fin de match à 40 de fatigue, 2 jours de repos : bien récupéré avant le suivant.
  assert.ok(fatigueAtTipOff(40, 2, 80) <= 10);
  // Back-to-back : récupère moins, jamais négatif.
  assert.ok(fatigueAtTipOff(40, 1, 80) > fatigueAtTipOff(40, 2, 80));
  assert.equal(fatigueAtTipOff(5, 3, 80), 0);
  // Usure élevée : récupération ralentie.
  assert.ok(fatigueAtTipOff(40, 1, 80, 50, 90) > fatigueAtTipOff(40, 1, 80, 50, 0));
});

test("usure d'une star sur une saison : reste sous le seuil de repos", () => {
  // 82 matchs, un back-to-back tous les ~6 matchs, 38 min, rythme rapide.
  let wear = 0;
  let fatigue = 0;
  let maxWear = 0;
  let minEnergy = 100;
  for (let g = 0; g < 82; g++) {
    const rest = g % 6 === 5 ? 1 : 2;
    const tip = fatigueAtTipOff(fatigue, rest, 85, 50, wear);
    minEnergy = Math.min(minEnergy, 100 - tip);
    wear = clampWearT(wear - wearRecoveryT(rest, false, 50, wear) + wearGainT(38, rest, 85, "medium") * 1.12);
    fatigue = Math.min(99, tip + fatigueGainForGame(85) * 1.12 + 3);
    maxWear = Math.max(maxWear, wear);
  }
  assert.ok(maxWear <= 60, `usure max ${maxWear}`);
  assert.ok(minEnergy >= 85, `énergie min ${minEnergy}`);
});
