import { build } from "esbuild";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import { webcrypto } from "node:crypto";

// Executes the real handler + real runtime dependencies. Only host services are
// substituted. Unknown network requests fail instead of reaching production.
export async function loadSearchFixtureFunction(slug, { store, provider, sourcePath } = {}) {
  let handler, helpers;
  const background = [], diagnostics = [];
  const path = resolve("supabase/functions", slug, "index.ts");
  const source = await readFile(sourcePath || path, "utf8");
  const result = await build({
    stdin: { contents: source + (slug === "media-search"
      ? "\nglobalThis.__fixture.helpers={addKnownCanonicalIdentities,addCanonicalIdentities};" : ""),
    loader: "ts", resolveDir: resolve("supabase/functions", slug), sourcefile: path },
    bundle: true, write: false, platform: "node", format: "iife",
    plugins: [{ name: "isolated-edge-host", setup(api) {
      api.onResolve({ filter: /^https:\/\/(deno\.land|esm\.sh)\// }, args => ({ path: args.path, namespace: "fixture" }));
      api.onLoad({ filter: /.*/, namespace: "fixture" }, args => ({ contents: args.path.includes("supabase-js")
        ? "export const createClient=(...args)=>globalThis.__fixture.createClient(...args);"
        : "export const serve=globalThis.__fixture.serve;" }));
    } }],
  });
  const environment = {
    SUPABASE_URL: "http://fixture.invalid", SUPABASE_SERVICE_ROLE_KEY: "fixture-only",
    SUPABASE_ANON_KEY: "fixture-only", TMDB_API_KEY: "fixture-only",
    GOOGLE_BOOKS_API_KEY: "fixture-only", OPENAI_API_KEY: "fixture-only",
  };
  const host = {
    serve(value) { handler = value; },
    createClient(url, key) {
      if (url !== environment.SUPABASE_URL || key !== "fixture-only") throw Error("Non-fixture database access rejected");
      return store;
    },
    set helpers(value) { helpers = value; },
  };
  runInNewContext(result.outputFiles[0].text, {
    __fixture: host, Deno: { env: { get: key => environment[key] } },
    EdgeRuntime: { waitUntil: promise => background.push(promise) },
    fetch: provider.fetch, Request, Response, Headers, URL, URLSearchParams,
    AbortController, AbortSignal, setTimeout, clearTimeout, TextEncoder, TextDecoder,
    crypto: webcrypto, console: Object.fromEntries(["log", "warn", "error"].map(method =>
      [method, (...args) => diagnostics.push({ method, args })])),
  });
  if (!handler) throw Error(`No captured handler for ${slug}`);
  return {
    handler, helpers, diagnostics, source,
    // Background work starts normally; a drain is never required before Save.
    async drain() {
      while (background.length) await Promise.all(background.splice(0));
    },
  };
}

export function createSearchFixtureProvider(query = "Dune", { blockedIds = [], uncertainIds = [] } = {}) {
  const requests = [];
  const title = number => `${query} Fixture ${String(number).padStart(2, "0")}`;
  const movie = id => ({
    id: Number(id), title: title(Number(id)), name: title(Number(id)),
    media_type: "movie", adult: false, release_date: "2024-01-01",
    overview: "A mainstream science fiction adventure.", poster_path: "/fixture.jpg",
    popularity: 100, vote_count: 100, genre_ids: [878],
    genres: [{ name: "Science Fiction" }], keywords: { keywords: [] },
  });
  return {
    requests, movie,
    async fetch(input, init = {}) {
      const url = new URL(String(input)); requests.push(url.pathname);
      if (url.hostname === "api.themoviedb.org") {
        if (/\/search\/(movie|tv|multi)$/.test(url.pathname)) return Response.json({
          results: Array.from({ length: 25 }, (_, index) => {
            const item = movie(index + 1);
            return url.pathname.endsWith("/tv") ? { ...item, media_type: "tv", first_air_date: item.release_date } : item;
          }),
        });
        const id = url.pathname.match(/\/(movie|tv)\/(\d+)$/)?.[2];
        if (id) return Response.json(movie(id));
      }
      if (url.hostname === "www.googleapis.com" && /\/volumes(?:\/fixture-volume-\d+)?$/.test(url.pathname)) {
        const volumes = {
        items: Array.from({ length: 25 }, (_, index) => ({
          id: `fixture-volume-${index + 1}`,
          volumeInfo: {
            title: title(index + 26), authors: ["Fixture Author"], publishedDate: "2024-01-01",
            description: "A science fiction novel.", categories: ["Fiction"],
            imageLinks: { thumbnail: "https://fixture.invalid/book.jpg" },
          },
        })),
        };
        const id = url.pathname.match(/\/volumes\/(fixture-volume-\d+)$/)?.[1];
        return Response.json(id ? volumes.items.find(item => item.id === id) : volumes);
      }
      if (url.hostname === "openlibrary.org") return Response.json({ docs: [] });
      if (url.hostname.includes("itunes.apple.com")) {
        const items = Array.from({ length: 15 }, (_, index) => ({
          trackId: 1000 + index, collectionId: 2000 + index,
          trackName: title(index + 51), collectionName: title(index + 51),
          artistName: "Fixture Artist", kind: "song", wrapperType: "track",
          releaseDate: "2024-01-01", artworkUrl100: "https://fixture.invalid/music.jpg",
        }));
        const lookupId = url.searchParams.get("id");
        return Response.json({ results: lookupId ? items.filter(item =>
          String(item.trackId) === lookupId || String(item.collectionId) === lookupId) : items });
      }
      if (url.hostname === "api.openai.com") {
        const body = JSON.parse(init.body);
        const data = body.messages?.at(-1)?.content || "";
        let items;
        try { items = JSON.parse(data).items; } catch { /* series/classification uses another schema */ }
        if (items) return Response.json({ choices: [{ message: { content: JSON.stringify({
          decisions: items.map(item => ({
            key: item.key,
            category: blockedIds.includes(item.key) ? "softcore_pornography" :
              uncertainIds.includes(item.key) ? "uncertain" : "non_pornographic",
            confidence: uncertainIds.includes(item.key) ? "low" : "high", reason: "Fixed policy control",
          })),
        }) } }] });
        if (body.model === "gpt-4o") return Response.json({ choices: [{ message: { content: "null" } }] });
        return Response.json({ choices: [{ message: { content: "{}" } }], data: [{ embedding: [] }] });
      }
      if (["fixture.invalid", "mahpgcogwpawvviapqza.supabase.co"].includes(url.hostname)
          && /\/(gaming-search|sports-search)$/.test(url.pathname)) {
        return Response.json({ results: [] });
      }
      if (url.hostname.includes("wikidata.org")) return Response.json({ search: [], results: { bindings: [] } });
      throw Error(`Unexpected fixture network destination: ${url.hostname}${url.pathname}`);
    },
  };
}
