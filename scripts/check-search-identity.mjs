import assert from "node:assert/strict";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { performance } from "node:perf_hooks";
import { createSearchIdentityStore, fixtureList, fixtureUser } from "./lib/search-identity-store.mjs";
import { createSearchFixtureProvider, loadSearchFixtureFunction } from "./lib/search-identity-runtime.mjs";

const before = process.argv.includes("--before");
const phase = before ? "before" : "after";
const sourcePath = before ? "generated-artifacts/search-identity/before.ts" : undefined;
const store = await createSearchIdentityStore();
const outcomes = [], samples = [];
const json = value => JSON.parse(JSON.stringify(value));
const fingerprintVersion = Number((await readFile("supabase/functions/_shared/media-fingerprint.ts", "utf8"))
  .match(/FINGERPRINT_VERSION\s*=\s*(\d+)/)[1]);

async function seed(items, state = "known") {
  await store.reset();
  const selected = state === "new" ? [] : state === "mixed"
    ? items.filter((_, index) => index < 15 || index >= 40) : items;
  const canonical = [], aliases = [], fingerprints = [];
  for (const [index, item] of selected.entries()) {
    const id = `30000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`;
    const metadata = {
      title: item.title, creator: item.creator || null, description: item.description || null,
      subjects: [], keywords: [], release_year: 2024, collection: null,
    };
    canonical.push({ id, title: item.title, media_type: item.type, creator: item.creator || null,
      normalized_title: item.title.toLowerCase(), source_verified: true, metadata });
    aliases.push({ canonical_media_id: id, external_source: item.external_source,
      external_id: String(item.external_id), source_verified: true, metadata: { provider_metadata: metadata } });
    fingerprints.push({
      external_source: item.external_source, external_id: String(item.external_id), canonical_media_id: id,
      fingerprint_version: fingerprintVersion, status: "ready", resolved_at: new Date().toISOString(),
      source_metadata: metadata, fingerprint: {
        version: fingerprintVersion, source_verified: true, verification_method: "provider_id",
        embedding: [], themes: [], tones: [], audience: [], styles: [], pacing: [],
        franchise: null, story_key: null, source_metadata: metadata,
      },
    });
  }
  for (const [table, data] of [["canonical_media", canonical], ["media_provider_aliases", aliases], ["media_fingerprints", fingerprints]]) {
    if (data.length) assert.equal((await store.from(table).insert(data)).error, null);
  }
  store.operations = []; store.errors = [];
}

const helperItems = Array.from({ length: 60 }, (_, index) => ({
  title: `Dune Fixture ${index + 1}`, type: "movie", external_source: "tmdb",
  external_id: String(index + 1), year: 2024,
}));
let routes = {};
const server = createServer(async (req, res) => {
  try {
    const handler = routes[req.url];
    assert.ok(handler, "Only isolated fixture routes are allowed");
    const chunks = []; for await (const chunk of req) chunks.push(chunk);
    const response = await handler(new Request(`http://fixture.invalid${req.url}`, {
      method: req.method, headers: req.headers, body: Buffer.concat(chunks),
    }));
    res.writeHead(response.status, Object.fromEntries(response.headers));
    res.end(Buffer.from(await response.arrayBuffer()));
  } catch (error) {
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: error.message }));
  }
});
let origin;
async function post(slug, body) {
  const start = performance.now();
  const response = await fetch(`${origin}/${slug}`, {
    method: "POST", headers: { Authorization: "Bearer fixture-only", "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await response.json();
  assert.ok(response.ok, `${slug} HTTP ${response.status}: ${JSON.stringify(data)}`);
  return { data, ms: +(performance.now() - start).toFixed(3) };
}
function trackBody(item, extra = {}) {
  return {
    media: {
      title: item.title, mediaType: item.type, creator: item.creator,
      imageUrl: item.poster_url || item.image, externalId: item.external_id,
      externalSource: item.external_source, year: item.year || item.release_date,
      canonical_media_id: item.canonical_media_id,
    },
    listType: "currently", skip_social_post: true, ...extra,
  };
}
function rateBody(item, rating = 4.5) {
  return {
    media_external_id: item.external_id, media_external_source: item.external_source,
    media_title: item.title, media_type: item.type, media_creator: item.creator,
    media_image_url: item.poster_url || item.image, media_year: item.year,
    canonical_media_id: item.canonical_media_id, rating,
    review_content: "Fixture review", contains_spoilers: true,
  };
}

try {
  const helperRuntime = await loadSearchFixtureFunction("media-search", {
    store, provider: createSearchFixtureProvider(), sourcePath,
  });
  // These call the actual helpers with real PostgreSQL aliases, constraints,
  // canonical triggers, and the real bulk RPC from the application's migration.
  for (const count of [0, 1, 29, 30, 31, 59, 60]) {
    const items = helperItems.slice(0, count);
    await seed(items);
    const known = await helperRuntime.helpers.addKnownCanonicalIdentities(items);
    const result = await helperRuntime.helpers.addCanonicalIdentities(known, {
      limit: 30, trustProviderResult: true, unresolvedOnly: true,
    });
    assert.equal(result.filter(item => item.canonical_media_id).length, count);
    const individualReads = store.operations.filter(op => op.table === "media_provider_aliases" && op.operation === "select").length;
    assert.equal(individualReads, before ? Math.max(0, count - 30) : 0);
    const batch = store.operations.find(op => op.operation === "rpc");
    assert.equal(batch?.count || 0, Math.min(count, before ? 30 : 60));
    outcomes.push({ case: `all-known-${count}`, individualReads, passed: true });
  }
  for (const state of ["new", "mixed"]) {
    await seed(helperItems, state);
    const known = await helperRuntime.helpers.addKnownCanonicalIdentities(helperItems);
    const result = await helperRuntime.helpers.addCanonicalIdentities(known, {
      limit: 30, trustProviderResult: true, unresolvedOnly: true,
    });
    const resolutions = store.operations.filter(op => op.table === "media_provider_aliases" && op.operation === "select").length;
    assert.ok(resolutions <= 30);
    if (state === "new") {
      assert.equal(resolutions, 30);
      assert.equal(result.filter(item => item.canonical_media_id).length, 30);
    }
    outcomes.push({ case: `${state}-60`, resolutions, passed: true });
  }
  await seed(helperItems);
  store.failBatch = true;
  const fallback = await helperRuntime.helpers.addCanonicalIdentities(
    await helperRuntime.helpers.addKnownCanonicalIdentities(helperItems),
    { limit: 30, trustProviderResult: true, unresolvedOnly: true },
  );
  assert.equal(fallback.filter(item => item.canonical_media_id).length, 30);
  assert.equal(store.operations.filter(op => op.table === "media_provider_aliases" && op.operation === "select").length, 30);
  outcomes.push({ case: "failed-bulk-read-bounded-fallback", passed: true });

  const synthetic = [
    { title: "Dune series", type: "book_series", external_source: "openai", external_id: "series-dune" },
    { title: "Dune suggestion", type: "movie", external_source: "openai", external_id: "suggestion" },
  ];
  await seed([]);
  assert.deepEqual(json(await helperRuntime.helpers.addKnownCanonicalIdentities(synthetic)), synthetic);
  assert.equal(store.operations.length, 0);
  outcomes.push({ case: "synthetic-series-and-model-items-excluded", passed: true });

  for (const uncertain of [false, true]) {
    await seed([]);
    const provider = createSearchFixtureProvider("Dune", {
      [uncertain ? "uncertainIds" : "blockedIds"]: ["movie:1"],
    });
    const safety = await loadSearchFixtureFunction("media-search", { store, provider, sourcePath });
    const response = await safety.handler(new Request("http://fixture.invalid/search", {
      method: "POST", body: JSON.stringify({ query: "Dune", type: "movie" }),
    }));
    const result = await response.json();
    assert.ok(result.results.length);
    assert.ok(!result.results.some(item => item.external_source === "tmdb" && item.external_id === "1"));
    assert.equal(result.partial, uncertain);
    assert.equal(result.failedProviders.includes("catalog-safety"), uncertain);
    await safety.drain();
    assert.equal((await store.pool.query("select * from media_provider_aliases where external_source='tmdb' and external_id='1'")).rowCount, 0);
    outcomes.push({ case: uncertain ? "actual-handler-uncertain-withheld" : "actual-handler-blocked-withheld", passed: true });
  }

  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  origin = `http://127.0.0.1:${server.address().port}`;
  for (const query of ["Dune", "Harry Potter"]) {
  for (const type of [undefined, "movie", "tv", "book"]) {
    const bootstrapProvider = createSearchFixtureProvider(query);
    await seed([]);
    const bootstrap = await loadSearchFixtureFunction("media-search", { store, provider: bootstrapProvider, sourcePath });
    const catalogResponse = await bootstrap.handler(new Request("http://fixture.invalid/search", {
      method: "POST", body: JSON.stringify({ query, type, include_book_series: false }),
    }));
    const { results: catalog } = await catalogResponse.json();
    await bootstrap.drain();
    assert.ok(catalog.length > 0, `${type || "all"} catalog is nonempty`);
    if (!type) assert.equal(catalog.length, 60);
    if (type === "movie" || type === "tv") {
      assert.ok(bootstrapProvider.requests.includes(`/3/search/${type}`), "New typed TMDB branch executed");
      assert.ok(bootstrapProvider.requests.includes("/v1/chat/completions"), "New safety classification executed");
    }
    for (const state of ["known", "new", "mixed"]) {
      for (let iteration = 0; iteration < 5; iteration++) {
        await seed(catalog, state);
        const provider = createSearchFixtureProvider(query);
        const persistedBefore = state === "known" ? (await store.pool.query(
          "select external_source,external_id,canonical_media_id,fingerprint,source_metadata from media_fingerprints order by external_source,external_id",
        )).rows : undefined;
        const search = await loadSearchFixtureFunction("media-search", { store, provider, sourcePath });
        const track = await loadSearchFixtureFunction("track-media", { store, provider });
        const rate = await loadSearchFixtureFunction("rate-media", { store, provider });
        routes = { "/search": search.handler, "/track": track.handler, "/rate": rate.handler };
        const start = await post("search", { query, type, include_book_series: false });
        assert.equal(start.data.partial, false, JSON.stringify({
          failedProviders: start.data.failedProviders,
          errors: search.diagnostics.filter(entry => entry.method === "error").map(entry => entry.args.map(String)),
        }));
        assert.deepEqual(start.data.results.map(item => [item.type, item.external_source, item.external_id]),
          catalog.map(item => [item.type, item.external_source, item.external_id]));
        if (persistedBefore) assert.deepEqual((await store.pool.query(
          "select external_source,external_id,canonical_media_id,fingerprint,source_metadata from media_fingerprints order by external_source,external_id",
        )).rows, persistedBefore, "Known fingerprints and metadata remain unchanged");
        // Last item deliberately exercises beyond the original bulk-read window
        // and, for a new 60-row page, beyond synchronous creation's budget.
        const selected = start.data.results.at(-1);
        if (state === "new" && catalog.length === 60) {
          assert.equal(selected.canonical_media_id, undefined, "Last new item is outside the 30-item synchronous budget");
          assert.equal(store.operations.filter(op => op.table === "canonical_media" && op.operation === "insert").length, 30);
        }
        const saved = await post("track", trackBody(selected));
        assert.equal(saved.data.success, true);
        const rated = await post("rate", rateBody(selected));
        assert.equal(rated.data.success, true);
        const { rows: items } = await store.pool.query("select * from list_items where list_id=$1", [fixtureList]);
        const { rows: ratings } = await store.pool.query("select * from media_ratings");
        const { rows: posts } = await store.pool.query("select * from social_posts");
        assert.equal(items.length, 1);
        assert.equal(ratings.length, 1);
        assert.ok(items[0].canonical_media_id);
        assert.equal(items[0].canonical_media_id, ratings[0].canonical_media_id);
        assert.equal(posts.length, 1);
        assert.equal(posts[0].canonical_media_id, ratings[0].canonical_media_id);
        assert.equal(posts[0].content, "Fixture review");
        assert.equal(posts[0].contains_spoilers, true);
        assert.equal(Number(ratings[0].rating), 4.5);
        // Real database round trips, no artificial latency. Host services and
        // provider responses are fixtures, not a Supabase production benchmark.
        samples.push({ phase, query, type: type || "all", state, iteration,
          count: catalog.length, search_ms: start.ms, save_ms: saved.ms, rate_ms: rated.ms });
        await search.drain();
        if (iteration === 0) {
          await post("track", trackBody(selected)); // idempotent duplicate save
          await post("rate", rateBody(selected, 3.5));
          assert.equal(Number((await store.pool.query("select rating from media_ratings")).rows[0].rating), 3.5);
          await post("rate", rateBody(selected, 0));
          assert.equal((await store.pool.query("select * from media_ratings")).rowCount, 0);
          assert.equal((await store.pool.query("select * from list_items")).rowCount, 1);
          if (!type) {
            const inline = await loadSearchFixtureFunction("inline-post", { store, provider });
            const list = await loadSearchFixtureFunction("add-media-to-list", { store, provider });
            routes["/inline"] = inline.handler; routes["/list"] = list.handler;
            for (const listType of ["queue", "finished", "dnf", "favorites"]) {
              await post("track", trackBody(selected, { listType }));
            }
            assert.equal((await store.pool.query("select * from list_items")).rowCount, 5);
            const fields = rateBody(selected);
            await post("list", { ...fields, list_id: fixtureList });
            assert.equal((await store.pool.query("select * from list_items")).rowCount, 5, "Dedicated list endpoint deduplicates too");
            await post("inline", { ...fields, type: "thought", rating: undefined,
              content: "Unrated fixture thought", visibility: "public" });
            const thought = (await store.pool.query("select * from social_posts where content=$1",
              ["Unrated fixture thought"])).rows[0];
            assert.equal(thought.rating, null);
            assert.equal(thought.canonical_media_id, items[0].canonical_media_id);
            // Same trigger that direct SDK post callers rely on: browser hints
            // cannot override the server-owned provider alias.
            const direct = await store.from("social_posts").insert({
              user_id: fixtureUser.id, content: "Direct SDK fixture", post_type: "thought",
              media_title: selected.title, media_type: selected.type,
              media_external_id: selected.external_id, media_external_source: selected.external_source,
              canonical_media_id: "ffffffff-ffff-4fff-8fff-ffffffffffff",
            }).select().single();
            assert.equal(direct.error, null);
            assert.equal(direct.data.canonical_media_id, items[0].canonical_media_id);
            // Also exercise competing immediate actions on another result.
            const concurrent = start.data.results.at(-2);
            await Promise.all([
              post("track", trackBody(concurrent)),
              post("rate", { ...rateBody(concurrent), skip_social_post: true }),
            ]);
            const alias = (await store.pool.query(
              "select canonical_media_id from media_provider_aliases where external_source=$1 and external_id=$2",
              [concurrent.external_source, concurrent.external_id],
            )).rows[0].canonical_media_id;
            const verdict = (await store.pool.query(
              "select canonical_media_id from media_ratings where media_external_source=$1 and media_external_id=$2",
              [concurrent.external_source, concurrent.external_id],
            )).rows[0];
            assert.equal(verdict.canonical_media_id, alias);
          }
        }
        const unexpectedErrors = store.errors.filter(error => error.code !== "23505");
        assert.deepEqual(unexpectedErrors, [], "No swallowed SQL/schema error may pass the action checks");
      }
      console.log(`PASS ${phase}: ${query}/${type || "all"}/${state}, search → immediate save → rating/review; duplicate, edit, delete`);
    }
  }
  }
  await mkdir("generated-artifacts/search-identity", { recursive: true });
  await writeFile(`generated-artifacts/search-identity/${phase}.json`, JSON.stringify({
    phase, environment: "Isolated PostgreSQL + real handler HTTP; fixture provider/auth/Supabase adapter; no artificial delays",
    outcomes, samples,
  }, null, 2));
  console.log(`PASS ${outcomes.length} coverage cases and ${samples.length} matched search/save/rate trials (${phase})`);
} finally {
  if (server.listening) {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  }
  await store.close();
}
