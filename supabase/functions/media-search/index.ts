

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
          results.push(...(gamingData.results || []));
        }
      } catch (error) {
        console.error('Gaming search routing error:', error);
      }
    }

    // Search sports games/events via ESPN API and OpenAI fallback
    if (!type || type === 'sports') {
      try {
        console.log('Searching sports for:', query);
        
        // Try ESPN API first
        const sports = ['football/nfl', 'basketball/nba', 'baseball/mlb', 'hockey/nhl', 'soccer/usa.1'];
        const queryLower = query.toLowerCase();
        
        for (const sport of sports.slice(0, 2)) { // Limit to avoid timeout
          try {
            const espnResponse = await fetch(`https://site.api.espn.com/apis/site/v2/sports/${sport}/scoreboard`, {
              headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
              }
            });
            
            if (espnResponse.ok) {
              const espnData = await espnResponse.json();
              
              espnData.events?.slice(0, 3).forEach((game) => {
                try {
                  const homeTeam = game.competitions?.[0]?.competitors?.find(c => c.homeAway === 'home')?.team;
                  const awayTeam = game.competitions?.[0]?.competitors?.find(c => c.homeAway === 'away')?.team;
                  
                  if (!homeTeam || !awayTeam) return;
                  
                  const gameTitle = `${awayTeam.displayName} @ ${homeTeam.displayName}`;
                  const searchText = `${gameTitle} ${homeTeam.displayName} ${awayTeam.displayName}`.toLowerCase();
                  
                  // Match if query contains team names or vice versa
                  const queryWords = queryLower.split(' ');
                  const matchesQuery = queryWords.some(word => 
                    word.length > 2 && (
                      searchText.includes(word) ||
                      homeTeam.displayName?.toLowerCase().includes(word) ||
                      awayTeam.displayName?.toLowerCase().includes(word)
                    )
                  );
                  
                  if (matchesQuery || queryLower.length < 3) { // Include all results for short queries
                    const homeScore = game.competitions?.[0]?.competitors?.find(c => c.homeAway === 'home')?.score;
                    const awayScore = game.competitions?.[0]?.competitors?.find(c => c.homeAway === 'away')?.score;
                    
                    results.push({
                      title: gameTitle,
                      type: 'sports',
                      creator: `${sport.split('/')[1].toUpperCase()} • ${game.season?.type?.name || 'Season'}`,
                      image: homeTeam.logo || awayTeam.logo || '',
                      external_id: game.id,
                      external_source: 'espn',
                      description: `${game.status?.type?.detail || 'Scheduled'} • ${new Date(game.date).toLocaleDateString()}${homeScore && awayScore ? ` • ${awayScore}-${homeScore}` : ''}`
                    });
                  }
                } catch (gameError) {
                  console.error(`Error processing game:`, gameError);
                }
              });
            }
          } catch (sportError) {
            console.error(`Error fetching ${sport}:`, sportError);
          }
        }
        
        // Improved OpenAI fallback - trigger when no ESPN results OR when query suggests specific game matchup
        const sportsResultsCount = results.filter(r => r.type === 'sports').length;
        const queryLooksLikeGame = /\b(vs|@|versus|against)\b/i.test(query) || 
                                  query.split(/\s+/).length >= 2; // Two or more words likely means team names
        
        if (sportsResultsCount === 0 || queryLooksLikeGame) {
          try {
            const openaiKey = Deno.env.get('OPENAI_API_KEY');
            if (openaiKey) {
              console.log('Using OpenAI fallback for sports search. Query:', query);
              
              // Get current date info for temporal context
              const currentDate = new Date();
              const currentMonth = currentDate.getMonth() + 1; // 0-based, so add 1
              const currentYear = currentDate.getFullYear();
              
              // Determine likely sport season context
              let seasonContext = '';
              if (currentMonth >= 9 || currentMonth <= 2) {
                seasonContext = 'NFL season (September-February), NBA season (October-April), NHL season (October-April)';
              } else if (currentMonth >= 3 && currentMonth <= 6) {
                seasonContext = 'MLB season (March-October), NBA playoffs (April-June), NHL playoffs (April-June)';
              } else {
                seasonContext = 'MLB season (March-October), offseason for NFL/NBA/NHL';
              }

              const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${openaiKey}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  model: 'gpt-4o-mini',
                  response_format: { type: "json_object" },
                  messages: [
                    {
                      role: 'system',
                      content: `You are a sports expert. Today is ${currentDate.toISOString().split('T')[0]}. Current season context: ${seasonContext}. 
                      Generate 3-5 realistic RECENT GAMES (last 2 weeks) or UPCOMING GAMES (next 2 weeks) involving the searched team/sport.
                      Return a JSON object with a "results" array. Each result must have: 
                      - title: "Team A vs Team B" or "Team A @ Team B" format
                      - creator: "NFL • Week 8" or "NBA • Regular Season" format
                      - description: game date, score if completed, or status
                      - type: always "sports"
                      
                      Example: {"results": [{"title": "Kansas City Chiefs @ Buffalo Bills", "creator": "NFL • Week 8", "description": "October 15, 2025 • Bills win 24-20", "type": "sports"}]}
                      
                      Focus on games involving the searched team, prioritize recent/upcoming games over historical ones.`
                    },
                    {
                      role: 'user',
                      content: `Generate recent or upcoming games for: "${query}"`
                    }
                  ],
                  max_tokens: 800,
                  temperature: 0.7,
                }),
              });

              if (openaiResponse.ok) {
                const openaiData = await openaiResponse.json();
                const content = openaiData.choices?.[0]?.message?.content;
                
                if (content) {
                  try {
                    // Parse the JSON response
                    const parsedResponse = JSON.parse(content);
                    const aiResults = parsedResponse.results || parsedResponse; // Handle both formats
                    
                    if (Array.isArray(aiResults)) {
                      console.log(`Successfully parsed ${aiResults.length} OpenAI sports results`);
                      aiResults.slice(0, 5).forEach((item, index) => {
                        results.push({
                          title: item.title || `Sports Game ${index + 1}`,
                          type: 'sports',
                          creator: item.creator || 'Sports',
                          image: '',
                          external_id: `ai_sports_${Date.now()}_${index}`,
                          external_source: 'openai',
                          description: item.description || ''
                        });
                      });
                    } else {
                      console.error('OpenAI response not an array:', typeof aiResults);
                    }
                  } catch (parseError) {
                    console.error('Error parsing OpenAI sports response. Response length:', content?.length || 0);
                    console.error('Parse error:', parseError.message);
                    
                    // Fallback: try to extract JSON array from response
                    const jsonMatch = content.match(/\[[\s\S]*\]/);
                    if (jsonMatch) {
                      try {
                        const fallbackResults = JSON.parse(jsonMatch[0]);
                        if (Array.isArray(fallbackResults)) {
                          console.log('Successfully extracted JSON from response using fallback parsing');
                          fallbackResults.slice(0, 5).forEach((item, index) => {
                            results.push({
                              title: item.title || `Sports Game ${index + 1}`,
                              type: 'sports', 
                              creator: item.creator || 'Sports',
                              image: '',
                              external_id: `ai_sports_fallback_${Date.now()}_${index}`,
                              external_source: 'openai',
                              description: item.description || ''
                            });
                          });
                        }
                      } catch (fallbackError) {
                        console.error('Fallback JSON extraction also failed:', fallbackError.message);
                      }
                    }
                  }
                } else {
                  console.error('No content in OpenAI response');
                }
              } else {
                console.error('OpenAI API error:', openaiResponse.status, await openaiResponse.text());
              }
            } else {
              console.error('OPENAI_API_KEY not found in environment');
            }
          } catch (error) {
            console.error('OpenAI sports search error:', error);
          }
        }
        
        console.log('Total sports results found:', results.filter(r => r.type === 'sports').length);
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
