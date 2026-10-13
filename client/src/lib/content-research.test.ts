import test from "node:test";
import assert from "node:assert/strict";
import { createResearchRequestGate, isResearchResult, isResearchTitle, safeResearchUrl } from "./content-research";
import { researchExport, type ResearchTitle, type CuratedPick } from "../../../shared/content-research";

const seed: ResearchTitle = { title: "Arrival", type: "movie", external_source: "tmdb", external_id: "329865", creator: "Denis Villeneuve", source_url: "https://www.themoviedb.org/movie/329865" };
const pick: CuratedPick = { ...seed, title: "Contact", external_id: "686", catalog_verified: true, rationale: "Patient first-contact storytelling and a sense of wonder.", relationship: "editorial similarity", selected: true };

test("request gate aborts previous work and rejects stale responses, including cancel", () => {
  const gate = createResearchRequestGate();
  const first = gate.begin();
  assert.equal(first.current(), true);
  const second = gate.begin();
  assert.equal(first.signal.aborted, true);
  assert.equal(first.current(), false);
  assert.equal(second.current(), true);
  gate.cancel();
  assert.equal(second.signal.aborted, true);
  assert.equal(second.current(), false);
});

test("catalog validation rejects invented/invalid identities and unsafe links", () => {
  assert.equal(isResearchTitle(seed), true);
  assert.equal(isResearchTitle({ ...seed, external_id: "" }), false);
  assert.equal(isResearchTitle({ ...seed, type: "unknown" }), false);
  assert.equal(isResearchTitle({ ...seed, source_url: "javascript:alert(1)" }), false);
  assert.equal(safeResearchUrl("data:text/html,unsafe"), undefined);
  assert.equal(isResearchResult({ seed, picks: [pick], feedback: [] }), true);
  assert.equal(isResearchResult({ seed, picks: [{ ...pick, catalog_verified: false }], feedback: [] }), false);
  assert.equal(isResearchResult({ seed, picks: [pick], feedback: [], chart: { status: "current" } }), false);
});

test("empty and partial drafts export only selected eligible picks deterministically", () => {
  assert.equal(researchExport(seed, [], "themes").outline, "");
  const unsafe = { ...pick, title: "Claim", rationale: "The official sequel." };
  const unselected = { ...pick, title: "Hidden", selected: false };
  const result = researchExport(seed, [unsafe, unselected, { ...pick, edited: true }], "mood");
  assert.equal(result.count, 1);
  assert.equal(result.excluded, 1);
  assert.match(result.outline, /Slide 2: Contact/);
  assert.match(result.outline, /admin-edited; prose not verified/);
  assert.doesNotMatch(result.outline, /Claim|Hidden|official sequel/);
  assert.deepEqual(result, researchExport(seed, [unsafe, unselected, { ...pick, edited: true }], "mood"));
});

test("export retains the response snapshot and editorial order rather than later inputs", () => {
  const snapshot = { seed: { ...seed }, angle: "setting" as const };
  const laterInputs = { seed: { ...seed, title: "Another title" }, angle: "mood" };
  const second = { ...pick, title: "Solaris", external_id: "593" };
  const result = researchExport(snapshot.seed, [second, pick], snapshot.angle);
  assert.ok(result.outline.indexOf("Solaris") < result.outline.indexOf("Contact"));
  assert.match(result.caption, /Arrival/);
  assert.match(result.caption, /setting/);
  assert.doesNotMatch(result.caption, new RegExp(laterInputs.seed.title));
});
