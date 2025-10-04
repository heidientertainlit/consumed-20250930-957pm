
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
    const { query, sport_type, date_range } = body;
    
    if (!query || query.trim().length === 0) {
      return new Response(JSON.stringify({ results: [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const results = [];
    const queryLower = query.toLowerCase();

    // ESPN API - Free tier with good coverage
    try {
      const sportMappings = {
        'football': 'football/nfl',
        'basketball': 'basketball/nba', 
        'baseball': 'baseball/mlb',
        'hockey': 'hockey/nhl',
        'soccer': 'soccer/usa.1',
        'tennis': 'tennis/atp',
        'golf': 'golf/pga'
      };

      const sportsToSearch = sport_type ? [sportMappings[sport_type]] : Object.values(sportMappings).slice(0, 2);

      for (const sport of sportsToSearch) {
        if (!sport) continue;
        
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
                
                if (matchesQuery || queryLower.length < 3) {
                  const homeScore = game.competitions?.[0]?.competitors?.find(c => c.homeAway === 'home')?.score;
                  const awayScore = game.competitions?.[0]?.competitors?.find(c => c.homeAway === 'away')?.score;
                  
                  results.push({
                    title: gameTitle,
                    type: 'sports',
                    creator: `${sport.split('/')[1].toUpperCase()} • ${game.season?.type?.name || 'Season'}`,
                    image: homeTeam.logo || awayTeam.logo || '',
                    external_id: game.id,
                    external_source: 'espn',
                    description: `${game.status?.type?.detail || 'Scheduled'} • ${new Date(game.date).toLocaleDateString()}${homeScore && awayScore ? ` • ${awayScore}-${homeScore}` : ''}`,
                    game_date: game.date,
                    status: game.status?.type?.name,
                    home_team: homeTeam.displayName,
                    away_team: awayTeam.displayName,
                    home_score: homeScore,
                    away_score: awayScore,
                    sport_league: sport.split('/')[1].toUpperCase()
                  });
                }
              } catch (gameError) {
                console.error('Error processing game:', gameError);
              }
            });
          }
        } catch (sportError) {
          console.error(`Error fetching ${sport}:`, sportError);
        }
      }
    } catch (error) {
      console.error('ESPN API error:', error);
    }

    // The Sports DB API - Free community database (only if ESPN didn't find enough results)
    if (results.length < 3) {
      try {
        if (query.length > 2) {
          const sportsDbResponse = await fetch(`https://www.thesportsdb.com/api/v1/json/3/searchevents.php?e=${encodeURIComponent(query)}`);
          if (sportsDbResponse.ok) {
            const sportsDbData = await sportsDbResponse.json();
            sportsDbData.event?.slice(0, 5).forEach((event) => {
              results.push({
                title: event.strEvent,
                type: 'sports',
                creator: `${event.strSport} • ${event.strLeague}`,
                image: event.strThumb || event.strPoster || '',
                external_id: event.idEvent,
                external_source: 'thesportsdb',
                description: `${event.strVenue || ''} • ${event.dateEvent}`,
                game_date: event.dateEvent,
                home_team: event.strHomeTeam,
                away_team: event.strAwayTeam,
                sport_league: event.strLeague
              });
            });
          }
        }
      } catch (error) {
        console.error('Sports DB search error:', error);
      }
    }

    // OpenAI fallback - trigger when no results OR when query suggests specific game matchup
    const sportsResultsCount = results.length;
    const queryLooksLikeGame = /\b(vs|@|versus|against)\b/i.test(query) || 
                              query.split(/\s+/).length >= 2;
    
    if (sportsResultsCount === 0 || queryLooksLikeGame) {
      try {
        const openaiKey = Deno.env.get('OPENAI_API_KEY');
        if (openaiKey) {
          console.log('Using OpenAI fallback for sports search. Query:', query);
          
          const currentDate = new Date();
          const currentMonth = currentDate.getMonth() + 1;
          const currentYear = currentDate.getFullYear();
          
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
                const parsedResponse = JSON.parse(content);
                const aiResults = parsedResponse.results || parsedResponse;
                
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
                }
              } catch (parseError) {
                console.error('Error parsing OpenAI sports response:', parseError);
                
                // Fallback: try to extract JSON array from response
                const jsonMatch = content.match(/\[[\s\S]*\]/);
                if (jsonMatch) {
                  try {
                    const fallbackResults = JSON.parse(jsonMatch[0]);
                    if (Array.isArray(fallbackResults)) {
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
                    console.error('Fallback JSON extraction failed:', fallbackError);
                  }
                }
              }
            }
          }
        }
      } catch (error) {
        console.error('OpenAI sports search error:', error);
      }
    }

    // Remove duplicates and limit results
    const uniqueResults = results.filter((result, index, self) => 
      index === self.findIndex(r => r.external_id === result.external_id && r.external_source === result.external_source)
    ).slice(0, 15);

    return new Response(JSON.stringify({ results: uniqueResults }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Sports search error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
