import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
};

interface CelebrityMatch {
  name: string;
  category: string;
  match_score: number;
  dna_title: string;
  dna_tagline: string;
  shared_traits: string[];
  why_you_match: string;
  image_url?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const jwt = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(jwt);

    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Calculate user's DNA level from logged items
    const { data: userLists } = await supabaseClient
      .from('user_lists')
      .select('id')
      .eq('user_id', user.id)
      .eq('list_type', 'all')
      .single();

    let itemCount = 0;
    if (userLists) {
      const { count } = await supabaseClient
        .from('user_list_items')
        .select('*', { count: 'exact', head: true })
        .eq('list_id', userLists.id);
      itemCount = count || 0;
    }

    // Calculate level: 0-14 = Level 1, 15-29 = Level 2, 30+ = Level 3
    const currentLevel = itemCount >= 30 ? 3 : itemCount >= 15 ? 2 : 1;

    if (currentLevel < 2) {
      return new Response(JSON.stringify({ 
        error: 'Celebrity DNA matching requires DNA Profile (Level 2)',
        current_level: currentLevel,
        required_level: 2,
        items_logged: itemCount,
        items_needed: 15 - itemCount
      }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Check cache first (cached for 7 days)
    const { data: cachedMatches } = await supabaseClient
      .from('celebrity_dna')
      .select('*')
      .eq('user_id', user.id)
      .gte('updated_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
      .limit(1);

    if (cachedMatches && cachedMatches.length > 0 && cachedMatches[0].favorite_titles) {
      // Return cached results
      const cached = cachedMatches[0];
      return new Response(JSON.stringify({
        celebrities: cached.favorite_titles, // We store matches here
        from_cache: true,
        user_level: currentLevel
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Get user's DNA signals
    const { data: userSignals } = await supabaseClient
      .from('user_dna_signals')
      .select('signal_type, signal_value, strength')
      .eq('user_id', user.id)
      .order('strength', { ascending: false })
      .limit(20);

    // Get user's DNA profile
    const { data: userProfile } = await supabaseClient
      .from('dna_profiles')
      .select('label, tagline, flavor_notes, favorite_genres, favorite_media_types')
      .eq('user_id', user.id)
      .single();

    if (!userSignals || userSignals.length === 0) {
      return new Response(JSON.stringify({ 
        error: 'No DNA signals found. Log some media first.'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiApiKey) {
      return new Response(JSON.stringify({ error: 'OpenAI API key not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Format user's DNA for the prompt
    const genreSignals = userSignals
      .filter((s: any) => s.signal_type === 'genre')
      .map((s: any) => `${s.signal_value} (${Math.round(s.strength * 100)}%)`)
      .join(', ');

    const creatorSignals = userSignals
      .filter((s: any) => s.signal_type === 'creator')
      .map((s: any) => s.signal_value)
      .join(', ');

    const mediaTypeSignals = userSignals
      .filter((s: any) => s.signal_type === 'media_type')
      .map((s: any) => s.signal_value)
      .join(', ');

    const decadeSignals = userSignals
      .filter((s: any) => s.signal_type === 'decade')
      .map((s: any) => s.signal_value)
      .join(', ');

    const prompt = `You are matching a user's Entertainment DNA with real celebrities based on shared entertainment taste.

USER'S ENTERTAINMENT DNA:
- DNA Label: "${userProfile?.label || 'Entertainment Explorer'}"
- DNA Tagline: "${userProfile?.tagline || ''}"
- Top Genres: ${genreSignals || 'various'}
- Favorite Creators: ${creatorSignals || 'various'}
- Media Types: ${mediaTypeSignals || 'various'}
- Favorite Decades: ${decadeSignals || 'various'}
- Flavor Notes: ${userProfile?.flavor_notes?.join(', ') || 'eclectic taste'}

Based on this Entertainment DNA, suggest 8 REAL celebrities (actors, musicians, directors, athletes, authors, or creators) who likely share similar entertainment taste.

REQUIREMENTS:
1. Choose celebrities known for their entertainment preferences (not just their work)
2. Mix categories: actors, musicians, directors, athletes, authors, influencers
3. Include both very famous and some "good taste" tastemaker celebrities
4. Make match scores between 55-95% (realistic, not all high)
5. Be specific about WHY they match

For each celebrity, provide:
- name: Full real name
- category: actor, musician, director, athlete, author, or influencer
- match_score: 55-95 (percentage match)
- dna_title: A fun 2-4 word entertainment archetype for them
- dna_tagline: A witty one-liner about their taste (≤100 chars)
- shared_traits: 2-3 specific things you share
- why_you_match: One sentence explaining the connection

Respond with JSON:
{
  "celebrities": [
    {
      "name": "string",
      "category": "string",
      "match_score": number,
      "dna_title": "string",
      "dna_tagline": "string",
      "shared_traits": ["string", "string"],
      "why_you_match": "string"
    }
  ]
}`;

    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: 'You are an entertainment taste expert who knows celebrities\' actual entertainment preferences from interviews, social media, and public statements. Match users with celebrities based on shared taste. Only suggest REAL, well-known celebrities. Respond only with valid JSON.'
          },
          { role: 'user', content: prompt }
        ],
        response_format: { type: "json_object" },
        max_tokens: 1500,
        temperature: 0.9
      })
    });

    if (!openaiResponse.ok) {
      throw new Error(`OpenAI API error: ${openaiResponse.status}`);
    }

    const openaiData = await openaiResponse.json();
    const result = JSON.parse(openaiData.choices[0].message.content);
    
    let celebrities: CelebrityMatch[] = result.celebrities || [];

    // Fetch images from TMDB for actors/directors
    const tmdbApiKey = Deno.env.get('TMDB_API_KEY');
    if (tmdbApiKey) {
      for (const celeb of celebrities) {
        if (['actor', 'director'].includes(celeb.category)) {
          try {
            const searchResponse = await fetch(
              `https://api.themoviedb.org/3/search/person?api_key=${tmdbApiKey}&query=${encodeURIComponent(celeb.name)}&page=1`
            );
            if (searchResponse.ok) {
              const searchData = await searchResponse.json();
              if (searchData.results && searchData.results.length > 0) {
                const profilePath = searchData.results[0].profile_path;
                if (profilePath) {
                  celeb.image_url = `https://image.tmdb.org/t/p/w500${profilePath}`;
                }
              }
            }
            // Small delay to avoid rate limiting
            await new Promise(resolve => setTimeout(resolve, 100));
          } catch (e) {
            console.error('TMDB fetch error for', celeb.name, e);
          }
        }
      }
    }

    // Sort by match score
    celebrities.sort((a, b) => b.match_score - a.match_score);

    // Cache the results (store in celebrity_dna table with user_id)
    await supabaseClient
      .from('celebrity_dna')
      .upsert({
        id: user.id, // Use user_id as the primary key for caching
        name: `Cache for ${user.id}`,
        user_id: user.id,
        favorite_titles: celebrities, // Store the matches here
        is_active: false, // Not a public celebrity
        updated_at: new Date().toISOString()
      }, { onConflict: 'id' });

    return new Response(JSON.stringify({
      celebrities,
      user_dna: {
        label: userProfile?.label,
        tagline: userProfile?.tagline
      },
      from_cache: false,
      user_level: userLevel.current_level
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error in match-dna-celebrity:', error);
    return new Response(JSON.stringify({
      error: 'Internal server error',
      details: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
