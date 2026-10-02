import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { build } from "esbuild";
import { DEFAULT_MODE_WEIGHTS, deriveSocialVoice } from "./persona-generation.ts";

/** Execute the actual Edge handler with isolated auth, provider and database adapters. */
async function harness() {
  const reads: string[] = [];
  const writes: { table: string; action: string; data: any }[] = [];
  const config = { bio: "Existing identity", interests: ["drama"], favorite_media: ["Known Movie"], media_types: ["movie"], tone: "thoughtful", posting_style: "short updates", activity_level: "high" };
  const weights = Object.fromEntries(Object.keys(DEFAULT_MODE_WEIGHTS).map(id => [id, id === "thoughtful" ? 100 : 0]));
  const db = {
    from(table: string) {
      let projection = "", action = "read", payload: any;
      const query: any = {
        select(value: string) { projection = value; return query; },
        in() { return query; }, eq() { return query; }, gte() { return query; },
        order() { return query; }, limit() { return query; }, not() { return query; },
        insert(data: any) { action = "insert"; payload = data; return query; },
        upsert(data: any) { action = "upsert"; payload = data; return query; },
        update(data: any) { action = "update"; payload = data; return query; },
        result(single = false) {
          if (action !== "read") { writes.push({ table, action, data: payload }); return { data: { id: "draft-id" }, error: null }; }
          reads.push(table);
          if (table === "app_settings") return { data: { value: JSON.stringify(weights) }, error: null };
          if (table === "users") {
            if (projection === "persona_config") return { data: { persona_config: { ...config } }, error: null };
            const persona = { id: "p1", user_name: "example", display_name: "Example", persona_config: { ...config } };
            return { data: single ? persona : [persona], error: null };
          }
          return { data: [], error: null };
        },
        single() { return Promise.resolve(query.result(true)); },
        maybeSingle() { return Promise.resolve(query.result(true)); },
        then(resolve: any, reject: any) { return Promise.resolve(query.result()).then(resolve, reject); },
      };
      return query;
    },
  };
  const compiled = await build({
    entryPoints: ["supabase/functions/generate-persona-content/index.ts"],
    bundle: true, write: false, format: "cjs", platform: "node", logLevel: "silent",
    plugins: [{
      name: "isolated-edge-adapters",
      setup(builder) {
        builder.onResolve({ filter: /^https:\/\// }, args => ({ path: args.path, namespace: "edge-adapter" }));
        builder.onResolve({ filter: /authorization\.ts$/ }, () => ({ path: "authorization", namespace: "edge-adapter" }));
        builder.onLoad({ filter: /.*/, namespace: "edge-adapter" }, args => ({
          contents: args.path === "authorization"
            ? `export async function authorizeAdminOrService(req) { return req.headers.get("Authorization") === "Bearer admin-test" ? {authorized:true,caller:"admin"} : {authorized:false,status:401,error:"Unauthorized"}; }`
            : args.path.includes("supabase-js")
              ? "export function createClient() { return globalThis.testDatabase; }"
              : "export function serve(handler) { globalThis.testHandler = handler; }",
        }));
      },
    }],
  });
  const context: any = {
    Request, Response, AbortSignal, Date, console,
    Deno: { env: { get: () => "test-placeholder-not-a-real-credential" } },
    testDatabase: db,
    fetch: async (url: string, options?: any) => {
      if (url === "https://api.openai.com/v1/chat/completions") {
        const body = JSON.parse(options.body);
        const candidateRequest = body.messages[1].content.startsWith("Persona tastes:");
        const value = candidateRequest
          ? { candidates: [{ title: "Known Movie", type: "movie", source: "Persona Favorite" }] }
          : { content: "Honestly, I liked it more than expected. The pacing was a little slow, but the ending worked for me." };
        return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(value) } }] }));
      }
      if (url.startsWith("https://api.themoviedb.org/3/search/movie")) {
        return new Response(JSON.stringify({ results: [{ id: 42, title: "Known Movie", release_date: "2000-01-01", genre_ids: [18], overview: "A family drama." }] }));
      }
      throw new Error("Unexpected provider request in isolated test");
    },
  };
  vm.runInNewContext(compiled.outputFiles[0].text, context);
  const request = async (body: any, authorized = true) => {
    const result = await context.testHandler(new Request("https://example.invalid/generator", {
      method: "POST", headers: { "Content-Type": "application/json", ...(authorized ? { Authorization: "Bearer admin-test" } : {}) },
      body: JSON.stringify(body),
    }));
    return { status: result.status, body: await result.json() };
  };
  return { request, reads, writes, config };
}
test("Edge preview generates actual assigned draft fields while making zero database writes", async () => {
  const h = await harness();
  const preview = { action: "dry-run", previewPersonaIds: ["p1"], previewPostsPerPersona: 1, useTrending: false };
  assert.ok(!("personaIds" in preview)); // Legacy generator cannot interpret this as a writing request.
  const result = await h.request(preview);
  assert.equal(result.status, 200);
  assert.equal(result.body.generated, 1);
  assert.equal(result.body.dryRun, true);
  assert.equal(result.body.drafts[0].media_title, "Known Movie");
  assert.equal(result.body.drafts[0].post_type, "review");
  assert.equal(h.writes.length, 0);
});
test("normal generation inserts drafts only, leaving scheduling and publishing untouched", async () => {
  const h = await harness();
  const result = await h.request({ personaIds: ["p1"], postsPerPersona: 1, useTrending: false });
  assert.equal(result.body.generated, 1);
  assert.equal(h.writes.length, 1);
  assert.equal(h.writes[0].table, "persona_post_drafts");
  assert.equal(h.writes[0].action, "insert");
  assert.ok(h.writes[0].data.ai_notes);
  assert.ok(!("persona_display_name" in h.writes[0].data));
});
test("unauthorized configuration and preview requests never reach the database", async () => {
  const h = await harness();
  for (const action of ["settings", "save-settings", "save-voice", "dry-run"]) {
    assert.equal((await h.request({ action }, false)).status, 401);
  }
  assert.equal(h.reads.length, 0);
  assert.equal(h.writes.length, 0);
});
test("voice saves preserve identity and unrelated configuration; mode settings use the existing key-value table", async () => {
  const h = await harness();
  const voice = deriveSocialVoice(h.config);
  assert.equal((await h.request({ action: "save-voice", personaId: "p1", voice })).status, 200);
  assert.equal(h.writes[0].data.persona_config.bio, h.config.bio);
  assert.equal(h.writes[0].data.persona_config.activity_level, h.config.activity_level);
  assert.equal(h.writes[0].data.persona_config.social_voice.energy, voice.energy);
  assert.equal((await h.request({ action: "save-settings", weights: DEFAULT_MODE_WEIGHTS })).status, 200);
  assert.equal(h.writes[1].table, "app_settings");
  assert.equal(h.writes[1].data.key, "persona_generation_mode_weights");
});
test("settings advertise preview capability; invalid weights are rejected before a write", async () => {
  const h = await harness();
  const settings = await h.request({ action: "settings" });
  assert.equal(settings.body.capabilities.dryRun, true);
  assert.equal((await h.request({ action: "save-settings", weights: { ...DEFAULT_MODE_WEIGHTS, micro: -1 } })).status, 400);
  assert.equal(h.writes.length, 0);
});