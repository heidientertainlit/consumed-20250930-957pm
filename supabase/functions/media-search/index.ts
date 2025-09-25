import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  
  try {
    const body = await req.json();
    const { query, type } = body;
    
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
          const tmdbResponse = await fetch(`https://api.themoviedb.org/3/search/multi?api_key=${tmdbKey}&query=${encodeURIComponent(query)}&page=1`);
          if (tmdbResponse.ok) {
            const tmdbData = await tmdbResponse.json();
            tmdbData.results?.slice(0, 10).forEach((item) => {
              if (item.media_type === 'movie' || item.media_type === 'tv') {
                results.push({
                  title: item.title || item.name,
                  type: item.media_type === 'movie' ? 'movie' : 'tv',
                  creator: item.media_type === 'movie' ? 'Unknown' : 'TV Show',
                  image: item.poster_path ? `https://image.tmdb.org/t/p/w300${item.poster_path}` : '',
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

    // Search books via Open Library
    if (!type || type === 'book') {
      try {
        const bookResponse = await fetch(`https://openlibrary.org/search.json?q=${encodeURIComponent(query)}&limit=5`);
        if (bookResponse.ok) {
          const bookData = await bookResponse.json();
          bookData.docs?.slice(0, 5).forEach((book) => {
            results.push({
              title: book.title,
              type: 'book',
              creator: book.author_name?.[0] || 'Unknown Author',
              image: book.cover_i ? `https://covers.openlibrary.org/b/id/${book.cover_i}-M.jpg` : '',
              external_id: book.key,
              external_source: 'openlibrary',
              description: book.first_sentence?.[0] || ''
            });
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
                results.push({
                  title: podcast.name,
                  type: 'podcast',
                  creator: podcast.publisher,
                  image: podcast.images?.[0]?.url || '',
                  external_id: podcast.id,
                  external_source: 'spotify',
                  description: podcast.description
                });
              });
            }
          }
        }
      } catch (error) {
        console.error('Podcast search error:', error);
      }
    }

    // Search music via Spotify API  
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
            
            // Now search for music
            const spotifyResponse = await fetch(`https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=10`, {
              headers: {
                'Authorization': `Bearer ${accessToken}`
              }
            });
            
            if (spotifyResponse.ok) {
              const spotifyData = await spotifyResponse.json();
              spotifyData.tracks?.items?.forEach((track) => {
                results.push({
                  title: track.name,
                  type: 'music',
                  creator: track.artists?.[0]?.name || 'Unknown Artist',
                  image: track.album?.images?.[0]?.url || '',
                  external_id: track.id,
                  external_source: 'spotify',
                  description: `From the album ${track.album?.name || 'Unknown Album'}`
                });
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
          const youtubeResponse = await fetch(`https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(query)}&type=video&maxResults=5&key=${youtubeKey}`);
          if (youtubeResponse.ok) {
            const youtubeData = await youtubeResponse.json();
            youtubeData.items?.forEach((video) => {
              results.push({
                title: video.snippet.title,
                type: 'youtube',
                creator: video.snippet.channelTitle,
                image: video.snippet.thumbnails?.medium?.url || '',
                external_id: video.id.videoId,
                external_source: 'youtube',
                description: video.snippet.description
              });
            });
          }
        }
      } catch (error) {
        console.error('YouTube search error:', error);
      }
    }

    // Search sports games/events via ESPN API
    if (!type || type === 'sports') {
      try {
        // ESPN provides a free API for recent games and events
        // Format: http://site.api.espn.com/apis/site/v2/sports/[SPORT]/[LEAGUE]/scoreboard
        const sports = ['football/nfl', 'basketball/nba', 'baseball/mlb', 'hockey/nhl', 'soccer/eng.1'];
        
        for (const sport of sports) {
          try {
            const espnResponse = await fetch(`http://site.api.espn.com/apis/site/v2/sports/${sport}/scoreboard`);
            if (espnResponse.ok) {
              const espnData = await espnResponse.json();
              espnData.events?.slice(0, 3).forEach((game) => {
                const homeTeam = game.competitions?.[0]?.competitors?.find(c => c.homeAway === 'home')?.team?.displayName;
                const awayTeam = game.competitions?.[0]?.competitors?.find(c => c.homeAway === 'away')?.team?.displayName;
                const gameTitle = `${awayTeam} @ ${homeTeam}`;
                
                if (gameTitle.toLowerCase().includes(query.toLowerCase())) {
                  results.push({
                    title: gameTitle,
                    type: 'sports',
                    creator: game.season?.type?.name || sport.split('/')[1].toUpperCase(),
                    image: game.competitions?.[0]?.competitors?.[0]?.team?.logo || '',
                    external_id: game.id,
                    external_source: 'espn',
                    description: `${game.status?.type?.detail || 'Game'} - ${new Date(game.date).toLocaleDateString()}`
                  });
                }
              });
            }
          } catch (sportError) {
            console.error(`Error fetching ${sport}:`, sportError);
          }
        }
      } catch (error) {
        console.error('Sports search error:', error);
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