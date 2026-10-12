import assert from "node:assert/strict";
import test from "node:test";
import { shouldRequestBookSeries } from "./media-search-book-series";

test("Track preserves book-series discovery for All and Books", () => {
  assert.equal(shouldRequestBookSeries(undefined, "matching-filter"), true);
  assert.equal(shouldRequestBookSeries("book", "matching-filter"), true);
});

test("Track skips book-series discovery only for explicit non-book filters", () => {
  for (const type of ["movie", "tv", "music", "podcast", "youtube", "game"]) {
    assert.equal(shouldRequestBookSeries(type, "matching-filter"), false, type);
  }
});

test("other callers preserve their legacy opt-in by default", () => {
  for (const type of [undefined, "book", "movie", "tv", "music", "podcast", "youtube", "game"]) {
    assert.equal(shouldRequestBookSeries(type), true, String(type));
    assert.equal(shouldRequestBookSeries(type, "always"), true, String(type));
  }
});
