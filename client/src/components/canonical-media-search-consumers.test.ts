import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const consumers = [
  "client/src/components/consumption-tracker.tsx",
  "client/src/components/media-search-bar.tsx",
  "client/src/components/direct-search-dialog.tsx",
  "client/src/components/quick-react-card.tsx",
  "client/src/pages/add.tsx",
];

test("user-visible media search consumers use the canonical search implementation", async () => {
  const sources = await Promise.all(consumers.map((file) => readFile(file, "utf8")));

  assert.match(sources[0], /MediaSearchPanel/);
  for (const source of sources.slice(1)) {
    assert.match(source, /MEDIA_SEARCH_FILTERS/);
    assert.match(source, /requestMediaSearch/);
    assert.match(source, /media-search-type-filters/);
  }
});

test("legacy restricted and non-canonical media-search payloads are absent", async () => {
  const sources = await Promise.all(consumers.map((file) => readFile(file, "utf8")));
  for (const source of sources) {
    assert.doesNotMatch(source, /types:\s*\[\s*['"]movie['"],\s*['"]tv['"]\s*\]/);
  }
});

test("rank selection sends the add-rank-item edge contract without making a request", async () => {
  const source = await readFile("client/src/components/consumption-tracker.tsx", "utf8");
  assert.match(source, /rankId:\s*targetRankId/);
  assert.match(source, /media:\s*\{[\s\S]*mediaType:\s*mediaData\.type/);
  assert.match(source, /imageUrl:\s*mediaData\.image/);
  assert.match(source, /externalId:\s*mediaData\.external_id/);
  assert.match(source, /externalSource:\s*mediaData\.external_source/);
  assert.doesNotMatch(source, /rank_id:\s*targetRankId/);
});