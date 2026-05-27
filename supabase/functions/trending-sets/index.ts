import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TrendingItem {
  id: string;
  title: string;
  image_url: string;
  year?: string;
  external_id: string;
  external_source: string;
  media_type: string;
  position: number;
}

interface TrendingSet {
  id: string;
  title: string;
  media_type: string;
  items: TrendingItem[];
}

async function fetchTrendingMovies(apiKey: string): Promise<TrendingSet[]> {
  try {
    const [trendingRes, nowPlayingRes] = await Promise.all([
      fetch(`https://api.themoviedb.org/3/trending/movie/week?api_key=${apiKey}`),
      fetch(`https://api.themoviedb.org/3/movie/now_playing?api_key=${apiKey}&region=US`),
    ]);

    const sets: TrendingSet[] = [];

    if (trendingRes.ok) {
      const data = await trendingRes.json();
      const items = (data.results || []).slice(0, 8).map((m: any, i: number) => ({
        id: `trending-movie-${m.id}`,
        title: m.title,
        image_url: m.poster_path ? `https://image.tmdb.org/t/p/w300${m.poster_path}` : '',
        year: m.release_date?.substring(0, 4) || '',
        external_id: m.id.toString(),
        external_source: 'tmdb',
        media_type: 'movie',
        position: i + 1,
      }));
      if (items.length > 0) {
        sets.push({ id: 'trending-movies-week', title: 'Trending Movies', media_type: 'movie', items });
      }
    }

    if (nowPlayingRes.ok) {
      const data = await nowPlayingRes.json();
      const items = (data.results || []).slice(0, 8).map((m: any, i: number) => ({
        id: `now-playing-${m.id}`,
        title: m.title,
        image_url: m.poster_path ? `https://image.tmdb.org/t/p/w300${m.poster_path}` : '',
        year: m.release_date?.substring(0, 4) || '',
        external_id: m.id.toString(),
        external_source: 'tmdb',
        media_type: 'movie',
        position: i + 1,
      }));
      if (items.length > 0) {
        sets.push({ id: 'now-playing-movies', title: 'In Theaters Now', media_type: 'movie', items });
      }
    }

    return sets;
  } catch (err) {
    console.error('Error fetching trending movies:', err);
    return [];
  }
}

async function fetchTrendingTV(apiKey: string): Promise<TrendingSet[]> {
  try {
    const [trendingRes, topRatedRes] = await Promise.all([
      fetch(`https://api.themoviedb.org/3/trending/tv/week?api_key=${apiKey}`),
      fetch(`https://api.themoviedb.org/3/tv/on_the_air?api_key=${apiKey}&region=US`),
    ]);

    const sets: TrendingSet[] = [];

    if (trendingRes.ok) {
      const data = await trendingRes.json();
      const items = (data.results || []).slice(0, 8).map((s: any, i: number) => ({
        id: `trending-tv-${s.id}`,
        title: s.name,
        image_url: s.poster_path ? `https://image.tmdb.org/t/p/w300${s.poster_path}` : '',
        year: s.first_air_date?.substring(0, 4) || '',
        external_id: s.id.toString(),
        external_source: 'tmdb',
        media_type: 'tv',
        position: i + 1,
      }));
      if (items.length > 0) {
        sets.push({ id: 'trending-tv-week', title: 'Trending TV Shows', media_type: 'tv', items });
      }
    }

    if (topRatedRes.ok) {
      const data = await topRatedRes.json();
      const items = (data.results || []).slice(0, 8).map((s: any, i: number) => ({
        id: `on-air-tv-${s.id}`,
        title: s.name,
        image_url: s.poster_path ? `https://image.tmdb.org/t/p/w300${s.poster_path}` : '',
        year: s.first_air_date?.substring(0, 4) || '',
        external_id: s.id.toString(),
        external_source: 'tmdb',
        media_type: 'tv',
        position: i + 1,
      }));
      if (items.length > 0) {
        sets.push({ id: 'on-air-tv', title: 'On The Air', media_type: 'tv', items });
      }
    }

    return sets;
  } catch (err) {
    console.error('Error fetching trending TV:', err);
    return [];
  }
}

function parseItunesRssEntry(entry: any, mediaType: string, prefix: string): any | null {
  const title = entry['im:name']?.label || entry['title']?.label;
  const artist = entry['im:artist']?.label || '';
  const images: any[] = entry['im:image'] || [];
  const bigImage = images.find((img: any) => parseInt(img.attributes?.height) >= 170) || images[images.length - 1];
  const image_url = bigImage?.label || '';
  const id = entry['id']?.attributes?.['im:id'] || entry['id']?.label?.split('/id')?.[1]?.split('?')[0] || '';
  const year = entry['im:releaseDate']?.label?.substring(0, 4) || '';
  if (!title || !image_url || !id) return null;
  return {
    id: `${prefix}-${id}`,
    title: artist ? `${title} — ${artist}` : title,
    image_url,
    year,
    external_id: id,
    external_source: 'apple',
    media_type: mediaType,
    position: 0,
  };
}

async function fetchTrendingMusic(): Promise<TrendingSet[]> {
  try {
    const sets: TrendingSet[] = [];

    const [topAlbumsRes, hotTracksRes] = await Promise.all([
      fetch('https://itunes.apple.com/us/rss/topalbums/limit=10/json'),
      fetch('https://itunes.apple.com/us/rss/topsongs/limit=10/json'),
    ]);

    if (topAlbumsRes.ok) {
      const data = await topAlbumsRes.json();
      const entries: any[] = data.feed?.entry || [];
      const items = entries
        .map((e, i) => { const r = parseItunesRssEntry(e, 'music', 'itunes-album'); return r ? { ...r, position: i + 1 } : null; })
        .filter(Boolean)
        .slice(0, 8);
      if (items.length > 0) {
        sets.push({ id: 'apple-top-albums', title: 'Top Albums Right Now', media_type: 'music', items });
      }
    }

    if (hotTracksRes.ok) {
      const data = await hotTracksRes.json();
      const entries: any[] = data.feed?.entry || [];
      const items = entries
        .map((e, i) => { const r = parseItunesRssEntry(e, 'music', 'itunes-song'); return r ? { ...r, position: i + 1 } : null; })
        .filter(Boolean)
        .slice(0, 8);
      if (items.length > 0) {
        sets.push({ id: 'apple-hot-songs', title: 'Hot Songs Right Now', media_type: 'music', items });
      }
    }

    return sets;
  } catch (err) {
    console.error('Error fetching trending music:', err);
    return [];
  }
}

async function fetchTrendingPodcasts(): Promise<TrendingSet[]> {
  try {
    const sets: TrendingSet[] = [];

    const topPodcastsRes = await fetch('https://itunes.apple.com/us/rss/toppodcasts/limit=10/json');

    if (topPodcastsRes.ok) {
      const data = await topPodcastsRes.json();
      const entries: any[] = data.feed?.entry || [];
      const items = entries
        .map((e, i) => {
          const title = e['im:name']?.label || e['title']?.label;
          const images: any[] = e['im:image'] || [];
          const bigImage = images.find((img: any) => parseInt(img.attributes?.height) >= 170) || images[images.length - 1];
          const image_url = bigImage?.label || '';
          const id = e['id']?.attributes?.['im:id'] || '';
          if (!title || !image_url || !id) return null;
          return {
            id: `itunes-podcast-${id}`,
            title,
            image_url,
            year: '',
            external_id: id,
            external_source: 'apple',
            media_type: 'podcast',
            position: i + 1,
          };
        })
        .filter(Boolean)
        .slice(0, 8);
      if (items.length > 0) {
        sets.push({ id: 'apple-top-podcasts', title: 'Top Podcasts Right Now', media_type: 'podcast', items });
      }
    }

    return sets;
  } catch (err) {
    console.error('Error fetching trending podcasts:', err);
    return [];
  }
}

async function fetchTrendingBooks(apiKey: string): Promise<TrendingSet[]> {
  try {
    const sets: TrendingSet[] = [];

    const queries = [
      { q: 'subject:fiction&orderBy=newest', title: 'Trending Fiction', setId: 'trending-fiction-books' },
      { q: 'subject:nonfiction&orderBy=newest', title: 'Trending Nonfiction', setId: 'trending-nonfiction-books' },
    ];

    for (const query of queries) {
      const res = await fetch(
        `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query.q)}&maxResults=8&printType=books&langRestrict=en&key=${apiKey}`
      );

      if (res.ok) {
        const data = await res.json();
        const items = (data.items || [])
          .filter((b: any) => b.volumeInfo?.imageLinks?.thumbnail)
          .map((b: any, i: number) => ({
            id: `trending-book-${b.id}`,
            title: b.volumeInfo.title,
            image_url: (b.volumeInfo.imageLinks?.thumbnail || '').replace('http://', 'https://'),
            year: b.volumeInfo.publishedDate?.substring(0, 4) || '',
            external_id: b.id,
            external_source: 'googlebooks',
            media_type: 'book',
            position: i + 1,
          }));
        if (items.length > 0) {
          sets.push({ id: query.setId, title: query.title, media_type: 'book', items });
        }
      }
    }

    return sets;
  } catch (err) {
    console.error('Error fetching trending books:', err);
    return [];
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const TMDB_API_KEY = Deno.env.get('TMDB_API_KEY');
    const GOOGLE_BOOKS_API_KEY = Deno.env.get('GOOGLE_BOOKS_API_KEY');

    let mediaType: string | null = null;
    try {
      const body = await req.json();
      mediaType = body.media_type || null;
    } catch {
      const url = new URL(req.url);
      mediaType = url.searchParams.get('media_type');
    }

    const allSets: TrendingSet[] = [];

    const fetchPromises: Promise<TrendingSet[]>[] = [];

    if (!mediaType || mediaType === 'movie') {
      if (TMDB_API_KEY) fetchPromises.push(fetchTrendingMovies(TMDB_API_KEY));
    }
    if (!mediaType || mediaType === 'tv') {
      if (TMDB_API_KEY) fetchPromises.push(fetchTrendingTV(TMDB_API_KEY));
    }
    if (!mediaType || mediaType === 'music') {
      fetchPromises.push(fetchTrendingMusic());
    }
    if (!mediaType || mediaType === 'podcast') {
      fetchPromises.push(fetchTrendingPodcasts());
    }
    if (!mediaType || mediaType === 'book') {
      if (GOOGLE_BOOKS_API_KEY) fetchPromises.push(fetchTrendingBooks(GOOGLE_BOOKS_API_KEY));
    }

    const results = await Promise.all(fetchPromises);
    for (const sets of results) {
      allSets.push(...sets);
    }

    const interleaved: TrendingSet[] = [];
    const byType: Record<string, TrendingSet[]> = {};
    for (const set of allSets) {
      if (!byType[set.media_type]) byType[set.media_type] = [];
      byType[set.media_type].push(set);
    }

    const types = Object.keys(byType);
    let maxLen = 0;
    for (const t of types) {
      if (byType[t].length > maxLen) maxLen = byType[t].length;
    }

    for (let i = 0; i < maxLen; i++) {
      for (const t of types) {
        if (byType[t][i]) {
          interleaved.push(byType[t][i]);
        }
      }
    }

    return new Response(JSON.stringify({ sets: interleaved }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in trending-sets:', error);
    return new Response(JSON.stringify({ error: 'Failed to fetch trending sets', sets: [] }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
