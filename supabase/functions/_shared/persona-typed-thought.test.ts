import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { buildWritingPrompt, DEFAULT_MODE_WEIGHTS, deriveSocialVoice, POST_MODES, type Persona } from "./persona-generation.ts";
import { generatePersonaBatch } from "./persona-generation-engine.ts";
import { planPostIntent, DEFAULT_INTENT_WEIGHTS, buildIntentValidationPrompt } from "./persona-post-intents.ts";

const persona: Persona = { id: "p", user_name: "alex_thompson", display_name: "Alex Thompson", persona_config: { generation_feedback: ["Keep my supplied preference."] } };
const media = { title: "Known Movie", type: "movie", source: "Discovery" as const, fit: 1, externalId: "123", externalSource: "tmdb" };
const check = "Does this sound like someone typed a thought, or like someone wrote content?";
test("all assembled writer messages explicitly request JSON for the provider's JSON-object mode", () => {
  for (const mode of POST_MODES) {
    for (const failure of [undefined, "Malformed JSON."]) {
      const prompt = buildWritingPrompt(persona, media, mode.id, deriveSocialVoice({}), null, [], [], failure);
      assert.ok(prompt.some(message => message.content.includes('Return only JSON: {"content":"…"}')));
    }
  }
});
test("writer receives the approved typed-thought contract, one hint and no audience/composition/batch targets", () => {
  const assignment = planPostIntent(persona, media, DEFAULT_INTENT_WEIGHTS, [], [], () => .5);
  for (const mode of POST_MODES) {
    const prompt = buildWritingPrompt(persona, media, mode.id, deriveSocialVoice({}), null,
      [{ personaId: "other", mediaKey: "other", mode: "thoughtful", words: 30, caps: true, content: "OTHER AUTHOR SENTINEL" }],
      [{ personaId: "other", title: "Other", type: "movie", content: "RECENT SENTINEL" }], undefined, assignment);
    const full = prompt.map(m => m.content).join("\n");
    assert.ok(full.includes(check));
    assert.ok(full.includes("SIMULATE WHAT THIS PERSON TYPED"));
    assert.ok(full.includes(`Typing mode: ${mode.id}.`));
    assert.ok(full.includes("Keep my supplied preference."));
    for (const removed of ["Conversation starter", "inviting other people's opinions", "Approximate target", "Recent batch shapes", "Recent intents:", "Discourage already-used", "OTHER AUTHOR SENTINEL", "RECENT SENTINEL", "Emotional stance:", "Final register check:", "two to four"]) assert.ok(!full.includes(removed), removed);
    assert.ok(full.includes("Assigned consumption state"));
    assert.ok(full.includes("Supported specific context"));
    assert.ok(full.includes("No additional biography"));
    assert.ok(full.includes("No rating language or numerical scores"));
    assert.ok(full.includes("Never return empty content without a rating"));
  }
  assert.equal(POST_MODES.find(m => m.id === "question")!.label, "Conversation starter"); // Metadata/mode system not retuned.
});
test("a retry requests only correction of the supplied failure, without a register rewrite", () => {
  const prompt = buildWritingPrompt(persona, media, "casual", deriveSocialVoice({}), 4, [], [], "Malformed JSON.");
  assert.ok(prompt[1].content.includes("Correct only this failure"));
  assert.ok(!prompt[1].content.includes("underlying thought/register"));
  assert.ok(prompt[1].content.includes("{{rating}}"));
  assert.ok(prompt[1].content.includes("{{rating_words}}"));
});
test("typed-thought check stays writer-only; ordinary valid output gets no style retry or extra pass", async () => {
  const assignment = planPostIntent(persona, media, DEFAULT_INTENT_WEIGHTS, [], [], () => .5);
  const validation = buildIntentValidationPrompt("fine", assignment, media, null, persona);
  assert.ok(!JSON.stringify(validation).includes(check));
  assert.ok(validation[0].content.includes("Do NOT judge"));
  let writers = 0, validators = 0;
  const result = await generatePersonaBatch({ personas: [persona], postsPerPersona: 1, weights: DEFAULT_MODE_WEIGHTS,
    recent: [], candidates: new Map([[persona.id, [media]]]), random: () => .99,
    chat: async messages => {
      if (messages[0].content.startsWith("Choose one concrete premise")) return '{"premise":"They think it is fine."}';
      if (messages[1].content.includes('"task":"narrow_intent_validation"')) {
        validators++; assert.ok(!JSON.stringify(messages).includes(check)); return '{"issues":[]}';
      }
      writers++; assert.ok(messages[0].content.includes(check)); return '{"content":"fine"}';
    },
  });
  assert.equal(result.drafts.length, 1, result.errors.join(";"));
  assert.equal(result.drafts[0].content, "fine");
  assert.equal(writers, 1); assert.equal(validators, 1);
  assert.ok(!fs.readFileSync("supabase/functions/_shared/persona-generation-engine.ts", "utf8").includes(check));
});