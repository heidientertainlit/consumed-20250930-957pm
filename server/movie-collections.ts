import type { MovieCollectionDetails, MovieCollectionSummary } from "../shared/movie-collections";

type CacheEntry = { expires: number; data: unknown };

/** Public, read-only catalog proxy shared by Express and the Vercel endpoint. */
export function createMovieCollectionsHandler({
  apiKey = () => process.env.TMDB_API_KEY,
  fetcher = fetch,
}: {
  apiKey?: () => string | undefined;
  fetcher?: typeof fetch;
} = {}) {
  const cache = new Map<string, CacheEntry>();
  const imageUrl = (path: unknown) =>
    typeof path === "string" && /^\/[\w.-]+$/.test(path)
      ? `https://image.tmdb.org/t/p/w185${path}` : "";
  const validId = (id: unknown) => /^\d+$/.test(String(id)) && Number(id) > 0 && Number.isSafeInteger(Number(id));

  return async (req: any, res: any) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    if (req.method === "OPTIONS") return res.status(204).end();
    if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

    const { query, collectionId } = req.query || {};
    const isSearch = typeof query === "string" && collectionId === undefined;
    const isDetails = query === undefined && typeof collectionId === "string" && validId(collectionId);
    if ((!isSearch && !isDetails) || (isSearch && (query.trim().length < 2 || query.trim().length > 120))) {
      return res.status(400).json({ error: "Provide a search query of 2–120 characters or a valid collectionId" });
    }
    const key = isSearch ? `search:${query.trim().toLowerCase()}` : `collection:${collectionId}`;
    const cached = cache.get(key);
    if (cached && cached.expires > Date.now()) {
      return res.status(200).json(cached.data);
    }
    cache.delete(key);
    const secret = apiKey();
    if (!secret) return res.status(503).json({ error: "Movie collections are unavailable" });
    try {
      const url = new URL(isSearch
        ? "https://api.themoviedb.org/3/search/collection"
        : `https://api.themoviedb.org/3/collection/${collectionId}`);
      url.searchParams.set("api_key", secret);
      url.searchParams.set("language", "en-US");
      if (isSearch) {
        url.searchParams.set("query", query.trim());
        url.searchParams.set("include_adult", "false");
        url.searchParams.set("page", "1");
      }
      const response = await fetcher(url.toString(), { signal: AbortSignal.timeout(6000) });
      if (!response.ok) throw new Error("Catalog lookup failed");
      const data = await response.json();
      let result: { collections: MovieCollectionSummary[] } | { collection: MovieCollectionDetails };
      if (isSearch) {
        result = {
          collections: (Array.isArray(data.results) ? data.results : [])
            .filter((item: any) => validId(item.id) && typeof item.name === "string" && item.name.trim() && item.adult !== true)
            .slice(0, 3)
            .map((item: any) => ({ id: String(item.id), title: item.name, image: imageUrl(item.poster_path) })),
        };
      } else {
        if (!validId(data.id) || String(data.id) !== collectionId || typeof data.name !== "string" || !Array.isArray(data.parts)) {
          throw new Error("Invalid collection response");
        }
        const seen = new Set<string>();
        const movies = [...data.parts]
          .filter((item: any) => {
            if (!validId(item.id) || typeof item.title !== "string" || !item.title.trim() || item.adult === true || (item.media_type && item.media_type !== "movie")) return false;
            const id = String(item.id);
            if (seen.has(id)) return false;
            seen.add(id);
            return true;
          })
          .sort((a: any, b: any) => (a.release_date || "9999").localeCompare(b.release_date || "9999"))
          .map((item: any) => ({
            title: item.title,
            type: "movie" as const,
            external_id: String(item.id),
            external_source: "tmdb" as const,
            image: imageUrl(item.poster_path),
            ...(/^\d{4}-/.test(item.release_date || "") ? { year: Number(item.release_date.slice(0, 4)) } : {}),
          }));
        result = { collection: { id: String(data.id), title: data.name, image: imageUrl(data.poster_path), movies } };
      }
      if (cache.size >= 200) cache.delete(cache.keys().next().value!);
      cache.set(key, { data: result, expires: Date.now() + (isSearch ? 10 * 60_000 : 60 * 60_000) });
      return res.status(200).json(result);
    } catch {
      // Never echo upstream URLs or errors: the TMDB credential is in the URL.
      return res.status(502).json({ error: "Couldn't load movie collections. Please try again." });
    }
  };
}

export const handleMovieCollectionsRequest = createMovieCollectionsHandler();
