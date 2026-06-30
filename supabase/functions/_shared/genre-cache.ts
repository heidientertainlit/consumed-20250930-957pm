/**
 * genre-cache
 *
 * Single source of truth for resolving a title's genre from its source API and
 * caching it in the `media_genres` table, keyed by (external_source, external_id).
 *
 * Supported sources: tmdb, googlebooks, itunes, openlibrary.
 * Unsupported sources (youtube, thesportsdb, spotify, rawg) resolve to null and
 * are simply not cached — callers fall back to whatever behavior they had before.
 *
 * Design: cache-first with write-back. `getOrResolveGenres` returns cached
 * canonical genres if present; on a miss it hits the source API, caches the
 * result, and returns it. This makes every consumer warm the cache for free.
 */

import { canonicalizeMany } from './genre-taxonomy.ts';

export const SUPPORTED_GENRE_SOURCES = ['tmdb', 'googlebooks', 'itunes', 'openlibrary'];

function normTmdbType(mediaType: string | null | undefined): 'tv' | 'movie' | null {
  if (!mediaType) return null;
  const s = String(mediaType).toLowerCase();
  if (s.includes('tv') || s.includes('television') || s.includes('series')) return 'tv';
  if (s.includes('movie') || s.includes('film')) return 'movie';
  return null;
}

async function fetchTmdbGenres(externalId: string, mediaType: string | null): Promise<string[]> {
  const key = Deno.env.get('TMDB_API_KEY');
  if (!key) return [];
  const tryTypes: ('tv' | 'movie')[] = (() => {
    const t = normTmdbType(mediaType);
    return t ? [t] : ['movie', 'tv'];
  })();
  for (const t of tryTypes) {
    try {
      const res = await fetch(`https://api.themoviedb.org/3/${t}/${externalId}?api_key=${key}`);
      if (res.ok) {
        const data = await res.json();
        const genres = (data.genres ?? []).map((g: any) => g?.name).filter(Boolean);
        if (genres.length) return genres;
      }
    } catch (_) { /* try next type */ }
  }
  return [];
}

async function fetchGoogleBooksGenres(externalId: string): Promise<string[]> {
  const key = Deno.env.get('GOOGLE_BOOKS_API_KEY');
  try {
    const url = `https://www.googleapis.com/books/v1/volumes/${externalId}?fields=volumeInfo/categories${key ? `&key=${key}` : ''}`;
    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json();
      return (data.volumeInfo?.categories ?? []) as string[];
    }
  } catch (_) { /* skip */ }
  return [];
}

async function fetchItunesGenres(externalId: string): Promise<string[]> {
  try {
    const res = await fetch(`https://itunes.apple.com/lookup?id=${externalId}`);
    if (res.ok) {
      const data = await res.json();
      const result = data.results?.[0];
      if (result?.genres?.length) return result.genres as string[];
      if (result?.primaryGenreName) return [result.primaryGenreName as string];
    }
  } catch (_) { /* skip */ }
  return [];
}

async function fetchOpenLibraryGenres(externalId: string): Promise<string[]> {
  // external_id may be "OL123W", "/works/OL123W", or a full key.
  const id = String(externalId).replace(/^\/?(works\/)?/i, '').trim();
  try {
    const res = await fetch(`https://openlibrary.org/works/${id}.json`);
    if (res.ok) {
      const data = await res.json();
      // subjects can be very long; take the first handful (most relevant)
      return ((data.subjects ?? []) as string[]).slice(0, 8);
    }
  } catch (_) { /* skip */ }
  return [];
}

/** Hit the source API and return RAW genre strings (uncanonicalized). null = unsupported source. */
export async function resolveRawGenres(
  source: string,
  externalId: string,
  mediaType: string | null,
): Promise<string[] | null> {
  if (!source || !externalId) return null;
  switch (source) {
    case 'tmdb':        return await fetchTmdbGenres(externalId, mediaType);
    case 'googlebooks': return await fetchGoogleBooksGenres(externalId);
    case 'itunes':      return await fetchItunesGenres(externalId);
    case 'openlibrary': return await fetchOpenLibraryGenres(externalId);
    default:            return null; // unsupported — caller falls back
  }
}

export async function getCachedGenres(
  svc: any,
  source: string,
  externalId: string,
): Promise<string[] | null> {
  const { data } = await svc
    .from('media_genres')
    .select('canonical_genres')
    .eq('external_source', source)
    .eq('external_id', externalId)
    .maybeSingle();
  return data ? (data.canonical_genres as string[]) : null;
}

export async function cacheGenres(
  svc: any,
  source: string,
  externalId: string,
  mediaType: string | null,
  rawGenres: string[],
): Promise<string[]> {
  const canonical = canonicalizeMany(rawGenres);
  await svc.from('media_genres').upsert({
    external_source: source,
    external_id: externalId,
    media_type: mediaType ?? null,
    raw_genres: rawGenres.map((g) => String(g).toLowerCase().trim()).filter(Boolean),
    canonical_genres: canonical,
    resolved_at: new Date().toISOString(),
  }, { onConflict: 'external_source,external_id' });
  return canonical;
}

/** Cache-first canonical genres for a single title; writes back on a miss. */
export async function getOrResolveGenres(
  svc: any,
  source: string,
  externalId: string,
  mediaType: string | null,
): Promise<string[]> {
  const cached = await getCachedGenres(svc, source, externalId);
  if (cached) return cached;
  const raw = await resolveRawGenres(source, externalId, mediaType);
  if (raw === null) return []; // unsupported source
  return await cacheGenres(svc, source, externalId, mediaType, raw);
}
