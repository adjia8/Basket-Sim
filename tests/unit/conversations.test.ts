import { test } from "node:test";
import assert from "node:assert/strict";
import {
  availableTopics,
  conversationOutcome,
  type ConversationContext,
} from "../../src/lib/careers/player-conversation-rules";

const base: ConversationContext = {
  personality: { professionalism: 10, ambition: 10, loyalty: 10, temperament: 10, leadership: 10 },
  age: 26,
  morale: 60,
  status: "rotation",
  canPromiseMoreMinutes: true,
  underExpectedMinutes: false,
  wantsTrade: false,
  hasActivePromise: false,
  recentIncident: false,
  recentGoodForm: false,
};
const mid = () => 0.5; // sans bruit

test("sujets proposés selon la situation du joueur", () => {
  assert.ok(!availableTopics(base).includes("convince_stay"));
  const unhappy = availableTopics({ ...base, wantsTrade: true, underExpectedMinutes: true });
  assert.ok(unhappy.includes("convince_stay") && unhappy.includes("promise_trade") && unhappy.includes("patience"));
  assert.ok(!availableTopics({ ...base, wantsTrade: true, hasActivePromise: true }).includes("promise_trade"));
  assert.ok(!availableTopics({ ...base, status: "bench" }).includes("less_minutes"));
});

test("promettre des minutes : bonne nouvelle et promesse enregistrée", () => {
  const o = conversationOutcome("more_minutes", "encouraging", base, mid);
  assert.ok(o.moraleDelta > 0);
  assert.equal(o.effect, "promise_minutes");
});

test("rétrograder : un professionnel fidèle l'accepte, un ambitieux se fâche et veut partir", () => {
  const pro = conversationOutcome("less_minutes", "calm", { ...base, personality: { ...base.personality, professionalism: 16, loyalty: 16 } }, mid);
  assert.ok(pro.moraleDelta >= 0, pro.reaction);
  const ambitious = conversationOutcome("less_minutes", "firm", { ...base, personality: { ...base.personality, ambition: 18, temperament: 4 } }, mid);
  assert.equal(ambitious.reaction, "angry");
  assert.equal(ambitious.effect, "trade_request");
});

test("convaincre de rester : la loyauté et le moral décident", () => {
  const loyal = conversationOutcome("convince_stay", "calm", { ...base, wantsTrade: true, personality: { ...base.personality, loyalty: 18 } }, mid);
  assert.equal(loyal.effect, "clear_trade_request");
  const mercenary = conversationOutcome("convince_stay", "calm", { ...base, wantsTrade: true, morale: 30, personality: { ...base.personality, loyalty: 3 } }, mid);
  assert.notEqual(mercenary.effect, "clear_trade_request");
});

test("recadrer : juste après un incident, ça passe chez un pro ; un sanguin le prend mal sauf avec calme", () => {
  const pro = conversationOutcome("discipline", "firm", { ...base, recentIncident: true, personality: { ...base.personality, professionalism: 16 } }, mid);
  assert.ok(pro.moraleDelta > 0);
  const hotFirm = conversationOutcome("discipline", "firm", { ...base, recentIncident: true, personality: { ...base.personality, temperament: 3 } }, mid);
  const hotCalm = conversationOutcome("discipline", "calm", { ...base, recentIncident: true, personality: { ...base.personality, temperament: 3 } }, mid);
  assert.ok(hotFirm.moraleDelta < hotCalm.moraleDelta);
  // Sans incident, le recadrage est vécu comme injuste.
  assert.ok(conversationOutcome("discipline", "firm", base, mid).moraleDelta < 0);
});

test("féliciter après une bonne série fait plaisir", () => {
  assert.ok(conversationOutcome("praise", "encouraging", { ...base, recentGoodForm: true }, mid).moraleDelta > 0);
});

import { ignoredLeadsToTradeRequest, requestTrigger, type RequestContext } from "../../src/lib/careers/player-request-rules";

const req: RequestContext = {
  personality: { professionalism: 10, ambition: 10, loyalty: 10, temperament: 10, leadership: 10 },
  morale: 60,
  underExpectedMinutes: false,
  contractYearsLeft: 3,
  extensionEligible: false,
  rookieScale: false,
};

test("demandes : un joueur sans motif ne vient jamais", () => {
  for (let i = 0; i < 200; i++) assert.equal(requestTrigger(req), null);
});

test("demandes : le motif le plus pressant passe d'abord, l'ambitieux vient plus vite", () => {
  assert.equal(requestTrigger({ ...req, morale: 20, underExpectedMinutes: true }, () => 0), "support");
  assert.equal(requestTrigger({ ...req, underExpectedMinutes: true }, () => 0), "minutes");
  assert.equal(requestTrigger({ ...req, contractYearsLeft: 1, extensionEligible: true }, () => 0), "contract");
  assert.equal(requestTrigger({ ...req, contractYearsLeft: 1, extensionEligible: true, rookieScale: true }, () => 0), null);
  const count = (c: RequestContext) => Array.from({ length: 4000 }, () => requestTrigger(c)).filter(Boolean).length;
  const calm = count({ ...req, underExpectedMinutes: true, personality: { ...req.personality, professionalism: 17 } });
  const eager = count({ ...req, underExpectedMinutes: true, personality: { ...req.personality, ambition: 18, temperament: 4 } });
  assert.ok(eager > calm * 1.5, `${eager} vs ${calm}`);
  assert.equal(ignoredLeadsToTradeRequest({ ...req.personality, ambition: 17 }), true);
});

test("répondre à sa demande : il apprécie d'être écouté", () => {
  const plain = conversationOutcome("patience", "calm", { ...base, underExpectedMinutes: true }, mid);
  const answered = conversationOutcome("patience", "calm", { ...base, underExpectedMinutes: true, answeringRequest: true }, mid);
  assert.ok(answered.moraleDelta > plain.moraleDelta, `${answered.reaction} vs ${plain.reaction}`);
});
