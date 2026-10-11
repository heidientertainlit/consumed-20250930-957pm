import { useQuery } from "@tanstack/react-query";

export interface TrendingContentItem {
  id?: string;
  title: string;
  media_type: string;
  image_url: string;
  external_id?: string;
  external_source?: string;
  source_label?: string;
  source_key?: string;
  creator?: string;
}

const trendingContentQueryKey = ["trending-content"];

// Chart labels are not always provider names. These aliases refer to the same
// authoritative provider IDs, not title-based guesses at a different work.
const providerAliases: Record<string, string> = {
  tmdb_movie: "tmdb",
  "apple-music": "itunes",
  "apple-podcasts": "itunes",
};

export function normalizeTrendingItems(items: unknown): TrendingContentItem[] {
  if (!Array.isArray(items)) throw new Error("Invalid trending media response.");
  return items
    .filter(item => item && typeof item.title === "string" && item.title.trim()
      && typeof item.image_url === "string" && item.image_url)
    .slice(0, 25)
    .map(item => ({
      ...item,
      external_source: providerAliases[item.external_source] || item.external_source,
      // `id` is a display key such as "app-0", not a provider media ID.
      external_id: item.external_id != null && String(item.external_id).trim()
        ? String(item.external_id).trim() : undefined,
    }));
}

async function fetchTrendingContent(): Promise<TrendingContentItem[]> {
  const baseUrl = import.meta.env.VITE_SUPABASE_URL || "https://mahpgcogwpawvviapqza.supabase.co";
  const response = await fetch(`${baseUrl}/functions/v1/get-trending-content`, {
    headers: {
      Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
      "Content-Type": "application/json",
    },
  });
  if (!response.ok) throw new Error("Could not load trending media.");
  const payload = await response.json();
  if (payload?.error) throw new Error("Could not load trending media.");
  return normalizeTrendingItems(payload?.items);
}

export function useTrendingContent(enabled = true) {
  return useQuery({
    queryKey: trendingContentQueryKey,
    queryFn: fetchTrendingContent,
    staleTime: 5 * 60 * 1000,
    retry: 1,
    enabled,
  });
}
