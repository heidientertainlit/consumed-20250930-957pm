import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

interface SetConfig {
  id: string;
  title: string;
  category: string;
  media_type: 'movie' | 'tv' | 'book' | 'music' | 'podcast' | 'game';
  fetch_type: 'tmdb_genre' | 'tmdb_decade' | 'spotify_podcast' | 'spotify_albums' | 'books_genre';
  fetch_params: Record<string, any>;
}

const SET_CONFIGS: SetConfig[] = [
  { id: 'horror-classics', title: 'Horror Classics', category: 'movies', media_type: 'movie', fetch_type: 'tmdb_genre', fetch_params: { genre_id: 27, sort_by: 'vote_count.desc', before_year: 2000 } },
  { id: '90s-comedies', title: '90s Comedies', category: 'movies', media_type: 'movie', fetch_type: 'tmdb_decade', fetch_params: { genre_id: 35, start_year: 1990, end_year: 1999 } },
  { id: 'sci-fi-essentials', title: 'Sci-Fi Essentials', category: 'movies', media_type: 'movie', fetch_type: 'tmdb_genre', fetch_params: { genre_id: 878, sort_by: 'vote_count.desc' } },
  { id: 'action-blockbusters', title: 'Action Blockbusters', category: 'movies', media_type: 'movie', fetch_type: 'tmdb_genre', fetch_params: { genre_id: 28, sort_by: 'revenue.desc' } },
  { id: 'animated-favorites', title: 'Animated Favorites', category: 'movies', media_type: 'movie', fetch_type: 'tmdb_genre', fetch_params: { genre_id: 16, sort_by: 'vote_count.desc' } },
  { id: 'romantic-classics', title: 'Romantic Classics', category: 'movies', media_type: 'movie', fetch_type: 'tmdb_genre', fetch_params: { genre_id: 10749, sort_by: 'vote_count.desc' } },
  { id: 'thriller-picks', title: 'Must-See Thrillers', category: 'movies', media_type: 'movie', fetch_type: 'tmdb_genre', fetch_params: { genre_id: 53, sort_by: 'vote_count.desc' } },
  { id: 'drama-kings', title: 'Drama Kings', category: 'tv', media_type: 'tv', fetch_type: 'tmdb_genre', fetch_params: { genre_id: 18, sort_by: 'vote_count.desc', is_tv: true } },
  { id: 'comedy-series', title: 'Comedy Series', category: 'tv', media_type: 'tv', fetch_type: 'tmdb_genre', fetch_params: { genre_id: 35, sort_by: 'vote_count.desc', is_tv: true } },
  { id: 'true-crime-podcasts', title: 'True Crime Podcasts', category: 'podcasts', media_type: 'podcast', fetch_type: 'spotify_podcast', fetch_params: { query: 'true crime' } },
  { id: 'comedy-podcasts', title: 'Comedy Podcasts', category: 'podcasts', media_type: 'podcast', fetch_type: 'spotify_podcast', fetch_params: { query: 'comedy podcast' } },
  { id: 'interview-podcasts', title: 'Interview Podcasts', category: 'podcasts', media_type: 'podcast', fetch_type: 'spotify_podcast', fetch_params: { query: 'interview podcast' } },
  { id: 'classic-albums', title: 'Classic Albums', category: 'music', media_type: 'music', fetch_type: 'spotify_albums', fetch_params: { query: 'greatest albums classic rock' } },
  { id: 'hip-hop-essentials', title: 'Hip-Hop Essentials', category: 'music', media_type: 'music', fetch_type: 'spotify_albums', fetch_params: { query: 'classic hip hop album' } },
  { id: 'fantasy-books', title: 'Fantasy Epics', category: 'books', media_type: 'book', fetch_type: 'books_genre', fetch_params: { query: 'fantasy epic bestseller' } },
  { id: 'mystery-books', title: 'Mystery Thrillers', category: 'books', media_type: 'book', fetch_type: 'books_genre', fetch_params: { query: 'mystery thriller bestseller' } },
];

async function fetchTMDBMovies(apiKey: string, params: Record<string, any>): Promise<any[]> {
  const isTV = params.is_tv === true;
  const endpoint = isTV ? 'discover/tv' : 'discover/movie';
  const titleField = isTV ? 'name' : 'title';
  const dateField = isTV ? 'first_air_date' : 'release_date';
  
  let url = `https://api.themoviedb.org/3/${endpoint}?api_key=${apiKey}&with_genres=${params.genre_id}&sort_by=${params.sort_by || 'vote_count.desc'}&vote_count.gte=500`;
  
  if (params.before_year) {
    url += `&${dateField}.lte=${params.before_year}-12-31`;
  }
  if (params.start_year && params.end_year) {
    url += `&${dateField}.gte=${params.start_year}-01-01&${dateField}.lte=${params.end_year}-12-31`;
  }

  const response = await fetch(url);
  if (!response.ok) return [];
  
  const data = await response.json();
  return (data.results || []).slice(0, 6).map((item: any, index: number) => ({
    title: item[titleField],
    image_url: item.poster_path ? `https://image.tmdb.org/t/p/w300${item.poster_path}` : '',
    external_id: item.id.toString(),
    external_source: 'tmdb',
    media_type: isTV ? 'tv' : 'movie',
    year: item[dateField]?.substring(0, 4) || '',
    position: index + 1
  }));
}

async function fetchSpotifyPodcasts(token: string, query: string): Promise<any[]> {
  const response = await fetch(
    `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=show&limit=6`,
    { headers: { 'Authorization': `Bearer ${token}` } }
  );
  if (!response.ok) return [];
  
  const data = await response.json();
  return (data.shows?.items || []).map((show: any, index: number) => ({
    title: show.name,
    image_url: show.images?.[0]?.url || '',
    external_id: show.id,
    external_source: 'spotify',
    media_type: 'podcast',
    year: '',
    position: index + 1
  }));
}

async function fetchSpotifyAlbums(token: string, query: string): Promise<any[]> {
  const response = await fetch(
    `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=album&limit=6`,
    { headers: { 'Authorization': `Bearer ${token}` } }
  );
  if (!response.ok) return [];
  
  const data = await response.json();
  return (data.albums?.items || []).map((album: any, index: number) => ({
    title: album.name,
    image_url: album.images?.[0]?.url || '',
    external_id: album.id,
    external_source: 'spotify',
    media_type: 'music',
    year: album.release_date?.substring(0, 4) || '',
    position: index + 1
  }));
}

async function fetchBooks(query: string): Promise<any[]> {
  const response = await fetch(
    `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}&orderBy=relevance&maxResults=6`
  );
  if (!response.ok) return [];
  
  const data = await response.json();
  return (data.items || []).map((book: any, index: number) => ({
    title: book.volumeInfo?.title || 'Unknown',
    image_url: book.volumeInfo?.imageLinks?.thumbnail?.replace('http:', 'https:') || '',
    external_id: book.id,
    external_source: 'googlebooks',
    media_type: 'book',
    year: book.volumeInfo?.publishedDate?.substring(0, 4) || '',
    position: index + 1
  }));
}

async function getSpotifyToken(clientId: string, clientSecret: string): Promise<string | null> {
  try {
    const response = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': 'Basic ' + btoa(`${clientId}:${clientSecret}`)
      },
      body: 'grant_type=client_credentials'
    });
    if (!response.ok) return null;
    const data = await response.json();
    return data.access_token;
  } catch {
    return null;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('authorization');
    const adminSecret = Deno.env.get('ADMIN_API_SECRET');
    
    if (!adminSecret || authHeader !== `Bearer ${adminSecret}`) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const TMDB_API_KEY = Deno.env.get('TMDB_API_KEY');
    const SPOTIFY_CLIENT_ID = Deno.env.get('SPOTIFY_CLIENT_ID');
    const SPOTIFY_CLIENT_SECRET = Deno.env.get('SPOTIFY_CLIENT_SECRET');

    let spotifyToken: string | null = null;
    if (SPOTIFY_CLIENT_ID && SPOTIFY_CLIENT_SECRET) {
      spotifyToken = await getSpotifyToken(SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET);
    }

    const { specific_set } = await req.json().catch(() => ({}));
    const configsToProcess = specific_set 
      ? SET_CONFIGS.filter(c => c.id === specific_set)
      : SET_CONFIGS;

    const results: { set_id: string; items_count: number; error?: string }[] = [];

    for (const config of configsToProcess) {
      try {
        let items: any[] = [];

        switch (config.fetch_type) {
          case 'tmdb_genre':
          case 'tmdb_decade':
            if (TMDB_API_KEY) {
              items = await fetchTMDBMovies(TMDB_API_KEY, config.fetch_params);
            }
            break;
          case 'spotify_podcast':
            if (spotifyToken) {
              items = await fetchSpotifyPodcasts(spotifyToken, config.fetch_params.query);
            }
            break;
          case 'spotify_albums':
            if (spotifyToken) {
              items = await fetchSpotifyAlbums(spotifyToken, config.fetch_params.query);
            }
            break;
          case 'books_genre':
            items = await fetchBooks(config.fetch_params.query);
            break;
        }

        if (items.length === 0) {
          results.push({ set_id: config.id, items_count: 0, error: 'No items fetched' });
          continue;
        }

        const { error: upsertError } = await supabase
          .from('seen_it_sets')
          .upsert({
            id: config.id,
            title: config.title,
            category: config.category,
            media_type: config.media_type,
            origin_type: 'auto',
            visibility: 'public',
            items_count: items.length,
            updated_at: new Date().toISOString()
          }, { onConflict: 'id' });

        if (upsertError) {
          results.push({ set_id: config.id, items_count: 0, error: upsertError.message });
          continue;
        }

        await supabase.from('seen_it_items').delete().eq('set_id', config.id);

        const itemsWithSetId = items.map(item => ({
          ...item,
          id: `${config.id}-${item.external_id}`,
          set_id: config.id
        }));

        const { error: insertError } = await supabase
          .from('seen_it_items')
          .insert(itemsWithSetId);

        if (insertError) {
          results.push({ set_id: config.id, items_count: 0, error: insertError.message });
          continue;
        }

        results.push({ set_id: config.id, items_count: items.length });
      } catch (err) {
        results.push({ set_id: config.id, items_count: 0, error: String(err) });
      }
    }

    return new Response(JSON.stringify({ success: true, results }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error generating media sets:', error);
    return new Response(JSON.stringify({ error: 'Failed to generate sets' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
