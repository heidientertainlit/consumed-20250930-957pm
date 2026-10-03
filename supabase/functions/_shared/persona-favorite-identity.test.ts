import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { knownFavoriteIdentity, mediaResolutionKey } from "./persona-favorite-identity.ts";
import { resolveMediaCandidate, createCachedPersonaMediaResolver, buildPersonaCandidates, type MediaResolutionDebug } from "./persona-media-candidates.ts";
import type { Persona } from "./persona-generation.ts";

const persona: Persona = { id: "real-uuid", user_name: "brooksj", display_name: "Julian Brooks", persona_config: { favorite_media: ["Blonde"], media_types: ["music", "movie"] } };
const wrong = { collectionName: "Blonde", artistName: "Alizée", collectionId: 1 };
const right = { collectionName: "Blonde", artistName: "Frank Ocean", collectionId: 2 };
async function provider(results: unknown[], body: (urls: string[]) => Promise<void>) {
  const original = globalThis.fetch, urls: string[] = [];
  globalThis.fetch = async input => { urls.push(String(input)); return new Response(JSON.stringify({ results })); };
  try { await body(urls); } finally { globalThis.fetch = original; }
}
test("trusted favorite hint is separate from untouched profiles and requires an actual configured favorite", () => {
  assert.deepEqual(knownFavoriteIdentity(persona, "BLONDE"), { title: "Blonde", type: "music", creator: "Frank Ocean" });
  assert.equal(knownFavoriteIdentity({ ...persona, user_name: "other" }, "Blonde"), undefined);
  assert.equal(knownFavoriteIdentity({ ...persona, persona_config: {} }, "Blonde"), undefined);
  assert.equal(knownFavoriteIdentity(persona, "Another album"), undefined);
});
test("provider search includes known artist and verifies both title and artist, not first title or fuzzy creator", async () => {
  await provider([wrong, { ...right, artistName: "Frank Ocean tribute" }, right], async urls => {
    const result = await resolveMediaCandidate("Blonde", "music", {}, " frank   ocean ");
    assert.equal(result!.creator, "Frank Ocean");
    assert.equal(result!.externalId, "2");
    assert.ok(new URL(urls[0]).searchParams.get("term")!.includes("ocean"));
    assert.equal(new URL(urls[0]).searchParams.get("entity"), "album");
  });
});
test("failed known identity rejects instead of title-only fallback, including missing creator or wrong title", async () => {
  for (const results of [[wrong], [{ collectionName: "Blonde", collectionId: 3 }], [{ ...right, collectionName: "Different album" }], []]) {
    await provider(results, async () => assert.equal(await resolveMediaCandidate("Blonde", "music", {}, "Frank Ocean"), null));
  }
  await assert.rejects(resolveMediaCandidate("Blonde", "music", {}, ""), /nonempty/);
  assert.equal(await resolveMediaCandidate("Blonde", "movie", {}, "Frank Ocean"), null);
});
test("known and unconstrained creator lookups cannot share cache entries; normalized identities can", async () => {
  await provider([wrong, right], async urls => {
    const debug: MediaResolutionDebug[] = [];
    const resolve = createCachedPersonaMediaResolver({}, entry => debug.push(entry));
    assert.equal((await resolve("Blonde", "music"))!.creator, "Alizée"); // Legacy unknown-creator behavior unchanged.
    assert.equal((await resolve("Blonde", "music", "Frank Ocean"))!.creator, "Frank Ocean");
    assert.equal((await resolve("BLONDE", "music", " frank  ocean "))!.creator, "Frank Ocean");
    assert.equal(urls.length, 2);
    assert.notEqual(debug[0].cacheKey, debug[1].cacheKey);
    assert.equal(debug[2].cacheHit, true);
    assert.equal(debug[1].resolved!.externalSource, "itunes");
    assert.equal(debug[1].requested.expectedCreator, "Frank Ocean");
    assert.equal(debug[1].status, "verified");
    assert.notEqual(mediaResolutionKey("Blonde", "music", "Alizée"), mediaResolutionKey("Blonde", "music", "Frank Ocean"));
  });
});
test("candidate builder enforces known favorites even if model labels them Discovery or resolver ignores hint", async () => {
  for (const source of ["Persona Favorite", "Discovery"]) {
    const seen: unknown[] = [];
    const chat = async () => JSON.stringify({ candidates: [{ title: "Blonde", type: "music", source }] });
    const rejected = await buildPersonaCandidates(persona, [], [], chat, async (title, type, creator) => {
      seen.push(creator); return { title, type, creator: "Alizée" };
    });
    assert.deepEqual(seen, ["Frank Ocean"]);
    assert.equal(rejected.length, 0);
    const accepted = await buildPersonaCandidates(persona, [], [], chat, async (title, type, creator) => ({ title, type, creator }));
    assert.equal(accepted.length, 1);
    assert.equal(accepted[0].creator, "Frank Ocean");
    assert.equal(accepted[0].source, source); // No selection/source weighting changes.
  }
  const wrongMedium = await buildPersonaCandidates(persona, [], [], async () => JSON.stringify({ candidates: [{ title: "Blonde", type: "movie", source: "Persona Favorite" }] }), async () => { throw Error("Wrong medium must not be resolved as the favorite"); });
  assert.equal(wrongMedium.length, 0);
});
test("both backend and local runner use the same creator-aware cache", () => {
  for (const path of ["supabase/functions/generate-persona-content/index.ts", "scripts/test-persona-generator-dry-run.ts"]) {
    const source = fs.readFileSync(path, "utf8");
    assert.ok(source.includes("createCachedPersonaMediaResolver(keys"));
    assert.ok(!source.includes("new Map<string, Promise<any>>"));
  }
});