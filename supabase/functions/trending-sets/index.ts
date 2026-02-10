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

async function getSpotifyToken(clientId: string, clientSecret: string): Promise<string | null> {
  try {
    const credentials = btoa(`${clientId}:${clientSecret}`);
    const res = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${credentials}`,
      },
      body: 'grant_type=client_credentials',
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.access_token;
  } catch {
    return null;
  }
}

async function fetchTrendingMusic(token: string): Promise<TrendingSet[]> {
  try {
    const sets: TrendingSet[] = [];

    const newReleasesRes = await fetch(
      'https://api.spotify.com/v1/browse/new-releases?limit=8&country=US',
      { headers: { 'Authorization': `Bearer ${token}` } }
    );

    if (newReleasesRes.ok) {
      const data = await newReleasesRes.json();
      const albums = data.albums?.items || [];
      const items = albums.map((a: any, i: number) => ({
        id: `trending-album-${a.id}`,
        title: a.name,
        image_url: a.images?.[0]?.url || '',
        year: a.release_date?.substring(0, 4) || '',
        external_id: a.id,
        external_source: 'spotify',
        media_type: 'music',
        position: i + 1,
      }));
      if (items.length > 0) {
        sets.push({ id: 'new-music-releases', title: 'New Music Releases', media_type: 'music', items });
      }
    }

    const featuredRes = await fetch(
      'https://api.spotify.com/v1/browse/featured-playlists?limit=8&country=US',
      { headers: { 'Authorization': `Bearer ${token}` } }
    );

    if (featuredRes.ok) {
      const data = await featuredRes.json();
      const playlists = data.playlists?.items || [];

      const topPlaylist = playlists.find((p: any) =>
        p.name?.toLowerCase().includes('top') ||
        p.name?.toLowerCase().includes('hits') ||
        p.name?.toLowerCase().includes('hot')
      ) || playlists[0];

      if (topPlaylist) {
        const tracksRes = await fetch(
          `https://api.spotify.com/v1/playlists/${topPlaylist.id}/tracks?limit=8&market=US`,
          { headers: { 'Authorization': `Bearer ${token}` } }
        );

        if (tracksRes.ok) {
          const tracksData = await tracksRes.json();
          const tracks = tracksData.items || [];
          const items = tracks
            .filter((t: any) => t.track?.album)
            .map((t: any, i: number) => ({
              id: `hot-track-${t.track.id}`,
              title: `${t.track.name} - ${t.track.artists?.[0]?.name || ''}`,
              image_url: t.track.album?.images?.[0]?.url || '',
              year: t.track.album?.release_date?.substring(0, 4) || '',
              external_id: t.track.album?.id || t.track.id,
              external_source: 'spotify',
              media_type: 'music',
              position: i + 1,
            }));
          if (items.length > 0) {
            sets.push({
              id: 'hot-tracks-now',
              title: topPlaylist.name || 'Hot Tracks',
              media_type: 'music',
              items,
            });
          }
        }
      }
    }

    return sets;
  } catch (err) {
    console.error('Error fetching trending music:', err);
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
    const SPOTIFY_CLIENT_ID = Deno.env.get('SPOTIFY_CLIENT_ID');
    const SPOTIFY_CLIENT_SECRET = Deno.env.get('SPOTIFY_CLIENT_SECRET');
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
      if (SPOTIFY_CLIENT_ID && SPOTIFY_CLIENT_SECRET) {
        fetchPromises.push(
          getSpotifyToken(SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET).then(token => {
            if (!token) return [];
            return fetchTrendingMusic(token);
          })
        );
      }
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
