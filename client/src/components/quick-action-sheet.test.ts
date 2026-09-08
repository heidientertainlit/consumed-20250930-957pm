import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(new URL("./quick-action-sheet.tsx", import.meta.url), "utf8");

test("quick action media pickers share the canonical filter renderer", () => {
  assert.match(
    source,
    /import\s*{[\s\S]*MEDIA_SEARCH_FILTERS,[\s\S]*requestMediaSearch,[\s\S]*}\s*from "@\/components\/media-search-panel"/,
  );
  assert.match(source, /MEDIA_SEARCH_FILTERS\.map\(\(\{ value, label \}\) =>/);
  for (const picker of [
    "say-media-type-filters",
    "rate-media-type-filters",
    "rank-media-type-filters",
  ]) {
    assert.match(source, new RegExp(`renderMediaTypeFilters\\("${picker}"\\)`));
  }
  assert.match(source, /rounded-xl border px-2\.5 py-1/);
});

test("quick action search is debounced, cancellable, and uses canonical POST search", () => {
  assert.match(source, /setTimeout\(\(\) => void handleMediaSearch\(trimmedQuery, mediaTypeFilter\), 200\)/);
  assert.match(source, /searchAbortRef\.current\?\.abort\(\)/);
  assert.match(source, /const controller = new AbortController\(\)/);
  assert.match(
    source,
    /requestMediaSearch\(\{ query, type, bearer, signal: controller\.signal \}\)/,
  );

  const searchImplementation = source.slice(
    source.indexOf("const handleMediaSearch"),
    source.indexOf("const renderMediaTypeFilters"),
  );
  assert.doesNotMatch(searchImplementation, /media_type/);
  assert.match(searchImplementation, /reqId === searchReqIdQA\.current/);
});

test("every add-rank-item request uses the edge contract", () => {
  assert.doesNotMatch(source, /\brank_id\b/);

  const rankRequests = source.match(
    /functions\/v1\/add-rank-item[\s\S]*?(?=\n\s*}\);)/g,
  ) ?? [];
  assert.equal(rankRequests.length, 2);
  for (const request of rankRequests) {
    assert.match(request, /rankId: selectedRankId/);
    assert.match(request, /title: selectedMedia\.title/);
    assert.match(request, /mediaType: selectedMedia\.type/);
    assert.match(request, /creator: selectedMedia\.creator \|\| ''/);
    assert.match(request, /imageUrl: selectedMedia\.image \|\| selectedMedia\.image_url \|\| ''/);
    assert.match(request, /externalId: selectedMedia\.external_id/);
    assert.match(request, /externalSource: selectedMedia\.external_source \|\| 'tmdb'/);
    assert.doesNotMatch(request, /\b(?:media_type|image_url|external_id|external_source):/);
  }
});