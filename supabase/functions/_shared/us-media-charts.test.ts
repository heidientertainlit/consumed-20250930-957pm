import assert from "node:assert/strict";
import test from "node:test";
import { balanceUSChartItems, getUSMusicCharts, recoverCachedMusic } from "./us-media-charts.ts";
import type { ChartItem, Fetcher } from "./us-streaming-charts.ts";

const generatedAt = "2026-10-21T12:00:00.000Z";
const now = new Date("2026-10-21T12:10:00.000Z");
const appleFeed = {
  feed: {
    updated: generatedAt,
    results: [{ id: "123", name: "Album", artistName: "Artist", artworkUrl100: "https://example.com/album.jpg" }],
  },
};
const item = (type: string, rank: number): ChartItem => ({
  id: `${type}-${rank}`, title: `${type} ${rank}`, media_type: type,
  image_url: "https://example.com/cover.jpg", external_id: String(rank),
  external_source: type === "movie" || type === "tv" ? "tmdb" : "itunes",
  source_key: type, source_label: type, rank, chart_country: "US", chart_date: "2026-10-21",
});

test("the research consumer's 150-item cap retains every available category", () => {
  const grouped = [80, 77, 20, 10, 10].flatMap((count, index) =>
    Array.from({ length: count }, (_, i) => item(["movie", "tv", "book", "music", "podcast"][index], i + 1)),
  );
  const mixed = balanceUSChartItems(grouped);
  assert.equal(mixed.length, grouped.length);
  assert.equal(new Set(mixed.map(x => x.id)).size, grouped.length);
  assert.deepEqual([...new Set(mixed.slice(0, 150).map(x => x.media_type))],
    ["movie", "tv", "book", "music", "podcast"]);
  for (const type of ["movie", "tv", "book", "music", "podcast"]) {
    assert.deepEqual(mixed.filter(x => x.media_type === type), grouped.filter(x => x.media_type === type));
  }
  assert.deepEqual(balanceUSChartItems([]), []);
});

test("Music uses the same official chart through Apple's redirecting host if the direct request fails", async () => {
  const calls: string[] = [];
  const fetcher: Fetcher = async url => {
    calls.push(String(url));
    return calls.length === 1 ? new Response(null, { status: 502 }) : Response.json(appleFeed);
  };
  const music = await getUSMusicCharts(fetcher);
  assert.deepEqual(calls, [
    "https://rss.marketingtools.apple.com/api/v2/us/music/most-played/10/albums.json",
    "https://rss.applemarketingtools.com/api/v2/us/music/most-played/10/albums.json",
  ]);
  assert.equal(music[0].external_id, "123");
  assert.equal(music[0].chart_date, "2026-10-21");
  assert.equal(music[0].media_type, "music");
});

test("Music recovery preserves other chart records and paid-chart age without calling streaming providers", async () => {
  const original = {
    items: [item("movie", 1), item("tv", 1), item("book", 1), item("podcast", 1)],
    generated_at: generatedAt, schema_version: 2, country: "US",
    source_status: { streaming: "available", books: "available", podcasts: "available", music: "unavailable" },
  };
  const fetcher: Fetcher = async url => {
    assert.match(String(url), /^https:\/\/rss\.(?:marketingtools\.apple|applemarketingtools)\.com\/api\/v2\/us\/music\//);
    return Response.json(appleFeed);
  };
  const recovered = await recoverCachedMusic(original, fetcher, now);
  assert.equal(recovered.generated_at, original.generated_at);
  assert.equal(recovered.source_status.music, "available");
  assert.deepEqual(recovered.items.filter((x: ChartItem) => x.media_type !== "music"), original.items);
  assert.equal(original.source_status.music, "unavailable");
  assert.equal(recovered.items.filter((x: ChartItem) => x.media_type === "music").length, 1);
});

test("failed Music recovery is throttled and keeps healthy cached charts intact", async () => {
  const original = {
    generated_at: generatedAt, items: [item("movie", 1)],
    source_status: { streaming: "available", music: "unavailable" },
  };
  let calls = 0;
  const failing: Fetcher = async () => { calls++; return new Response(null, { status: 502 }); };
  const recent = await recoverCachedMusic(original, failing, new Date("2026-10-21T12:01:00Z"));
  assert.equal(recent, original);
  assert.equal(calls, 0);
  const retried = await recoverCachedMusic(original, failing, now);
  assert.equal(calls, 2);
  assert.equal(retried.items, original.items);
  assert.equal(retried.generated_at, generatedAt);
  assert.equal(retried.source_status.music, "unavailable");
  assert.equal(await recoverCachedMusic(retried, failing, new Date(now.getTime() + 1000)), retried);
  assert.equal(calls, 2);
  const healthy = { ...original, source_status: { music: "available" } };
  assert.equal(await recoverCachedMusic(healthy, failing, now), healthy);
});
