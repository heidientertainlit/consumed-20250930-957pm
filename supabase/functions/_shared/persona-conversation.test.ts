import { test } from "node:test";
import assert from "node:assert/strict";
import { conversationPrompt, validateConversation, validateRoster } from "./persona-conversation.ts";

const a = "22222222-2222-4222-8222-222222222222", b = "33333333-3333-4333-8333-333333333333";
const messages = () => [
  { client_id: "m0", participant_id: a, parent_client_id: null, body: "A question", offset_seconds: 0 },
  { client_id: "m1", participant_id: b, parent_client_id: "m0", body: "A response", offset_seconds: 60 },
  { client_id: "m2", participant_id: a, parent_client_id: "m1", body: "Returning response", offset_seconds: 300 },
];
test("returning personas, top-level and nested graph, exact roster", () => {
  assert.equal(validateConversation(messages(), [a, b], a, 3).length, 3);
  assert.throws(() => validateRoster([a, a], a));
  assert.throws(() => validateRoster([a, b], "foreign"));
});
test("unselected author, foreign parent, cycles and simultaneous arrivals rejected", () => {
  for (const patch of [{ participant_id: "foreign" }, { parent_client_id: "m2" }, { offset_seconds: 0 }, { client_id: "m0" }]) {
    const msgs = messages(); Object.assign(msgs[1], patch);
    assert.throws(() => validateConversation(msgs, [a, b], a));
  }
});
test("root author/offset cannot change; public mappings cannot be injected", () => {
  const msgs = messages(); msgs[0].participant_id = b;
  assert.throws(() => validateConversation(msgs, [a, b], a));
  const clean = validateConversation(messages().map(m => ({ ...m, public_id: "fake", delivered_at: "fake" })), [a, b], a);
  assert.equal(clean[0].public_id, undefined);
});
test("conversation prompt binds subject, evidence, JSON contract and unchanged identity", () => {
  const config = { tone: "warm", interests: ["books"], favorite_media: ["Not the selected subject"] };
  const before = JSON.stringify(config);
  const prompt = conversationPrompt({ topic: "Chosen book", angle: "pacing", context: "", subject: { title: "Chosen book", externalId: "exact" },
    provenance: [], personas: [{ id: a, user_name: "fictional", display_name: "A", persona_config: config }],
    opening: a, count: 3, durationSeconds: 300, maxWords: 60 });
  assert.match(prompt[0].content, /JSON/);
  assert.match(prompt[0].content, /Never switch to persona favorites/);
  assert.equal(JSON.parse(prompt[1].content).verifiedSubject.externalId, "exact");
  assert.equal(JSON.stringify(config), before);
});
