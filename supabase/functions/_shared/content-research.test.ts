import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { transformSync } from "esbuild";
import { catalogTitle, resolveCandidate, chartMetadata, runResearch, validateResearchInput } from "./content-research.ts";
import { researchHandler } from "./content-research-handler.ts";
import { createResearchServices, researchSearchBody } from "./content-research-providers.ts";
import { researchExport, researchTypes, type ResearchTitle } from "../../../shared/content-research.ts";

const seed = catalogTitle({ title: "The White Lotus", type: "tv", external_source: "tmdb", external_id: "111803", year: "2021" })!;
const movie = catalogTitle({ title: "The Menu", type: "movie", creator: "Mark Mylod", year: "2022", external_source: "tmdb", external_id: "593643" })!;
const body = { action: "generate", seed, angle: "themes", types: [...researchTypes] };
const response = (value: any) => new Response(JSON.stringify(value), { headers: { "Content-Type": "application/json" } });

test("admin authorization precedes parsing, rate limiting and all costly providers; service denied", async () => {
  for (const auth of [{ authorized: false, status: 401 }, { authorized: false, status: 403 }, { authorized: true, caller: "service" }]) {
    const handler = researchHandler({ authorize: async () => auth, limit: async () => { throw new Error("must not limit"); }, services: () => { throw new Error("must not create services"); } });
    assert.equal((await handler(new Request("https://test", { method: "POST", body: "broken" }))).status, auth.status || 403);
  }
});
test("malformed inputs and request limits cannot reach costly services", async () => {
  let cost = 0, limits = 0;
  const handler = researchHandler({ authorize: async () => ({ authorized: true, caller: "admin", userId: "admin" }),
    limit: async () => { limits++; return false; }, services: () => { cost++; throw new Error(); } });
  for (const input of ["null", "[]", "{", JSON.stringify({ ...body, types: ["sports"] }), JSON.stringify({ ...body, angle: "whatever" }), JSON.stringify({ action: "search", query: 123 }), JSON.stringify({ action: "search", query: "aa", type: "all" })]) {
    assert.equal((await handler(new Request("https://test", { method: "POST", body: input }))).status, 400);
  }
  assert.equal(limits, 0);
  const limited = await handler(new Request("https://test", { method: "POST", body: JSON.stringify(body) }));
  assert.equal(limited.status, 429);
  assert.equal(limited.headers.get("Retry-After"), "3600");
  assert.equal(cost, 0);
});
test("identity rejects AI fallbacks, wrong title/type/creator/year, ambiguity; never first hit", () => {
  assert.equal(catalogTitle({ ...movie, external_source: "openai" }), null);
  assert.equal(catalogTitle({ ...movie, external_id: "ai_game_12", external_source: "rawg", type: "game" }), null);
  assert.equal(resolveCandidate(movie, [{ ...movie, title: "Menu" }, movie]), movie);
  for (const wrong of [{ ...movie, type: "tv" }, { ...movie, year: "1999" }, { ...movie, creator: "Someone else" }]) {
    assert.equal(resolveCandidate(movie, [wrong as ResearchTitle]), null);
  }
  assert.equal(resolveCandidate({ title: movie.title, type: movie.type }, [movie, { ...movie, external_id: "999" }]), null);
  assert.equal(catalogTitle({ title: "Disco Elysium", type: "game", external_source: "rawg", external_id: "29225" })?.type, "game");
  assert.equal(catalogTitle({ title: "Lessons from the Screenplay", type: "youtube", external_source: "youtube", external_id: "UCu6mSoMNzHQiBIOCkHUa2Aw" })?.media_subtype, "channel");
  assert.equal(catalogTitle({ title: "Video", type: "youtube", external_source: "youtube", external_id: "abcdefghijk" })?.media_subtype, "video");
});
test("stale chart provenance is preserved and missing or unavailable source is explicit", () => {
  const item = { media_type: "tv", source_label: "Netflix", source_key: "netflix", chart_country: "US", chart_date: "2026-10-01" };
  assert.deepEqual(chartMetadata(item, { source_status: { streaming: "stale" } }, Date.parse("2026-10-02")), { ...Object.fromEntries(Object.entries(item).filter(([key]) => key !== "media_type")), status: "stale" });
  assert.equal(chartMetadata(item, { source_status: { streaming: "available" } }, Date.parse("2026-10-13")).status, "stale");
  assert.equal(chartMetadata({ ...item, chart_date: "" }, {}).status, "unavailable");
});
test("NYT ISBN chart identities are explicitly excluded with provenance, not silently lost or made into work IDs", async () => {
  const nyt = { title: "The Guest", creator: "Emma Cline", media_type: "book",
    external_source: "openlibrary", external_id: "9780812998627",
    source_key: "nyt-hardcover-fiction", source_label: "NYT Hardcover Fiction",
    chart_country: "US", chart_date: new Date().toISOString().slice(0, 10) };
  const result = await runResearch({ action: "trending" }, {
    search: async () => { throw new Error("No unbounded chart fan-out"); },
    candidates: async () => { throw new Error("No model for charts"); },
    charts: async () => ({ items: [nyt], source_status: { books: "available" } }),
  });
  assert.equal(result.items.length, 0);
  assert.equal(result.feedback.length, 1);
  assert.match(result.feedback[0], /The Guest.*NYT Hardcover Fiction.*US.*current/);
  assert.match(result.feedback[0], /chart ISBN \(not an Open Library work ID\)/);
  assert.match(result.feedback[0], /use catalog search/);
});
test("White Lotus full handler produces partial verified cross-media results without official claims, duplicates or seed", async () => {
  const titles = [
    movie,
    catalogTitle({ title: "Succession", type: "tv", external_source: "tmdb", external_id: "76331", year: "2018" })!,
    catalogTitle({ title: "The Guest", type: "book", creator: "Emma Cline", external_source: "googlebooks", external_id: "guest123" })!,
    catalogTitle({ title: "Dummy", type: "music", creator: "Portishead", external_source: "itunes", external_id: "1440653096", media_subtype: "album" })!,
    catalogTitle({ title: "Disco Elysium", type: "game", external_source: "rawg", external_id: "29225" })!,
    catalogTitle({ title: "Lessons from the Screenplay", type: "youtube", external_source: "youtube", external_id: "UCu6mSoMNzHQiBIOCkHUa2Aw" })!,
  ];
  const candidates = [...titles.map(t => ({ ...t, rationale: "Like the seed, its uneasy social encounters invite a reading about status and power." })),
    { ...movie, rationale: "An official sequel to The White Lotus." },
    { title: "Outage", type: "podcast", rationale: "Its satire examines status." },
    { ...seed, rationale: "The same uneasy social tension." }];
  const handler = researchHandler({
    authorize: async () => ({ authorized: true, caller: "admin", userId: "admin" }), limit: async () => true,
    services: () => ({
      search: async title => { if (title === "Outage") throw new Error("offline"); return title === seed.title ? [seed] : titles.filter(t => t.title === title); },
      candidates: async () => candidates,
      charts: async () => ({ items: [{ ...seed, source_key: "netflix", source_label: "Netflix", chart_country: "US", chart_date: "2026-01-01" }], source_status: { streaming: "stale" } }),
    }),
  });
  const res = await handler(new Request("https://test", { method: "POST", body: JSON.stringify({ ...body, chart: { source_key: "netflix", source_label: "FORGED" } }) }));
  assert.equal(res.status, 200);
  const result = await res.json();
  assert.equal(result.picks.length, 6);
  assert.equal(result.chart.source_label, "Netflix");
  assert.equal(result.chart.status, "stale");
  assert.ok(result.feedback.some((s: string) => s.includes("provider unavailable")));
  assert.ok(result.feedback.some((s: string) => s.includes("unsupported factual")));
  assert.ok(result.feedback.some((s: string) => s.includes("seed excluded")));
  const exported = researchExport(result.seed, result.picks.map((p: any) => ({ ...p, selected: true })), "themes");
  assert.equal(exported.count, 6);
  assert.ok(!exported.outline.includes("official sequel"));
});
test("no unverifiable seed reaches generation; fan-out capped; chart outages are partial", async () => {
  let calls = 0;
  await assert.rejects(runResearch(validateResearchInput(body), {
    search: async () => [], charts: async () => ({}), candidates: async () => { calls++; return []; },
  }), /reverified/);
  assert.equal(calls, 0);
  const result = await runResearch(validateResearchInput({ ...body, chart: {} }), {
    search: async () => { calls++; return [seed, movie]; },
    charts: async () => { throw new Error("offline"); },
    candidates: async () => Array.from({ length: 100 }, () => ({ ...movie, rationale: "Satirical class tension." })),
  });
  assert.ok(calls <= 15);
  assert.equal(result.chart.status, "unavailable");
  assert.equal(result.picks.length, 1);
});
test("verified export respects selection and order, excludes unverified and factual edited copy", () => {
  const pick = { ...movie, catalog_verified: true as const, relationship: "editorial similarity" as const, selected: true, rationale: "Class satire." };
  const out = researchExport(seed, [{ ...pick, title: "Second" }, { ...pick, title: "First", edited: true }, { ...pick, selected: false }, { ...pick, rationale: "Official adaptation" }, { ...pick, catalog_verified: false as any }], "mood");
  assert.equal(out.count, 2);
  assert.equal(out.excluded, 2);
  assert.ok(out.outline.indexOf("Second") < out.outline.indexOf("First"));
  assert.match(out.outline, /admin-edited; prose not verified/);
});

/** Executes the existing downstream handler, stubbing only network providers.
 * These are contract fixtures, not evidence of live provider availability. */
function downstreamMediaSearch() {
  let handler!: (req: Request) => Promise<Response>;
  const providers: string[] = [];
  const src = readFileSync(new URL("../media-search/index.ts", import.meta.url), "utf8").replace(/^import .*;\r?$/gm, "");
  const code = transformSync(src, { loader: "ts", format: "cjs" }).code;
  const fetcher = async (input: string | URL | Request) => {
    const url = new URL(String(input)); providers.push(url.hostname);
    if (url.hostname === "api.themoviedb.org") return response({ results: [{ id: 111803, name: "The White Lotus", media_type: "tv", first_air_date: "2021-07-11" }] });
    if (url.hostname === "itunes.apple.com") return response({ results: [] });
    if (url.hostname === "www.googleapis.com" && url.pathname.includes("youtube")) return response({ items: [] });
    if (url.hostname === "www.googleapis.com") return response({ items: [] });
    if (url.hostname === "openlibrary.org") return response({ docs: [] });
    if (url.pathname.endsWith("/gaming-search")) return response({ results: [{ title: "Disco Elysium", type: "game", external_source: "rawg", external_id: "29225" }] });
    return response({ results: [] });
  };
  const env: Record<string, string> = { TMDB_API_KEY: "fixture", YOUTUBE_API_KEY: "fixture" };
  new Function("serve", "createClient", "resolveCanonicalMedia", "Deno", "fetch", "EdgeRuntime", "console", code)(
    (fn: typeof handler) => handler = fn, () => { throw new Error("unexpected database"); }, () => { throw new Error("unexpected identity write"); },
    { env: { get: (key: string) => env[key] } }, fetcher, { waitUntil() {} }, { log() {}, error() {}, warn() {} },
  );
  return { handler, providers };
}
test("real media-search handler receives typed/default contracts through research transport", async () => {
  for (const type of [undefined, ...researchTypes]) {
    const downstream = downstreamMediaSearch();
    let sent: any;
    const services = createResearchServices({ baseUrl: "https://test", authorization: "Bearer fixture",
      fetcher: (async (url, init) => {
        sent = JSON.parse(String(init?.body));
        const result = await downstream.handler(new Request(String(url), init));
        assert.equal(result.status, 200, await result.clone().text());
        return result;
      }) as typeof fetch });
    const rows = await services.search("The White Lotus", type);
    assert.deepEqual(sent, researchSearchBody("The White Lotus", type));
    assert.equal(sent.include_book_series, false);
    assert.ok(!("media_type" in sent));
    if (!type || type === "tv") assert.equal(rows[0]?.external_id, seed.external_id);
    if (!type) assert.ok(downstream.providers.includes("itunes.apple.com"));
    if (type === "game") assert.equal(rows[0]?.external_source, "rawg");
  }
});
test("research code has no personal-data or publishing dependencies/writes; durable limiter is atomic and service-only", () => {
  for (const file of ["content-research.ts", "content-research-handler.ts", "content-research-providers.ts", "../admin-content-research/index.ts"]) {
    const source = readFileSync(new URL(file, import.meta.url), "utf8");
    assert.doesNotMatch(source, /dna_profiles|list_items|user_recommendations|social_posts|scheduled_posts|rebuild-recommendations|generate-media-recommendations|conversational-search/);
  }
  const sql = readFileSync(new URL("../../migrations/20261013120000_admin_content_research_limits.sql", import.meta.url), "utf8");
  assert.match(sql, /on conflict \(admin_id, action\) do update/);
  assert.match(sql, /enable row level security/);
  assert.match(sql, /from public, anon, authenticated/);
  const config = readFileSync(new URL("../../config.toml", import.meta.url), "utf8");
  assert.match(config, /\[functions\.admin-content-research\]\s*verify_jwt\s*=\s*false/);
});
