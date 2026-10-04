import test from "node:test";
import assert from "node:assert/strict";
import { buildPremisePrompt, premiseContext, premiseStateContradictions, generatePremise } from "./persona-premise.ts";
import { buildWritingPrompt, deriveSocialVoice, DEFAULT_MODE_WEIGHTS, parseGenerationNotes, POST_MODES, type Persona } from "./persona-generation.ts";
import { generatePersonaBatch } from "./persona-generation-engine.ts";
import { DEFAULT_INTENT_WEIGHTS, type IntentAssignment } from "./persona-post-intents.ts";

const persona: Persona = { id: "p", user_name: "p", display_name: "Person", persona_config: { bio: "Likes books.", social_voice: { questionFrequency: "frequent" } } };
const media = { title: "A book", type: "book", source: "Discovery" as const, fit: 1, externalId: "verified-book", externalSource: "googlebooks", description: "SYNOPSIS_SENTINEL", genres: ["Fantasy"] };
const assignment: IntentAssignment = { intent: "reaction", intentLabel: "Reaction", reason: "test", consumption: { state: "finished", source: "supplied" }, context: { people: [{ name: "CAST_SENTINEL", kind: "performer" }], moments: ["MOMENT_SENTINEL"] } };

test("premise input uses identity, media, state and intent; no synopsis, mode, rating or full cast", () => {
  const prompt = buildPremisePrompt(persona, media, assignment);
  const input = JSON.parse(prompt[1].content);
  assert.equal(input.state.state, "finished");
  assert.equal(input.intent, "reaction");
  assert.deepEqual(input.media.genres, ["Fantasy"]);
  assert.deepEqual(input.supportedContext, {});
  for (const absent of ["SYNOPSIS_SENTINEL", "CAST_SENTINEL", "questionFrequency", "author_style", "Typing mode", "Authoritative rating"]) assert.ok(!JSON.stringify(prompt).includes(absent), absent);
  assert.ok(prompt[0].content.includes("Return only JSON"));
  assert.deepEqual(premiseContext({ ...assignment, intent: "moment" }), { moments: ["MOMENT_SENTINEL"] });
  assert.equal(premiseContext({ ...assignment, intent: "character" }).people![0].name, "CAST_SENTINEL");
});

test("all writer modes receive the premise and soft upper bound without question-frequency or composition prompting", () => {
  for (const mode of POST_MODES) {
    const prompt = buildWritingPrompt(persona, media, mode.id, deriveSocialVoice(persona.persona_config), null, [], [], undefined, assignment, "She is annoyed she enjoyed it.");
    const full = JSON.stringify(prompt);
    assert.ok(full.includes("She is annoyed she enjoyed it."));
    assert.ok(full.includes(`Approximate upper bound: ${mode.words[1]} words`));
    for (const absent of ["questionFrequency", "SYNOPSIS_SENTINEL", "CAST_SENTINEL", "two to four", "genuinely wants answered.\\nAuthoritative"]) assert.ok(!full.includes(absent), absent);
    assert.ok(full.includes("Do not invent a different central thought"));
  }
});

test("one premise call precedes writing and is unchanged across existing repairs; metadata retains it", async () => {
  const phases: string[] = [], writerPrompts: string[] = [];
  const original = JSON.stringify(persona.persona_config);
  const result = await generatePersonaBatch({
    personas: [persona], postsPerPersona: 1, weights: DEFAULT_MODE_WEIGHTS, intentWeights: DEFAULT_INTENT_WEIGHTS,
    recent: [], candidates: new Map([[persona.id, [media]]]), random: () => .5,
    chat: async messages => {
      if (messages[0].content.startsWith("Choose one concrete premise")) { phases.push("premise"); return '{"premise":"She is annoyed she enjoyed it."}'; }
      if (messages[1].content.includes('"task":"narrow_intent_validation"')) { phases.push("validation"); return '{"issues":[]}'; }
      phases.push("writer"); writerPrompts.push(messages[1].content);
      return writerPrompts.length === 1 ? '{"content":' : '{"content":"annoyed that I enjoyed this"}';
    },
  });
  assert.equal(result.drafts.length, 1, result.errors.join(";"));
  assert.deepEqual(phases, ["premise", "writer", "writer", "validation"]);
  for (const prompt of writerPrompts) assert.ok(prompt.includes('Concrete premise: "She is annoyed she enjoyed it."'));
  assert.equal(parseGenerationNotes(result.drafts[0].ai_notes)!.premise, "She is annoyed she enjoyed it.");
  assert.equal(JSON.stringify(persona.persona_config), original);
});

test("malformed premise fails explicitly without another premise call or an invented fallback", async () => {
  let calls = 0;
  const result = await generatePersonaBatch({
    personas: [persona], postsPerPersona: 1, weights: DEFAULT_MODE_WEIGHTS, recent: [],
    candidates: new Map([[persona.id, [media]]]), random: () => .5,
    chat: async () => { calls++; return '{"content":"not a premise"}'; },
  });
  assert.equal(calls, 1);
  assert.equal(result.drafts.length, 0);
  assert.match(result.errors[0], /Premise generation returned no meaning/);
});

test("premises reject obvious completion/state contradictions, including an upcoming finale after finishing", () => {
  for (const [state, premise] of [
    ["finished", "I'm so emotionally invested in this season, I can't believe the finale is next!"],
    ["finished", "I haven't finished it yet."],
    ["finished", "She still has chapters left."],
    ["finished", "I've never seen this."],
    ["not_started", "I just finished watching it."],
    ["starting", "After finishing it, I'm relieved."],
    ["in_progress", "I just finished reading it."],
    ["revisiting", "I've never read this."],
    ["dropped", "I've never seen it."],
  ] as const) assert.ok(premiseStateContradictions(premise, { ...assignment, consumption: { state, source: "supplied" } }).length, `${state}: ${premise}`);
  for (const premise of [
    "The finale was satisfying.",
    "I want another book that makes me feel the same way.",
    "I want to rewatch this tomorrow.",
    "I'm not finished thinking about this.",
  ]) assert.deepEqual(premiseStateContradictions(premise, assignment), []);
  assert.deepEqual(premiseStateContradictions("The finale is next.", { ...assignment, consumption: { state: "in_progress", source: "supplied" } }), []);
  assert.ok(buildPremisePrompt(persona, media, assignment)[0].content.includes("finished means the experience is complete"));
});

test("a contradictory premise fails before writing without retrying or changing the assigned state", async () => {
  let calls = 0;
  await assert.rejects(generatePremise(async () => { calls++; return '{"premise":"The finale is next!"}'; }, persona, media, assignment), /Premise\/state mismatch/);
  assert.equal(calls, 1);
  assert.equal(assignment.consumption.state, "finished");
});