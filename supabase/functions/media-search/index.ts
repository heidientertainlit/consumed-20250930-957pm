
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

// Content filter helper
function isContentAppropriate(item: any, type: string): boolean {
  if (type === 'movie' || type === 'tv') {
    if (item.adult === true) return false;
  }
  return true;
}

// Fetch with timeout helper
async function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs: number = 5000): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  
  try {
    let query: string | null = null;
    let type: string | null = null;
    
    if (req.method === 'GET') {
      const url = new URL(req.url);
      query = url.searchParams.get('query');
      type = url.searchParams.get('type');
    } else {
      const body = await req.json();
      query = body.query;
      type = body.type;
    }
    
    if (!query || query.trim().length === 0) {
      return new Response(JSON.stringify({ results: [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const results: any[] = [];
    const errors: string[] = [];

    // Create all search promises to run in parallel
    const searchPromises: Promise<void>[] = [];

    // TMDB Search (movies and TV)
    if (!type || type === 'movie' || type === 'tv') {
      searchPromises.push((async () => {
        try {
          const tmdbKey = Deno.env.get('TMDB_API_KEY');
          if (tmdbKey) {
            const tmdbResponse = await fetchWithTimeout(
              `https://api.themoviedb.org/3/search/multi?api_key=${tmdbKey}&query=${encodeURIComponent(query)}&page=1&include_adult=false`,
              {},
              4000
            );
            if (tmdbResponse.ok) {
              const tmdbData = await tmdbResponse.json();
              tmdbData.results?.slice(0, 10).forEach((item: any) => {
                if ((item.media_type === 'movie' || item.media_type === 'tv') && isContentAppropriate(item, item.media_type)) {
                  results.push({
                    title: item.title || item.name,
                    type: item.media_type === 'movie' ? 'movie' : 'tv',
                    creator: item.media_type === 'movie' ? 'Unknown' : 'TV Show',
                    poster_url: item.poster_path ? `https://image.tmdb.org/t/p/w300${item.poster_path}` : '',
                    external_id: item.id?.toString(),
                    external_source: 'tmdb',
                    description: item.overview
                  });
                }
              });
            }
          }
        } catch (error) {
          console.error('TMDB search error:', error);
          errors.push('tmdb');
        }
      })());
    }

    // Open Library Search (books) - with shorter timeout
    if (!type || type === 'book') {
      searchPromises.push((async () => {
        try {
          let bookUrl;
          if (query.toLowerCase().includes(' by ')) {
            const parts = query.split(/\s+by\s+/i);
            const title = parts[0].trim();
            const author = parts[1].trim();
            bookUrl = `https://openlibrary.org/search.json?title=${encodeURIComponent(title)}&author=${encodeURIComponent(author)}&limit=5`;
          } else {
            bookUrl = `https://openlibrary.org/search.json?q=${encodeURIComponent(query)}&limit=5`;
          }
          
          const bookResponse = await fetchWithTimeout(bookUrl, {}, 3000);
          if (bookResponse.ok) {
            const bookData = await bookResponse.json();
            bookData.docs?.slice(0, 5).forEach((book: any) => {
              if (isContentAppropriate(book, 'book')) {
                results.push({
                  title: book.title,
                  type: 'book',
                  creator: book.author_name?.[0] || 'Unknown Author',
                  poster_url: book.cover_i ? `https://covers.openlibrary.org/b/id/${book.cover_i}-M.jpg` : '',
                  external_id: book.key,
                  external_source: 'openlibrary',
                  description: book.first_sentence?.[0] || ''
                });
              }
            });
          }
        } catch (error) {
          console.error('Books search error:', error);
          errors.push('books');
        }
      })());
    }

    // Spotify Search (podcasts)
    if (!type || type === 'podcast') {
      searchPromises.push((async () => {
        try {
          const clientId = Deno.env.get('SPOTIFY_CLIENT_ID');
          const clientSecret = Deno.env.get('SPOTIFY_CLIENT_SECRET');
          
          if (clientId && clientSecret) {
            const authResponse = await fetchWithTimeout('https://accounts.spotify.com/api/token', {
              method: 'POST',
              headers: {
                'Authorization': `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
                'Content-Type': 'application/x-www-form-urlencoded'
              },
              body: 'grant_type=client_credentials'
            }, 3000);
            
            if (authResponse.ok) {
              const authData = await authResponse.json();
              const accessToken = authData.access_token;
              
              const spotifyResponse = await fetchWithTimeout(
                `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=show&limit=10`,
                { headers: { 'Authorization': `Bearer ${accessToken}` } },
                3000
              );
              
              if (spotifyResponse.ok) {
                const spotifyData = await spotifyResponse.json();
                spotifyData.shows?.items?.forEach((podcast: any) => {
                  if (isContentAppropriate(podcast, 'podcast')) {
                    results.push({
                      title: podcast.name,
                      type: 'podcast',
                      creator: podcast.publisher,
                      poster_url: podcast.images?.[0]?.url || '',
                      external_id: podcast.id,
                      external_source: 'spotify',
                      description: podcast.description
                    });
                  }
                });
              }
            }
          }
        } catch (error) {
          console.error('Podcast search error:', error);
          errors.push('podcast');
        }
      })());
    }

    // Spotify Search (music)
    if (!type || type === 'music') {
      searchPromises.push((async () => {
        try {
          const clientId = Deno.env.get('SPOTIFY_CLIENT_ID');
          const clientSecret = Deno.env.get('SPOTIFY_CLIENT_SECRET');
          
          if (clientId && clientSecret) {
            const authResponse = await fetchWithTimeout('https://accounts.spotify.com/api/token', {
              method: 'POST',
              headers: {
                'Authorization': `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
                'Content-Type': 'application/x-www-form-urlencoded'
              },
              body: 'grant_type=client_credentials'
            }, 3000);
            
            if (authResponse.ok) {
              const authData = await authResponse.json();
              const accessToken = authData.access_token;
              
              const spotifyResponse = await fetchWithTimeout(
                `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=album,track&limit=10`,
                { headers: { 'Authorization': `Bearer ${accessToken}` } },
                3000
              );
              
              if (spotifyResponse.ok) {
                const spotifyData = await spotifyResponse.json();
                
                spotifyData.albums?.items?.slice(0, 5).forEach((album: any) => {
                  if (isContentAppropriate(album, 'music')) {
                    results.push({
                      title: album.name,
                      type: 'music',
                      creator: album.artists?.[0]?.name || 'Unknown Artist',
                      poster_url: album.images?.[0]?.url || '',
                      external_id: album.id,
                      external_source: 'spotify',
                      description: `ALBUM • ${album.total_tracks || 0} tracks • ${album.release_date?.substring(0, 4) || 'Unknown year'}`
                    });
                  }
                });
                
                spotifyData.tracks?.items?.slice(0, 5).forEach((track: any) => {
                  if (isContentAppropriate(track, 'music')) {
                    results.push({
                      title: track.name,
                      type: 'music',
                      creator: track.artists?.[0]?.name || 'Unknown Artist',
                      poster_url: track.album?.images?.[0]?.url || '',
                      external_id: track.id,
                      external_source: 'spotify',
                      description: `TRACK • ${track.album?.name || 'Unknown Album'}`
                    });
                  }
                });
              }
            }
          }
        } catch (error) {
          console.error('Music search error:', error);
          errors.push('music');
        }
      })());
    }

    // YouTube Search
    if (!type || type === 'youtube') {
      searchPromises.push((async () => {
        try {
          const youtubeKey = Deno.env.get('YOUTUBE_API_KEY');
          if (youtubeKey) {
            const youtubeResponse = await fetchWithTimeout(
              `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(query)}&type=video&maxResults=5&key=${youtubeKey}&safeSearch=strict`,
              {},
              3000
            );
            if (youtubeResponse.ok) {
              const youtubeData = await youtubeResponse.json();
              youtubeData.items?.forEach((video: any) => {
                if (isContentAppropriate(video.snippet, 'youtube')) {
                  results.push({
                    title: video.snippet.title,
                    type: 'youtube',
                    creator: video.snippet.channelTitle,
                    poster_url: video.snippet.thumbnails?.medium?.url || '',
                    external_id: video.id.videoId,
                    external_source: 'youtube',
                    description: video.snippet.description
                  });
                }
              });
            }
          }
        } catch (error) {
          console.error('YouTube search error:', error);
          errors.push('youtube');
        }
      })());
    }

    // Gaming Search
    if (!type || type === 'game' || type === 'gaming') {
      searchPromises.push((async () => {
        try {
          const gamingResponse = await fetchWithTimeout(
            'https://mahpgcogwpawvviapqza.supabase.co/functions/v1/gaming-search',
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': req.headers.get('Authorization') || ''
              },
              body: JSON.stringify({ query })
            },
            3000
          );
          
          if (gamingResponse.ok) {
            const gamingData = await gamingResponse.json();
            results.push(...(gamingData.results || []));
          }
        } catch (error) {
          console.error('Gaming search routing error:', error);
          errors.push('gaming');
        }
      })());
    }

    // Sports Search
    if (!type || type === 'sports') {
      searchPromises.push((async () => {
        try {
          const sportsResponse = await fetchWithTimeout(
            'https://mahpgcogwpawvviapqza.supabase.co/functions/v1/sports-search',
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': req.headers.get('Authorization') || ''
              },
              body: JSON.stringify({ query })
            },
            3000
          );
          
          if (sportsResponse.ok) {
            const sportsData = await sportsResponse.json();
            results.push(...(sportsData.results || []));
          }
        } catch (error) {
          console.error('Sports search routing error:', error);
          errors.push('sports');
        }
      })());
    }

    // Wait for all searches to complete (with individual timeouts)
    await Promise.allSettled(searchPromises);

    return new Response(JSON.stringify({ 
      results,
      partial: errors.length > 0,
      failedProviders: errors
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Search error:', error);
    return new Response(JSON.stringify({ error: error.message, results: [] }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
