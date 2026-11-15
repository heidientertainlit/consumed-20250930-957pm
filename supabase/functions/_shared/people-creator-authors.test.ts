import assert from "node:assert/strict";
import test from "node:test";
import { build } from "esbuild";
import { searchPeopleCreatorAuthors, sameCreatorAuthority, type PeopleCreatorResult } from "./people-creator-authors";
import { creatorMatches, matchingCreatorFollows } from "../../../client/src/components/creator-search-identity";

const writer: PeopleCreatorResult = {
  name: "Kristin Hannah", role: "Writer", image: "portrait.jpg",
  external_source: "tmdb", external_id: "1932549", known_for: ["Firefly Lane", "Wer zu lieben wagt"],
};
const legacy = { creator_name: "Kristin Hannah", external_source: "googlebooks", external_id: "old-book" };
const doc = { key: "OL30522A", name: "Kristin Hannah", top_work: "The Nightingale", work_count: 100 };

function providers(overrides: Record<string, any> = {}) {
  const calls: string[] = [];
  const fetcher: typeof fetch = async input => {
    const url = String(input);
    calls.push(url);
    const path = new URL(url).pathname;
    const values: Record<string, any> = {
      "/search/authors.json": { docs: [doc] },
      "/authors/OL30522A.json": { key: "/authors/OL30522A", remote_ids: { wikidata: "Q533400", imdb: "nm3731939" } },
      "/3/person/1932549/external_ids": { wikidata_id: "Q533400", imdb_id: "nm3731939" },
      "/books/v1/volumes/old-book": {
        volumeInfo: { authors: ["Kristin Hannah"], industryIdentifiers: [{ type: "ISBN_13", identifier: "9780312577223" }] },
      },
      "/api/books": { "ISBN:9780312577223": { authors: [{ url: "https://openlibrary.org/authors/OL30522A/Kristin_Hannah" }] } },
      "/3/search/person": {
        results: [{ id: 1932549, name: "Kristin Hannah", known_for_department: "Writing",
          profile_path: "/portrait.jpg", known_for: [{ name: "Firefly Lane" }] }],
      },
      "/books/v1/volumes": {
        items: [{ id: "old-book", volumeInfo: { authors: ["Kristin Hannah"], title: "The Nightingale" } }],
      },
    };
    const value = Object.hasOwn(overrides, path) ? overrides[path] : values[path];
    if (value === undefined) throw new Error(`Unexpected test request ${path}`);
    return value instanceof Response ? value : Response.json(value);
  };
  return { fetcher, calls };
}

test("cross-catalog merging needs matching authority IDs and rejects conflicts", () => {
  assert.equal(sameCreatorAuthority({}, {}), false);
  assert.equal(sameCreatorAuthority({ wikidata: "Q1" }, { wikidata: "Q1" }), true);
  assert.equal(sameCreatorAuthority({ imdb: "nm1" }, { imdb: "nm1" }), true);
  assert.equal(sameCreatorAuthority({ wikidata: "Q1", imdb: "nm1" }, { wikidata: "Q2", imdb: "nm1" }), false);
});

test("verified Kristin Hannah becomes one Author with her portrait, book title and both IDs", async () => {
  const provider = providers();
  const { results } = await searchPeopleCreatorAuthors("Kristin Hannah", [writer], {
    fetcher: provider.fetcher, tmdbKey: "fixture-key",
  });
  assert.equal(results.length, 1);
  assert.equal(results[0].role, "Author");
  assert.equal(results[0].image, "portrait.jpg");
  assert.deepEqual(results[0].known_for, ["The Nightingale"]);
  assert.equal(results[0].external_source, "tmdb");
  assert.ok(creatorMatches(results[0], { external_source: "openlibrary", external_id: "OL30522A" }));
  assert.ok(!provider.calls.some(url => url.includes("googleapis")));
});

test("same names without shared identity evidence stay separate", async () => {
  const { fetcher } = providers({ "/3/person/1932549/external_ids": {} });
  const { results } = await searchPeopleCreatorAuthors("Kristin Hannah", [writer], { fetcher, tmdbKey: "fixture" });
  assert.equal(results.length, 2);
  assert.equal(results[0].role, "Writer");
  assert.equal(results[1].external_source, "openlibrary");
});

test("a verified book credit cannot relabel an actor or director as an Author", async () => {
  for (const role of ["Actor", "Director", "Producer"]) {
    const { fetcher } = providers();
    const person = { ...writer, role };
    const { results } = await searchPeopleCreatorAuthors("Kristin Hannah", [person], {
      fetcher, tmdbKey: "fixture",
    });
    assert.equal(results.length, 1);
    assert.equal(results[0].role, role);
    assert.deepEqual(results[0].known_for, person.known_for);
  }
});

test("old Google Books follows get an alias only after ISBN verifies the author", async () => {
  const { fetcher, calls } = providers();
  const { results } = await searchPeopleCreatorAuthors("Kristin Hannah", [writer], {
    fetcher, tmdbKey: "fixture", googleBooksKey: "fixture-books-key", legacyFollows: [legacy],
  });
  assert.equal(results.length, 1);
  assert.equal(creatorMatches(results[0], legacy), true);
  assert.equal(matchingCreatorFollows(results[0], [legacy, writer]).length, 2);
  assert.ok(calls.some(url => new URL(url).searchParams.get("key") === "fixture-books-key"));
});

test("a same-name old book linked to a different author is not an alias", async () => {
  const { fetcher } = providers({
    "/api/books": { "ISBN:9780312577223": { authors: [{ url: "https://openlibrary.org/authors/OL999A" }] } },
  });
  const { results } = await searchPeopleCreatorAuthors("Kristin Hannah", [writer], {
    fetcher, tmdbKey: "fixture", legacyFollows: [legacy],
  });
  assert.equal(creatorMatches(results[0], legacy), false);
});

test("failed author search is explicit and preserves actor/musician results", async () => {
  const { fetcher } = providers({ "/search/authors.json": new Response("Unavailable", { status: 503 }) });
  const musician = { ...writer, role: "Musician", external_source: "spotify", external_id: "artist" };
  const { results, warnings } = await searchPeopleCreatorAuthors("Kristin Hannah", [writer, musician], { fetcher });
  assert.deepEqual(results, [writer, musician]);
  assert.equal(warnings.length, 1);
});

test("failed author details do not erase a real author or guess a merge", async () => {
  const { fetcher } = providers({ "/authors/OL30522A.json": new Response("", { status: 429 }) });
  const { results } = await searchPeopleCreatorAuthors("Kristin Hannah", [writer], { fetcher, tmdbKey: "fixture" });
  assert.equal(results.length, 2);
  assert.equal(results[1].external_id, "OL30522A");
});

test("author-only search uses a person ID, not a book cover or volume ID", async () => {
  const { fetcher } = providers();
  const { results } = await searchPeopleCreatorAuthors("Kristin Hannah", [], { fetcher });
  assert.equal(results[0].external_id, "OL30522A");
  assert.equal(results[0].image, "");
});

test("Jennifer Lawrence namesakes cannot be erased by an unverified author", async () => {
  const people = ["72129", "4863981", "6245600"].map(external_id => ({
    name: "Jennifer Lawrence", role: "Actor", external_source: "tmdb", external_id,
  }));
  const { fetcher } = providers({
    "/search/authors.json": { docs: [{ ...doc, name: "Jennifer Lawrence" }] },
    "/authors/OL30522A.json": { key: "/authors/OL30522A", remote_ids: {} },
  });
  const { results } = await searchPeopleCreatorAuthors("Jennifer Lawrence", people, { fetcher });
  assert.deepEqual(results.slice(0, 3), people);
  assert.equal(results.length, 4);
});

test("the real handler opts in only for People; all other callers still use Google Books", async () => {
  const bundle = await build({
    entryPoints: ["supabase/functions/search-creators/index.ts"], bundle: true, write: false,
    platform: "node", format: "esm",
    plugins: [{
      name: "capture-handler", setup(builder) {
        builder.onResolve({ filter: /^https:\/\/deno.land\// }, () => ({ path: "serve", namespace: "fixture" }));
        builder.onLoad({ filter: /.*/, namespace: "fixture" }, () => ({
          contents: "export function serve(handler) { globalThis.__creatorSearchHandler = handler; }",
        }));
      },
    }],
  });
  const previousFetch = globalThis.fetch;
  const globals = globalThis as any;
  const previousDeno = globals.Deno;
  try {
    globals.Deno = { env: { get: (name: string) => name === "TMDB_API_KEY" ? "fixture-key" : undefined } };
    await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString("base64")}`);
    for (const [scope, expectedSource] of [[undefined, "googlebooks"], ["unrecognized", "googlebooks"], ["people-creators", "openlibrary"]]) {
      const provider = providers();
      globalThis.fetch = provider.fetcher;
      const response = await globals.__creatorSearchHandler(new Request("https://fixture/search-creators", {
        method: "POST", body: JSON.stringify({ query: "Kristin Hannah", scope }),
      }));
      assert.equal(response.status, 200);
      const body = await response.json();
      if (expectedSource === "googlebooks") {
        assert.equal(body.results.length, 2);
        assert.equal(body.results[1].external_source, "googlebooks");
        assert.ok(!provider.calls.some(url => url.includes("openlibrary")));
        assert.equal(Object.hasOwn(body, "warnings"), false);
      } else {
        assert.equal(body.results.length, 1);
        assert.equal(body.results[0].role, "Author");
        assert.ok(!provider.calls.some(url => url.includes("googleapis")));
      }
      assert.ok(!provider.calls.some(url => url.includes("media-search") || url.includes("follow-creator")));
    }
  } finally {
    globalThis.fetch = previousFetch;
    globals.Deno = previousDeno;
    delete globals.__creatorSearchHandler;
  }
});
