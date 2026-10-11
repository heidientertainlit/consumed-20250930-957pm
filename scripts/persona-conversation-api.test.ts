import { test } from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";

// Execute the REAL handlers and auth boundary with fake transports only.
// No workspace env vars, credentials, production data or provider calls.
const admin = "11111111-1111-4111-8111-111111111111";
const a = "22222222-2222-4222-8222-222222222222";
const b = "33333333-3333-4333-8333-333333333333";
const sid = "55555555-5555-4555-8555-555555555555";
const subject = { title: "Exact selected title", type: "movie", creator: null, externalId: "900", externalSource: "tmdb", canonicalId: sid };
const messages = [
  { client_id: "m0", participant_id: a, parent_client_id: null, body: "What did you think?", offset_seconds: 0 },
  { client_id: "m1", participant_id: b, parent_client_id: "m0", body: "I liked the pacing.", offset_seconds: 60 },
  { client_id: "m2", participant_id: a, parent_client_id: "m1", body: "Same here.", offset_seconds: 300 },
];
const g = globalThis as any;
async function loadHandler(path: string) {
  const result = await build({ entryPoints: [path], bundle: true, write: false, format: "esm", platform: "node",
    plugins: [{
      name: "fake-transports",
      setup(build) {
        build.onResolve({ filter: /^https:\/\// }, args => ({ path: args.path, namespace: "fake" }));
        build.onLoad({ filter: /.*/, namespace: "fake" }, args => ({
          contents: args.path.includes("/http/server") ? "export const serve = fn => {globalThis.fixtureHandler=fn};"
            : "export const createClient = () => globalThis.fixtureDB;", loader: "js",
        }));
        // Canonical identity is separately unit-tested in the existing suite.
        // Here verify ONLY server-issued provider data reaches that trust path.
        build.onResolve({ filter: /\/canonical-media\.ts$/ }, () => ({ path: "canonical", namespace: "identity" }));
        build.onLoad({ filter: /.*/, namespace: "identity" }, () => ({
          contents: `export async function resolveCanonicalMedia(db,input) {
            globalThis.identityInputs.push(input);
            if (!input.verifiedSourceMetadata || input.externalSource==='openai') throw Error('Unverified');
            return {canonicalMediaId:'${sid}',sourceVerified:true,metadata:input.verifiedSourceMetadata};
          }`, loader: "js",
        }));
      },
    }],
  });
  await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString("base64")}#${path}`);
  return g.fixtureHandler;
}
function fixture() {
  const writes: any[] = []; const calls: any[] = []; const queries: any[] = [];
  let scanFails = false; const failedRPCs = new Set<string>();
  const searchRequests: any[] = [], providerRequests: string[] = [], pending: Promise<any>[] = [];
  let realSearch = false;
  let nextSubject = 1;
  const rows: Record<string, any[]> = {
    users: [{ id: admin, is_admin: true }, { id: a, is_persona: true, persona_config: { tone: "reserved", favorite_media: ["Do not substitute"] }, display_name: "A", user_name: "fictional_a" },
      { id: b, is_persona: true, persona_config: { tone: "warm" }, display_name: "B", user_name: "fictional_b" }],
    persona_conversation_subjects: [{ id: sid, subject, provenance: [{ provider: "TMDB", fetchedAt: "2026-10-09" }], topic: "Verified suggested question", expires_at: "2099-01-01" }],
    persona_conversation_runs: [], persona_conversation_gender: [],
  };
  const db = {
    auth: { getUser: async (token: string) => ({ data: { user: token === "admin-session" ? { id: admin } : token === "human-session" ? { id: a } : null }, error: null }) },
    from(table: string) {
      let filters: ((r: any) => boolean)[] = [], operation = "", payload: any, one = false;
      let orderKey = "", ascending = true, rowLimit = Infinity;
      const q: any = {
        select: () => q,
        order: (key: string, options?: { ascending?: boolean }) => {
          orderKey = key; ascending = options?.ascending !== false;
          queries.push({ table, method: "order", key }); return q;
        },
        limit: (value: number) => { rowLimit = value; queries.push({ table, method: "limit", value }); return q; },
        eq: (key: string, value: any) => { filters.push(r => r[key] === value); return q; },
        gt: (key: string, value: any) => { filters.push(r => r[key] > value); return q; },
        lte: (key: string, value: any) => { filters.push(r => r[key] <= value); return q; },
        or: (expression: string) => {
          queries.push({ table, method: "or", expression });
          const match = /^next_attempt_at\.is\.null,next_attempt_at\.lte\.(.+)$/.exec(expression);
          if (!match) throw new Error(`Unsupported fixture OR expression: ${expression}`);
          filters.push(r => r.next_attempt_at == null || r.next_attempt_at <= match[1]); return q;
        },
        in: (key: string, value: any[]) => { filters.push(r => value.includes(r[key])); return q; },
        insert: (value: any) => { operation = "insert"; payload = value; return q; },
        upsert: (value: any) => { operation = "upsert"; payload = value; return q; },
        update: (value: any) => { operation = "update"; payload = value; return q; },
        single: () => { one = true; return q; }, maybeSingle: () => { one = true; return q; },
        then(resolve: any, reject: any) {
          try {
            if (scanFails && table === "persona_conversation_runs" && !operation) {
              return Promise.resolve({ data: null, error: { message: "fixture scan unavailable" } }).then(resolve, reject);
            }
            let found = (rows[table] || []).filter(r => filters.every(f => f(r)));
            if (orderKey) found.sort((a, b) => {
              const result = a[orderKey] === b[orderKey] ? 0 : a[orderKey] < b[orderKey] ? -1 : 1;
              return ascending ? result : -result;
            });
            found = found.slice(0, rowLimit);
            if (operation) {
              writes.push({ table, operation, payload });
              if (operation === "insert") {
                found = (Array.isArray(payload) ? payload : [payload]).map((r: any) => ({
                  id: table === "persona_conversation_subjects" ? `00000000-0000-4000-8000-${String(nextSubject++).padStart(12, "0")}` : sid,
                  revision: 1, status: "draft",
                  ...(table === "persona_conversation_subjects" ? { expires_at: "2099-01-01" } : {}), ...r,
                }));
                rows[table] = [...(rows[table] || []), ...found];
              } else if (operation === "update") found.forEach(r => Object.assign(r, payload));
              else found = [payload];
            }
            return Promise.resolve({ data: one ? found[0] || null : found, error: null }).then(resolve, reject);
          } catch (err) { return Promise.reject(err).then(resolve, reject); }
        },
      };
      return q;
    },
    rpc: async (name: string, args: any) => {
      calls.push({ name, args });
      if (failedRPCs.has(args.p_run)) return { data: null, error: { message: "fixture transaction unavailable" } };
      return { data: name === "resolve_media_canonical_batch" ? [] : { id: sid }, error: null };
    },
  };
  let modelCount = 0, malformed = false, flagged = false, factsFail = false, providersFail = false;
  g.fixtureDB = db; g.identityInputs = [];
  g.EdgeRuntime = { waitUntil: (promise: Promise<any>) => { pending.push(promise); } };
  g.Deno = { env: { get: (name: string) => ({
    SUPABASE_URL: "https://fixture.invalid", SUPABASE_SERVICE_ROLE_KEY: "fixture-service",
    SUPABASE_ANON_KEY: "fixture-anon", OPENAI_API_KEY: "fixture-writer", TMDB_API_KEY: "fixture-tmdb",
  } as any)[name] } };
  g.fetch = async (url: string, options: any = {}) => {
    if (realSearch && url.includes("/functions/v1/media-search")) {
      searchRequests.push(JSON.parse(options.body));
      return mediaSearch(new Request(url, options));
    }
    if (realSearch && !url.includes("openai.com")) {
      providerRequests.push(url);
      if (url.includes("/search/multi")) return Response.json({ results: [{
        id: 900, title: subject.title, overview: "Verified provider summary", release_date: "2020-01-01",
        media_type: "movie", genre_ids: [], vote_count: 1000, popularity: 500,
      }] });
      if (url.includes("themoviedb.org") && url.includes("/movie/900")) return Response.json({
        id: 900, title: subject.title, genres: [], credits: { crew: [] }, external_ids: {},
      });
      // Other provider fixture searches return legitimate empty response shapes.
      return Response.json({ results: [], items: [], docs: [], genres: [] });
    }
    if (url.includes("/moderations")) {
      const input = JSON.parse(options.body).input;
      return Response.json({ results: input.map(() => ({ flagged })) });
    }
    if (url.includes("/chat/completions")) {
      modelCount++;
      const request = JSON.parse(options.body);
      assert(request.messages.some((m: any) => m.content.includes("JSON")), "JSON-object mode has explicit JSON instructions");
      const reviewing = request.messages[0].content.includes("checking EVERY");
      const suggesting = request.messages[0].content.includes("subjective discussion question");
      const result = reviewing ? { issues: factsFail ? ["Unsupported facts"] : [] } : suggesting
        ? { suggestions: JSON.parse(request.messages[1].content).map((s: any) => ({ id: s.id, topic: `What did you think about ${s.subject.title}?` })) } : { messages };
      return Response.json({ choices: [{ message: { content: malformed ? "invalid json" : JSON.stringify(result) } }] });
    }
    if (url.includes("/media-search")) return Response.json({ results: [{ title: subject.title, type: "movie", external_id: "900", external_source: "tmdb" },
      { title: "Fabricated fallback", type: "movie", external_id: "fake", external_source: "openai" }] });
    if (providersFail) return new Response("", { status: 503 });
    if (url.includes("openlibrary.org")) return Response.json({ works: [{ title: "Provider book", key: "/works/OL1W", author_name: ["Verified Author"] }] });
    if (url.includes("themoviedb.org")) return Response.json({ results: [{ id: 900, title: "Provider film", name: "Provider TV", release_date: "2020-01-01", first_air_date: "2020-01-01" }] });
    throw new Error("Unexpected network attempted");
  };
  return { rows, writes, calls, queries, searchRequests, providerRequests, pending,
    failWorkerScan: () => { scanFails = true; }, failWorkerRPC: (id: string) => failedRPCs.add(id),
    useActualSearch: () => { realSearch = true; }, get modelCount() { return modelCount; },
    failJSON: () => { malformed = true; }, failModeration: () => { flagged = true; },
    failFacts: () => { factsFail = true; }, failProviders: () => { providersFail = true; } };
}
const handler = await loadHandler("supabase/functions/admin-persona-conversations/index.ts");
const worker = await loadHandler("supabase/functions/deliver-persona-conversations/index.ts");
const mediaSearch = await loadHandler("supabase/functions/media-search/index.ts");
const request = (body: any, token = "admin-session") => new Request("https://fixture.invalid", {
  method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify(body),
});
const generation = { action: "generate", topic: "An exact topic", subjectId: sid, participantIds: [a, b], openingAuthorId: a, replyCount: 2, durationMinutes: 5, maxWords: 60 };

test("scheduled worker filters state, start time and retry time and scans at most twenty runs", async () => {
  const f = fixture();
  const past = "2000-01-01T00:00:00.000Z", future = "2099-01-01T00:00:00.000Z";
  f.rows.persona_conversation_runs = [
    ...Array.from({ length: 25 }, (_, i) => ({
      id: `due-${i}`, status: "scheduled", start_at: past, next_attempt_at: null,
    })),
    { id: "draft", status: "draft", start_at: past },
    { id: "approved-only", status: "approved", start_at: past },
    { id: "paused", status: "paused", start_at: past },
    { id: "cancelled", status: "cancelled", start_at: past },
    { id: "future", status: "scheduled", start_at: future },
    { id: "backoff", status: "scheduled", start_at: past, next_attempt_at: future },
  ];
  const response = await worker(request({}, "fixture-service"));
  assert.equal(response.status, 200);
  const deliveryCalls = f.calls.filter(call => call.name === "deliver_persona_conversation");
  assert.equal(deliveryCalls.length, 20);
  assert(deliveryCalls.every(call => call.args.p_run.startsWith("due-")));
  assert(f.queries.some(query => query.table === "persona_conversation_runs" && query.method === "limit" && query.value === 20));
  assert.equal(f.writes.length, 0, "Only the transactional RPC may publish");
});

test("worker scan failure cannot invoke delivery, and one RPC failure does not lose later due runs", async () => {
  let f = fixture(); f.failWorkerScan();
  assert.equal((await worker(request({}, "fixture-service"))).status, 500);
  assert.equal(f.calls.length, 0);
  assert.equal(f.writes.length, 0);
  f = fixture();
  f.rows.persona_conversation_runs = [
    { id: "fail", status: "scheduled", start_at: "2000-01-01" },
    { id: "next", status: "scheduled", start_at: "2000-01-01" },
  ];
  f.failWorkerRPC("fail");
  const response = await worker(request({}, "fixture-service"));
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(data.results[0].status, "failed");
  assert.deepEqual(f.calls.map(call => call.args.p_run), ["fail", "next"]);
  assert.equal(f.writes.length, 0);
});

test("admin authorization, service-only worker, no private reads for human", async () => {
  const f = fixture();
  for (const token of ["human-session", "unknown", "fixture-service", ""]) assert.notEqual((await handler(request({ action: "state" }, token))).status, 200);
  assert.equal(f.writes.length, 0);
  assert.notEqual((await worker(request({}, "admin-session"))).status, 200);
  assert.equal(f.calls.length, 0);
});
test("authorized service worker scans due runs but does not directly insert public rows", async () => {
  const f = fixture();
  f.rows.persona_conversation_runs = [{ id: sid, status: "scheduled", start_at: "2000-01-01" }];
  const res = await worker(request({}, "fixture-service"));
  assert.equal(res.status, 200);
  assert.equal(f.calls.length, 1);
  assert.equal(f.calls[0].name, "deliver_persona_conversation");
  assert.equal(f.writes.length, 0);
});
test("generation binds server subject and stays private; returns exact roster", async () => {
  const f = fixture();
  const res = await handler(request({ ...generation, subject: { title: "Client forgery" } }));
  assert.equal(res.status, 200, await res.clone().text());
  const run = await res.json();
  assert.equal(run.subject.title, subject.title);
  assert.deepEqual(run.participant_ids, [a, b]);
  assert.equal(run.status, "draft");
  assert.equal(f.modelCount, 2, "one writer and one factual review");
  assert(f.writes.every(w => w.table === "persona_conversation_runs"));
});
test("unsupported model facts, malformed JSON and moderation fail closed without writes", async () => {
  for (const flag of ["failJSON", "failModeration", "failFacts"] as const) {
    const f = fixture(); f[flag]();
    assert.equal((await handler(request(generation))).status, 400);
    assert.equal(f.writes.length, 0);
  }
});
test("non-persona IDs, expired subject selection and invalid graph create no drafts", async () => {
  const f = fixture();
  assert.equal((await handler(request({ ...generation, participantIds: [a, admin] }))).status, 400);
  f.rows.persona_conversation_subjects[0].expires_at = "2000-01-01";
  assert.equal((await handler(request(generation))).status, 400);
  assert.equal(f.writes.length, 0);
});
test("manual music search supported; forged AI search results are never verified", async () => {
  const f = fixture();
  const res = await handler(request({ action: "search", type: "movie", query: "Exact" }));
  assert.equal(res.status, 200);
  assert.equal((await res.json()).items.length, 1);
  assert.equal(g.identityInputs.length, 1);
  assert.equal(g.identityInputs[0].externalId, "900");
  assert.equal(g.identityInputs[0].verifiedSourceMetadata.title, subject.title);
  assert.equal((await handler(request({ action: "search", type: "music", query: "Exact" }))).status, 200);
  assert.equal((await handler(request({ action: "search", type: "news", query: "Exact" }))).status, 400);
  assert(f.writes.every(w => w.table === "persona_conversation_subjects"));
});
test("studio default All search executes actual media-search provider contract, attaches and generates exact title", async () => {
  const f = fixture(); f.useActualSearch();
  const searched = await handler(request({ action: "search", type: "all", query: subject.title }));
  assert.equal(searched.status, 200, await searched.clone().text());
  const { items } = await searched.json();
  assert.equal(Object.hasOwn(f.searchRequests[0], "type"), false, "All must omit the provider filter");
  assert(f.providerRequests.some(url => url.includes("/search/multi")), "actual handler reached TMDB search");
  await Promise.all(f.pending);
  const selected = items.find((i: any) => i.externalSource === "tmdb" && i.externalId === "900");
  assert(selected, "default search offers the verified provider title");
  assert.equal(selected.title, subject.title);
  const generated = await handler(request({ ...generation, subjectId: selected.id }));
  assert.equal(generated.status, 200, await generated.clone().text());
  const draft = await generated.json();
  assert.equal(draft.subject.externalId, "900");
  assert.equal(draft.subject.title, subject.title);
  assert.equal(draft.status, "draft");
  assert(f.writes.every(w => !["social_posts", "social_post_comments"].includes(w.table)));
});
test("provider failures report supported source coverage, without fabricated trends", async () => {
  const f = fixture(); f.failProviders();
  const res = await handler(request({ action: "suggest" }));
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.deepEqual(data.suggestions, []);
  assert.equal(data.coverage.length, 3);
  assert(data.coverage.every((c: any) => c.status === "failed" && c.fetchedAt));
  assert.deepEqual(data.coverage.flatMap((c: any) => c.types).sort(), ["book", "movie", "tv"]);
});
test("sourced AI questions stay attached to exact server-issued subjects", async () => {
  const f = fixture();
  const res = await handler(request({ action: "suggest" }));
  assert.equal(res.status, 200, await res.clone().text());
  const data = await res.json();
  assert(data.suggestions.length > 0);
  assert(data.suggestions.every((s: any) => s.subject.canonicalId === sid && s.topic.includes(s.subject.title) && s.provenance[0].fetchedAt));
  assert.equal(f.modelCount, 2);
  assert(f.writes.every(w => w.table === "persona_conversation_subjects"));
});
test("gender metadata never reads private human gender or writes persona config", async () => {
  const f = fixture();
  assert.equal((await handler(request({ action: "gender", personaId: a, gender: "nonbinary" }))).status, 200);
  assert.equal(f.writes[0].table, "persona_conversation_gender");
  assert.equal(f.rows.users[1].persona_config.tone, "reserved");
  assert.equal((await handler(request({ action: "gender", personaId: admin, gender: "woman" }))).status, 400);
  assert.equal((await handler(request({ action: "gender", personaId: a, gender: "guessed" }))).status, 400);
});
test("edited/approved content is re-moderated and evidence checked, stale revision fails", async () => {
  const f = fixture();
  f.rows.persona_conversation_runs = [{ id: sid, ...generation, participant_ids: [a, b], opening_author_id: a, messages, revision: 3, max_words: 60, subject, status: "draft" }];
  assert.equal((await handler(request({ action: "approve", runId: sid, revision: 2 }))).status, 400);
  f.failFacts();
  assert.equal((await handler(request({ action: "edit", runId: sid, revision: 3, messages }))).status, 400);
  assert.equal(f.calls.length, 0);
});
