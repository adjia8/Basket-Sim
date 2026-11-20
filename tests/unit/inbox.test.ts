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
