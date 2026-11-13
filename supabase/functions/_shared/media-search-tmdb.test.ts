import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { transformSync } from "esbuild";

// Run the real handler; only catalog/network and secret access are isolated.
const source = readFileSync(new URL("../media-search/index.ts", import.meta.url), "utf8")
  .replace(/^import .*;\r?$/gm, "");
const code = transformSync(source, { loader: "ts", format: "cjs" }).code;

function fixture(overrides: Record<string, unknown> = {}) {
  let handler!: (req: Request) => Promise<Response>;
  const requests: URL[] = [];
  const movie = {
    id: 755, title: "From Dusk Till Dawn", release_date: "1996-01-19",
    poster_path: "/movie.jpg", overview: "A crime thriller.", popularity: 20, vote_count: 1000,
  };
  const tv = {
    id: 124364, name: "FROM", first_air_date: "2022-02-20",
    poster_path: "/tv.jpg", overview: "A mystery series.", popularity: 30, vote_count: 2000,
  };
  const fetcher = async (input: string | URL | Request) => {
    const url = new URL(String(input));
    requests.push(url);
    if (url.hostname === "api.themoviedb.org") {
      if (url.pathname === "/3/search/movie") return Response.json({ results: [
        movie, { ...movie, id: 768, title: "From Hell" },
        { ...movie, id: 26389, title: "From Paris with Love" },
      ], ...overrides });
      if (url.pathname === "/3/search/tv") return Response.json({ results: [tv], ...overrides });
      if (url.pathname === "/3/search/multi") return Response.json({ results: [
        { ...tv, media_type: "tv" }, { ...movie, media_type: "movie" },
        { id: 999, name: "A Person", media_type: "person" },
      ], ...overrides });
      throw new Error(`Unexpected TMDB request: ${url.pathname}`);
    }
    if (url.hostname === "itunes.apple.com") return Response.json({ results: [] });
    if (url.hostname === "openlibrary.org") return Response.json({ docs: [] });
    if (url.hostname === "www.googleapis.com") return Response.json({ items: [] });
    if (url.pathname.endsWith("/gaming-search")) return Response.json({ results: [] });
    throw new Error(`Unexpected provider: ${url.hostname}${url.pathname}`);
  };
  new Function("serve", "createClient", "resolveCanonicalMedia", "Deno", "fetch", "EdgeRuntime", "console", code)(
    (fn: typeof handler) => { handler = fn; },
    () => { throw new Error("Unexpected database access"); },
    () => { throw new Error("Unexpected identity write"); },
    { env: { get: (key: string) => key === "TMDB_API_KEY" ? "fixture" : undefined } },
    fetcher, { waitUntil() {} }, { log() {}, warn() {}, error() {} },
  );
  async function search(type?: string, query = "from", method = "POST") {
    const body = { query, ...(type ? { type } : {}), include_book_series: false };
    const url = new URL("https://fixture.invalid/functions/v1/media-search");
    if (method === "GET") {
      url.searchParams.set("query", query);
      if (type) url.searchParams.set("type", type);
    }
    const response = await handler(new Request(url, method === "GET" ? undefined : {
      method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    }));
    assert.equal(response.status, 200);
    return response.json();
  }
  return { search, requests };
}

test("Movies searches the movie catalog and preserves typed-result tracking fields", async () => {
  const f = fixture();
  const data = await f.search("movie");
  assert.equal(data.results.length, 3);
  assert.ok(data.results.every((r: any) => r.type === "movie"));
  assert.deepEqual(f.requests.map(url => url.pathname), ["/3/search/movie"]);
  const movie = data.results.find((r: any) => r.external_id === "755");
  assert.equal(movie.title, "From Dusk Till Dawn");
  assert.equal(movie.external_source, "tmdb");
  assert.equal(movie.year, "1996");
  assert.equal(movie.media_subtype, null);
  assert.equal(movie.image, "https://image.tmdb.org/t/p/w300/movie.jpg");
  assert.equal(movie.image_url, movie.image);
});

test("TV searches the TV catalog and maps name, year, poster and series type", async () => {
  const f = fixture();
  const data = await f.search("tv");
  assert.deepEqual(f.requests.map(url => url.pathname), ["/3/search/tv"]);
  assert.equal(data.results.length, 1);
  assert.equal(data.results[0].title, "FROM");
  assert.equal(data.results[0].type, "tv");
  assert.equal(data.results[0].media_subtype, "series");
  assert.equal(data.results[0].external_id, "124364");
  assert.equal(data.results[0].year, "2022");
  assert.equal(data.results[0].image, "https://image.tmdb.org/t/p/w300/tv.jpg");
});

test("All retains mixed TMDB results, excludes people, and still calls other sources", async () => {
  const f = fixture();
  const data = await f.search();
  assert.deepEqual(data.results.map((r: any) => r.type).sort(), ["movie", "tv"]);
  assert.ok(f.requests.some(url => url.pathname === "/3/search/multi"));
  assert.ok(!f.requests.some(url => /\/search\/(movie|tv)$/.test(url.pathname)));
  assert.ok(f.requests.some(url => url.hostname === "itunes.apple.com"));
  assert.ok(f.requests.some(url => url.hostname === "openlibrary.org"));
});

test("explicit non-TMDB filters never start a TMDB search", async () => {
  for (const type of ["book", "music", "podcast", "youtube", "game"]) {
    const f = fixture();
    await f.search(type);
    assert.ok(!f.requests.some(url => url.hostname === "api.themoviedb.org"), type);
  }
});

test("primary and sequel searches respect Movies, TV and All with omitted media_type", async () => {
  for (const type of ["movie", "tv", undefined]) {
    const f = fixture({ results: [] });
    await f.search(type, "star wars 4");
    assert.deepEqual(f.requests.filter(url => url.hostname === "api.themoviedb.org")
      .map(url => [url.pathname, url.searchParams.get("query")]), [
      [`/3/search/${type || "multi"}`, "star wars 4"],
      [`/3/search/${type || "multi"}`, "star wars episode 4"],
    ]);
  }
});

test("typed sequel responses without media_type are retained and deduplicated", async () => {
  for (const type of ["movie", "tv"]) {
    const row = type === "movie"
      ? { id: 11, title: "Star Wars Episode IV", release_date: "1977-05-25" }
      : { id: 22, name: "Star Wars Episode IV", first_air_date: "2020-01-01" };
    const f = fixture({ results: [row] });
    const data = await f.search(type, "star wars 4");
    assert.equal(data.results.length, 1);
    assert.equal(data.results[0].type, type);
    assert.equal(data.results[0].external_id, String(row.id));
    assert.equal(f.requests.length, 2);
  }
});

test("GET requests use the same movie/TV routing and preserve query escaping", async () => {
  for (const type of ["movie", "tv"]) {
    const f = fixture();
    await f.search(type, "from & beyond", "GET");
    assert.equal(f.requests[0].pathname, `/3/search/${type}`);
    assert.equal(f.requests[0].searchParams.get("query"), "from & beyond");
    assert.equal(f.requests[0].searchParams.get("include_adult"), "false");
  }
});
