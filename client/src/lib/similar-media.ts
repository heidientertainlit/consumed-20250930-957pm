// Recommendation resolution only: generation/ranking and shared search stay unchanged.
export type CatalogMediaType = "movie" | "tv" | "book" | "music" | "podcast" | "youtube";
export type GeneratedRecommendation = {
  title: string;
  type?: string;
  media_type?: string;
  year?: string | number;
  creator?: string;
  author?: string;
  artist?: string;
};
export type ResolvedRecommendation = {
  title: string;
  type: CatalogMediaType;
  poster_url: string;
  external_id: string;
  external_source: string;
};
export type RecommendationSlot = {
  key: string;
  status: "pending" | "ready" | "unavailable";
  item?: ResolvedRecommendation;
};

export const GENERATION_TIMEOUT_MS = 20_000;
export const RESOLUTION_TIMEOUT_MS = 10_000;

export function recommendationType(value: unknown): CatalogMediaType | null {
  if (typeof value !== "string") return null;
  const aliases: Record<string, CatalogMediaType> = {
    movie: "movie", film: "movie",
    tv: "tv", "tv show": "tv", "tv series": "tv", television: "tv",
    book: "book", novel: "book",
    music: "music", album: "music", song: "music", track: "music",
    podcast: "podcast", youtube: "youtube",
  };
  return aliases[value.trim().toLowerCase()] || null;
}

type RequestOptions = {
  signal?: AbortSignal;
  timeoutMs?: number;
  fetcher?: typeof fetch;
};

// The deadline covers both fetch and body parsing, even if a transport ignores abort.
export async function recommendationRequest(
  url: string,
  body: unknown,
  accessToken: string,
  { signal, timeoutMs = RESOLUTION_TIMEOUT_MS, fetcher = fetch }: RequestOptions = {},
): Promise<any> {
  if (signal?.aborted) throw new DOMException("Request cancelled", "AbortError");
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let onAbort = () => {};
  const cancelled = new Promise<never>((_, reject) => {
    onAbort = () => {
      controller.abort();
      reject(new DOMException("Request cancelled", "AbortError"));
    };
    signal?.addEventListener("abort", onAbort, { once: true });
    timer = setTimeout(() => {
      controller.abort();
      reject(new Error("Recommendation request timed out"));
    }, timeoutMs);
  });
  try {
    return await Promise.race([
      (async () => {
        const response = await fetcher(url, {
          method: "POST",
          headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
          body: JSON.stringify(body),
          signal: controller.signal,
        });
        if (!response.ok) throw new Error(`Recommendation request failed (${response.status})`);
        return response.json();
      })(),
      cancelled,
    ]);
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", onAbort);
  }
}

export async function generateSimilarMedia(
  baseUrl: string,
  title: string,
  mediaType: string,
  accessToken: string,
  options: RequestOptions = {},
): Promise<GeneratedRecommendation[]> {
  // Preserve the existing cross-media prompt exactly. No same-type bias.
  const prompt = `Find me media similar to "${title}" (${mediaType}). Include: other ${mediaType === 'tv' ? 'TV shows' : mediaType === 'movie' ? 'movies' : mediaType?.toLowerCase() + 's'} like it, soundtrack music, books it's based on or similar books, related podcasts, and any connected media. Mix of types please.`;
  const result = await recommendationRequest(
    `${baseUrl}/functions/v1/conversational-search`, { query: prompt }, accessToken,
    { timeoutMs: GENERATION_TIMEOUT_MS, ...options },
  );
  const recommendations = result?.recommendations || result?.results;
  if (!Array.isArray(recommendations)) throw new Error("Invalid recommendation response");
  return recommendations.slice(0, 6).filter(
    (item): item is GeneratedRecommendation =>
      !!item && typeof item.title === "string" && !!item.title.trim(),
  );
}

function normalizedTitle(value: string) {
  return value.replace(/\s*[\[(]\d{4}[\])]\s*$/, "")
    .normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

function yearOf(value: unknown): string | null {
  const match = /(?:^|\D)((?:18|19|20)\d{2})(?:\D|$)/.exec(String(value ?? ""));
  return match?.[1] || null;
}

function expectedCreator(item: GeneratedRecommendation) {
  return item.creator || item.author || item.artist || "";
}

// A real catalog result is not necessarily the requested work. Never use the
// first hit blindly, invent IDs, or substitute a different media type.
export function verifiedRecommendation(
  recommendation: GeneratedRecommendation,
  results: unknown,
): ResolvedRecommendation | null {
  const type = recommendationType(recommendation.type || recommendation.media_type);
  if (!type || !Array.isArray(results)) return null;
  const wanted = normalizedTitle(recommendation.title);
  const creator = normalizedTitle(expectedCreator(recommendation));
  const year = yearOf(recommendation.year);
  for (const result of results) {
    if (!result || recommendationType(result.type || result.media_type) !== type) continue;
    const source = String(result.external_source || result.source || "").trim().toLowerCase();
    const id = String(result.external_id ?? result.id ?? "").trim();
    if (!id || !["tmdb", "googlebooks", "openlibrary", "open_library", "itunes", "spotify", "youtube"].includes(source)) continue;
    const title = typeof result.title === "string" ? result.title.trim() : "";
    const matchedTitle = normalizedTitle(title);
    if (!matchedTitle) continue;
    const matchedCreator = normalizedTitle(String(result.creator || result.author || result.artist || ""));
    const titleOptions = [matchedTitle];
    if (matchedCreator) {
      titleOptions.push(`${matchedCreator} ${matchedTitle}`, `${matchedTitle} ${matchedCreator}`);
    }
    // Providers often omit the trailing word "Podcast" from the catalog title.
    const comparableWanted = type === "podcast" ? wanted.replace(/ podcast$/, "") : wanted;
    if (!titleOptions.some(candidate => candidate === wanted || candidate === comparableWanted)) continue;
    if (creator && (!matchedCreator || !(` ${matchedCreator} `).includes(` ${creator} `))) continue;
    if (year && yearOf(result.year || result.release_date || result.published_date) !== year) continue;
    return {
      title,
      type,
      // Do not fabricate Google Books cover URLs for coverless catalog editions.
      poster_url: result.poster_url || result.image || result.image_url || "",
      external_id: id,
      external_source: source,
    };
  }
  return null;
}

export async function resolveSimilarMedia(
  baseUrl: string,
  recommendation: GeneratedRecommendation,
  accessToken: string,
  options: RequestOptions = {},
): Promise<ResolvedRecommendation | null> {
  const type = recommendationType(recommendation.type || recommendation.media_type);
  if (!type) return null;
  const query = [
    recommendation.title,
    expectedCreator(recommendation),
    recommendation.year,
  ].filter(Boolean).join(" ");
  const response = await recommendationRequest(
    `${baseUrl}/functions/v1/media-search`, { query, type }, accessToken, options,
  );
  return verifiedRecommendation(recommendation, response?.results);
}
