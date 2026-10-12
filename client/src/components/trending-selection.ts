import type { TrendingContentItem } from "./use-trending-content";

export type TrendingCategory = "all" | "movie" | "tv" | "book" | "music" | "podcast";
const categories: TrendingCategory[] = ["movie", "tv", "book", "music", "podcast"];

function roundRobin(queues: TrendingContentItem[][], limit: number) {
  const result: TrendingContentItem[] = [];
  for (let i = 0; result.length < limit && queues.some(queue => i < queue.length); i++) {
    for (const queue of queues) {
      if (queue[i] && result.length < limit) result.push(queue[i]);
    }
  }
  return result;
}

/** Discovery is based on external charts, never on Consumed activity or global buzz. */
export function selectTrendingItems(
  items: TrendingContentItem[], category: TrendingCategory, limit = 25,
): TrendingContentItem[] {
  const seen = new Set<string>();
  const eligible = items.filter(item => {
    if (["consumed", "open-library", "trending-tv", "trending-movies"].includes(item.source_key || "")) return false;
    if (item.chart_country && item.chart_country !== "US") return false;
    const type = item.media_type === "book_series" ? "book" : item.media_type;
    if (!categories.includes(type as TrendingCategory) || (category !== "all" && type !== category)) return false;
    const identity = item.external_source && item.external_id
      ? `${item.media_type}:${item.external_source}:${item.external_id}`
      : `${item.media_type}:${item.title.trim().toLowerCase()}:${item.creator || ""}`;
    if (seen.has(identity)) return false;
    seen.add(identity);
    return true;
  });
  // Balance charts inside each media category before balancing the All view.
  // Otherwise the first five TV picks all come from Netflix.
  const buckets = new Map<string, Map<string, TrendingContentItem[]>>();
  for (const item of eligible) {
    const type = item.media_type === "book_series" ? "book" : item.media_type;
    const source = item.source_key || item.source_label || type;
    if (!buckets.has(type)) buckets.set(type, new Map());
    const sources = buckets.get(type)!;
    if (!sources.has(source)) sources.set(source, []);
    sources.get(source)!.push(item);
  }
  const categoryQueues = [...buckets.values()].map(sources => roundRobin(
    [...sources.values()].map(queue => queue.slice().sort((a, b) => (a.rank || 999) - (b.rank || 999))), limit,
  ));
  return roundRobin(categoryQueues, limit);
}
