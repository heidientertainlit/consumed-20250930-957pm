import test from "node:test";
import assert from "node:assert/strict";
import { renderPersonaReport } from "./persona-generation-report.ts";
import { generatePersonaBatch } from "../supabase/functions/_shared/persona-generation-engine.ts";
import { DEFAULT_MODE_WEIGHTS, type Persona } from "../supabase/functions/_shared/persona-generation.ts";

test("report preserves batch order/text, escapes content, hides identities initially and discloses repairs", async () => {
  const p: Persona = { id: "p", user_name: "alex_thompson", display_name: "A < B", persona_config: {} };
  const result = await generatePersonaBatch({
    personas: [p], postsPerPersona: 1, weights: DEFAULT_MODE_WEIGHTS, recent: [], random: () => .99,
    candidates: new Map([[p.id, [{ title: "A & B", type: "movie", source: "Discovery", fit: 1 }]]]),
    chat: async messages => messages[1].content.includes('"task":"narrow_intent_validation"')
      ? '{"issues":[]}' : JSON.stringify({ content: '<script>alert("x")</script> 🚫' }),
  });
  const before = JSON.stringify(result);
  const html = renderPersonaReport({ ...result, personaCount: 1 });
  assert.equal(JSON.stringify(result), before);
  assert.ok(html.includes('<body class="blind">'));
  assert.ok(html.includes('body.blind .identity'));
  assert.ok(html.includes('id="toggle"'));
  assert.ok(html.includes("A &lt; B"));
  assert.ok(html.includes("A &amp; B"));
  assert.ok(!html.includes('<script>alert("x")</script>'));
  assert.ok(html.includes("&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;"));
  assert.ok(html.includes("Emoji-only repair — original writer text"));
  assert.ok(html.includes("🚫"));
  for (const field of ["Persona:", "Intent:", "Mode:", "State:", "Rating:", "Intent distribution", "Mode distribution", "Validation/style warnings", "Emoji repairs"]) assert.ok(html.includes(field), field);
});