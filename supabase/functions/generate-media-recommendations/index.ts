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

    // If user doesn't exist, create them (using working pattern)
    if (appUserError && appUserError.code === 'PGRST116') {
      console.log('User not found, creating new user:', user.email);
      const { data: newUser, error: createError } = await supabase
        .from('users')
        .insert({
          id: user.id,
          email: user.email,
          user_name: user.email.split('@')[0] || 'user'
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

    // Fetch user's DNA profile from database
    const { data: dnaProfile, error: dnaError } = await supabase
      .from('dna_profiles')
      .select('*')
      .eq('user_id', appUser.id)
      .single();

    console.log("DNA profile lookup:", { found: !!dnaProfile, dnaError });

    if (dnaError || !dnaProfile) {
      return new Response(JSON.stringify({
        error: 'No DNA profile found. Please complete the DNA survey first.'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Get user's recent consumption using correct schema (list_items table)
    const { data: recentConsumption, error: consumptionError } = await supabase
      .from('list_items')
      .select('title, type, media_type, creator, created_at')
      .eq('user_id', appUser.id)
      .order('created_at', { ascending: false })
      .limit(10);

    console.log("Recent consumption lookup:", { count: recentConsumption?.length, consumptionError });

    // Prepare data for AI prompt
    const mediaTypesText = dnaProfile.favorite_media_types?.join(', ') || 'various media types';
    const genresText = dnaProfile.favorite_genres?.join(', ') || 'various genres';
    const recentMediaText = recentConsumption?.map((item) => 
      `${item.title} by ${item.creator || 'Unknown'} (${item.media_type || item.type})`
    ).join(', ') || 'no recent media';

    const prompt = `Based on this Entertainment DNA profile:

${dnaProfile.profile_text}

User's favorite media types: ${mediaTypesText}
User's favorite genres: ${genresText}
Recent media consumption: ${recentMediaText}

Generate 8-12 personalized media recommendations that specifically match their profile. For each recommendation, provide:
- title: exact title of the media
- creator: author/artist/director/developer  
- media_type: one of "book", "movie", "tv", "music", "podcast", "game", "youtube"
- year: release year (number)
- description: 2-3 sentence explanation of why this matches their entertainment DNA
- genre: primary genre
- rating_explanation: why this person would rate it highly

Focus on content that matches their specific preferences mentioned in the profile.

Respond in JSON format with a "recommendations" array.`;

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

    console.log("Calling OpenAI API...");

    // Call OpenAI API
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
            content: 'You are an expert entertainment recommendation engine that analyzes Entertainment DNA profiles to suggest personalized media content. Always respond with valid JSON.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        response_format: { type: "json_object" },
        max_tokens: 2000,
        temperature: 0.7
      })
    });

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