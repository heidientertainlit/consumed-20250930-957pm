import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Cache-Control': 'no-store',
};

// Fallback map: genre-name → TMDB genre IDs, used only when TMDB has no matching
// keyword for the room's tag. Keyword discovery is preferred (better for niche
// topics like "true crime", which is a keyword, not a base TMDB genre).
const GENRE_MAP: Record<string, { movie: number[]; tv: number[] }> = {
  'true crime': { movie: [80, 99], tv: [80, 99] },
  'crime': { movie: [80], tv: [80] },
  'horror': { movie: [27], tv: [9648] },
  'comedy': { movie: [35], tv: [35] },
  'drama': { movie: [18], tv: [18] },
  'sci-fi': { movie: [878], tv: [10765] },
  'science fiction': { movie: [878], tv: [10765] },
  'fantasy': { movie: [14], tv: [10765] },
  'romance': { movie: [10749], tv: [18] },
  'thriller': { movie: [53], tv: [80] },
  'action': { movie: [28], tv: [10759] },
  'documentary': { movie: [99], tv: [99] },
  'animation': { movie: [16], tv: [16] },
  'mystery': { movie: [9648], tv: [9648] },
  'family': { movie: [10751], tv: [10751] },
  'reality': { movie: [], tv: [10764] },
};

function mapItem(item: any, kind: 'movie' | 'tv') {
  const title = kind === 'movie'
    ? (item.title || item.original_title)
    : (item.name || item.original_name);
  const date = kind === 'movie' ? item.release_date : item.first_air_date;
  return {
    title,
    type: kind,
    year: date ? Number(String(date).slice(0, 4)) || null : null,
    poster_url: item.poster_path ? `https://image.tmdb.org/t/p/w300${item.poster_path}` : '',
    external_id: String(item.id),
    external_source: 'tmdb',
    rating: item.vote_average ? Math.round(item.vote_average * 10) / 10 : null,
  };
}

function interleave(a: any[], b: any[]) {
  const out: any[] = [];
  const n = Math.max(a.length, b.length);
  for (let i = 0; i < n; i++) {
    if (i < a.length) out.push(a[i]);
    if (i < b.length) out.push(b[i]);
  }
  return out;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const json = (body: any, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  try {
    const url = new URL(req.url);
    let seriesTag = url.searchParams.get('series_tag') || '';
    let name = url.searchParams.get('name') || '';
    let mediaType = url.searchParams.get('media_type') || '';
    if (req.method === 'POST') {
      try {
        const b = await req.json();
        seriesTag = b.series_tag || seriesTag;
        name = b.name || name;
        mediaType = b.media_type || mediaType;
      } catch (_) { /* no body */ }
    }

    // The search term: prefer the room's genre tag ("true-crime" → "true crime"),
    // fall back to the room name.
    const term = (seriesTag.replace(/-/g, ' ') || name).trim();
    const tmdbKey = Deno.env.get('TMDB_API_KEY');
    if (!tmdbKey) return json({ sections: [], error: 'TMDB not configured' }, 500);
    if (!term) return json({ sections: [] });

    // Resolve a TMDB keyword id for the term (best signal for genre discovery).
    let keywordId: string | null = null;
    try {
      const kr = await fetch(
        `https://api.themoviedb.org/3/search/keyword?api_key=${tmdbKey}&query=${encodeURIComponent(term)}`
      );
      if (kr.ok) {
        const kd = await kr.json();
        const lc = term.toLowerCase();
        const exact = (kd.results || []).find((k: any) => (k.name || '').toLowerCase() === lc);
        keywordId = exact ? String(exact.id) : (kd.results?.[0] ? String(kd.results[0].id) : null);
      }
    } catch (_) { /* keyword resolution is best-effort */ }

    const genreIds = GENRE_MAP[term.toLowerCase()] || null;
    if (!keywordId && !genreIds) {
      // Nothing to discover with — return empty so the client shows an empty state.
      return json({ keyword: term, keyword_id: null, sections: [] });
    }

    const today = new Date().toISOString().split('T')[0];
    const wantMovie = !mediaType || mediaType === 'movie';
    const wantTv = !mediaType || mediaType === 'tv';

    async function discover(kind: 'movie' | 'tv', sortBy: string, extra: Record<string, string>) {
      const p = new URLSearchParams({
        api_key: tmdbKey!,
        sort_by: sortBy,
        include_adult: 'false',
        page: '1',
        ...extra,
      });
      if (keywordId) {
        p.set('with_keywords', keywordId);
      } else if (genreIds && genreIds[kind].length > 0) {
        p.set('with_genres', genreIds[kind].join(','));
      } else {
        return [];
      }
      try {
        const r = await fetch(`https://api.themoviedb.org/3/discover/${kind}?${p.toString()}`);
        if (!r.ok) return [];
        const d = await r.json();
        return (d.results || [])
          .filter((i: any) => i.poster_path)
          .map((i: any) => mapItem(i, kind));
      } catch (_) {
        return [];
      }
    }

    const [
      trendMovie, trendTv,
      newMovie, newTv,
      topMovie, topTv,
    ] = await Promise.all([
      wantMovie ? discover('movie', 'popularity.desc', { 'vote_count.gte': '50' }) : Promise.resolve([]),
      wantTv ? discover('tv', 'popularity.desc', { 'vote_count.gte': '50' }) : Promise.resolve([]),
      wantMovie ? discover('movie', 'primary_release_date.desc', { 'primary_release_date.lte': today, 'vote_count.gte': '15' }) : Promise.resolve([]),
      wantTv ? discover('tv', 'first_air_date.desc', { 'first_air_date.lte': today, 'vote_count.gte': '15' }) : Promise.resolve([]),
      wantMovie ? discover('movie', 'vote_average.desc', { 'vote_count.gte': '200' }) : Promise.resolve([]),
      wantTv ? discover('tv', 'vote_average.desc', { 'vote_count.gte': '200' }) : Promise.resolve([]),
    ]);

    const sections = [
      { key: 'trending', title: 'Trending This Week', items: interleave(trendMovie, trendTv).slice(0, 15) },
      { key: 'new', title: 'New Releases', items: interleave(newMovie, newTv).slice(0, 15) },
      { key: 'top', title: 'Fan Favorites', items: interleave(topMovie, topTv).slice(0, 15) },
    ].filter((s) => s.items.length > 0);

    return json({ keyword: term, keyword_id: keywordId, sections });
  } catch (e) {
    return json({ sections: [], error: String((e as any)?.message || e) }, 500);
  }
});
