import assert from "node:assert/strict";
import test from "node:test";
import { createCatalogVideoGate } from "./catalog-video-classification";

const ref = (id: number, type: "movie" | "tv" = "movie") => ({ id: String(id), type });
function fixture({
  details = {} as Record<string, any>,
  decisions = {} as Record<string, any>,
  modelFailure = false,
  modelBody = undefined as unknown,
  configured = true,
  clock = Date.now,
} = {}) {
  const calls: string[] = [];
  const gate = createCatalogVideoGate({
    tmdbKey: () => "fixture", modelKey: () => configured ? "fixture" : undefined, now: clock,
    fetcher: (async (input, init) => {
      const url = new URL(String(input)); calls.push(url.pathname);
      if (url.hostname === "api.themoviedb.org") {
        const key = url.pathname.replace("/3/", "").replace("/", ":");
        if (!(key in details)) return new Response("", { status: 503 });
        return Response.json(details[key]);
      }
      if (modelFailure) throw new Error("Classification unavailable");
      const payload = JSON.parse(String(init?.body));
      assert.match(payload.messages[0].content, /JSON/);
      const items = JSON.parse(payload.messages[1].content).items;
      return Response.json({ choices: [{ message: { content: JSON.stringify(modelBody ?? {
        decisions: items.map((item: any) => ({
          key: item.key, category: "non_pornographic", confidence: "high",
          reason: "Identified as a narrative mainstream film, not pornography.",
          ...decisions[item.key],
        })),
      }) } }] });
    }) as typeof fetch,
  });
  return { gate, calls };
}

test("both reported films and unrelated soft porn are excluded without an ID/title blacklist", async () => {
  const details = {
    "movie:140971": { id: 140971, title: "Love in the Bosses Office", adult: false, softcore: false, keywords: { keywords: [{ name: "softcore" }] } },
    "movie:948855": { id: 948855, title: "Love in the Bosses Office 2", adult: false, softcore: false, overview: "", keywords: { keywords: [] } },
    "movie:164660": { id: 164660, title: "Secret Games", adult: false, softcore: false, keywords: { keywords: [] } },
    "movie:901234567": { id: 901234567, title: "An Unseen Ordinary Title", adult: false, overview: "An erotic feature consisting of staged sexual encounters for arousal." },
  };
  const f = fixture({ details, decisions: Object.fromEntries(Object.keys(details).map(key => [
    key, { category: "softcore_pornography", reason: "Sexual encounters are the primary purpose of the work." },
  ])) });
  const verdicts = await f.gate.assess(Object.keys(details).map(key => ref(Number(key.split(":")[1]))));
  assert.deepEqual([...verdicts.values()], ["block", "block", "block", "block"]);
  assert.equal(f.calls.filter(path => path === "/v1/chat/completions").length, 1);
});

test("mainstream mature titles, workplace comedy and xXx require and retain positive clearance", async () => {
  const titles = ["The Office", "xXx", "Basic Instinct", "Eyes Wide Shut", "Fifty Shades of Grey", "Romance", "Sex Education"];
  const f = fixture({ details: Object.fromEntries(titles.map((title, i) => [`movie:${i + 1}`, {
    id: i + 1, title, adult: false, softcore: false, overview: "A mainstream narrative work with mature themes.",
  }])) });
  assert.ok([...(await f.gate.assess(titles.map((_, i) => ref(i + 1)))).values()].every(value => value === "allow"));
});

test("missing metadata, wrong identities, unsupported sources and failed lookups never get clearance", async () => {
  const f = fixture({ details: {
    "movie:1": { id: 99, title: "Wrong work" },
    "movie:2": { id: 2 },
  } });
  assert.deepEqual([...(await f.gate.assess([ref(1), ref(2), ref(3)])).values()], ["uncertain", "uncertain", "uncertain"]);
  const filtered = await f.gate.filterResults([
    { type: "movie", external_id: "3", external_source: "tmdb" },
    { type: "movie", external_id: "known-title", external_source: "openai" },
    { type: "book", title: "Unchanged" },
  ]);
  assert.deepEqual(filtered.results, [{ type: "book", title: "Unchanged" }]);
  assert.equal(filtered.uncertain, true);
  assert.ok(!f.calls.includes("/v1/chat/completions"));
});

test("unconfigured/failed/refused/malformed/low-confidence classification is uncertain, never allowed", async () => {
  for (const options of [
    { configured: false }, { modelFailure: true }, { modelBody: {} },
    { modelBody: { decisions: [] } },
    { modelBody: { decisions: [{ key: "movie:1", category: "non_pornographic", confidence: "high" }] } },
    { decisions: { "movie:1": { confidence: "low" } } },
    { decisions: { "movie:1": { category: "uncertain" } } },
    { modelBody: { decisions: [{ key: "tv:1", category: "non_pornographic", confidence: "high", reason: "Wrong entity" }] } },
  ]) {
    const f = fixture({ ...options, details: { "movie:1": { id: 1, title: "Neutral Name" } } });
    assert.equal((await f.gate.assess([ref(1)])).get("movie:1"), "uncertain");
  }
});

test("metadata evidence rejects explicit flags even when model classification is unavailable", async () => {
  for (const evidence of [{ adult: true }, { softcore: true }, { keywords: { results: [{ name: "softcore" }] } }]) {
    const f = fixture({ configured: false, details: { "tv:1": { id: 1, name: "A Plain Name", ...evidence } } });
    assert.equal((await f.gate.assess([ref(1, "tv")])).get("tv:1"), "block");
    assert.ok(!f.calls.includes("/v1/chat/completions"));
  }
});

test("cached and concurrent checks reuse decisions; movie/TV identities never collide", async () => {
  const f = fixture({
    details: { "movie:1": { id: 1, title: "Neutral Movie" }, "tv:1": { id: 1, name: "Neutral Series" } },
    decisions: { "movie:1": { category: "softcore_pornography" } },
  });
  await Promise.all([f.gate.assess([ref(1), ref(1, "tv")]), f.gate.assess([ref(1)])]);
  const result = await f.gate.assess([ref(1), ref(1, "tv")]);
  assert.deepEqual([...result], [["movie:1", "block"], ["tv:1", "allow"]]);
  assert.equal(f.calls.filter(path => path === "/3/movie/1").length, 1);
});

test("uncertain decisions expire quickly so temporary failures do not hide works indefinitely", async () => {
  let now = 0;
  const f = fixture({ clock: () => now, modelFailure: true, details: { "movie:1": { id: 1, title: "A Narrative Film" } } });
  await f.gate.assess([ref(1)]);
  now = 14_999;
  await f.gate.assess([ref(1)]);
  assert.equal(f.calls.filter(path => path === "/3/movie/1").length, 1);
  now = 15_001;
  await f.gate.assess([ref(1)]);
  assert.equal(f.calls.filter(path => path === "/3/movie/1").length, 2);
});

test("bounded batches leave unchecked titles uncertain and validate duplicate/foreign model keys", async () => {
  const details = Object.fromEntries(Array.from({ length: 81 }, (_, i) => [`movie:${i + 1}`, { id: i + 1, title: `Film ${i + 1}` }]));
  const f = fixture({ details });
  const verdicts = await f.gate.assess(Array.from({ length: 81 }, (_, i) => ref(i + 1)));
  assert.equal(verdicts.get("movie:80"), "allow");
  assert.equal(verdicts.get("movie:81"), "uncertain");
  assert.equal(f.calls.filter(path => path.startsWith("/3/")).length, 80);
  const duplicate = fixture({ details, modelBody: { decisions: [1, 1].map(() => ({
    key: "movie:1", category: "non_pornographic", confidence: "high", reason: "Duplicate clearance must not pass.",
  })) } });
  assert.equal((await duplicate.gate.assess([ref(1)])).get("movie:1"), "uncertain");
});
