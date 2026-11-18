import assert from "node:assert/strict";
import test from "node:test";
import { createMovieCollectionsHandler } from "../../../server/movie-collections";

/** Keep the real policy; isolate only provider/model transport. */
function fixtureHandler(options: Parameters<typeof createMovieCollectionsHandler>[0], fixtures: {
  collections?: Record<string, any>; decisions?: Record<string, string>; modelFailure?: boolean; detailFailure?: boolean;
} = {}) {
  const summaries = new Map<string, any>(), movies = new Map<string, any>();
  return createMovieCollectionsHandler({
    ...options, modelKey: () => "test-only",
    fetcher: (async (input, init) => {
      const url = new URL(String(input));
      if (url.hostname === "api.openai.com") {
        if (fixtures.modelFailure) return new Response("", { status: 503 });
        const items = JSON.parse(JSON.parse(String(init?.body)).messages[1].content).items;
        return Response.json({ choices: [{ message: { content: JSON.stringify({ decisions: items.map((item: any) => ({
          key: item.key, category: fixtures.decisions?.[item.key] || "non_pornographic",
          confidence: "high", reason: "Reviewed fixture narrative-work evidence.",
        })) }) } }] });
      }
      if (/^\/3\/movie\/\d+$/.test(url.pathname)) {
        if (fixtures.detailFailure) return new Response("", { status: 503 });
        return Response.json(movies.get(url.pathname.split("/").at(-1)!) || {});
      }
      const id = url.pathname.split("/").at(-1)!;
      let response: Response;
      if (url.pathname.startsWith("/3/collection/") && summaries.has(id)) {
        const parent = summaries.get(id);
        response = Response.json(fixtures.collections?.[id] || {
          ...parent, parts: [{ id: Number(id) * 100 + 1, title: `Narrative film ${id}` }],
        });
      } else response = await options!.fetcher!(input, init);
      const data = await response.clone().json().catch(() => null);
      for (const summary of data?.results || []) summaries.set(String(summary.id), summary);
      for (const movie of data?.parts || []) movies.set(String(movie.id), movie);
      return response;
    }) as typeof fetch,
  });
}

function request(handler: ReturnType<typeof createMovieCollectionsHandler>, query: object, method = "GET") {
  const result = { status: 0, body: null as any, headers: {} as Record<string, string> };
  const res: any = {
    setHeader: (name: string, value: string) => { result.headers[name] = value; },
    status: (status: number) => { result.status = status; return res; },
    json: (body: any) => { result.body = body; return res; },
    end: () => res,
  };
  return handler({ query, method }, res).then(() => result);
}

test("search uses the TMDB collection endpoint, bounds results, and caches repeated searches", async () => {
  let calls = 0;
  const handler = fixtureHandler({
    apiKey: () => "test-only",
    fetcher: (async input => {
      calls++;
      const url = new URL(String(input));
      assert.equal(url.pathname, "/3/search/collection");
      assert.equal(url.searchParams.get("query"), "Harry Potter");
      assert.equal(url.searchParams.get("include_adult"), "false");
      return new Response(JSON.stringify({ results: Array.from({ length: 6 }, (_, i) => ({ id: i + 1, name: `Collection ${i}`, poster_path: "/poster.jpg" })) }));
    }) as typeof fetch,
  });
  const first = await request(handler, { query: "Harry Potter" });
  assert.equal(first.status, 200);
  assert.equal(first.body.collections.length, 3);
  assert.deepEqual(first.body.collections[0], { id: "1", title: "Collection 0", image: "https://image.tmdb.org/t/p/w185/poster.jpg" });
  assert.equal(JSON.stringify(first.body).includes("test-only"), false);
  await request(handler, { query: "harry potter" });
  assert.equal(calls, 1);
});

test("expansion returns real individual movie IDs in release order, excluding non-movies and duplicates", async () => {
  const handler = fixtureHandler({
    apiKey: () => "test-only",
    fetcher: (async input => {
      assert.equal(new URL(String(input)).pathname, "/3/collection/7");
      return new Response(JSON.stringify({ id: 7, name: "Harry Potter Collection", parts: [
        { id: 2, title: "Second", release_date: "2002-01-01" },
        { id: 1, title: "First", release_date: "2001-01-01", poster_path: "/first.jpg" },
        { id: 1, title: "Duplicate", release_date: "2001-01-01" },
        { id: 3, name: "TV series", media_type: "tv" },
      ] }));
    }) as typeof fetch,
  });
  const result = await request(handler, { collectionId: "7" });
  assert.equal(result.status, 200);
  assert.deepEqual(result.body.collection.movies.map((movie: any) => movie.external_id), ["1", "2"]);
  assert.deepEqual(result.body.collection.movies[0], { title: "First", type: "movie", external_id: "1", external_source: "tmdb", image: "https://image.tmdb.org/t/p/w185/first.jpg", year: 2001 });
  assert.equal(result.body.collection.movies.some((movie: any) => movie.type !== "movie"), false);
});

test("invalid requests never reach TMDB; missing configuration and provider failures are explicit", async () => {
  let calls = 0;
  const handler = fixtureHandler({
    apiKey: () => "test-only",
    fetcher: (async () => { calls++; throw new Error("Do not expose upstream URL or credential"); }) as typeof fetch,
  });
  for (const query of [{}, { query: "a" }, { query: "x".repeat(121) }, { collectionId: "../movie/1" }, { collectionId: ["1", "2"] }, { collectionId: "0" }, { query: "Harry Potter", collectionId: "7" }]) {
    assert.equal((await request(handler, query)).status, 400);
  }
  assert.equal((await request(handler, { query: "Harry Potter" }, "POST")).status, 405);
  assert.equal((await request(handler, {}, "OPTIONS")).status, 204);
  assert.equal(calls, 0);
  const failure = await request(handler, { query: "Harry Potter" });
  assert.equal(failure.status, 502);
  assert.equal(JSON.stringify(failure.body).includes("credential"), false);
  assert.equal((await request(createMovieCollectionsHandler({ apiKey: () => undefined }), { query: "Harry Potter" })).status, 503);
});

test("failed collection lookups can be retried and never populate the success cache", async () => {
  let calls = 0;
  const handler = fixtureHandler({
    apiKey: () => "test-only",
    fetcher: (async () => {
      calls++;
      if (calls === 1) return new Response("Unavailable", { status: 503 });
      return new Response(JSON.stringify({ id: 7, name: "Collection", parts: [{ id: 1, title: "First" }] }));
    }) as typeof fetch,
  });
  assert.equal((await request(handler, { collectionId: "7" })).status, 502);
  const retry = await request(handler, { collectionId: "7" });
  assert.equal(retry.status, 200);
  assert.equal(retry.body.collection.movies[0].external_id, "1");
});

const explicitCollection = {
  id: 1024107, name: "The Office: A XXX Parody Collection",
  adult: false, poster_path: "/explicit-collection.jpg",
};

test("collection search blocks the reproduced false adult flag and missing flags before caching titles or artwork", async () => {
  let calls = 0;
  const handler = fixtureHandler({
    apiKey: () => "test-only",
    fetcher: (async () => {
      calls++;
      return Response.json({ results: [
        explicitCollection,
        { id: 2, name: "Office Pornographic Parody Collection", poster_path: "/explicit-two.jpg" },
        { id: 3, name: "Flagged collection", adult: true, poster_path: "/flagged.jpg" },
        { id: 4, name: "The Office Collection", adult: false, poster_path: "/office.jpg" },
        { id: 5, name: "xXx Collection", adult: false, overview: "Action thrillers about secret agents." },
        { id: 6, name: "Harry Potter Collection" },
      ] });
    }) as typeof fetch,
  });
  for (let i = 0; i < 2; i++) {
    const result = await request(handler, { query: "the office" });
    assert.equal(result.status, 200);
    assert.deepEqual(result.body.collections.map((item: any) => item.id), ["4", "5", "6"]);
    assert.doesNotMatch(JSON.stringify(result.body), /explicit|flagged|1024107/i);
  }
  assert.equal(calls, 1, "the success cache must contain only filtered results");
});

test("direct collection requests block unsafe parent metadata without exposing title, artwork, or films", async () => {
  for (const parent of [
    explicitCollection,
    { id: 1024107, name: "Ordinary name", adult: true },
    { id: 1024107, name: "Ordinary name", overview: "A pornographic parody of a sitcom." },
    { id: 1024107, name: "Ordinary name", original_name: "The Office: A XXX Parody Collection" },
  ]) {
    const handler = fixtureHandler({
      apiKey: () => "test-only",
      fetcher: (async () => Response.json({
        ...parent, poster_path: "/private-artwork.jpg",
        parts: [{ id: 50, title: "Must not disclose", poster_path: "/private-film.jpg" }],
      })) as typeof fetch,
    });
    for (let i = 0; i < 2; i++) {
      const result = await request(handler, { collectionId: "1024107" });
      assert.equal(result.status, 404);
      assert.deepEqual(result.body, { error: "Collection unavailable" });
    }
  }
});

test("a mixed collection containing pornography is unavailable as a whole, not partially exposed", async () => {
  let calls = 0;
  const handler = fixtureHandler({
    apiKey: () => "test-only",
    fetcher: (async () => {
      calls++;
      return Response.json({ id: 7, name: "Mainstream Collection", parts: [
        { id: 1, title: "The Office: A XXX Parody", adult: false, poster_path: "/explicit.jpg" },
        { id: 2, title: "Flagged film", adult: true },
        { id: 3, title: "Office", overview: "A pornographic parody of a workplace sitcom." },
        { id: 4, title: "The Office", adult: false, release_date: "2005-01-01" },
        { id: 5, title: "xXx", overview: "An extreme sports athlete becomes a secret agent.", release_date: "2002-01-01" },
        { id: 6, title: "Romance", overview: "A mature romance with sexual themes.", release_date: "2000-01-01" },
      ] });
    }) as typeof fetch,
  });
  for (let i = 0; i < 2; i++) {
    const result = await request(handler, { collectionId: "7" });
    assert.equal(result.status, 404);
    assert.doesNotMatch(JSON.stringify(result.body), /explicit|parody|flagged/i);
  }
  assert.equal(calls, 2, "blocked parents are not stored in the success response cache");
});

const softPornCollection = {
  id: 1164478, name: "Love in the Bosses Office Collection", adult: false, overview: "", poster_path: "/soft-porn.jpg",
  parts: [
    { id: 140971, title: "Love in the Bosses Office", adult: false, softcore: false },
    { id: 948855, title: "Love in the Bosses Office 2", adult: false, softcore: false },
  ],
};
test("reported collection and both films are excluded via member classification before search/direct serialization", async () => {
  const handler = fixtureHandler({
    apiKey: () => "test-only",
    fetcher: (async input => Response.json(String(input).includes("/search/") ? { results: [softPornCollection] } : softPornCollection)) as typeof fetch,
  }, { collections: { "1164478": softPornCollection }, decisions: { "movie:140971": "softcore_pornography", "movie:948855": "softcore_pornography" } });
  for (let repeat = 0; repeat < 2; repeat++) {
    const search = await request(handler, { query: "the office" });
    assert.equal(search.status, 200);
    assert.deepEqual(search.body, { collections: [] });
    const direct = await request(handler, { collectionId: "1164478" });
    assert.equal(direct.status, 404);
    assert.doesNotMatch(JSON.stringify(direct.body), /Bosses|140971|948855|soft-porn.jpg/);
  }
});

test("missing members, lookup failures and uncertain/model failures never expose collection metadata", async () => {
  for (const fixtures of [
    { modelFailure: true }, { detailFailure: true },
    { decisions: { "movie:948855": "uncertain" } },
    { collections: { "1164478": { ...softPornCollection, parts: [] } } },
  ]) {
    const collection = fixtures.collections?.["1164478"] || softPornCollection;
    const handler = fixtureHandler({
      apiKey: () => "test-only",
      fetcher: (async input => Response.json(String(input).includes("/search/") ? { results: [collection] } : collection)) as typeof fetch,
    }, { collections: { "1164478": collection }, ...fixtures });
    assert.equal((await request(handler, { query: "the office" })).status, 503);
    const direct = await request(handler, { collectionId: "1164478" });
    assert.equal(direct.status, 503);
    assert.doesNotMatch(JSON.stringify(direct.body), /Bosses|soft-porn.jpg/);
  }
});
