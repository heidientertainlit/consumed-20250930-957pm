import assert from "node:assert/strict";
import test from "node:test";
import { createMovieCollectionsHandler } from "../../../server/movie-collections";

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
  const handler = createMovieCollectionsHandler({
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
  const handler = createMovieCollectionsHandler({
    apiKey: () => "test-only",
    fetcher: (async input => {
      assert.equal(new URL(String(input)).pathname, "/3/collection/7");
      return new Response(JSON.stringify({ id: 7, name: "Harry Potter Collection", parts: [
        { id: 2, title: "Second", release_date: "2002-01-01" },
        { id: 1, title: "First", release_date: "2001-01-01", poster_path: "/first.jpg" },
        { id: 1, title: "Duplicate", release_date: "2001-01-01" },
        { id: 3, name: "TV series", media_type: "tv" },
        { id: 4, title: "Not suitable", adult: true },
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
  const handler = createMovieCollectionsHandler({
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
  const handler = createMovieCollectionsHandler({
    apiKey: () => "test-only",
    fetcher: (async () => {
      calls++;
      if (calls === 1) return new Response("Unavailable", { status: 503 });
      return new Response(JSON.stringify({ id: 7, name: "Collection", parts: [] }));
    }) as typeof fetch,
  });
  assert.equal((await request(handler, { collectionId: "7" })).status, 502);
  const retry = await request(handler, { collectionId: "7" });
  assert.equal(retry.status, 200);
  assert.deepEqual(retry.body.collection.movies, []);
});
