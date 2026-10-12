import assert from "node:assert/strict";
import test from "node:test";
import { normalizeTrendingItems, type TrendingContentItem } from "./use-trending-content";
import { selectTrendingItems } from "./trending-selection";

function item(type: string, index: number, source = "chart"): TrendingContentItem {
  return { title: `${type} ${source} ${index}`, image_url: "cover.jpg", media_type: type,
    external_source: "provider", external_id: `${type}-${source}-${index}`, source_key: source, rank: index + 1, chart_country: "US" };
}
test("all categories survive the display limit, including podcasts after the old cutoff", () => {
  const raw = ["movie", "tv", "book", "music", "podcast"].flatMap(type =>
    Array.from({ length: 10 }, (_, i) => item(type, i)));
  const normalized = normalizeTrendingItems(raw);
  assert.equal(normalized.length, 50);
  const selected = selectTrendingItems(normalized, "all");
  assert.equal(selected.length, 25);
  for (const type of ["movie", "tv", "book", "music", "podcast"]) {
    assert.equal(selected.filter(entry => entry.media_type === type).length, 5);
    assert.equal(selectTrendingItems(normalized, type as any).length, 10);
  }
});
test("major streaming charts are balanced in category views and the mixed view", () => {
  const raw = ["netflix", "prime", "hbo", "apple", "peacock", "paramount", "hulu", "disney"]
    .flatMap(source => Array.from({ length: 10 }, (_, i) => item("tv", i, source)));
  assert.equal(new Set(selectTrendingItems(raw, "tv").map(entry => entry.source_key)).size, 8);
  const mixed = selectTrendingItems([...raw, ...Array.from({ length: 10 }, (_, i) => item("book", i))], "all");
  assert.equal(new Set(mixed.filter(entry => entry.media_type === "tv").map(entry => entry.source_key)).size, 8);
});
test("Consumed, global buzz, Open Library activity, and foreign charts are excluded", () => {
  const raw = ["consumed", "trending-tv", "trending-movies", "open-library"].map((source, i) => item("movie", i, source));
  raw.push({ ...item("movie", 5), chart_country: "GB" }, item("movie", 6));
  assert.deepEqual(selectTrendingItems(raw, "all").map(entry => entry.title), [item("movie", 6).title]);
});
test("deduplicates provider work identities but never joins different media types", () => {
  const movie = item("movie", 0);
  const tv = { ...movie, media_type: "tv" };
  assert.equal(selectTrendingItems([movie, { ...movie, source_key: "other" }, tv], "all").length, 2);
  assert.equal(selectTrendingItems([], "podcast").length, 0);
});
