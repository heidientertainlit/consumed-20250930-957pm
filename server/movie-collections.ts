import type { MovieCollectionDetails, MovieCollectionSummary } from "../shared/movie-collections";
import { isAllowedCatalogVideo } from "../supabase/functions/_shared/catalog-content-safety";
import { createCatalogVideoGate, type CatalogVerdict } from "../supabase/functions/_shared/catalog-video-classification";

type CacheEntry = { expires: number; data: unknown };

/** Public, read-only catalog proxy shared by Express and the Vercel endpoint. */
export function createMovieCollectionsHandler({
  apiKey = () => process.env.TMDB_API_KEY,
  modelKey = () => process.env.OPENAI_API_KEY,
  fetcher = fetch,
}: {
  apiKey?: () => string | undefined;
  modelKey?: () => string | undefined;
  fetcher?: typeof fetch;
} = {}) {
  const cache = new Map<string, CacheEntry>();
  const safety = createCatalogVideoGate({ tmdbKey: apiKey, modelKey, fetcher });
  const imageUrl = (path: unknown) =>
    typeof path === "string" && /^\/[\w.-]+$/.test(path)
      ? `https://image.tmdb.org/t/p/w185${path}` : "";
  const validId = (id: unknown) => /^\d+$/.test(String(id)) && Number(id) > 0 && Number.isSafeInteger(Number(id));
  async function screenCollections(collections: any[]): Promise<CatalogVerdict[]> {
    const parts = collections.map(data => Array.isArray(data?.parts)
      ? data.parts.filter((item: any) => !item?.media_type || item.media_type === "movie") : []);
    const verdicts = await safety.assess(parts.flat().filter((item: any) => validId(item?.id))
      .map((item: any) => ({ type: "movie" as const, id: String(item.id) })));
    return collections.map((data, index) => {
      if (!data || !Array.isArray(data.parts) || !parts[index].length) return "uncertain";
      if (!isAllowedCatalogVideo(data) || parts[index].some((item: any) => !isAllowedCatalogVideo(item))) return "block";
      const checks = parts[index].map((item: any) =>
        validId(item?.id) && typeof item.title === "string" && item.title.trim()
          ? verdicts.get(`movie:${item.id}`) || "uncertain" : "uncertain");
      if (checks.includes("block")) return "block";
      return checks.every((value: CatalogVerdict) => value === "allow") ? "allow" : "uncertain";
    });
  }

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
      // Only the filtered response below is ever cached. Raw provider titles,
      // posters and metadata must never populate this success cache.
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
        const candidates = (Array.isArray(data.results) ? data.results : [])
          .filter((item: any) => validId(item?.id) && typeof item.name === "string" && item.name.trim() && isAllowedCatalogVideo(item))
          .slice(0, 3);
        // Search summaries have neither reliable flags nor member metadata.
        // Fetch members before exposing even the parent name/poster.
        const details = await Promise.all(candidates.map(async (item: any) => {
          try {
            const detailUrl = new URL(`https://api.themoviedb.org/3/collection/${item.id}`);
            detailUrl.searchParams.set("api_key", secret);
            detailUrl.searchParams.set("language", "en-US");
            const response = await fetcher(detailUrl.toString(), { signal: AbortSignal.timeout(6000) });
            if (!response.ok) return null;
            const detail = await response.json();
            return String(detail?.id) === String(item.id) && typeof detail.name === "string" ? detail : null;
          } catch { return null; }
        }));
        const verdicts = await screenCollections(details);
        // Transient classification/lookup failures must be explicit, not cached
        // as a successful "no collections" response.
        if (verdicts.includes("uncertain")) return res.status(503).json({ error: "Movie collections are temporarily unavailable. Please try again." });
        result = { collections: candidates.filter((_: any, index: number) => verdicts[index] === "allow")
          .map((item: any) => ({ id: String(item.id), title: item.name, image: imageUrl(item.poster_path) })) };
      } else {
        if (!validId(data.id) || String(data.id) !== collectionId || typeof data.name !== "string" || !Array.isArray(data.parts)) {
          throw new Error("Invalid collection response");
        }
        // Direct collection IDs must enforce the same boundary as search,
        // before revealing even the collection title or artwork.
        if (!isAllowedCatalogVideo(data)) {
          return res.status(404).json({ error: "Collection unavailable" });
        }
        const [verdict] = await screenCollections([data]);
        if (verdict === "block") return res.status(404).json({ error: "Collection unavailable" });
        if (verdict !== "allow") return res.status(503).json({ error: "Movie collections are temporarily unavailable. Please try again." });
        const seen = new Set<string>();
        const movies = [...data.parts]
          .filter((item: any) => {
            if (!validId(item.id) || typeof item.title !== "string" || !item.title.trim() || !isAllowedCatalogVideo(item) || (item.media_type && item.media_type !== "movie")) return false;
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
