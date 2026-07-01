const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Cache-Control': 'no-store',
};

// Per-room explore config keyed by series_tag. This is the source of truth for
// what a room's Explore surfaces. Using explicit TMDB genre ids (plus a
// `without` exclusion list) is far more reliable than TMDB keyword search, which
// tags kids/animation titles as "heartwarming" and pollutes cozy rooms with
// cartoons. `keyword` is only used where a keyword genuinely models the room
// better than a base genre (e.g. "true crime").
//   Genre ids: 80 Crime, 99 Documentary, 27 Horror, 35 Comedy, 18 Drama,
//   878 Sci-Fi, 14 Fantasy, 10749 Romance, 53 Thriller, 28 Action, 16 Animation,
//   9648 Mystery, 10751 Family, 36 History, 10759 Action&Adventure(tv),
//   10765 Sci-Fi&Fantasy(tv), 10764 Reality(tv).
const ROOM_CONFIG: Record<string, { movie: number[]; tv: number[]; without?: number[]; keyword?: string }> = {
  'true-crime':      { movie: [80, 99], tv: [80, 99], keyword: 'true crime', without: [16] },
  'mystery':         { movie: [9648], tv: [9648], without: [16] },
  'reality':         { movie: [], tv: [10764], without: [16] },
  'horror':          { movie: [27], tv: [9648, 18] },
  'action-thriller': { movie: [28, 53], tv: [10759, 80], without: [16] },
  'fantasy':         { movie: [14], tv: [10765] },
  'period-drama':    { movie: [18, 36], tv: [18], without: [16] },
  'heartwarming':    { movie: [10749], tv: [18], without: [16, 10751, 27, 878, 80, 53, 9648, 10765, 10768, 10752] },
  'rom-com':         { movie: [10749, 35], tv: [35], without: [16] },
};

// Legacy fallback for rooms without an explicit config entry.
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

function dedupe(items: any[]) {
  const seen = new Set<string>();
  const out: any[] = [];
  for (const it of items) {
    const k = `${it.type}:${it.external_id}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(it);
  }
  return out;
}

// Books via Google Books (genre browse by subject).
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

// Podcasts via the free iTunes Search API.
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
    let seedsRaw = url.searchParams.get('seeds') || '';
    if (req.method === 'POST') {
      try {
        const b = await req.json();
        seriesTag = b.series_tag || seriesTag;
        name = b.name || name;
        mediaType = b.media_type || mediaType;
        seedsRaw = b.seeds || seedsRaw;
      } catch (_) { /* no body */ }
    }

    const tagKey = seriesTag.trim().toLowerCase();
    // The search term (for books / podcasts / keyword fallback).
    const term = (seriesTag.replace(/-/g, ' ') || name).trim();
    const tmdbKey = Deno.env.get('TMDB_API_KEY');
    if (!tmdbKey) return json({ sections: [], error: 'TMDB not configured' }, 500);
    if (!term && !seedsRaw) return json({ sections: [] });

    const cfg = ROOM_CONFIG[tagKey] || null;

    // Resolve a TMDB keyword id: prefer the config keyword, else fall back to
    // the term itself only when there is no explicit genre config for the room.
    let keywordId: string | null = null;
    const keywordQuery = cfg?.keyword || (cfg ? '' : term);
    if (keywordQuery) {
      try {
        const kr = await fetch(
          `https://api.themoviedb.org/3/search/keyword?api_key=${tmdbKey}&query=${encodeURIComponent(keywordQuery)}`
        );
        if (kr.ok) {
          const kd = await kr.json();
          const lc = keywordQuery.toLowerCase();
          const exact = (kd.results || []).find((k: any) => (k.name || '').toLowerCase() === lc);
          keywordId = exact ? String(exact.id) : (kd.results?.[0] ? String(kd.results[0].id) : null);
        }
      } catch (_) { /* best-effort */ }
    }

    const genreIds = cfg || GENRE_MAP[term.toLowerCase()] || null;
    const withoutGenres = cfg?.without || [];

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
      const g = genreIds ? genreIds[kind] : [];
      let hasFilter = false;
      // When the room has an explicit config we drive by genre; keyword is only
      // layered on for keyword-modelled rooms (e.g. true crime).
      if (keywordId && (!cfg || cfg.keyword)) {
        p.set('with_keywords', keywordId);
        hasFilter = true;
      }
      if (g && g.length > 0) {
        p.set('with_genres', g.join(','));
        hasFilter = true;
      }
      if (withoutGenres.length > 0) p.set('without_genres', withoutGenres.join(','));
      if (!hasFilter) return [];
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

    // ── Seed-guided recommendations ──────────────────────────────────────
    // Resolve the room's example titles to TMDB and pull "recommendations" so
    // Explore is anchored to the real titles that define the room's vibe.
    const seeds = seedsRaw
      .split(/[|,]/)
      .map((s) => s.trim())
      .filter((s) => s.length > 1)
      .slice(0, 5);

    async function seedRecommendations(): Promise<any[]> {
      // Seed recs are movie/tv only — skip for rooms scoped to podcasts/books.
      if (seeds.length === 0 || (!wantMovie && !wantTv)) return [];
      const matched: { id: number; kind: 'movie' | 'tv' }[] = [];
      await Promise.all(seeds.map(async (title) => {
        try {
          const r = await fetch(
            `https://api.themoviedb.org/3/search/multi?api_key=${tmdbKey}&include_adult=false&query=${encodeURIComponent(title)}`
          );
          if (!r.ok) return;
          const d = await r.json();
          const hit = (d.results || []).find(
            (x: any) => (x.media_type === 'movie' || x.media_type === 'tv') && x.poster_path
          );
          if (hit) matched.push({ id: hit.id, kind: hit.media_type });
        } catch (_) { /* skip */ }
      }));

      const seedKeys = new Set(matched.map((m) => `${m.kind}:${m.id}`));
      const withoutSet = new Set(withoutGenres);
      const recLists = await Promise.all(matched.slice(0, 4).map(async (m) => {
        try {
          const r = await fetch(
            `https://api.themoviedb.org/3/${m.kind}/${m.id}/recommendations?api_key=${tmdbKey}&page=1`
          );
          if (!r.ok) return [];
          const d = await r.json();
          return (d.results || [])
            .filter((i: any) => i.poster_path)
            // Respect the room's genre exclusions so the seed rail can't
            // reintroduce off-vibe content (e.g. cartoons) that the discover
            // rails filter out.
            .filter((i: any) => !(i.genre_ids || []).some((g: number) => withoutSet.has(g)))
            .map((i: any) => mapItem(i, m.kind));
        } catch (_) {
          return [];
        }
      }));

      // Round-robin across seeds so no single title dominates.
      const out: any[] = [];
      const maxLen = Math.max(0, ...recLists.map((l) => l.length));
      for (let i = 0; i < maxLen; i++) {
        for (const list of recLists) {
          if (i < list.length) out.push(list[i]);
        }
      }
      return dedupe(out).filter((it) => !seedKeys.has(`${it.type}:${it.external_id}`)).slice(0, 15);
    }

    const [
      seedRecs,
      trendMovie, trendTv,
      newMovie, newTv,
      topMovie, topTv,
      podcasts, books,
    ] = await Promise.all([
      seedRecommendations(),
      wantMovie && canTmdb ? discover('movie', 'popularity.desc', { 'vote_count.gte': '50' }) : Promise.resolve([]),
      wantTv && canTmdb ? discover('tv', 'popularity.desc', { 'vote_count.gte': '50' }) : Promise.resolve([]),
      wantMovie && canTmdb ? discover('movie', 'primary_release_date.desc', { 'primary_release_date.lte': today, 'vote_count.gte': '15' }) : Promise.resolve([]),
      wantTv && canTmdb ? discover('tv', 'first_air_date.desc', { 'first_air_date.lte': today, 'vote_count.gte': '15' }) : Promise.resolve([]),
      wantMovie && canTmdb ? discover('movie', 'vote_average.desc', { 'vote_count.gte': '200' }) : Promise.resolve([]),
      wantTv && canTmdb ? discover('tv', 'vote_average.desc', { 'vote_count.gte': '200' }) : Promise.resolve([]),
      wantPodcast ? fetchPodcasts(term) : Promise.resolve([]),
      wantBook ? fetchBooks(term) : Promise.resolve([]),
    ]);

    const sections = [
      { key: 'seeds', title: 'More Like Your Favorites', items: seedRecs },
      { key: 'trending', title: 'Trending This Week', items: interleave(trendMovie, trendTv).slice(0, 15) },
      { key: 'new', title: 'New Releases', items: interleave(newMovie, newTv).slice(0, 15) },
      { key: 'top', title: 'Fan Favorites', items: interleave(topMovie, topTv).slice(0, 15) },
      { key: 'movies', title: 'Movies', items: topMovie.length ? topMovie.slice(0, 15) : trendMovie.slice(0, 15) },
      { key: 'tv', title: 'TV Shows', items: topTv.length ? topTv.slice(0, 15) : trendTv.slice(0, 15) },
      { key: 'podcasts', title: 'Podcasts', items: podcasts },
      { key: 'books', title: 'Books', items: books },
    ].filter((s) => s.items.length > 0);

    return json({ keyword: term, keyword_id: keywordId, seeds, sections });
  } catch (e) {
    return json({ sections: [], error: String((e as any)?.message || e) }, 500);
  }
});
