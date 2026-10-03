import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { SEEDED_AUTHOR_STYLES, AUTHOR_STYLE_OPTIONS, resolveAuthorStyle } from "./persona-author-style.ts";
import { repairDisallowedEmoji } from "./persona-emoji-repair.ts";
import { buildWritingPrompt, deriveSocialVoice, DEFAULT_MODE_WEIGHTS, parseGenerationNotes, type Persona } from "./persona-generation.ts";
import { generatePersonaBatch } from "./persona-generation-engine.ts";
import { PERSONAL_SOCIAL_REGISTER } from "./persona-writing-instructions.ts";

const media = { title: "Known title", type: "movie", source: "Discovery" as const, fit: 1 };
const persona = (name: string): Persona => ({ id: "real-database-uuid", user_name: name, display_name: name, persona_config: {} });

test("all ten intentional profiles resolve by username, not UUID; no guessed profile for others", () => {
  assert.equal(Object.keys(SEEDED_AUTHOR_STYLES).length, 10);
  for (const name of Object.keys(SEEDED_AUTHOR_STYLES)) {
    const style = resolveAuthorStyle(persona(name))!;
    assert.deepEqual(style, SEEDED_AUTHOR_STYLES[name]);
    assert.equal(Object.keys(style).length, Object.keys(AUTHOR_STYLE_OPTIONS).length + 1);
    assert.equal(style.principles.length, 2);
  }
  assert.equal(resolveAuthorStyle(persona("uncurated")), null);
  assert.equal(resolveAuthorStyle(persona("constructor")), null);
});
test("partial saved author overrides win without altering social voice or seed defaults", () => {
  const p = persona("alex_thompson");
  p.persona_config.social_voice = { energy: "expressive", preferredModeWeights: { ...DEFAULT_MODE_WEIGHTS } };
  const before = deriveSocialVoice(p.persona_config);
  p.persona_config.author_style = { certainty: "tentative", principles: ["An explicitly saved behavioral principle."] };
  const style = resolveAuthorStyle(p)!;
  assert.equal(style.certainty, "tentative");
  assert.equal(style.directness, "blunt");
  assert.deepEqual(style.principles, p.persona_config.author_style.principles);
  assert.deepEqual(deriveSocialVoice(p.persona_config), before);
  assert.equal(SEEDED_AUTHOR_STYLES.alex_thompson.certainty, "declarative");
  style.principles.push("Must not mutate the defaults.");
  assert.equal(SEEDED_AUTHOR_STYLES.alex_thompson.principles.length, 2);
});
test("uncurated identities support a full explicit profile; invalid overrides fail explicitly", () => {
  const p = persona("uncurated");
  p.persona_config.author_style = { ...SEEDED_AUTHOR_STYLES.nick };
  assert.deepEqual(resolveAuthorStyle(p), SEEDED_AUTHOR_STYLES.nick);
  p.persona_config.author_style = { certainty: "tentative" };
  assert.throws(() => resolveAuthorStyle(p), /Invalid or missing/);
  p.persona_config.author_style = { ...SEEDED_AUTHOR_STYLES.nick, certainty: "guessed" as any };
  assert.throws(() => resolveAuthorStyle(p), /certainty/);
  p.persona_config.author_style = { ...SEEDED_AUTHOR_STYLES.nick, examples: ["Do not automatically inject prose."] } as any;
  assert.throws(() => resolveAuthorStyle(p), /Unknown/);
});
test("all checked-in test personas receive author principles, never their example prose", () => {
  const source = fs.readFileSync("supabase/functions/setup-personas/index.ts", "utf8");
  const seeded = vm.runInNewContext(`(${source.match(/const personas = (\[[\s\S]*?\n\]);/)![1]})`);
  for (const seed of seeded.filter((p: any) => Object.hasOwn(SEEDED_AUTHOR_STYLES, p.username))) {
    const { username, display_name, ...config } = seed;
    const p = { id: "uuid", user_name: username, display_name, persona_config: config };
    const prompt = buildWritingPrompt(p, media, "casual", deriveSocialVoice(config), null, [], []);
    const system = prompt[0].content;
    assert.ok(system.includes("PERSONA AUTHOR STYLE"));
    for (const principle of resolveAuthorStyle(p)!.principles) assert.ok(system.includes(principle));
    for (const example of config.style_examples) assert.ok(!prompt.some(m => m.content.includes(example.content)));
    assert.ok(system.includes("not a checklist"));
    assert.ok(system.includes("Ordinary") || system.includes("ordinary"));
  }
});
test("same media and mode reach distinct author styles without changing the assignment", () => {
  const prompt = (name: string) => {
    const p = persona(name);
    return buildWritingPrompt(p, media, "casual", deriveSocialVoice({}), null, [], []);
  };
  const a = prompt("alex_thompson"), b = prompt("reedreads");
  assert.equal(a[1].content, b[1].content);
  assert.notEqual(a[0].content, b[0].content);
  assert.ok(a[0].content.includes('"certainty":"declarative"'));
  assert.ok(b[0].content.includes('"certainty":"tentative"'));
  assert.ok(PERSONAL_SOCIAL_REGISTER.length < 1800);
  for (const phrase of ["named people, scenes, episodes, quotes, credits", "spoiler details", "No additional biography", "Emoji setting"]) assert.ok(a[0].content.includes(phrase));
});
test("emoji-only repair handles flags, modifiers, ZWJ, keycaps and pictographs without touching prose", () => {
  const text = "Still good. 🚫 👩🏽‍💻 🇺🇸 1️⃣ ❤️ 🌟\n© 2026 ™ ® 3.5/5";
  const repair = repairDisallowedEmoji(text, "none")!;
  assert.deepEqual(repair.removed, ["🚫", "👩🏽‍💻", "🇺🇸", "1️⃣", "❤️", "🌟"]);
  assert.equal(repair.repaired, "Still good.      \n© 2026 ™ ® 3.5/5");
  assert.equal(repair.original, text);
  assert.equal(repairDisallowedEmoji(repair.repaired, "none"), null);
  assert.equal(repairDisallowedEmoji(text, "low"), null);
  assert.equal(repairDisallowedEmoji("Plain 5/5, #1, *good*.", "none"), null);
  assert.equal(repairDisallowedEmoji("©️®️™️", "none")!.repaired, "");
});
test("Jurassic Park emoji regression: one local repair, no extra writer or validator and unchanged words", async () => {
  const p = persona("alex_thompson");
  let writers = 0, validators = 0;
  const result = await generatePersonaBatch({
    personas: [p], postsPerPersona: 1, weights: DEFAULT_MODE_WEIGHTS, recent: [],
    candidates: new Map([[p.id, [media]]]), random: () => .5,
    chat: async messages => {
      if (messages[1].content.includes('"task":"narrow_intent_validation"')) {
        validators++;
        assert.ok(messages[1].content.includes("Still amazed by the T. rex scene every time. "));
        assert.ok(!messages[1].content.includes("🚫"));
        return '{"issues":[]}';
      }
      writers++;
      return '{"content":"Still amazed by the T. rex scene every time. 🚫"}';
    },
  });
  assert.equal(result.drafts.length, 1, result.errors.join(";"));
  assert.equal(result.drafts[0].content, "Still amazed by the T. rex scene every time. ");
  assert.equal(writers, 1);
  assert.equal(validators, 1);
  const meta = parseGenerationNotes(result.drafts[0].ai_notes)!;
  assert.equal(meta.emojiRepairs!.length, 1);
  assert.equal(meta.styleWarnings!.length, 1);
  assert.deepEqual(meta.authorStyle, SEEDED_AUTHOR_STYLES.alex_thompson);
});
test("emoji-only unrated output fails rather than being rewritten; permitted emoji and ordinary posts stay untouched", async () => {
  for (const [text, frequency] of [["🚫", "none"], ["oh NO", "none"], ["still perfect.", "none"], ["🌟", "low"]] as const) {
    const p = persona("alex_thompson");
    p.persona_config.social_voice = { emojiFrequency: frequency };
    let writers = 0;
    const result = await generatePersonaBatch({
      personas: [p], postsPerPersona: 1, weights: DEFAULT_MODE_WEIGHTS, recent: [],
      candidates: new Map([[p.id, [media]]]), random: () => .99,
      chat: async messages => messages[1].content.includes('"task":"narrow_intent_validation"') ? '{"issues":[]}' : (writers++, JSON.stringify({ content: text })),
    });
    assert.equal(writers, 1);
    if (text === "🚫") {
      assert.equal(result.drafts.length, 0);
      assert.ok(result.errors[0].includes("empty unrated"));
    } else {
      assert.equal(result.drafts[0].content, text);
      assert.equal(parseGenerationNotes(result.drafts[0].ai_notes)!.emojiRepairs!.length, 0);
    }
  }
});