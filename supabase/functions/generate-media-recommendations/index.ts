import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

serve(async (req) => {
  console.log("generate-media-recommendations function hit!", req.method, req.url);
  
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

    // Get auth user (using working pattern)
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    console.log("Auth check result:", { user: user?.email, userError });
    
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Look up app user by email, CREATE if doesn't exist (using working pattern)
    let { data: appUser, error: appUserError } = await supabase
      .from('users')
      .select('id, email, user_name')
      .eq('email', user.email)
      .single();

    console.log('User lookup result:', { appUser, appUserError });

    // If user doesn't exist, create them using service role client (bypass RLS)
    if (appUserError && appUserError.code === 'PGRST116') {
      console.log('User not found, creating new user:', user.email);
      const supabaseAdmin = createClient(
        Deno.env.get('SUPABASE_URL') ?? '', 
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      );
      
      const { data: newUser, error: createError } = await supabaseAdmin
        .from('users')
        .insert({
          id: user.id,
          email: user.email,
          user_name: user.user_metadata?.user_name || user.email.split('@')[0] || 'user',
          display_name: user.user_metadata?.display_name || user.email.split('@')[0] || 'User',
          first_name: user.user_metadata?.first_name || '',
          last_name: user.user_metadata?.last_name || ''
        })
        .select('id, email, user_name')
        .single();

      if (createError) {
        console.error('Failed to create user:', createError);
        return new Response(JSON.stringify({ 
          error: 'Failed to create user: ' + createError.message 
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      
      appUser = newUser;
      console.log('Created new user:', appUser);
    } else if (appUserError) {
      console.error('User lookup error:', appUserError);
      return new Response(JSON.stringify({ 
        error: 'User lookup failed: ' + appUserError.message 
      }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Fetch user's DNA profile and consumption history in parallel
    const [dnaResult, consumptionResult] = await Promise.all([
      supabase
        .from('dna_profiles')
        .select('*')
        .eq('user_id', appUser.id)
        .single(),
      supabase
        .from('list_items')
        .select('title, type, media_type, creator, created_at')
        .eq('user_id', appUser.id)
        .order('created_at', { ascending: false })
        .limit(6)
    ]);

    const { data: dnaProfile, error: dnaError } = dnaResult;
    const { data: recentConsumption, error: consumptionError } = consumptionResult;

    console.log("DNA profile lookup:", { found: !!dnaProfile, dnaError });

    if (dnaError || !dnaProfile) {
      return new Response(JSON.stringify({
        error: 'No DNA profile found. Please complete the DNA survey first.'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log("Recent consumption lookup:", { count: recentConsumption?.length, consumptionError });

    // Check if we're generating context-aware recommendations for a specific media item
    const url = new URL(req.url);
    const currentMediaTitle = url.searchParams.get('currentMediaTitle');
    const currentMediaType = url.searchParams.get('currentMediaType');
    const currentMediaCreator = url.searchParams.get('currentMediaCreator');

    console.log("Request params:", { currentMediaTitle, currentMediaType, currentMediaCreator });

    // Prepare data for AI prompt
    const mediaTypesText = dnaProfile.favorite_media_types?.join(', ') || 'various media types';
    const genresText = dnaProfile.favorite_genres?.join(', ') || 'various genres';
    const recentMediaText = recentConsumption?.map((item) => 
      `${item.title} by ${item.creator || 'Unknown'} (${item.media_type || item.type})`
    ).join(', ') || 'no recent media';

    let prompt: string;

    if (currentMediaTitle && currentMediaType) {
      // Context-aware recommendations for media detail page
      prompt = `Based on this Entertainment DNA profile:

${dnaProfile.profile_text}

User's favorite media types: ${mediaTypesText}
User's favorite genres: ${genresText}
Recent media consumption: ${recentMediaText}

The user is currently viewing: "${currentMediaTitle}" by ${currentMediaCreator || 'Unknown'} (${currentMediaType})

Generate 6-8 personalized recommendations similar to "${currentMediaTitle}" that also match their entertainment DNA profile. For each recommendation, provide:
- title: exact title of the media
- creator: author/artist/director/developer  
- media_type: one of "book", "movie", "tv", "music", "podcast", "game", "youtube"
- year: release year (number)
- description: 2-3 sentence explanation of why this is similar to "${currentMediaTitle}" and matches their entertainment DNA
- genre: primary genre
- rating_explanation: why this person would rate it highly

Focus on content that is similar in style, theme, or genre to "${currentMediaTitle}" while matching their specific preferences.

Respond in JSON format with a "recommendations" array.`;
    } else {
      // General recommendations based on DNA profile (for Track page)
      prompt = `Based on this Entertainment DNA profile:

${dnaProfile.profile_text}

User's favorite media types: ${mediaTypesText}
User's favorite genres: ${genresText}
Recent media consumption: ${recentMediaText}

Generate 6-8 personalized media recommendations that specifically match their profile. For each recommendation, provide:
- title: exact title of the media
- creator: author/artist/director/developer  
- media_type: one of "book", "movie", "tv", "music", "podcast", "game", "youtube"
- year: release year (number)
- description: 2-3 sentence explanation of why this matches their entertainment DNA
- genre: primary genre
- rating_explanation: why this person would rate it highly

Focus on content that matches their specific preferences mentioned in the profile.

Respond in JSON format with a "recommendations" array.`;
    }

    // Get OpenAI API key
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiApiKey) {
      console.error('OpenAI API key not configured');
      return new Response(JSON.stringify({
        error: 'OpenAI API key not configured'
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log("Calling OpenAI API with timeout...");

    // Create AbortController for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 25000); // 25 second timeout

    try {
      // Call OpenAI API with faster model
      const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openaiApiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini', // Faster, cheaper model
          messages: [
            {
              role: 'system',
              content: 'You are an expert entertainment recommendation engine that analyzes Entertainment DNA profiles to suggest personalized media content. Always respond with valid JSON.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          response_format: { type: "json_object" },
          max_tokens: 800, // Reduced for faster response
          temperature: 0.7
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!openaiResponse.ok) {
        const errorText = await openaiResponse.text();
        console.error('OpenAI API error:', openaiResponse.status, errorText);
        throw new Error(`OpenAI API error: ${openaiResponse.status} - ${errorText}`);
      }

      const openaiResult = await openaiResponse.json();
      const recommendationsText = openaiResult.choices[0].message.content;

      console.log("OpenAI response received, parsing...");

      let recommendations;
      try {
        recommendations = JSON.parse(recommendationsText);
      } catch (parseError) {
        console.error('Error parsing OpenAI response:', parseError);
        console.error('Raw response:', recommendationsText);
        throw new Error('Failed to parse AI recommendations');
      }

      // Transform recommendations into the format expected by the frontend
      const formattedRecommendations = recommendations.recommendations?.map((rec) => ({
        id: `rec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        title: rec.title,
        creator: rec.creator,
        media_type: rec.media_type,
        type: rec.media_type, // For compatibility
        year: rec.year,
        description: rec.description,
        genre: rec.genre,
        rating_explanation: rec.rating_explanation,
        image_url: null,
        external_id: null,
        external_source: 'ai_recommendation'
      })) || [];

      console.log("Generated recommendations:", formattedRecommendations.length);

      return new Response(JSON.stringify({
        recommendations: formattedRecommendations,
        count: formattedRecommendations.length,
        generated_at: new Date().toISOString()
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      });

    } catch (fetchError) {
      clearTimeout(timeoutId);
      
      // Handle timeout specifically
      if (fetchError.name === 'AbortError') {
        console.error('OpenAI request timed out after 25 seconds');
        return new Response(JSON.stringify({
          error: 'Request timed out',
          details: 'Recommendation generation took too long. Please try again.'
        }), {
          status: 504,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      
      throw fetchError;
    }

  } catch (error) {
    console.error('Error generating recommendations:', error);
    return new Response(JSON.stringify({
      error: 'Failed to generate recommendations',
      details: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});