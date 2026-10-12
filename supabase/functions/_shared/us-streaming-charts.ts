// FlixPatrol v2 contracts: https://flixpatrol.com/api/endpoint-top10s/
// Authentication is HTTP Basic with the API key as username and an empty password.
export const US_COUNTRY_ID = "cnt_iMUHNbZvnNHK5YdhgwtOoP4u";
export const US_STREAMING_PLATFORMS = [
  { key: "netflix", label: "Netflix", id: "cmp_IA6TdMqwf6kuyQvxo9bJ4nKX" },
  { key: "prime-video", label: "Prime Video", id: "cmp_qypvowjqFhEIpCc0HlQ6VoYk" },
  { key: "hbo-max", label: "HBO Max", id: "cmp_6UhCvnTeRkgZUtcNGslX9bJL" },
  { key: "apple-tv", label: "Apple TV", id: "cmp_VvmYc7OphiUds0Hgjbz5MESn" },
  { key: "peacock", label: "Peacock", id: "cmp_5xU3J3E4UMZoCD62pGqLKjO8" },
  { key: "paramount-plus", label: "Paramount+", id: "cmp_riMmDaNhomIc4J2dWGQPKbkZ" },
  { key: "hulu", label: "Hulu", id: "cmp_9iwHIMYOCvD6zprSPoHgTJau" },
  { key: "disney-plus", label: "Disney+", id: "cmp_oGtsgdpOrjIu3XzTEnWPt87Y" },
] as const;

export interface ChartItem {
  id: string;
  title: string;
  image_url: string;
  media_type: string;
  source_label: string;
  source_key: string;
  external_id?: string;
  external_source?: string;
  creator?: string;
  rank: number;
  chart_country: "US";
  chart_date: string;
}
export type Fetcher = typeof fetch;
type Resource = Record<string, any>;
const API_ORIGIN = "https://api.flixpatrol.com";

export function resourceData(value: any): Resource {
  return value?.data && !Array.isArray(value.data) ? value.data : value;
}
export function resourceId(value: any): string | undefined {
  return typeof value === "string" ? value : resourceData(value)?.id;
}
export function apiList(body: any): Resource[] {
  const list = Array.isArray(body) ? body : body?.data;
  if (!Array.isArray(list)) throw new Error("Invalid FlixPatrol list response");
  return list.map(resourceData);
}

async function apiGet(path: string, params: Record<string, string>, key: string, fetcher: Fetcher) {
  const url = new URL(`/v2/${path}`, API_ORIGIN);
  Object.entries(params).forEach(([name, value]) => url.searchParams.set(name, value));
  const response = await fetcher(url.toString(), {
    headers: { Authorization: `Basic ${btoa(`${key}:`)}`, Accept: "application/json" },
    signal: AbortSignal.timeout(12000),
  });
  if (!response.ok) throw new Error(`FlixPatrol HTTP ${response.status}`);
  const rows = apiList(await response.json());
  // Never quietly treat a truncated page as an entire Top 10.
  const total = Number(response.headers.get("x-total-count"));
  if (total > rows.length) throw new Error("FlixPatrol returned an incomplete chart page");
  return rows;
}

export function selectChartRows(rows: Resource[], companyId: string, date: string): Resource[] {
  return rows.filter(row => {
    return resourceId(row.company) === companyId && resourceId(row.country) === US_COUNTRY_ID
      && [2, 3].includes(row.type) && Number.isInteger(row.ranking)
      && row.ranking >= 1 && row.ranking <= 10 && row.date?.from === date
      && Boolean(resourceId(row.movie));
  }).sort((a, b) => a.ranking - b.ranking);
}

export async function getUSStreamingCharts(options: {
  key?: string; tmdbKey?: string; fetcher?: Fetcher; now?: Date;
}): Promise<ChartItem[]> {
  const { key, tmdbKey, fetcher = fetch, now = new Date() } = options;
  if (!key) throw new Error("FlixPatrol subscription/key required");
  if (!tmdbKey) throw new Error("TMDB artwork key required");
  const fetchPlatform = async (platform: typeof US_STREAMING_PLATFORMS[number]) => {
    // Today's chart can be pending publication. Use the latest actual daily chart,
    // at most two days old, never an invented rank or a global popularity fallback.
    for (let daysAgo = 0; daysAgo <= 2; daysAgo++) {
      const date = new Date(now.getTime() - daysAgo * 86400000).toISOString().slice(0, 10);
      const rows = await apiGet("top10s", {
        "company[eq]": platform.id, "country[eq]": US_COUNTRY_ID,
        "date[from][eq]": date, "type[in]": "2,3", "ranking[lte]": "10",
      }, key, fetcher);
      const valid = selectChartRows(rows, platform.id, date);
      if (valid.length) return { platform, rows: valid, date };
    }
    return { platform, rows: [], date: "" };
  };
  // Fail fast on an invalid subscription, rather than repeating an auth failure
  // for every service. Once the key works, other service outages are isolated.
  const first = await fetchPlatform(US_STREAMING_PLATFORMS[0]);
  const rest = await Promise.allSettled(US_STREAMING_PLATFORMS.slice(1).map(fetchPlatform));
  const charts = [first, ...rest.flatMap((result, index) => {
    if (result.status === "fulfilled") return [result.value];
    console.error(`US chart unavailable: ${US_STREAMING_PLATFORMS[index + 1].key}`);
    return [];
  })];
  const titleIds = [...new Set(charts.flatMap(chart => chart.rows.map(row => resourceId(row.movie)!)))];
  const titles = new Map<string, Resource>();
  // Batch title resolution. Official TMDB IDs avoid ambiguous title searches and
  // keep the paid API budget bounded instead of one paid call per poster.
  for (let offset = 0; offset < titleIds.length; offset += 50) {
    const rows = await apiGet("titles", { "id[in]": titleIds.slice(offset, offset + 50).join(",") }, key, fetcher);
    rows.forEach(title => titles.set(title.id, title));
  }
  const artwork = new Map<string, string>();
  const jobs = titleIds.filter(id => {
    const title = titles.get(id);
    return title?.tmdbId && [1, 2].includes(title.type);
  });
  // Bounded enrichment with exact provider IDs. No guessed identity gets written.
  for (let offset = 0; offset < jobs.length; offset += 10) {
    await Promise.all(jobs.slice(offset, offset + 10).map(async id => {
      const title = titles.get(id)!;
      const mediaType = title.type === 1 ? "movie" : "tv";
      const params = new URLSearchParams({ api_key: tmdbKey });
      try {
        const response = await fetcher(`https://api.themoviedb.org/3/${mediaType}/${title.tmdbId}?${params}`, {
          signal: AbortSignal.timeout(5000),
        });
        if (!response.ok) return;
        const media = await response.json();
        if (media.poster_path) artwork.set(id, `https://image.tmdb.org/t/p/w300${media.poster_path}`);
      } catch { /* Missing artwork omits a card; it never changes its chart identity. */ }
    }));
  }
  const items: ChartItem[] = [];
  for (const { platform, rows, date } of charts) {
    for (const row of rows) {
      const titleId = resourceId(row.movie)!;
      const title = titles.get(titleId);
      const expectedTitleType = row.type === 2 ? 1 : 2;
      if (!title?.title || title.type !== expectedTitleType || !artwork.has(titleId)) continue;
      items.push({
        id: `flix-${platform.key}-${row.type}-${titleId}`,
        title: title.title, media_type: row.type === 2 ? "movie" : "tv",
        image_url: artwork.get(titleId)!, external_source: "tmdb", external_id: String(title.tmdbId),
        source_key: platform.key, source_label: platform.label, rank: row.ranking,
        chart_country: "US", chart_date: date,
      });
    }
  }
  return items;
}
