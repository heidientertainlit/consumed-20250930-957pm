import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { transformSync } from "esbuild";
import { isAllowedCatalogVideo } from "./catalog-content-safety";
import { createCatalogVideoGate } from "./catalog-video-classification";

// Run the real handler; only catalog/network and secret access are isolated.
const source = readFileSync(new URL("../media-search/index.ts", import.meta.url), "utf8")
  .replace(/^import .*;\r?$/gm, "");
const code = transformSync(source, { loader: "ts", format: "cjs" }).code;

function fixture(overrides: Record<string, unknown> = {}, options: {
  detail?: unknown; modelResults?: unknown[]; classifications?: Record<string, string>; classificationFailure?: boolean;
  correction?: string; retryResults?: unknown[];
} = {}) {
  let handler!: (req: Request) => Promise<Response>;
  const requests: URL[] = [];
  let classificationRequests = 0;
  const movie = {
    id: 755, title: "From Dusk Till Dawn", release_date: "1996-01-19",
    poster_path: "/movie.jpg", overview: "A crime thriller.", popularity: 20, vote_count: 1000,
  };
  const tv = {
    id: 124364, name: "FROM", first_air_date: "2022-02-20",
    poster_path: "/tv.jpg", overview: "A mystery series.", popularity: 30, vote_count: 2000,
  };
  const fetcher = async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(String(input));
    requests.push(url);
    if (url.hostname === "api.themoviedb.org") {
      if (/^\/3\/movie\/\d+$/.test(url.pathname) && options.detail !== undefined) {
        return Response.json(options.detail);
      }
      if (/^\/3\/(?:movie|tv)\/\d+$/.test(url.pathname)) {
        const id = Number(url.pathname.split("/").at(-1));
        const row = [...(Array.isArray(overrides.results) ? overrides.results : []), movie, { ...movie, id: 768, title: "From Hell" }, { ...movie, id: 26389, title: "From Paris with Love" }, tv]
          .find(item => item.id === id);
        return Response.json(row || { id, title: "Fixture narrative film" });
      }
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
    if (url.hostname === "api.openai.com") {
      const payload = JSON.parse(String(init?.body));
      if (payload.messages[0].content.startsWith("You classify catalog")) {
        classificationRequests++;
        if (options.classificationFailure) return new Response("", { status: 503 });
        return Response.json({ choices: [{ message: { content: JSON.stringify({ decisions:
          JSON.parse(payload.messages[1].content).items.map((item: any) => ({
            key: item.key, category: options.classifications?.[item.key] || "non_pornographic",
            confidence: "high", reason: "Fixture-reviewed catalog evidence.",
          })),
        }) } }] });
      }
      const content = payload.messages[0].content.startsWith("You correct misspelled")
        ? options.correction || payload.messages[1].content : JSON.stringify(options.modelResults || []);
      return Response.json({ choices: [{ message: { content } }] });
    }
    if (url.pathname.endsWith("/gaming-search")) return Response.json({ results: [] });
    if (url.pathname.endsWith("/media-search")) return Response.json({ results: options.retryResults || [] });
    throw new Error(`Unexpected provider: ${url.hostname}${url.pathname}`);
  };
  new Function("serve", "createClient", "resolveCanonicalMedia", "Deno", "fetch", "EdgeRuntime", "console", "isAllowedCatalogVideo", "createCatalogVideoGate", code)(
    (fn: typeof handler) => { handler = fn; },
    () => { throw new Error("Unexpected database access"); },
    () => { throw new Error("Unexpected identity write"); },
    { env: { get: (key: string) => key === "TMDB_API_KEY" || key === "OPENAI_API_KEY" ? "fixture" : undefined } },
    fetcher, { waitUntil() {} }, { log() {}, warn() {}, error() {} }, isAllowedCatalogVideo,
    (config: Parameters<typeof createCatalogVideoGate>[0]) => createCatalogVideoGate({ ...config, fetcher }),
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
  return { search, requests, get classifications() { return classificationRequests; } };
}

test("Movies searches the movie catalog and preserves typed-result tracking fields", async () => {
  const f = fixture();
  const data = await f.search("movie");
  assert.equal(data.results.length, 3);
  assert.ok(data.results.every((r: any) => r.type === "movie"));
   assert.deepEqual(f.requests.filter(url => url.pathname.includes("/search/")).map(url => url.pathname), ["/3/search/movie"]);
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
  assert.deepEqual(f.requests.filter(url => url.pathname.includes("/search/")).map(url => url.pathname), ["/3/search/tv"]);
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
    assert.equal(f.requests.filter(url => url.pathname.includes("/search/")).length, 2);
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

test("All, Movies, and TV exclude mislabeled pornography and preserve mainstream controls", async () => {
  for (const type of [undefined, "movie", "tv"]) {
    const media_type = type || "movie";
    const f = fixture({ results: [
      { id: 1, media_type, title: "The Office: A XXX Parody", adult: false, poster_path: "/explicit.jpg" },
      { id: 2, media_type, title: "Office", original_title: "The Office: A XXX Parody" },
      { id: 3, media_type, title: "Office", overview: "A pornographic parody of a sitcom." },
      { id: 4, media_type, title: "Flagged", adult: true },
      { id: 5, media_type, title: "The Office", adult: false },
      { id: 6, media_type, title: "xXx", overview: "An action thriller about a secret agent." },
      { id: 7, media_type, title: "Romance", overview: "A mature romance with sexual themes." },
    ] });
    const data = await f.search(type, "office");
    assert.deepEqual(data.results.map((r: any) => r.external_id).sort(), ["5", "6", "7"]);
    assert.doesNotMatch(JSON.stringify(data), /explicit\.jpg|parody|Flagged/);
  }
});

test("secondary sequel searches cannot reintroduce blocked movie/TV results", async () => {
  for (const type of [undefined, "movie", "tv"]) {
    const f = fixture({ results: [
      { id: 1, media_type: type || "movie", title: "Office 4: A XXX Parody", adult: false },
      { id: 2, media_type: type || "tv", title: "Office 4" },
    ] });
    const data = await f.search(type, "office 4");
    assert.deepEqual(data.results.map((r: any) => r.external_id), ["2"]);
    assert.equal(f.requests.filter(url => url.pathname.includes("/search/")).length, 2);
  }
});

test("title enrichment that reveals unsafe metadata removes the result before serialization", async () => {
  for (const detail of [
    { title: "The Office: A XXX Parody", adult: false, poster_path: "/explicit.jpg" },
    { title: "The Office", adult: true },
    { title: "The Office", overview: "A pornographic parody of a sitcom." },
  ]) {
    const f = fixture({ results: [{ id: 1, title: "Office", adult: false }] }, { detail });
    const data = await f.search("movie", "the office");
    assert.deepEqual(data.results, []);
    assert.ok(f.requests.some(url => url.pathname === "/3/movie/1"));
    assert.doesNotMatch(JSON.stringify(data), /explicit|parody|Office/);
  }
});

test("unverified model-only fallback videos cannot restore titles without catalog clearance", async () => {
  const f = fixture({ results: [] }, { modelResults: [
    { title: "The Office: A XXX Parody", type: "movie", description: "A parody." },
    { title: "Office", type: "movie", description: "A pornographic parody of a sitcom." },
    { title: "The Office", type: "tv", description: "A workplace comedy series." },
  ] });
  const data = await f.search("tv", "office");
  assert.deepEqual(data.results, []);
  assert.equal(data.partial, true);
  assert.ok(data.failedProviders.includes("catalog-safety"));
  assert.ok(f.requests.some(url => url.hostname === "api.openai.com"));
});

test("ordinary-looking soft porn is excluded in All, Movies, TV and sequel paths, including cached requests", async () => {
  for (const type of [undefined, "movie", "tv"]) {
    const media_type = type || "movie";
    const f = fixture({ results: [
      { id: 140971, title: "Love in the Bosses Office", adult: false, softcore: false, media_type, poster_path: "/softporn.jpg" },
      { id: 948855, title: "Love in the Bosses Office 2", adult: false, softcore: false, media_type, overview: "" },
      { id: 164660, title: "Secret Games", adult: false, media_type },
      { id: 402, title: "Basic Instinct", adult: false, media_type },
      { id: 7451, title: "xXx", adult: false, media_type },
    ] }, { classifications: Object.fromEntries([140971, 948855, 164660].map(id => [`${media_type}:${id}`, "softcore_pornography"])) });
    for (let repeat = 0; repeat < 2; repeat++) {
      const data = await f.search(type, "office 2");
      assert.deepEqual(data.results.map((item: any) => item.external_id).sort(), ["402", "7451"]);
      assert.doesNotMatch(JSON.stringify(data), /softporn|Bosses Office|Secret Games/);
    }
    assert.equal(f.classifications, 1);
  }
});

test("classification failure is explicitly partial and does not leak posters or trigger typo fallback", async () => {
  const f = fixture({}, { classificationFailure: true });
  const data = await f.search("movie");
  assert.deepEqual(data.results, []);
  assert.equal(data.partial, true);
  assert.deepEqual(data.failedProviders, ["catalog-safety"]);
  assert.equal(f.requests.filter(url => url.hostname === "api.openai.com").length, 1);
});

test("typo retry responses from an older worker receive the same screening before return", async () => {
  const f = fixture({ results: [] }, { correction: "office", classifications: { "movie:948855": "softcore_pornography" }, retryResults: [
    { type: "movie", title: "Love in the Bosses Office 2", external_source: "tmdb", external_id: "948855", image: "/softporn.jpg", adult: false },
    { type: "tv", title: "The Office", external_source: "tmdb", external_id: "2316" },
  ] });
  const data = await f.search("tv", "ofice");
  assert.deepEqual(data.results.map((item: any) => item.external_id), ["2316"]);
  assert.equal(data.corrected_from, "ofice");
  assert.equal(data.corrected_to, "office");
  assert.doesNotMatch(JSON.stringify(data), /Bosses Office|softporn/);
});
