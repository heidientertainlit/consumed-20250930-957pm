import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequestGuard, normalizeConversationSubject, participantSelectionReasons, scopeOptions, subjectSelectionMedia } from "./conversation-subject";

test("selection transport only sends media identity and normalizes stored subjects", () => {
  assert.deepEqual(subjectSelectionMedia({ title: "Severance", type: "tv", external_id: 95396, external_source: "tmdb", image: "unused" }), {
    title: "Severance", type: "tv", external_id: 95396, external_source: "tmdb",
  });
  assert.deepEqual(normalizeConversationSubject({ title: "Severance", type: "tv", external_id: 95396, external_source: "tmdb" }, "stored-id"), {
    id: "stored-id", title: "Severance", type: "tv", creator: undefined, externalId: "95396", externalSource: "tmdb",
  });
  assert.equal(normalizeConversationSubject(null), undefined);
  assert.equal(normalizeConversationSubject({ title: "Missing id" }), undefined);
  assert.equal(normalizeConversationSubject({ item: { id: "old", title: "Legacy title" } })?.id, "old");
});

test("new requests and cancellation invalidate old selections", async () => {
  const guard = createRequestGuard();
  const first = guard.next();
  const second = guard.next();
  await Promise.resolve();
  assert.equal(guard.current(first), false);
  assert.equal(guard.current(second), true);
  guard.next();
  assert.equal(guard.current(second), false);
});

test("scope accepts QuickTrack endpoint shapes and preserves zero-numbered specials", () => {
  assert.deepEqual(scopeOptions([{ season_number: 0, name: "Specials", overview: "Bonus" }, { seasonNumber: 2 }, {}], "season"), [
    { number: 0, name: "Specials", overview: "Bonus" }, { number: 2, name: undefined, overview: undefined },
  ]);
  assert.equal(scopeOptions([{ episodeNumber: 7 }, { episode_number: 8 }], "episode").length, 2);
  assert.deepEqual(scopeOptions(null, "episode"), []);
});

test("participant reasons are readable and legacy provenance is safe", () => {
  const entry = { kind: "persona-selection", participant_id: "p1", reason: "Follows workplace dramas" };
  assert.deepEqual(participantSelectionReasons([entry, { kind: "source" }]), [{ participant_id: "p1", reason: entry.reason }]);
  assert.deepEqual(participantSelectionReasons({ entries: [entry] }), [{ participant_id: "p1", reason: entry.reason }]);
  for (const legacy of [null, {}, "legacy", [{ kind: "persona-selection" }]]) assert.deepEqual(participantSelectionReasons(legacy), []);
});

test("studio retains review controls while generation uses automatic participants without angle", () => {
  const source = readFileSync(new URL("./persona-conversation-controls.tsx", import.meta.url), "utf8");
  assert.match(source, /<MediaSearchPanel/);
  assert.match(source, /invoke\("select-subject", \{ media: subjectSelectionMedia\(result\) \}\)/);
  assert.match(source, /autoParticipants: true, seasonNumber, episodeNumber/);
  assert.match(source, /disabled=\{busy \|\| selecting \|\| !topic.trim\(\)\}/);
  assert.doesNotMatch(source, /participantIds:|openingAuthorId:|\bangle\b|invoke\("search"/);
  for (const action of ["edit", "approve", "schedule", "regenerate"]) assert.ok(source.includes(`"${action}"`));
});
