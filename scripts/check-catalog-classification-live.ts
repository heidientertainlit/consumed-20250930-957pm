/**
 * Opt-in, read-only provider/model verification. Incurs OpenAI usage.
 * No Supabase database connection, Git operation or deployment.
 * Run: npx tsx scripts/check-catalog-classification-live.ts --live
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { transformSync } from "esbuild";
import { createCatalogVideoGate } from "../supabase/functions/_shared/catalog-video-classification";
import { isAllowedCatalogVideo } from "../supabase/functions/_shared/catalog-content-safety";
import { createMovieCollectionsHandler } from "../server/movie-collections";

assert.ok(process.argv.includes("--live"), "Pass --live to authorize this read-only, paid-provider check.");
assert.ok(process.env.TMDB_API_KEY && process.env.OPENAI_API_KEY, "TMDB and OpenAI credentials must be configured.");
const started = Date.now();
let providerCalls = 0, modelCalls = 0;
const transport: typeof fetch = async (input, init) => {
  if (String(input).includes("api.openai.com")) modelCalls++;
  else providerCalls++;
  return fetch(input, init);
};
const options = { tmdbKey: () => process.env.TMDB_API_KEY, modelKey: () => process.env.OPENAI_API_KEY, fetcher: transport };
const gate = createCatalogVideoGate(options);
const cases = [
  { id: "140971", type: "movie", name: "Love in the Bosses Office", expected: "block" },
  { id: "948855", type: "movie", name: "Love in the Bosses Office 2", expected: "block" },
  { id: "60818", type: "movie", name: "Bikini Airways", expected: "block" },
  { id: "164660", type: "movie", name: "Secret Games", expected: "block" },
  { id: "59306", type: "movie", name: "Friend of the Family", expected: "block" },
  { id: "402", type: "movie", name: "Basic Instinct", expected: "allow" },
  { id: "345", type: "movie", name: "Eyes Wide Shut", expected: "allow" },
  { id: "216015", type: "movie", name: "Fifty Shades of Grey", expected: "allow" },
  { id: "7451", type: "movie", name: "xXx", expected: "allow" },
  { id: "2316", type: "tv", name: "The Office", expected: "allow" },
] as const;
const verdicts = await gate.assess([...cases]);
for (const row of cases) {
  assert.equal(verdicts.get(`${row.type}:${row.id}`), row.expected, row.name);
  console.log(`PASS live provider + classifier: ${row.name}: ${row.expected}`);
}
const callsAfterCold = modelCalls;
await gate.assess([...cases]);
assert.equal(modelCalls, callsAfterCold, "Warm decisions must avoid repeat model cost");

// Exercise generalization using deliberately synthetic metadata, NOT claimed
// as real-provider evidence. Real model, unrecognized titles, no adult labels.
const syntheticGate = createCatalogVideoGate({
  ...options,
  fetcher: async (input, init) => {
    if (String(input).includes("api.openai.com")) return transport(input, init);
    const id = new URL(String(input)).pathname.split("/").at(-1)!;
    return Response.json({
      id: Number(id), title: `Unseen Catalog Work ${id}`, adult: false, softcore: false,
      ...(id === "900000001" ? { overview: "A feature made primarily for sexual arousal, consisting of simulated sexual encounters connected by a minimal framing story." } : {}),
    });
  },
});
const synthetic = await syntheticGate.assess([{ id: "900000001", type: "movie" }, { id: "900000002", type: "movie" }]);
assert.equal(synthetic.get("movie:900000001"), "block");
assert.equal(synthetic.get("movie:900000002"), "uncertain");
console.log("PASS real classifier with synthetic unseen pornography and insufficient-evidence fixtures");

const collections = createMovieCollectionsHandler({ apiKey: options.tmdbKey, modelKey: options.modelKey, fetcher: transport });
async function collectionRequest(query: object) {
  let status = 0, body: any;
  const res: any = { setHeader() {}, status(value: number) { status = value; return res; }, json(value: any) { body = value; return res; } };
  await collections({ method: "GET", query }, res);
  return { status, body };
}
const office = await collectionRequest({ query: "the office" });
assert.equal(office.status, 200);
assert.doesNotMatch(JSON.stringify(office.body), /Bosses Office|XXX Parody|1164478|1024107/i);
const direct = await collectionRequest({ collectionId: "1164478" });
assert.equal(direct.status, 404);
assert.deepEqual(direct.body, { error: "Collection unavailable" });
for (const query of ["harry potter", "xXx"]) {
  const data = await collectionRequest({ query });
  assert.equal(data.status, 200, query);
  assert.ok(data.body.collections.length > 0, `${query} collection retained`);
}
console.log("PASS live collection handler: reported search/direct IDs blocked; mainstream collections retained");

// Execute the actual Edge handler locally, supplying ONLY read-only provider
// credentials. Canonical database writes cannot be reached in this harness.
let handler!: (req: Request) => Promise<Response>;
const code = transformSync(readFileSync("supabase/functions/media-search/index.ts", "utf8").replace(/^import .*;\r?$/gm, ""), { loader: "ts", format: "cjs" }).code;
new Function("serve", "createClient", "resolveCanonicalMedia", "Deno", "fetch", "EdgeRuntime", "console", "isAllowedCatalogVideo", "createCatalogVideoGate", code)(
  (fn: typeof handler) => { handler = fn; },
  () => { throw new Error("Database access is forbidden in this read-only check"); },
  () => { throw new Error("Identity writes are forbidden in this read-only check"); },
  { env: { get: (key: string) => ["TMDB_API_KEY", "OPENAI_API_KEY"].includes(key) ? process.env[key] : undefined } },
  transport, { waitUntil() {} }, { log() {}, warn() {}, error() {} }, isAllowedCatalogVideo,
  (config: Parameters<typeof createCatalogVideoGate>[0]) => createCatalogVideoGate({ ...config, fetcher: transport }),
);
for (const type of ["movie", "tv"]) {
  const query = type === "movie" ? "Love in the Bosses Office" : "the office";
  const response = await handler(new Request("https://fixture.invalid/media-search", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, type, include_book_series: false }),
  }));
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.doesNotMatch(JSON.stringify(data), /Bosses Office|140971|948855|XXX Parody/i);
  if (type === "tv") assert.ok(data.results.some((item: any) => item.external_id === "2316"), "The Office TV remains available");
}
console.log("PASS local real Edge handler with live providers: soft porn excluded; The Office TV retained");
console.log(JSON.stringify({ scope: "local handlers + live read-only TMDB/OpenAI; not deployed Edge or production UI", providerCalls, modelCalls, elapsedMs: Date.now() - started }));
