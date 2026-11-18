import { useEffect, useId, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, Film, Loader2, MessageSquarePlus, Plus, Star } from "lucide-react";
import { appApiUrl } from "@/lib/share";
import type { MovieCollectionDetails, MovieCollectionFilm, MovieCollectionSummary } from "@shared/movie-collections";

// Do not reuse pre-filter search/details responses in a still-open client.
const collectionSafetyCacheKey = "adult-filter-v1";

async function getCollections<T>(params: Record<string, string>, signal: AbortSignal): Promise<T> {
  const response = await fetch(appApiUrl(`/api/movie-collections?${new URLSearchParams(params)}`), { signal });
  if (!response.ok) throw new Error("Movie collections are unavailable");
  return response.json();
}

type MovieActions = {
  onOpenMedia: (movie: MovieCollectionFilm) => void;
  onAddMedia: (movie: MovieCollectionFilm) => void;
  onRateMedia?: (movie: MovieCollectionFilm) => void;
};

type Appearance = { appearance?: "dark" | "light" };

function MovieCollectionRow({ collection, onOpenMedia, onAddMedia, onRateMedia, appearance = "dark" }: MovieActions & Appearance & {
  collection: MovieCollectionSummary;
}) {
  const light = appearance === "light";
  const [expanded, setExpanded] = useState(false);
  const regionId = useId();
  const { data, isPending, isError, refetch } = useQuery({
    queryKey: ["movie-collection-details", collectionSafetyCacheKey, collection.id],
    queryFn: ({ signal }) => getCollections<{ collection: MovieCollectionDetails }>({ collectionId: collection.id }, signal),
    enabled: expanded,
    staleTime: 60 * 60_000,
    retry: false,
  });
  const movies = data?.collection.movies || [];
  return (
    <div data-testid={`movie-collection-${collection.id}`}>
      <button
        type="button"
        onClick={() => setExpanded(value => !value)}
        aria-expanded={expanded}
        aria-controls={regionId}
        className={`flex w-full items-start gap-3 px-3 py-2.5 text-left ${light ? "rounded-xl hover:bg-gray-50" : "hover:bg-white/5"}`}
      >
        {collection.image ? <img src={collection.image} alt="" className="h-14 w-10 shrink-0 rounded object-cover" /> : <Film aria-hidden="true" size={24} className="mt-2 shrink-0 text-purple-300" />}
        <span className="min-w-0 flex-1">
          <span className={`block text-sm font-semibold leading-snug ${light ? "text-gray-900" : "text-white"}`}>{collection.title}</span>
          <span className={`mt-0.5 block text-xs ${light ? "text-gray-500" : "text-gray-400"}`}>Movie collection</span>
          <span className={`mt-1 inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-medium ${light ? "border-purple-200 bg-purple-100 text-purple-700" : "border-purple-400/40 bg-purple-500/30 text-purple-200"}`}>
            <Film size={11} aria-hidden="true" />
            {data ? `${movies.length} movies` : "View movies"}
            <ChevronDown size={11} aria-hidden="true" className={expanded ? "rotate-180" : ""} />
          </span>
        </span>
      </button>
      {expanded && (
        <div id={regionId} className={`ml-4 mr-2 mb-2 overflow-hidden rounded-xl border ${light ? "border-purple-200 bg-purple-50" : "border-purple-500/20 bg-purple-800/10"}`}>
          <p className={`border-b px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider ${light ? "border-purple-100 text-purple-700" : "border-purple-500/15 text-purple-300"}`}>Movies in this collection</p>
          {isPending ? (
            <p role="status" className={`flex items-center gap-2 px-3 py-3 text-xs ${light ? "text-gray-500" : "text-gray-400"}`}><Loader2 size={12} aria-hidden="true" className="animate-spin motion-reduce:animate-none" />Loading movies...</p>
          ) : isError ? (
            <div className={`px-3 py-3 text-xs ${light ? "text-gray-600" : "text-gray-400"}`}>
              <p role="alert">Couldn't load movies.</p>
              <button type="button" onClick={() => void refetch()} className={`mt-2 underline ${light ? "text-purple-700" : "text-purple-300"}`}>Try again</button>
            </div>
          ) : movies.length === 0 ? (
            <p className={`px-3 py-3 text-xs ${light ? "text-gray-500" : "text-gray-400"}`}>No movies found in this collection.</p>
          ) : movies.map(movie => (
            <div key={movie.external_id} className={`flex items-center gap-2 border-b px-3 py-2 last:border-0 ${light ? "border-purple-100" : "border-purple-500/10"}`} data-testid={`collection-movie-${movie.external_id}`}>
              <button type="button" onClick={() => onOpenMedia(movie)} className="flex min-w-0 flex-1 items-center gap-2.5 text-left">
                {movie.image ? <img src={movie.image} alt="" className="h-11 w-8 shrink-0 rounded object-cover" /> : <Film size={20} aria-hidden="true" className="shrink-0 text-purple-300" />}
                <span className="min-w-0 flex-1">
                  <span className={`block text-xs font-medium leading-snug ${light ? "text-gray-900" : "text-white/90"}`}>{movie.title}</span>
                  <span className={`mt-0.5 block text-[10px] ${light ? "text-gray-500" : "text-gray-400"}`}>Movie{movie.year ? ` · ${movie.year}` : ""}</span>
                </span>
              </button>
              <button type="button" onClick={() => onAddMedia(movie)} aria-label={`Add ${movie.title} to a list`} className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-purple-600 text-white hover:bg-purple-700"><Plus size={13} aria-hidden="true" /></button>
              {onRateMedia && <button type="button" onClick={() => onRateMedia(movie)} aria-label={`Rate ${movie.title}`} className="relative flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-r from-orange-500 to-pink-500 text-white"><MessageSquarePlus size={13} aria-hidden="true" /><Star size={8} aria-hidden="true" className="absolute -right-0.5 -top-0.5 fill-yellow-300 text-yellow-300" /></button>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** Optional discovery, independent from existing media and people search queries. */
export function MovieCollectionSearchResults({ query, enabled, appearance = "dark", ...actions }: MovieActions & Appearance & {
  query: string;
  enabled: boolean;
}) {
  const [settledQuery, setSettledQuery] = useState("");
  const trimmed = query.trim();
  useEffect(() => {
    setSettledQuery("");
    if (!enabled || trimmed.length < 2 || trimmed.length > 120) return;
    const timeout = window.setTimeout(() => setSettledQuery(trimmed), 300);
    return () => window.clearTimeout(timeout);
  }, [trimmed, enabled]);
  const ready = enabled && settledQuery === trimmed && settledQuery.length >= 2;
  const { data, isError } = useQuery({
    queryKey: ["movie-collection-search", collectionSafetyCacheKey, settledQuery],
    queryFn: ({ signal }) => getCollections<{ collections: MovieCollectionSummary[] }>({ query: settledQuery }, signal),
    enabled: ready,
    staleTime: 10 * 60_000,
    retry: false,
  });
  if (!ready) return null;
  if (isError) return <p className={`px-3 py-2 text-[11px] ${appearance === "light" ? "text-gray-500" : "text-gray-400"}`}>Movie collections unavailable. Other search results are unaffected.</p>;
  if (!data?.collections.length) return null;
  return (
    <section aria-label="Movie collections" data-testid="movie-collection-search-results" className={appearance === "light" ? "mb-3 rounded-xl border border-gray-200 p-1" : undefined}>
      <p className={`px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider ${appearance === "light" ? "text-gray-500" : "border-t border-white/[0.06] text-gray-400"}`}>Movie collections</p>
      {data.collections.map(collection => <MovieCollectionRow key={`${settledQuery}-${collection.id}`} collection={collection} appearance={appearance} {...actions} />)}
    </section>
  );
}
