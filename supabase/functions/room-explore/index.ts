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

// Books via Google Books (genre browse by subject). external_source 'googlebooks'
// is handled by get-media-details so cards open correctly.
async function fetchBooks(term: string): Promise<any[]> {
  const key = Deno.env.get('GOOGLE_BOOKS_API_KEY');
  const q = `subject:"${term}"`;
  const base = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(q)}&maxResults=20&printType=books&orderBy=relevance`;
  const u = key ? `${base}&key=${key}` : base;
  try {
    const r = await fetch(u);
    if (!r.ok) return [];
    const d = await r.json();
    return (d.items || [])
      .map((item: any) => {
        const v = item.volumeInfo || {};
        let img = v.imageLinks?.thumbnail || v.imageLinks?.smallThumbnail || '';
        if (img.startsWith('http://')) img = img.replace('http://', 'https://');
        return {
          title: v.title,
          type: 'book',
          year: v.publishedDate ? Number(String(v.publishedDate).slice(0, 4)) || null : null,
          poster_url: img,
          external_id: item.id,
          external_source: 'googlebooks',
          creator: v.authors?.[0] || null,
          rating: v.averageRating ? Math.round(v.averageRating * 10) / 10 : null,
        };
      })
      .filter((b: any) => b.title && b.poster_url)
      .slice(0, 15);
  } catch (_) {
    return [];
  }
}

// Podcasts via the free iTunes Search API. external_source 'itunes' is handled by
// get-media-details so cards open correctly.
async function fetchPodcasts(term: string): Promise<any[]> {
  const u = `https://itunes.apple.com/search?term=${encodeURIComponent(term)}&media=podcast&entity=podcast&limit=20&country=US`;
  try {
    const r = await fetch(u);
    if (!r.ok) return [];
    const d = await r.json();
    return (d.results || [])
      .map((p: any) => ({
        title: p.collectionName || p.trackName,
        type: 'podcast',
        year: p.releaseDate ? Number(String(p.releaseDate).slice(0, 4)) || null : null,
        poster_url: p.artworkUrl600 || p.artworkUrl100 || p.artworkUrl60 || '',
        external_id: String(p.collectionId || p.trackId),
        external_source: 'itunes',
        creator: p.artistName || null,
        rating: null,
      }))
      .filter((p: any) => p.title && p.poster_url && p.external_id)
      .slice(0, 15);
  } catch (_) {
    return [];
  }
}

Deno.serve(async (req) => {
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

    const today = new Date().toISOString().split('T')[0];
    const wantMovie = !mediaType || mediaType === 'movie';
    const wantTv = !mediaType || mediaType === 'tv';
    const wantPodcast = !mediaType || mediaType === 'podcast';
    const wantBook = !mediaType || mediaType === 'book';
    const canTmdb = !!keywordId || !!genreIds;

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
      podcasts, books,
    ] = await Promise.all([
      wantMovie && canTmdb ? discover('movie', 'popularity.desc', { 'vote_count.gte': '50' }) : Promise.resolve([]),
      wantTv && canTmdb ? discover('tv', 'popularity.desc', { 'vote_count.gte': '50' }) : Promise.resolve([]),
      wantMovie && canTmdb ? discover('movie', 'primary_release_date.desc', { 'primary_release_date.lte': today, 'vote_count.gte': '15' }) : Promise.resolve([]),
      wantTv && canTmdb ? discover('tv', 'first_air_date.desc', { 'first_air_date.lte': today, 'vote_count.gte': '15' }) : Promise.resolve([]),
      wantMovie && canTmdb ? discover('movie', 'vote_average.desc', { 'vote_count.gte': '200' }) : Promise.resolve([]),
      wantTv && canTmdb ? discover('tv', 'vote_average.desc', { 'vote_count.gte': '200' }) : Promise.resolve([]),
      wantPodcast ? fetchPodcasts(term) : Promise.resolve([]),
      wantBook ? fetchBooks(term) : Promise.resolve([]),
    ]);

    // Vibe sections (mixed movie + tv) first, then browse-by-media-type sections.
    const sections = [
      { key: 'trending', title: 'Trending This Week', items: interleave(trendMovie, trendTv).slice(0, 15) },
      { key: 'new', title: 'New Releases', items: interleave(newMovie, newTv).slice(0, 15) },
      { key: 'top', title: 'Fan Favorites', items: interleave(topMovie, topTv).slice(0, 15) },
      { key: 'movies', title: 'Movies', items: topMovie.length ? topMovie.slice(0, 15) : trendMovie.slice(0, 15) },
      { key: 'tv', title: 'TV Shows', items: topTv.length ? topTv.slice(0, 15) : trendTv.slice(0, 15) },
      { key: 'podcasts', title: 'Podcasts', items: podcasts },
      { key: 'books', title: 'Books', items: books },
    ].filter((s) => s.items.length > 0);

    return json({ keyword: term, keyword_id: keywordId, sections });
  } catch (e) {
    return json({ sections: [], error: String((e as any)?.message || e) }, 500);
  }
});
