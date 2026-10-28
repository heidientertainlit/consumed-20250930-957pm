import test from "node:test";
import assert from "node:assert/strict";
import type { LabWork } from "../../../shared/recommendation-lab.ts";
import { similarityKey, similarityResultKey } from "../../../shared/media-similarity.ts";
import { createMediaSimilarity, similarityMeter } from "./media-similarity-engine.ts";
import { B_MODEL, B_RESERVATION_USD, B_SYSTEM_PROMPT, bPacket, selectWithB, validateB } from "./media-similarity-selector.ts";
import { createSimilarityProviders } from "./media-similarity-providers.ts";

function work(id: string, type = "tv"): LabWork {
  return {
    id: `${type}:tmdb:${id}`, title: `Title ${id}`, external_id: id, external_source: "tmdb", media_type: type,
    source_verified: true, destination_path: `/media/${type}/tmdb/${id}`, verification: {}, status: "embedded",
    source_metadata: { creator: "Creator", subjects: ["Comedy"], keywords: ["offbeat"],
      description: `A catalog synopsis for ${id}, not proof of the audience's experience.`,
      poster_url: "https://image.tmdb.org/t/p/w342/test.jpg" },
    profile: { appeal: [{ label: "DO NOT SEND PROFILE LABELS", evidence: "a quote" }] },
  };
}
const source = work("250923"), candidates = [work("101"), work("102")];
const decision = (id: string, rank: number, recommend = true) => ({
  candidate_id: id, rank, recommend, reason: "An experiential connection", caveat: "A tonal difference",
  confidence: "medium", evidence_used: [{ work_id: id, field: "prior_familiarity", basis: "model_familiarity" }],
});
const result = () => ({ decisions: [decision(candidates[1].id, 1), decision(candidates[0].id, 2)], pool_assessment: "Two possibilities" });
const response = (body: any, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const modelResponse = (value: any = result()) => ({
  model: B_MODEL, usage: { prompt_tokens: 100, completion_tokens: 80 },
  choices: [{ finish_reason: "stop", message: { content: JSON.stringify(value) } }],
});

test("B packet uses same-format verified catalog facts, never profile labels; excludes source and duplicate identities", () => {
  const alias = { ...candidates[0], id: "another-internal-id" };
  const { input, eligible } = bPacket(source, [source, ...candidates, alias, work("99", "movie"), { ...work("98"), source_verified: false }],
    new Map([[candidates[0].id, 18]]));
  assert.equal(eligible.size, 2);
  assert.equal(input.candidates[0].provider_position, 18);
  assert.equal(input.source.provider_provenance, "source");
  assert.ok(!JSON.stringify(input).includes("DO NOT SEND PROFILE LABELS"));
  assert.match(B_SYSTEM_PROMPT, /not matching labels/);
  assert.match(B_SYSTEM_PROMPT, /Do not fill slots with weak matches/);
});

test("B ranks, not response order or deterministic scores, own the final order", () => {
  const eligible = bPacket(source, candidates).eligible;
  const raw = result(); raw.decisions.reverse();
  assert.deepEqual(validateB(raw, source, eligible).map(w => w.id), [candidates[1].id, candidates[0].id]);
  assert.deepEqual(validateB({ decisions: [], pool_assessment: "Abstain" }, source, eligible), []);
});

test("unknown IDs, duplicates, gapped ranks, bad evidence and malformed envelopes fail closed", () => {
  const eligible = bPacket(source, candidates).eligible;
  for (const mutate of [
    (r: any) => { r.decisions[0].candidate_id = "tv:tmdb:invented"; },
    (r: any) => { r.decisions[1] = r.decisions[0]; },
    (r: any) => { r.decisions[1].rank = 3; },
    (r: any) => { r.decisions[0].evidence_used[0].work_id = "foreign-work"; },
    (r: any) => { r.decisions[0].recommend = "yes"; },
    (r: any) => { r.decisions[0].confidence = "guaranteed"; },
    (r: any) => { r.decisions = null; },
  ]) { const raw = result(); mutate(raw); assert.throws(() => validateB(raw, source, eligible)); }
});

test("one pinned GPT-4.1 call, strict JSON schema, exact candidate IDs and correct metering", async () => {
  const meter = similarityMeter();
  let calls = 0;
  const chosen = await selectWithB(source, candidates, meter.store, "fixture", async (url, init) => {
    calls++;
    assert.equal(String(url), "https://api.openai.com/v1/chat/completions");
    const body = JSON.parse(String(init?.body));
    assert.equal(body.model, B_MODEL);
    assert.equal(body.messages[0].content, B_SYSTEM_PROMPT);
    assert.equal(body.response_format.json_schema.strict, true);
    assert.deepEqual(body.response_format.json_schema.schema.properties.decisions.items.properties.candidate_id.enum, candidates.map(w => w.id));
    assert.ok(!String(init?.body).includes("DO NOT SEND PROFILE LABELS"));
    return response(modelResponse());
  });
  assert.equal(calls, 1);
  assert.deepEqual(chosen.map(w => w.id), [candidates[1].id, candidates[0].id]);
  assert.equal(meter.cost(), 0.00084);
});

for (const failure of ["network", "server", "missing-usage", "invalid-json", "truncated", "refusal", "wrong-model", "rate-limit"]) {
  test(`B ${failure}: no retry, conservative charge and explicit failure`, async () => {
    const meter = similarityMeter(); let calls = 0;
    await assert.rejects(selectWithB(source, candidates, meter.store, "fixture", async () => {
      calls++;
      if (failure === "network") throw new Error("Transport interrupted");
      if (failure === "server") return response({}, 503);
      if (failure === "rate-limit") return response({}, 429);
      const data: any = modelResponse();
      if (failure === "missing-usage") delete data.usage;
      if (failure === "invalid-json") data.choices[0].message.content = "{";
      if (failure === "truncated") data.choices[0].finish_reason = "length";
      if (failure === "refusal") data.choices[0].message.content = null;
      if (failure === "wrong-model") data.model = "some-other-model";
      return response(data);
    }));
    assert.equal(calls, 1);
    assert.equal(meter.cost(), ["network", "server", "missing-usage"].includes(failure)
      ? B_RESERVATION_USD : failure === "rate-limit" ? 0 : 0.00084);
  });
}

test("existing per-title limit denies B before network work when reservation will not fit", async () => {
  const meter = similarityMeter();
  await meter.store("reserve", { token: "other-preparation", amount: 0.14 });
  await assert.rejects(selectWithB(source, candidates, meter.store, "fixture", async () => assert.fail("No paid request")));
  assert.equal(meter.cost(), 0.14);
});

test("provider positions retain invalid original slots; only the first page's first 20 slots are considered", async () => {
  let calls = 0;
  const provider = createSimilarityProviders(() => "fixture", async input => {
    calls++;
    assert.match(new URL(String(input)).pathname, /tv\/250923\/recommendations$/);
    return response({ results: [null, { id: 101 }, { id: "bad" }, { id: 102 },
      ...Array.from({ length: 22 }, (_, i) => ({ id: 200 + i }))] });
  });
  const rows = await provider.recommendationsForB(source);
  assert.equal(calls, 1);
  assert.deepEqual(rows.slice(0, 2).map(x => x.position), [2, 4]);
  assert.ok(rows.every(x => x.position <= 20));
  assert.deepEqual(await provider.recommendationsForB(work("999", "book")), []);
  assert.equal(calls, 1);
});

test("long synopses are explicitly shortened without removing the candidate pool", async () => {
  const many = Array.from({ length: 32 }, (_, i) => {
    const w = work(String(100 + i)); w.source_metadata.description = "Long catalog synopsis. ".repeat(100); return w;
  });
  await selectWithB(source, many, similarityMeter().store, "fixture", async (_, init) => {
    const packet = JSON.parse(JSON.parse(String(init?.body)).messages[1].content);
    assert.equal(packet.candidates.length, 32);
    assert.ok(packet.candidates.every((w: any) => w.synopsis_truncated && w.synopsis.length === 500));
    return response(modelResponse());
  });
});

test("oversized metadata fails before reservation or paid work", async () => {
  const many = Array.from({ length: 32 }, (_, i) => {
    const w = work(String(100 + i));
    w.source_metadata.description = "Long synopsis. ".repeat(200);
    w.source_metadata.subjects = Array(16).fill("x".repeat(100));
    w.source_metadata.keywords = Array(16).fill("y".repeat(100));
    return w;
  });
  const meter = similarityMeter();
  await assert.rejects(selectWithB(source, many, meter.store, "fixture", async () => assert.fail("No network")), /bound/);
  assert.equal(meter.cost(), 0);
});

test("result cache version changes only film/TV, not reusable profiles or other formats", () => {
  for (const type of ["movie", "tv"] as const) {
    const id = { source: "tmdb", externalId: "10", type };
    assert.notEqual(similarityResultKey(id), similarityKey(id));
  }
  const book = { source: "openlibrary", externalId: "OL1W", type: "book" as const };
  assert.equal(similarityResultKey(book), similarityKey(book));
});

for (const failure of ["none", "invalid", "empty", "partial", "outage", "missing-usage"]) test(`engine: ${failure === "none" ? "B can choose TMDB #18 and #16" : `${failure} B keeps existing cards`}, without changing other formats`, async () => {
  const fail = failure !== "none";
  const id = { source: "tmdb", externalId: "250923", type: "tv" as const };
  const legacy = [work("70"), work("71")].map(w => ({ title: w.title, type: "tv", external_source: "tmdb", external_id: w.external_id, poster_url: "" }));
  const jobs: Promise<unknown>[] = [], finished: any[] = [], saved: any[] = [];
  let claimed = false, modelCalls = 0, fresh = false;
  const service = createMediaSimilarity(async (action, p = {}) => {
    if (action === "read") return p.key === similarityKey(id) ? { items: legacy, fresh: true }
      : fresh ? { items: finished[0].items, fresh: true } : {};
    if (action === "claim") {
      assert.equal(p.daily_limit, 1);
      assert.equal(p.key, similarityResultKey(id));
      if (claimed) return { preparing: true };
      claimed = true; return { token: "lease" };
    }
    if (action === "profile") return p.key === similarityKey(id) ? source : null;
    if (action === "save_profile") { saved.push(p); return {}; }
    if (action === "pool") return [work("900", "book"), work("901", "movie")];
    if (action === "finish") { finished.push(p); fresh = true; return {}; }
    throw new Error(`Unexpected action ${action}`);
  }, () => "fixture", job => jobs.push(job), async (input, init) => {
    const url = new URL(String(input));
    if (url.hostname === "api.openai.com") {
      modelCalls++;
      const body = JSON.parse(String(init?.body));
      assert.equal(body.model, B_MODEL, "No candidate profile/embedding calls for B");
      const packet = JSON.parse(body.messages[1].content);
      assert.equal(packet.candidates.length, 20);
      assert.equal(packet.candidates.find((w: any) => w.id === "tv:tmdb:117").provider_position, 18);
      const raw = { decisions: [decision("tv:tmdb:117", 1), decision("tv:tmdb:115", 2)], pool_assessment: "Considered the lower provider ranks" };
      if (failure === "outage") return response({}, 503);
      if (failure === "invalid") raw.decisions[0].candidate_id = "tv:tmdb:unknown";
      if (failure === "empty") raw.decisions = [];
      if (failure === "partial") raw.decisions = raw.decisions.slice(0, 1);
      const data: any = modelResponse(raw);
      if (failure === "missing-usage") delete data.usage;
      return response(data);
    }
    if (url.pathname.endsWith("/250923/recommendations"))
      return response({ results: Array.from({ length: 20 }, (_, i) => ({ id: 100 + i, name: `Title ${100 + i}` })) });
    const match = /^\/3\/tv\/(\d+)$/.exec(url.pathname);
    if (match) return response({ id: Number(match[1]), name: `Title ${match[1]}`, overview: "Catalog synopsis", genres: [{ name: "Comedy" }] });
    return response({ results: [], docs: [], genres: [] });
  });
  assert.deepEqual((await service.load(id, "visitor-one")).items, legacy);
  await service.load(id, "visitor-two");
  await Promise.all(jobs);
  assert.equal(jobs.length, 1);
  assert.equal(modelCalls, 1);
  assert.equal(saved.length, 0, "B catalog verification must not overwrite the shared profile/embedding pool");
  assert.equal(finished.length, 1);
  assert.deepEqual(finished[0].items.map((w: any) => w.external_id), fail ? ["70", "71"] : ["117", "115"]);
  assert.ok(finished[0].cost < 0.25);
  assert.deepEqual((await service.load(id, "visitor-three")).items, finished[0].items);
  assert.equal(modelCalls, 1, "Cached visits do not call B again");
  assert.equal(jobs.length, 1);
});
