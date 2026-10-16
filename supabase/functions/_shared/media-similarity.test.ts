import test from "node:test";
import assert from "node:assert/strict";
import { SIMILARITY_TYPES, similarityIdentity, similarityKey, similarityCards } from "../../../shared/media-similarity.ts";
import { createMediaSimilarity, similarityMeter } from "./media-similarity-engine.ts";
import { createSimilarityProviders } from "./media-similarity-providers.ts";
import type { LabWork } from "../../../shared/recommendation-lab.ts";

const response = (d: unknown) => new Response(JSON.stringify(d), { headers: { "Content-Type": "application/json" } });
function work(type: string, id: string): LabWork {
  const provider = type === "book" ? "openlibrary" : type === "youtube" ? "youtube" : ["music", "podcast"].includes(type) ? "itunes" : "tmdb";
  return { id, media_type: type, external_source: provider, external_id: id,
    title: `Verified ${id}`, source_verified: true, destination_path: `/media/${type}/${provider}/${id}`,
    source_metadata: { creator: "Author", subjects: ["Thriller"], description: "A source-grounded description." },
    verification: {}, profile: { appeal: [{ label: "Twisty suspense", evidence: "source-grounded description" }] }, status: "profiled" };
}
test("identities normalize aliases, retain media type, and reject unsafe values", () => {
  assert.deepEqual(similarityIdentity({ source: "open_library", externalId: "/works/OL123W", type: "book" }),
    { source: "openlibrary", externalId: "OL123W", type: "book" });
  for (const id of ["", "bad\nid", "bad?id", "bad#id"]) assert.throws(() => similarityIdentity({ source: "tmdb", externalId: id, type: "movie" }));
  assert.notEqual(similarityKey({ source: "tmdb", externalId: "12", type: "movie" }), similarityKey({ source: "tmdb", externalId: "12", type: "tv" }));
  assert.throws(() => similarityIdentity({ source: "rawg", externalId: "12", type: "game" }), "Do not add unsupported consumer destinations");
});
test("only public verified card fields cross the consumer boundary", () => {
  const row = { title: "Book", type: "book", external_source: "openlibrary", external_id: "OL1W", poster_url: "http://unsafe.invalid",
    profile: { secret: true }, actor: "private" };
  assert.deepEqual(similarityCards([row, row, { title: "Invented", type: "book" }]),
    [{ title: "Book", type: "book", external_source: "openlibrary", external_id: "OL1W", poster_url: "" }]);
});
test("cached results are shared across visitors, without provider/model work", async () => {
  const actions: string[] = [];
  const card = { title: "Book", type: "book", external_source: "openlibrary", external_id: "OL1W", poster_url: "" };
  const service = createMediaSimilarity(async action => { actions.push(action); return { items: [card], fresh: true }; },
    () => undefined, () => assert.fail("No background task"), async () => { assert.fail("No network"); });
  for (const visitor of ["a", "b"]) assert.equal((await service.load({ source: "tmdb", externalId: "new-title", type: "movie" }, visitor)).items[0].title, "Book");
  assert.deepEqual(actions, ["read", "read"]);
});
for (const type of SIMILARITY_TYPES) test(`${type}: unprepared titles use cross-media ranking, no 11-title whitelist`, async () => {
  const jobs: Promise<unknown>[] = [], finishes: any[] = [];
  let preparing = false;
  const identity = { source: work(type, "id").external_source, externalId: `new-${type}`, type };
  const source = work(type, identity.externalId);
  const service = createMediaSimilarity(async (action, p = {}) => {
    if (action === "read") return { items: [], fresh: false };
    if (action === "claim") {
      if (preparing) return { preparing: true };
      preparing = true; return { token: "lease" };
    }
    if (action === "profile") return source;
    if (action === "pool") return [source, work("book", "OL1W"), work("movie", "222"), work("podcast", "333")];
    if (action === "finish") { finishes.push(p); return {}; }
    throw new Error(`Unexpected ${action}`);
  }, () => undefined, job => jobs.push(job), async () => response({ docs: [], results: [], genres: [] }));
  const initial = await service.load(identity, "visitor-a");
  assert.equal(initial.preparing, true);
  assert.equal((await service.load(identity, "visitor-b")).preparing, true);
  assert.equal(jobs.length, 1, "Concurrent visitors must not start duplicate preparation");
  await Promise.all(jobs);
  assert.equal(finishes.length, 1);
  assert.ok(finishes[0].items.length >= 2);
  assert.ok(new Set(finishes[0].items.map((x: any) => x.type)).size >= 2);
  assert.ok(!finishes[0].items.some((x: any) => x.external_id === identity.externalId));
  assert.equal(finishes[0].cost, 0);
});
test("stale cards stay available during refresh and budget denial", async () => {
  const card = { title: "Existing book", type: "book", external_source: "openlibrary", external_id: "OL1W", poster_url: "" };
  const service = createMediaSimilarity(async action => action === "read" ? { items: [card], fresh: false } : {},
    () => undefined, () => assert.fail("Budget denial must not start paid work"));
  const result = await service.load({ source: "tmdb", externalId: "1", type: "movie" }, "visitor");
  assert.equal(result.items[0].title, card.title);
  assert.equal(result.preparing, false);
});
test("preparation failure is settled; nothing invented is published", async () => {
  const jobs: Promise<unknown>[] = [], finishes: any[] = [];
  const service = createMediaSimilarity(async (action, p = {}) => {
    if (action === "read") return {};
    if (action === "claim") return { token: "lease" };
    if (action === "profile") return null;
    if (action === "finish") { finishes.push(p); return {}; }
  }, () => undefined, job => jobs.push(job), async () => { throw new Error("Network unavailable"); });
  await service.load({ source: "tmdb", externalId: "new", type: "movie" }, "visitor");
  await Promise.all(jobs);
  assert.equal(finishes[0].items.length, 0);
  assert.ok(finishes[0].error);
});
test("model meter bounds reservations and retains unknown outcomes", async () => {
  const m = similarityMeter();
  await m.store("reserve", { token: "a", amount: 0.01 });
  assert.equal(m.cost(), 0.01);
  await m.store("settle", { token: "a", actual: 0.001 });
  await m.store("reserve", { token: "unknown", amount: 0.01 });
  assert.equal(m.cost(), 0.011);
  await assert.rejects(m.store("reserve", { token: "too-much", amount: 0.25 }));
  await assert.rejects(m.store("settle", { token: "unknown", actual: -1 }));
});
test("provider/type mismatches fail before touching a catalog", async () => {
  const providers = createSimilarityProviders(() => "test", async () => { assert.fail("No catalog request"); });
  await assert.rejects(providers.details("googlebooks", "123", "movie"), /mismatch/);
});
test("YouTube IDs and handles are verified through their real endpoint contracts", async () => {
  const urls: string[] = [];
  const providers = createSimilarityProviders(() => "test", async url => {
    urls.push(String(url));
    return response({ items: [{ id: "UCabcdefghijklmnopqrstuv", snippet: { title: "A channel", description: "Verified description" } }] });
  });
  assert.equal((await providers.details("youtube", "@channel", "youtube")).source_metadata.media_subtype, "channel");
  assert.match(urls[0], /channels\?part=snippet&forHandle=%40channel/);
  await assert.rejects(providers.details("youtube", "../../private", "youtube"));
});
for (const type of SIMILARITY_TYPES) test(`${type}: cold preparation executes real provider parsing and grounded model contracts`, async () => {
  const source = type === "book" ? "googlebooks" : work(type, "id").external_source;
  const identity = { source, type, externalId: type === "youtube" ? "abcdefghijk" : type === "podcast" ? "101" : "100" };
  const evidence = "A tense investigation reveals family secrets and shifting loyalties. The story builds suspense through surprising reversals and an uncertain resolution.";
  const jobs: Promise<unknown>[] = [], saved: LabWork[] = [], finishes: any[] = [], models: string[] = [];
  const service = createMediaSimilarity(async (action, p = {}) => {
    if (action === "read") return {};
    if (action === "claim") return { token: "lease" };
    if (action === "profile") return null;
    if (action === "save_profile") { saved.push(p.work); return {}; }
    if (action === "pool") return [work("book", "OL99W"), work("movie", "999")];
    if (action === "finish") { finishes.push(p); return {}; }
    throw new Error(`Unexpected store action ${action}`);
  }, () => "fixture-not-a-credential", job => jobs.push(job), async (input, init) => {
    const url = new URL(String(input));
    if (url.hostname === "api.openai.com") {
      models.push(url.pathname);
      const body = JSON.parse(String(init?.body));
      if (url.pathname.endsWith("/chat/completions")) {
        assert.match(body.messages[0].content, /JSON/);
        assert.ok(body.messages[0].content.includes(evidence));
        return response({ model: "gpt-4o-mini", usage: { prompt_tokens: 100, completion_tokens: 100 },
          choices: [{ message: { content: JSON.stringify({ appeal: [{ label: "Twisty suspense", evidence: "A tense investigation reveals family secrets" }] }) } }] });
      }
      assert.equal(body.model, "text-embedding-3-small");
      return response({ model: body.model, usage: { total_tokens: 20 },
        data: body.input.map((_: string, index: number) => ({ index, embedding: Array(256).fill(0.1) })) });
    }
    if (url.pathname === `/3/${type}/100`) return response({ id: 100, title: "Source title", name: "Source title",
      overview: evidence, genres: [{ name: "Thriller" }], credits: { crew: [{ job: "Director", name: "Author" }] }, created_by: [{ name: "Author" }] });
    if (url.pathname === "/books/v1/volumes/100") return response({ volumeInfo: {
      title: "Source title", authors: ["Author"], description: evidence, categories: ["Thriller"] } });
    if (url.pathname === "/lookup") return response({ results: [{ collectionId: Number(identity.externalId), collectionName: "Source title",
      artistName: "Author", kind: type === "podcast" ? "podcast" : "album", genres: ["Thriller"],
      // Music catalog names/genres alone must NOT be fabricated into a sound profile.
      ...(type === "podcast" ? { description: evidence } : {}) }] });
    if (url.pathname === "/youtube/v3/videos") return response({ items: [{ id: identity.externalId,
      snippet: { title: "Source title", channelTitle: "Author", description: evidence, tags: ["Thriller"] } }] });
    return response({ results: [], docs: [], genres: [], items: [] });
  });
  await service.load(identity, "visitor");
  await Promise.all(jobs);
  assert.equal(saved[0]?.source_verified, true);
  assert.equal(saved[0]?.external_source, source);
  assert.equal(finishes[0]?.error, null);
  assert.equal(finishes[0].items.length, 2);
  assert.equal(models.length, type === "music" ? 0 : 2);
  assert.equal(saved[0].status, type === "music" ? "verified" : "embedded");
  assert.ok(finishes[0].cost < 0.01);
});
