import assert from "node:assert/strict";
import test from "node:test";
import { apiList, getUSStreamingCharts, selectChartRows, US_COUNTRY_ID, US_STREAMING_PLATFORMS } from "./us-streaming-charts";
import { loadUSCharts } from "./us-media-charts";

const date = "2026-10-11";
const company = US_STREAMING_PLATFORMS[0].id;
const relation = (type: string, id: string) => ({ type, data: { id } });
const row = (id = "title-a", type = 2, ranking = 1) => ({
  movie: relation("titles", id), company: relation("companies", company),
  country: relation("countries", US_COUNTRY_ID), date: { type: 1, from: date, to: date },
  type, ranking,
});
test("v2 resource wrappers and US/date/rank eligibility are interpreted exactly", () => {
  assert.equal(apiList({ data: [{ type: "top10s", data: row() }] })[0].ranking, 1);
  assert.throws(() => apiList({ error: {} }), /Invalid/);
  const invalid = [
    { ...row(), country: "GB" }, { ...row(), company: "foreign" },
    { ...row(), ranking: 11 }, { ...row(), ranking: 0 }, { ...row(), type: 40 },
    { ...row(), date: { from: "2026-10-10" } }, { ...row(), ranking: 1.5 },
  ];
  assert.equal(selectChartRows([row(), ...invalid], company, date).length, 1);
});
test("all eight platforms request US movie and TV charts with Basic authentication and exact ID artwork", async () => {
  const visited = new Set<string>();
  let searchCalls = 0;
  const fetcher: typeof fetch = async (input, init) => {
    const url = new URL(String(input));
    if (url.hostname === "api.themoviedb.org") {
      if (url.pathname.includes("search")) searchCalls++;
      return Response.json({ poster_path: "/poster.jpg" });
    }
    assert.equal(new Headers(init?.headers).get("Authorization"), `Basic ${btoa("fixture-key:")}`);
    if (url.pathname.endsWith("titles")) {
      const titles = url.searchParams.get("id[in]")!.split(",").map(id => ({
        type: "titles", data: { id, title: id, type: id.endsWith("-tv") ? 2 : 1, tmdbId: id.endsWith("-tv") ? 200 : 100 },
      }));
      return Response.json({ data: titles });
    }
    const id = url.searchParams.get("company[eq]")!;
    visited.add(id);
    assert.equal(url.searchParams.get("country[eq]"), US_COUNTRY_ID);
    assert.equal(url.searchParams.get("type[in]"), "2,3");
    assert.equal(url.searchParams.get("ranking[lte]"), "10");
    const rows = [2, 3].flatMap(type => Array.from({ length: 10 }, (_, i) =>
      ({ ...row(`${id}-${i}-${type === 3 ? "tv" : "movie"}`, type, i + 1), company: relation("companies", id) })));
    return Response.json({ data: rows.map(data => ({ type: "top10s", data })) });
  };
  const items = await getUSStreamingCharts({ key: "fixture-key", tmdbKey: "fixture-tmdb", fetcher, now: new Date(date) });
  assert.equal(visited.size, 8);
  assert.equal(items.length, 160);
  assert.equal(searchCalls, 0);
  assert.ok(items.every(item => item.chart_country === "US" && item.chart_date === date && item.rank <= 10));
  assert.equal(items.filter(item => item.media_type === "movie").length, 80);
});
test("uses an actual previous-day chart when today's has not been published", async () => {
  const previous = "2026-10-10";
  const requestedDates: string[] = [];
  const fetcher: typeof fetch = async input => {
    const url = new URL(String(input));
    if (url.hostname === "api.themoviedb.org") return Response.json({ poster_path: "/poster.jpg" });
    if (url.pathname.endsWith("titles")) return Response.json({ data: [{ id: "title-a", title: "Actual title", type: 1, tmdbId: 123 }] });
    const requested = url.searchParams.get("date[from][eq]")!;
    requestedDates.push(requested);
    return Response.json({ data: requested === date ? [] : [{
      ...row(), company: url.searchParams.get("company[eq]"), date: { from: previous },
    }] });
  };
  const items = await getUSStreamingCharts({ key: "fixture-key", tmdbKey: "fixture-tmdb", fetcher, now: new Date(date) });
  assert.ok(requestedDates.includes(date) && requestedDates.includes(previous));
  assert.ok(items.every(item => item.chart_date === previous));
});
test("streaming auth failures do not suppress music/podcasts or substitute popularity", async () => {
  const urls: string[] = [];
  const fetcher: typeof fetch = async input => {
    const url = String(input); urls.push(url);
    if (url.includes("flixpatrol")) return Response.json({ error: "not authorized" }, { status: 401 });
    if (url.includes("marketingtools")) return Response.json({ feed: { updated: date, results: [
      { id: "10", name: "US Album", artistName: "Artist", artworkUrl100: "album.jpg" },
    ] } });
    return Response.json({ feed: { updated: { label: date }, entry: [{
      id: { attributes: { "im:id": "20" } }, "im:name": { label: "US Podcast" },
      "im:image": [{}, {}, { label: "podcast.jpg" }],
    }] } });
  };
  const result = await loadUSCharts({ flixKey: "fixture-key", tmdbKey: "fixture-tmdb", fetcher, now: new Date(date) });
  assert.equal(result.source_status.streaming, "unavailable");
  assert.equal(result.source_status.music, "available");
  assert.equal(result.source_status.podcasts, "available");
  assert.deepEqual(result.items.map(item => item.media_type), ["music", "podcast"]);
  assert.ok(!urls.some(url => /trending|topalbums/.test(url)));
});
