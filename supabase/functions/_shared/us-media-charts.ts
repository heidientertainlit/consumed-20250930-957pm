import { getUSStreamingCharts, type ChartItem, type Fetcher } from "./us-streaming-charts.ts";
import { improveBookCovers, type CoverOptions, type CoverCache } from "./book-cover-quality.ts";

function feedDate(value: string): string {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) throw new Error("Chart feed has an invalid update date");
  return new Date(timestamp).toISOString().slice(0, 10);
}

export async function getUSBookCharts(key: string | undefined, fetcher: Fetcher = fetch, coverOptions: CoverOptions = {}): Promise<ChartItem[]> {
  if (!key) throw new Error("NYT chart key required");
  const lists = [
    { slug: "hardcover-fiction", label: "NYT Fiction" },
    { slug: "hardcover-nonfiction", label: "NYT Nonfiction" },
  ];
  const results = await Promise.allSettled(lists.map(async list => {
    const response = await fetcher(
      `https://api.nytimes.com/svc/books/v3/lists/current/${list.slug}.json?${new URLSearchParams({ "api-key": key })}`,
      { signal: AbortSignal.timeout(12000) },
    );
    if (!response.ok) throw new Error(`NYT HTTP ${response.status}`);
    const data = await response.json();
    return (data.results?.books || []).filter((book: any) => book.rank >= 1 && book.rank <= 10).map((book: any) => ({
      id: `nyt-${list.slug}-${book.rank}`, title: book.title, media_type: "book",
      image_url: book.book_image || "", creator: book.author,
      source_label: list.label, source_key: `nyt-${list.slug}`, rank: book.rank,
      external_id: book.primary_isbn13 || book.primary_isbn10, external_source: "openlibrary",
      alternate_isbns: (book.isbns || []).flatMap((isbn: any) => [isbn.isbn13, isbn.isbn10]).filter(Boolean),
      chart_country: "US" as const, chart_date: data.results.bestsellers_date,
    }));
  }));
  return improveBookCovers(results.flatMap(result => result.status === "fulfilled" ? result.value : []), {
    ...coverOptions, fetcher,
  });
}

export async function getUSMusicCharts(fetcher: Fetcher = fetch): Promise<ChartItem[]> {
  const response = await fetcher("https://rss.marketingtools.apple.com/api/v2/us/music/most-played/10/albums.json", {
    signal: AbortSignal.timeout(12000),
  });
  if (!response.ok) throw new Error(`Apple Music HTTP ${response.status}`);
  const data = await response.json();
  return (data.feed?.results || []).slice(0, 10).map((album: any, index: number) => ({
    id: `apple-music-${album.id}`, title: album.name, creator: album.artistName,
    media_type: "music", image_url: album.artworkUrl100 || "",
    external_id: String(album.id), external_source: "itunes",
    source_label: "Apple Music", source_key: "apple-music", rank: index + 1,
    chart_country: "US", chart_date: feedDate(data.feed.updated),
  }));
}

export async function getUSPodcastCharts(fetcher: Fetcher = fetch): Promise<ChartItem[]> {
  const response = await fetcher("https://itunes.apple.com/us/rss/toppodcasts/limit=10/json", {
    signal: AbortSignal.timeout(12000),
  });
  if (!response.ok) throw new Error(`Apple Podcasts HTTP ${response.status}`);
  const data = await response.json();
  return (data.feed?.entry || []).slice(0, 10).map((entry: any, index: number) => ({
    id: `apple-podcasts-${entry.id?.attributes?.["im:id"]}`,
    title: entry["im:name"]?.label, creator: entry["im:artist"]?.label,
    media_type: "podcast", image_url: entry["im:image"]?.[2]?.label || "",
    external_id: entry.id?.attributes?.["im:id"], external_source: "itunes",
    source_label: "Apple Podcasts", source_key: "apple-podcasts", rank: index + 1,
    chart_country: "US", chart_date: feedDate(data.feed.updated.label),
  }));
}

export async function loadUSCharts(options: {
  flixKey?: string; tmdbKey?: string; nytKey?: string; fetcher?: Fetcher; now?: Date;
  openaiKey?: string; googleBooksKey?: string; coverCache?: CoverCache;
}) {
  const results = await Promise.allSettled([
    getUSStreamingCharts({ key: options.flixKey, tmdbKey: options.tmdbKey, fetcher: options.fetcher, now: options.now }),
    getUSBookCharts(options.nytKey, options.fetcher, {
      openaiKey: options.openaiKey, googleBooksKey: options.googleBooksKey, cache: options.coverCache,
    }),
    getUSMusicCharts(options.fetcher),
    getUSPodcastCharts(options.fetcher),
  ]);
  const names = ["streaming", "books", "music", "podcasts"];
  const source_status: Record<string, string> = {};
  const items = results.flatMap((result, index) => {
    source_status[names[index]] = result.status === "fulfilled" && result.value.length ? "available" : "unavailable";
    if (result.status === "rejected") console.error(`${names[index]} charts unavailable: ${result.reason?.message || "request failed"}`);
    return result.status === "fulfilled" ? result.value : [];
  }).filter(item => item.title && item.image_url && item.external_id);
  return { items, source_status, country: "US", generated_at: (options.now || new Date()).toISOString(), schema_version: 2 };
}
