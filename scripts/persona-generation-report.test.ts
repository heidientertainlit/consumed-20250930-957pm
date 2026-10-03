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
    chat: async messages => messages[0].content.startsWith("Choose one concrete premise") ? '{"premise":"They enjoyed it."}' : messages[1].content.includes('"task":"narrow_intent_validation"')
      ? '{"issues":[]}' : JSON.stringify({ content: '<script>alert("x")</script> 🚫' }),
  });
  const before = JSON.stringify(result);
  const html = renderPersonaReport({ ...result, personaCount: 1,
    writerOutputs: [{ persona: "A < B", raw: '<script>raw rejected response</script>' }],
    favoriteIdentityChecks: [{ persona: "Julian", expected: { title: "Blonde", type: "music", creator: "Frank Ocean" }, verified: true, resolved: { creator: "Frank Ocean", externalId: "provider-id" }, purpose: "diagnostic-only; not inserted into the candidate pool" }],
    mediaResolutionDebug: [{ requested: { title: "Blonde", type: "music", expectedCreator: "Frank Ocean" }, cacheKey: '["music","blonde","frank ocean"]', cacheHit: false, status: "verified", resolved: { title: "Blonde", type: "music", creator: "Frank Ocean", externalId: "provider-id", externalSource: "itunes" } }],
  });
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
  assert.ok(html.includes("Known-favorite identity verification"));
  assert.ok(html.includes("Frank Ocean"));
  assert.ok(html.includes("expectedCreator"));
  assert.ok(html.includes("Raw writer responses — including retries"));
  assert.ok(!html.includes("<script>raw rejected response</script>"));
  assert.ok(html.includes("&lt;script&gt;raw rejected response&lt;/script&gt;"));
  assert.ok(html.indexOf("Known-favorite identity verification") > html.indexOf('<article id="post-1">'));
  for (const field of ["Persona:", "Intent:", "Premise:", "Mode:", "State:", "Rating:", "Intent distribution", "Mode distribution", "Validation/style warnings", "Emoji repairs"]) assert.ok(html.includes(field), field);
});