import { test } from "node:test";
import assert from "node:assert/strict";
import {
  categoryOf,
  defaultPriority,
  injuryPriority,
  sortMessages,
  withDigests,
  type InboxPriority,
} from "../../src/lib/careers/inbox-priority-rules";

const msg = (id: string, priority: InboxPriority, unread: boolean, date: string) => ({ id, priority, unread, date });

test("boîte de réception : urgents non lus épinglés en tête, puis le plus récent", () => {
  const sorted = sortMessages([
    msg("info-new", "info", true, "2026-12-10"),
    msg("urgent-old", "urgent", true, "2026-12-01"),
    msg("read-recent", "urgent", false, "2026-12-12"),
    msg("important", "important", true, "2026-12-11"),
  ]);
  assert.deepEqual(sorted.map((m) => m.id), ["urgent-old", "important", "info-new", "read-recent"]);
});

test("boîte de réception : les infos d'une même journée sont regroupées", () => {
  const sorted = sortMessages([
    msg("u", "urgent", true, "2026-12-10T00:00:00Z"),
    msg("a", "info", true, "2026-12-10T00:00:00Z"),
    msg("b", "info", true, "2026-12-10T00:00:00Z"),
    msg("c", "info", false, "2026-12-10T00:00:00Z"),
    msg("d", "info", true, "2026-12-09T00:00:00Z"),
  ]);
  const rows = withDigests(sorted);
  const digest = rows.find((r) => r.kind === "digest");
  assert.ok(digest && digest.kind === "digest" && digest.messages.length === 3);
  assert.equal(rows.filter((r) => r.kind === "digest").length, 1);
  assert.ok(rows.some((r) => r.kind === "message" && r.message.id === "d"), "une info isolée reste visible");
  assert.equal(rows[0].kind === "message" && rows[0].message.id, "u");
});

test("boîte de réception : importance et catégories par type", () => {
  assert.equal(injuryPriority("severe", 30, 50), "urgent");
  assert.equal(injuryPriority("moderate", 12, 80), "urgent");
  assert.equal(injuryPriority("moderate", 4, 40), "important");
  assert.equal(injuryPriority("minor", 2, 40), "info");
  assert.equal(defaultPriority("player_request"), "urgent");
  assert.equal(defaultPriority("trade_request"), "urgent");
  assert.equal(defaultPriority("standings"), "info");
  assert.equal(categoryOf("injury"), "medical");
  assert.equal(categoryOf("trade_offer"), "transfers");
  assert.equal(categoryOf("press_review"), "press");
  assert.equal(categoryOf("cup"), "competitions");
  assert.equal(categoryOf("staff"), "board");
});

// ---------------------------------------------------------------------------
// Infirmerie de la ligue

import { estimatedReturn, injuryTier, isNotableInjury, sortInjured } from "../../src/lib/careers/injury-report-rules";

test("infirmerie : les joueurs importants d'abord, puis les absences les plus longues", () => {
  assert.equal(injuryTier(88, 70), "star");
  assert.equal(injuryTier(70, 85), "star");
  assert.equal(injuryTier(77, 50), "starter");
  assert.equal(injuryTier(68, 40), "role");
  const sorted = sortInjured([
    { id: "role-long", tier: "role" as const, gamesRemaining: 40, overall: 65 },
    { id: "star-short", tier: "star" as const, gamesRemaining: 2, overall: 90 },
    { id: "starter", tier: "starter" as const, gamesRemaining: 5, overall: 78 },
    { id: "star-long", tier: "star" as const, gamesRemaining: 20, overall: 84 },
  ]);
  assert.deepEqual(sorted.map((p) => p.id), ["star-long", "star-short", "starter", "role-long"]);
});

test("infirmerie : blessure notable = star absente longtemps ; retour estimé d'après le calendrier", () => {
  assert.ok(isNotableInjury({ overall: 90, renown: 90, severity: "moderate", gamesOut: 10 }));
  assert.ok(isNotableInjury({ overall: 84, renown: 60, severity: "severe", gamesOut: 3 }));
  assert.ok(!isNotableInjury({ overall: 90, renown: 90, severity: "minor", gamesOut: 2 }));
  assert.ok(!isNotableInjury({ overall: 72, renown: 50, severity: "severe", gamesOut: 30 }));
  const dates = ["2026-12-01", "2026-12-03", "2026-12-05"];
  assert.equal(estimatedReturn(dates, 0), "2026-12-01");
  assert.equal(estimatedReturn(dates, 2), "2026-12-05");
  assert.equal(estimatedReturn(dates, 3), null); // saison terminée avant
});
