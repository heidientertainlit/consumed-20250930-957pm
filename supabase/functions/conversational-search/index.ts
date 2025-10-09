
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

// Detect if query is a direct media search vs conversational recommendation request
function detectDirectSearch(query: string): boolean {
  const lower = query.toLowerCase().trim();
  const wordCount = lower.split(/\s+/).length;
  
  // Conversational indicators - if any of these are present, it's NOT a direct search
  const conversationalKeywords = [
    'like', 'similar', 'recommend', 'suggestion', 'what should', 'looking for',
    'want to', 'help me', 'find me', 'show me', 'give me', 'need', 'mood',
    'feeling', 'uplifting', 'sad', 'happy', 'exciting', 'relaxing', 'funny',
    'something', 'anything', 'best', 'top', 'favorite', 'everyone', 'family',
    'group', 'friends', 'partner', 'kids', 'blend'
  ];
  
  for (const keyword of conversationalKeywords) {
    if (lower.includes(keyword)) {
      return false; // It's conversational
    }
  }
  
  // Question words indicate conversational search
  const questionWords = ['what', 'which', 'how', 'why', 'when', 'where', 'who'];
  for (const word of questionWords) {
    if (lower.startsWith(word + ' ')) {
      return false;
    }
  }
  
  // If it's 1-5 words and has no conversational indicators, likely a direct search
  // e.g., "Friends", "Taylor Swift", "Harry Potter", "The Office"
  if (wordCount >= 1 && wordCount <= 5) {
    return true;
  }
  
  // Default to conversational for longer queries
  return false;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '', 
      Deno.env.get('SUPABASE_ANON_KEY') ?? '', 
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization') }
        }
      }
    );

    // Get auth user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (req.method === 'POST') {
      const { query } = await req.json();

      if (!query || query.trim().length === 0) {
        return new Response(JSON.stringify({
          type: 'error',
          message: 'Please enter a search query'
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      console.log('Processing conversational search for:', query);
      
      // Detect if this is a direct media search vs. conversational query
      const isDirectSearch = detectDirectSearch(query);
      console.log('Search type:', isDirectSearch ? 'DIRECT' : 'CONVERSATIONAL');
      
      // If it's a direct search, use media-search API for actual results
      if (isDirectSearch) {
        try {
          const searchResponse = await fetch(
            'https://mahpgcogwpawvviapqza.supabase.co/functions/v1/media-search',
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': req.headers.get('Authorization') || ''
              },
              body: JSON.stringify({ query })
            }
          );
          
          if (searchResponse.ok) {
            const searchData = await searchResponse.json();
            
            if (searchData.results && searchData.results.length > 0) {
              // Return direct search results with links to detail pages
              const formattedResults = searchData.results.slice(0, 10).map((item: any) => ({
                id: item.external_id || Math.random().toString(),
                title: item.title,
                type: item.type,
                description: item.description || '',
                poster_url: item.image || '',
                detailUrl: item.external_id && item.external_source 
                  ? `/media/${item.type}/${item.external_source}/${item.external_id}`
                  : null,
                external_id: item.external_id,
                external_source: item.external_source
              }));
              
              return new Response(JSON.stringify({
                type: 'direct',
                results: formattedResults
              }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
              });
            }
          }
        } catch (error) {
          console.error('Direct search failed, falling back to AI:', error);
          // Fall through to AI recommendations
        }
      }

      // Get OpenAI API key
      const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
      if (!openaiApiKey) {
        console.error('OpenAI API key not configured');
        return new Response(JSON.stringify({
          type: 'error',
          message: 'AI recommendations are currently unavailable. Please try again later.'
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Get user's consumption history for personalization
      const { data: userMedia, error: mediaError } = await supabase
        .from('list_items')
        .select('title, creator, media_type, notes, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20);

      console.log("User media lookup:", { count: userMedia?.length, mediaError });

      // Get user's DNA profile if available
      const { data: dnaProfile } = await supabase
        .from('dna_profiles')
        .select('profile_text, favorite_media_types, favorite_genres')
        .eq('user_id', user.id)
        .single();

      console.log("DNA profile lookup:", { found: !!dnaProfile });

      // Prepare context for AI
      const recentMediaText = userMedia?.slice(0, 10).map((item) => 
        `${item.title} by ${item.creator || 'Unknown'} (${item.media_type})`
      ).join(', ') || 'no recent media tracked';

      const dnaContext = dnaProfile ? 
        `User's Entertainment DNA: ${dnaProfile.profile_text}\nFavorite types: ${dnaProfile.favorite_media_types?.join(', ') || 'various'}\nFavorite genres: ${dnaProfile.favorite_genres?.join(', ') || 'various'}` :
        'No Entertainment DNA profile available';

      // Create AI prompt
      const prompt = `You are an expert entertainment recommendation engine. A user is asking: "${query}"

Context about this user:
${dnaContext}

Recent media they've tracked: ${recentMediaText}

Based on their query and profile, provide 3-5 personalized recommendations. For each recommendation, provide:
- title: exact title of the media
- type: one of "movie", "tv", "book", "music", "podcast", "game", "youtube"  
- description: 2-3 sentences explaining why this matches their request
- searchTerm: a good search term they could use to find more like this

Also provide an explanation of why these recommendations match their query and 3-4 related search suggestions.

Respond in JSON format with:
- explanation: why these recommendations match their query
- recommendations: array of recommendation objects
- searchSuggestions: array of related search terms they might try

Focus on content that directly answers their question and matches their demonstrated preferences.`;

      console.log("Calling OpenAI API for conversational search...");

      // Call OpenAI API
      const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openaiApiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: 'You are an expert entertainment recommendation engine. Always respond with valid JSON in the exact format requested.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          response_format: { type: "json_object" },
          max_tokens: 1500,
          temperature: 0.7
        })
      });

      if (!openaiResponse.ok) {
        const errorText = await openaiResponse.text();
        console.error('OpenAI API error:', openaiResponse.status, errorText);
        
        // Fallback response
        return new Response(JSON.stringify({
          type: 'conversational',
          explanation: `I understand you're looking for "${query}". Here are some suggestions:`,
          recommendations: [
            {
              title: "Search our media database",
              type: "various",
              description: "Try searching for specific titles, creators, or genres in our main search",
              searchTerm: query.split(' ').slice(-2).join(' ') // Use last 2 words as search term
            }
          ],
          searchSuggestions: [
            "Fantasy book series",
            "Adventure novels", 
            "Young adult fiction",
            "Magic and wizardry books"
          ]
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const openaiResult = await openaiResponse.json();
      const aiResponse = openaiResult.choices[0].message.content;

      console.log("OpenAI response received, parsing...");

      let parsedResponse;
      try {
        parsedResponse = JSON.parse(aiResponse);
      } catch (parseError) {
        console.error('Error parsing OpenAI response:', parseError);
        console.error('Raw response:', aiResponse);
        
        // Fallback response
        return new Response(JSON.stringify({
          type: 'conversational',
          explanation: `Based on your query "${query}", here are some personalized recommendations:`,
          recommendations: [
            {
              title: "Explore similar content",
              type: "various",
              description: "Try searching for specific genres or creators that match your interests",
              searchTerm: "fantasy books"
            }
          ],
          searchSuggestions: [
            "Fantasy adventure series",
            "Young adult magic books",
            "Epic fantasy novels",
            "Coming of age stories"
          ]
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Return the AI-generated conversational response
      return new Response(JSON.stringify({
        type: 'conversational',
        explanation: parsedResponse.explanation || `Based on your query "${query}", here are some personalized recommendations:`,
        recommendations: parsedResponse.recommendations || [],
        searchSuggestions: parsedResponse.searchSuggestions || []
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Conversational search error:', error);
    return new Response(JSON.stringify({
      type: 'error',
      message: 'Search is temporarily unavailable. Please try again later.'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
