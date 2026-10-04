import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { build } from "esbuild";
import { generatePersonaBatch } from "./persona-generation-engine.ts";
import { DEFAULT_MODE_WEIGHTS, type MediaCandidate } from "./persona-generation.ts";
import { requirePersonaMediaIdentity } from "./persona-media-identity.ts";

const functions = ["generate-persona-content", "admin-approve-draft", "post-scheduled-content", "social-feed"];
const compiled = new Map(await Promise.all(functions.map(async name => {
  const result = await build({
    entryPoints: [`supabase/functions/${name}/index.ts`],
    bundle: true, write: false, format: "cjs", platform: "node", logLevel: "silent",
    plugins: [{
      name: "isolated-pipeline-adapters",
      setup(builder) {
        builder.onResolve({ filter: /^https:\/\// }, args => ({ path: args.path, namespace: "adapter" }));
        builder.onResolve({ filter: /authorization\.ts$/ }, () => ({ path: "auth", namespace: "adapter" }));
        builder.onLoad({ filter: /.*/, namespace: "adapter" }, args => ({
          contents: args.path === "auth" ? "export async function authorizeAdminOrService() { return {authorized:true}; }"
            : args.path.includes("supabase-js") ? "export function createClient() { return globalThis.db; }"
            : "export function serve(handler) { globalThis.capture(handler); }",
        }));
      },
    }],
  });
  return [name, result.outputFiles[0].text] as const;
})));

type Fixture = { title: string; type: string; source: string; id: string; creator?: string };
const fixtures: Fixture[] = [
  { title: "Jurassic Park", type: "movie", source: "tmdb", id: "329" },
  { title: "American Horror Story", type: "tv", source: "tmdb", id: "1413" },
  { title: "Mistborn", type: "book", source: "googlebooks", id: "t_ZYYXZq4RgC", creator: "Brandon Sanderson" },
  { title: "Blonde", type: "music", source: "itunes", id: "1146195596", creator: "Frank Ocean" },
];

/** Actual Edge handlers, with only database/HTTP/auth adapters replaced. No live writes. */
function harness(fixture = fixtures[0], rejected = false) {
  const persona = {
    id: "persona", user_name: "brooksj", display_name: "Julian Brooks", is_persona: true,
    persona_config: { media_types: [fixture.type], favorite_media: [fixture.title], interests: ["drama"] },
  };
  const tables = new Map<string, any[]>([["users", [persona]]]);
  const writes: { table: string; action: string; data: any }[] = [];
  const requests: string[] = [];
  const db = {
    auth: { getUser: async () => ({ data: { user: null }, error: null }) },
    from(table: string) {
      if (!tables.has(table)) tables.set(table, []);
      const rows = tables.get(table)!;
      let action = "read", payload: any;
      const filters: ((row: any) => boolean)[] = [];
      const query: any = {
        select() { return query; }, order() { return query; }, limit() { return query; }, range() { return query; },
        eq(key: string, value: any) { filters.push(row => row[key] === value); return query; },
        neq(key: string, value: any) { filters.push(row => row[key] !== value); return query; },
        in(key: string, values: any[]) { filters.push(row => values.includes(row[key])); return query; },
        is(key: string, value: any) { filters.push(row => (row[key] ?? null) === value); return query; },
        not(key: string, operator: string, value: any) {
          if (operator === "is") filters.push(row => (row[key] ?? null) !== value);
          return query;
        },
        gte(key: string, value: string) { filters.push(row => row[key] >= value); return query; },
        lte(key: string, value: string) { filters.push(row => row[key] <= value); return query; },
        insert(data: any) { action = "insert"; payload = data; return query; },
        update(data: any) { action = "update"; payload = data; return query; },
        result(single = false) {
          let selected = rows.filter(row => filters.every(filter => filter(row)));
          if (action === "insert") {
            const created = {
              id: `${table}-${rows.length + 1}`, created_at: new Date().toISOString(),
              likes_count: 0, comments_count: 0, canonical_media_id: null, ...payload,
            };
            rows.push(created); selected = [created];
          } else if (action === "update") {
            selected.forEach(row => Object.assign(row, payload));
          }
          if (action !== "read") writes.push({ table, action, data: structuredClone(payload) });
          return { data: single ? selected[0] ?? null : structuredClone(selected), error: null };
        },
        single() { return Promise.resolve(query.result(true)); },
        maybeSingle() { return Promise.resolve(query.result(true)); },
        then(resolve: any, reject: any) { return Promise.resolve(query.result()).then(resolve, reject); },
      };
      return query;
    },
  };
  const handlers = new Map<string, (req: Request) => Promise<Response>>();
  for (const [name, source] of compiled) {
    vm.runInNewContext(source, {
      db, Request, Response, URL, AbortSignal, Date,
      console: { log() {}, error() {}, warn() {} },
      Deno: { env: { get: () => "isolated-test-only" } },
      capture: (handler: any) => handlers.set(name, handler),
      fetch: async (input: string, options?: any) => {
        requests.push(input);
        // Later stages must never try a provider/title lookup.
        if (name !== "generate-persona-content") throw new Error(`${name} unexpectedly requested a provider`);
        const url = new URL(input);
        let response: any;
        if (url.hostname === "api.openai.com") {
          const messages = JSON.parse(options.body).messages;
          const user = messages[1].content, system = messages[0].content;
          const value = user.startsWith("Persona tastes:")
            ? { candidates: [{ title: fixture.title, type: fixture.type, source: "Persona Favorite" }] }
            : system.startsWith("Choose one concrete premise")
              ? { premise: "They liked it more than expected." }
              : user.includes('"task":"narrow_intent_validation"') ? { issues: [] }
                : {
                  content: "Honestly, I liked it more than expected.",
                  // Writer fields are not authoritative and must not hijack identity.
                  media_external_id: "wrong-writer-id", media_external_source: "wrong-source",
                };
          response = { choices: [{ message: { content: JSON.stringify(value) } }] };
        } else if (url.hostname === "api.themoviedb.org" && url.pathname.includes("/search/")) {
          response = { results: rejected ? [{ id: 999, title: "Wrong title", name: "Wrong title", release_date: "2000-01-01" }]
            : [{ id: Number(fixture.id), title: fixture.title, name: fixture.title, release_date: "2000-01-01", first_air_date: "2000-01-01", genre_ids: [18] }] };
        } else if (url.hostname === "api.themoviedb.org" && url.pathname.endsWith("/credits")) {
          response = { cast: [] };
        } else if (url.hostname === "www.googleapis.com") {
          response = { items: rejected ? [] : [{ id: fixture.id, volumeInfo: { title: fixture.title, authors: [fixture.creator], publishedDate: "2000-01-01" } }] };
        } else if (url.hostname === "itunes.apple.com") {
          const wrong = { collectionId: 999, collectionName: fixture.title, artistName: "Alizée" };
          response = { results: rejected ? [wrong] : [wrong, { collectionId: Number(fixture.id), collectionName: fixture.title, artistName: fixture.creator }] };
        } else {
          throw new Error(`Unexpected isolated provider: ${url.hostname}`);
        }
        return new Response(JSON.stringify(response));
      },
    });
  }
  async function request(name: string, body?: any, postId?: string) {
    const response = await handlers.get(name)!(new Request(`https://test.invalid/${name}${postId ? `?post_id=${postId}` : ""}`, {
      method: body === undefined ? "GET" : "POST",
      ...(body === undefined ? {} : { body: JSON.stringify(body), headers: { "Content-Type": "application/json" } }),
    }));
    return { status: response.status, body: await response.json() };
  }
  return { persona, tables, writes, requests, request };
}

for (const fixture of fixtures) {
  test(`${fixture.source} ${fixture.type}: verified identity survives real generation, storage, approval, publication and feed handlers`, async () => {
    const h = harness(fixture);
    const generated = await h.request("generate-persona-content", { personaIds: [h.persona.id], postsPerPersona: 1, useTrending: false });
    assert.equal(generated.status, 200);
    assert.equal(generated.body.generated, 1, JSON.stringify(generated.body));
    const draft = h.tables.get("persona_post_drafts")![0];
    assert.equal(draft.media_external_id, fixture.id);
    assert.equal(draft.media_external_source, fixture.source);
    assert.equal(JSON.parse(draft.ai_notes).generation.externalId, fixture.id);
    assert.ok(!("persona_display_name" in draft));
    const providerCalls = h.requests.length;
    const approved = await h.request("admin-approve-draft", { draft_id: draft.id, scheduled_for: "2000-01-01T00:00:00Z" });
    assert.equal(approved.status, 200, JSON.stringify(approved.body));
    const scheduled = h.tables.get("scheduled_persona_posts")![0];
    assert.equal(scheduled.media_external_id, fixture.id);
    assert.equal(scheduled.media_external_source, fixture.source);
    // Supply already cached artwork so the feed needs no enrichment lookup.
    scheduled.image_url = "https://test.invalid/verified-poster.jpg";
    const published = await h.request("post-scheduled-content", {});
    assert.equal(published.body.successful, 1, JSON.stringify(published.body));
    const post = h.tables.get("social_posts")![0];
    assert.equal(post.media_external_id, fixture.id);
    assert.equal(post.media_external_source, fixture.source);
    const feed = await h.request("social-feed", undefined, post.id);
    assert.equal(feed.status, 200, JSON.stringify(feed.body));
    const item = feed.body.posts[0].mediaItems[0];
    assert.equal(item.externalId, fixture.id);
    assert.equal(item.externalSource, fixture.source);
    assert.equal(item.mediaType, fixture.type);
    assert.equal(`/media/${item.mediaType}/${item.externalSource}/${item.externalId}`, `/media/${fixture.type}/${fixture.source}/${fixture.id}`);
    assert.equal(post.content, draft.content);
    assert.equal(post.rating, draft.rating);
    assert.equal(post.media_creator, draft.media_creator);
    assert.equal(h.requests.length, providerCalls, "No provider re-resolution during approval, publishing or feed");
  });
}

test("approval prefers complete draft columns over stale notes and preserves edited content/rating", async () => {
  const h = harness();
  h.tables.set("persona_post_drafts", [{
    id: "draft", persona_user_id: "persona", media_title: "Jurassic Park", media_type: "movie",
    media_external_id: "329", media_external_source: "tmdb", content: "Original", rating: 3,
    ai_notes: JSON.stringify({ generation: { version: 1, externalId: "wrong", externalSource: "wrong" } }),
  }]);
  const response = await h.request("admin-approve-draft", {
    draft_id: "draft", scheduled_for: "2000-01-01T00:00:00Z", content_override: "Edited", rating_override: 4,
  });
  assert.equal(response.status, 200);
  const row = h.tables.get("scheduled_persona_posts")![0];
  assert.equal(row.media_external_id, "329");
  assert.equal(row.media_external_source, "tmdb");
  assert.equal(row.content, "Edited");
  assert.equal(row.rating, 4);
  assert.equal(h.requests.length, 0);
});

test("approval rejects missing/partial identity before edits or scheduling; notes cannot complete a partial tuple", async () => {
  for (const identity of [
    {}, { media_external_id: "329" }, { media_external_source: "tmdb" },
    { media_external_id: "", media_external_source: "tmdb" },
    { media_external_id: "undefined", media_external_source: "tmdb" },
  ]) {
    const h = harness();
    h.tables.set("persona_post_drafts", [{
      id: "draft", media_title: "Jurassic Park", media_type: "movie", content: "Original", ...identity,
      ai_notes: Object.keys(identity).length
        ? JSON.stringify({ generation: { version: 1, externalId: "329", externalSource: "tmdb" } })
        : "Unverified title-only legacy notes",
    }]);
    const response = await h.request("admin-approve-draft", {
      draft_id: "draft", scheduled_for: "2000-01-01T00:00:00Z", content_override: "Must not be saved",
    });
    assert.equal(response.status, 422);
    assert.equal(h.writes.length, 0);
    assert.equal(h.requests.length, 0);
  }
});

test("publication rejects incomplete media identity, rolls back its claim and creates no social post", async () => {
  for (const identity of [{}, { media_external_id: "329" }, { media_external_source: "tmdb" }]) {
    const h = harness();
    h.tables.set("scheduled_persona_posts", [{
      id: "scheduled", persona_user_id: "persona", media_title: "Jurassic Park", media_type: "movie",
      posted: false, scheduled_for: "2000-01-01T00:00:00Z", ...identity,
    }]);
    const response = await h.request("post-scheduled-content", {});
    assert.equal(response.body.successful, 0);
    assert.equal(response.body.results[0].success, false);
    assert.match(response.body.results[0].error, /Verified media provider/);
    assert.equal(h.tables.get("social_posts")?.length || 0, 0);
    assert.equal(h.tables.get("scheduled_persona_posts")![0].posted, false);
    assert.equal(h.requests.length, 0);
  }
});

test("Blonde verification failure rejects the other artist's same-title album without a draft or publication", async () => {
  const h = harness(fixtures[3], true);
  const response = await h.request("generate-persona-content", { personaIds: [h.persona.id], postsPerPersona: 1, useTrending: false });
  assert.equal(response.body.generated, 0);
  assert.equal(h.writes.length, 0);
  assert.ok(h.requests.some(url => url.includes("Frank%20Ocean")));
});

test("unverified title suggestions never receive a guessed provider identity", async () => {
  const h = harness(fixtures[0], true);
  const response = await h.request("generate-persona-content", { personaIds: [h.persona.id], postsPerPersona: 1, useTrending: false });
  assert.equal(response.body.generated, 0);
  assert.equal(h.writes.length, 0);
});

test("a candidate lacking a complete provider identity is rejected before any writing call", async () => {
  const candidate: MediaCandidate = { title: "Unverified", type: "movie", source: "Discovery", fit: 1 };
  let calls = 0;
  const result = await generatePersonaBatch({
    personas: [harness().persona], postsPerPersona: 1, weights: DEFAULT_MODE_WEIGHTS,
    recent: [], candidates: new Map([["persona", [candidate]]]),
    chat: async () => { calls++; throw new Error("Should not write"); },
  });
  assert.equal(result.drafts.length, 0);
  assert.equal(calls, 0);
  assert.match(result.errors[0], /Verified media provider/);
  for (const id of [undefined, null, "", "undefined", "null", " NaN "]) {
    assert.throws(() => requirePersonaMediaIdentity(id, "tmdb"));
  }
});

test("genuinely media-free posts remain supported by approval and publication", async () => {
  const h = harness();
  h.tables.set("persona_post_drafts", [{
    id: "draft", persona_user_id: "persona", post_type: "thought", content: "Hello.",
    media_title: null, media_type: null, media_external_id: null, media_external_source: null,
  }]);
  assert.equal((await h.request("admin-approve-draft", { draft_id: "draft", scheduled_for: "2000-01-01T00:00:00Z" })).status, 200);
  assert.equal((await h.request("post-scheduled-content", {})).body.successful, 1);
  assert.equal(h.tables.get("social_posts")![0].media_external_id, null);
});