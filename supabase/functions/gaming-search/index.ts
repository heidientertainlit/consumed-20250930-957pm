
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
    const { query } = body;
    
    if (!query || query.trim().length === 0) {
      return new Response(JSON.stringify({ results: [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const results = [];

    // RAWG.io API - Free tier, 20k requests/month
    try {
      const rawgKey = Deno.env.get('RAWG_API_KEY');
      if (rawgKey) {
        const rawgResponse = await fetch(
          `https://api.rawg.io/api/games?key=${rawgKey}&search=${encodeURIComponent(query)}&page_size=10`,
          {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
          }
        );
        
        if (rawgResponse.ok) {
          const rawgData = await rawgResponse.json();
          rawgData.results?.slice(0, 10).forEach((game: any) => {
            results.push({
              title: game.name,
              type: 'game',
              creator: game.developers?.map((d: any) => d.name).join(', ') || 
                       game.publishers?.map((p: any) => p.name).join(', ') || 
                       'Unknown Developer',
              image: game.background_image || '',
              external_id: game.id?.toString(),
              external_source: 'rawg',
              description: game.genres?.map((g: any) => g.name).join(', ') || 
                          `Released: ${game.released || 'TBA'} • Rating: ${game.rating || 'N/A'}/5`
            });
          });
        }
      } else {
        console.error('RAWG_API_KEY not found in environment');
      }
    } catch (error) {
      console.error('RAWG gaming search error:', error);
    }

    // Fallback to OpenAI if no results found
    if (results.length === 0) {
      try {
        const openaiKey = Deno.env.get('OPENAI_API_KEY');
        if (openaiKey) {
          console.log('Using OpenAI fallback for gaming search. Query:', query);
          
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
                  content: `You are a gaming expert. Generate 5-8 popular games matching the search query.
                  Return a JSON object with a "results" array. Each result must have: 
                  - title: game name
                  - creator: developer/publisher name
                  - description: brief description with release year and genre
                  - type: always "game"
                  
                  Example: {"results": [{"title": "The Legend of Zelda: Breath of the Wild", "creator": "Nintendo", "description": "Action-adventure game • 2017", "type": "game"}]}`
                },
                {
                  role: 'user',
                  content: `Find games matching: "${query}"`
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
                const aiResults = parsedResponse.results || [];
                
                aiResults.slice(0, 8).forEach((item: any, index: number) => {
                  results.push({
                    title: item.title || `Game ${index + 1}`,
                    type: 'game',
                    creator: item.creator || 'Unknown Developer',
                    image: '',
                    external_id: `ai_game_${Date.now()}_${index}`,
                    external_source: 'openai',
                    description: item.description || ''
                  });
                });
              } catch (parseError) {
                console.error('Error parsing OpenAI gaming response:', parseError);
              }
            }
          }
        }
      } catch (error) {
        console.error('OpenAI gaming search error:', error);
      }
    }

    return new Response(JSON.stringify({ results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Gaming search error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
