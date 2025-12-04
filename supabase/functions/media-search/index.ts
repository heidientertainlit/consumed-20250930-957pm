
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

// Content filter helper
function isContentAppropriate(item: any, type: string): boolean {
  // Only filter TMDB adult content (pornographic films)
  if (type === 'movie' || type === 'tv') {
    if (item.adult === true) return false;
  }
  
  // Allow all other content (music, podcasts, books, etc.)
  return true;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  
  try {
    // Handle both GET (with query params) and POST (with JSON body)
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

    const results = [];

    // Search movies and TV shows via TMDB
    if (!type || type === 'movie' || type === 'tv') {
      try {
        const tmdbKey = Deno.env.get('TMDB_API_KEY');
        if (tmdbKey) {
          const tmdbResponse = await fetch(`https://api.themoviedb.org/3/search/multi?api_key=${tmdbKey}&query=${encodeURIComponent(query)}&page=1&include_adult=false`);
          if (tmdbResponse.ok) {
            const tmdbData = await tmdbResponse.json();
            tmdbData.results?.slice(0, 10).forEach((item) => {
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
      }
    }

    // Search books via Open Library with "by" detection
    if (!type || type === 'book') {
      try {
        let bookUrl;
        
        // Detect "by" pattern for structured search (e.g., "accused by claire poulson")
        if (query.toLowerCase().includes(' by ')) {
          const parts = query.split(/\s+by\s+/i);
          const title = parts[0].trim();
          const author = parts[1].trim();
          bookUrl = `https://openlibrary.org/search.json?title=${encodeURIComponent(title)}&author=${encodeURIComponent(author)}&limit=5`;
        } else {
          // Use regular search for queries without "by"
          bookUrl = `https://openlibrary.org/search.json?q=${encodeURIComponent(query)}&limit=5`;
        }
        
        const bookResponse = await fetch(bookUrl);
        if (bookResponse.ok) {
          const bookData = await bookResponse.json();
          bookData.docs?.slice(0, 5).forEach((book) => {
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
      }
    }

    // Search podcasts via Spotify API
    if (!type || type === 'podcast') {
      try {
        const clientId = Deno.env.get('SPOTIFY_CLIENT_ID');
        const clientSecret = Deno.env.get('SPOTIFY_CLIENT_SECRET');
        
        if (clientId && clientSecret) {
          // First, get access token
          const authResponse = await fetch('https://accounts.spotify.com/api/token', {
            method: 'POST',
            headers: {
              'Authorization': `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
              'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: 'grant_type=client_credentials'
          });
          
          if (authResponse.ok) {
            const authData = await authResponse.json();
            const accessToken = authData.access_token;
            
            // Now search for podcasts
            const spotifyResponse = await fetch(`https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=show&limit=10`, {
              headers: {
                'Authorization': `Bearer ${accessToken}`
              }
            });
            
            if (spotifyResponse.ok) {
              const spotifyData = await spotifyResponse.json();
              spotifyData.shows?.items?.forEach((podcast) => {
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
      }
    }

    // Search music via Spotify API (albums and tracks)
    if (!type || type === 'music') {
      try {
        const clientId = Deno.env.get('SPOTIFY_CLIENT_ID');
        const clientSecret = Deno.env.get('SPOTIFY_CLIENT_SECRET');
        
        if (clientId && clientSecret) {
          // First, get access token
          const authResponse = await fetch('https://accounts.spotify.com/api/token', {
            method: 'POST',
            headers: {
              'Authorization': `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
              'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: 'grant_type=client_credentials'
          });
          
          if (authResponse.ok) {
            const authData = await authResponse.json();
            const accessToken = authData.access_token;
            
            // Search for both albums and tracks
            const spotifyResponse = await fetch(`https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=album,track&limit=10`, {
              headers: {
                'Authorization': `Bearer ${accessToken}`
              }
            });
            
            if (spotifyResponse.ok) {
              const spotifyData = await spotifyResponse.json();
              
              // Process albums first (prioritize full albums)
              spotifyData.albums?.items?.slice(0, 5).forEach((album) => {
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
              
              // Then process tracks (limit to 5 to balance with albums)
              spotifyData.tracks?.items?.slice(0, 5).forEach((track) => {
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
      }
    }

    // Search YouTube videos via YouTube API
    if (!type || type === 'youtube') {
      try {
        const youtubeKey = Deno.env.get('YOUTUBE_API_KEY');
        if (youtubeKey) {
          const youtubeResponse = await fetch(`https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(query)}&type=video&maxResults=5&key=${youtubeKey}&safeSearch=strict`);
          if (youtubeResponse.ok) {
            const youtubeData = await youtubeResponse.json();
            youtubeData.items?.forEach((video) => {
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
      }
    }

    // Search games via new gaming-search function
    if (!type || type === 'game' || type === 'gaming') {
      try {
        const gamingResponse = await fetch(
          'https://mahpgcogwpawvviapqza.supabase.co/functions/v1/gaming-search',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': req.headers.get('Authorization') || ''
            },
            body: JSON.stringify({ query })
          }
        );
        
        if (gamingResponse.ok) {
          const gamingData = await gamingResponse.json();
          // Gaming search already filters content internally
          results.push(...(gamingData.results || []));
        }
      } catch (error) {
        console.error('Gaming search routing error:', error);
      }
    }

    // Search sports via new sports-search function
    if (!type || type === 'sports') {
      try {
        const sportsResponse = await fetch(
          'https://mahpgcogwpawvviapqza.supabase.co/functions/v1/sports-search',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': req.headers.get('Authorization') || ''
            },
            body: JSON.stringify({ query })
          }
        );
        
        if (sportsResponse.ok) {
          const sportsData = await sportsResponse.json();
          results.push(...(sportsData.results || []));
        }
      } catch (error) {
        console.error('Sports search routing error:', error);
      }
    }

    return new Response(JSON.stringify({ results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Search error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
