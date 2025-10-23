import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

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
    console.log("Auth check result:", { user: user?.email, userError });
    
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Look up app user by email
    let { data: appUser, error: appUserError } = await supabase
      .from('users')
      .select('id, email, user_name')
      .eq('email', user.email)
      .single();

    console.log('User lookup result:', { appUser, appUserError });

    if (appUserError && appUserError.code === 'PGRST116') {
      // User doesn't exist, create them
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

    console.log('Fetching comprehensive user data for advanced recommendations...');

    // 1. Get DNA Profile
    const { data: dnaProfile } = await supabase
      .from('dna_profiles')
      .select('*')
      .eq('user_id', appUser.id)
      .single();

    console.log('DNA Profile fetched:', !!dnaProfile);

    // 2. Get User Highlights (their favorites)
    const { data: highlights } = await supabase
      .from('user_highlights')
      .select('*')
      .eq('user_id', appUser.id)
      .order('created_at', { ascending: false })
      .limit(10);

    console.log('Highlights fetched:', highlights?.length || 0);

    // 3. Get Consumption History (last 20 items)
    const { data: consumptionHistory } = await supabase
      .from('list_items')
      .select('title, media_type, creator, external_id, external_source')
      .eq('user_id', appUser.id)
      .order('id', { ascending: false })
      .limit(20);

    console.log('Consumption history fetched:', consumptionHistory?.length || 0);

    // 4. Get Highly Rated Media (4-5 stars)
    const { data: highRatings } = await supabase
      .from('media_ratings')
      .select('media_title, media_type, rating, media_external_id, media_external_source')
      .eq('user_id', appUser.id)
      .gte('rating', 4)
      .order('rating', { ascending: false })
      .limit(15);

    console.log('High ratings fetched:', highRatings?.length || 0);

    // 5. Get Social Posts & Reviews
    const { data: socialPosts } = await supabase
      .from('social_posts')
      .select('content, media_title, media_type, rating, media_creator')
      .eq('user_id', appUser.id)
      .not('media_title', 'is', null)
      .order('created_at', { ascending: false })
      .limit(10);

    console.log('Social posts fetched:', socialPosts?.length || 0);

    // 6. Get Custom Lists with themes
    const { data: customLists } = await supabase
      .from('lists')
      .select('title')
      .eq('user_id', appUser.id)
      .eq('is_default', false)
      .limit(10);

    console.log('Custom lists fetched:', customLists?.length || 0);

    // Build comprehensive user profile for AI
    const userProfile = {
      dnaProfile: dnaProfile ? {
        label: dnaProfile.label,
        tagline: dnaProfile.tagline,
        profileText: dnaProfile.profile_text,
        favoriteGenres: dnaProfile.favorite_genres,
        favoriteMediaTypes: dnaProfile.favorite_media_types,
        favoriteSports: dnaProfile.favorite_sports,
      } : null,
      highlights: highlights?.map(h => ({
        title: h.title,
        creator: h.creator,
        type: h.media_type
      })) || [],
      recentConsumption: consumptionHistory?.map(item => ({
        title: item.title,
        type: item.media_type,
        creator: item.creator
      })) || [],
      highlyRated: highRatings?.map(r => ({
        title: r.media_title,
        type: r.media_type,
        rating: r.rating
      })) || [],
      socialActivity: socialPosts?.map(p => ({
        title: p.media_title,
        type: p.media_type,
        rating: p.rating,
        review: p.content
      })) || [],
      customListThemes: customLists?.map(l => l.title) || []
    };

    console.log('User profile compiled:', {
      hasDNA: !!userProfile.dnaProfile,
      highlightsCount: userProfile.highlights.length,
      consumptionCount: userProfile.recentConsumption.length,
      ratingsCount: userProfile.highlyRated.length,
      postsCount: userProfile.socialActivity.length,
      listsCount: userProfile.customListThemes.length
    });

    // Build AI prompt
    const prompt = `You are an advanced entertainment recommendation engine analyzing a comprehensive user profile.

USER PROFILE:

${userProfile.dnaProfile ? `
Entertainment DNA Profile:
- Label: ${userProfile.dnaProfile.label || 'Not set'}
- Tagline: ${userProfile.dnaProfile.tagline || 'Not set'}
- Profile: ${userProfile.dnaProfile.profileText || 'Not set'}
- Favorite Genres: ${JSON.stringify(userProfile.dnaProfile.favoriteGenres) || 'Not set'}
- Favorite Media Types: ${JSON.stringify(userProfile.dnaProfile.favoriteMediaTypes) || 'Not set'}
` : 'DNA Profile: Not completed yet'}

Highlighted Favorites (${userProfile.highlights.length}):
${userProfile.highlights.slice(0, 5).map(h => `- ${h.title} by ${h.creator} (${h.type})`).join('\n') || 'None'}

Recent Consumption (${userProfile.recentConsumption.length} items):
${userProfile.recentConsumption.slice(0, 10).map(c => `- ${c.title} (${c.type})`).join('\n') || 'None'}

Highly Rated Media (${userProfile.highlyRated.length} items, 4-5 stars):
${userProfile.highlyRated.slice(0, 8).map(r => `- ${r.title} (${r.type}) - ${r.rating} stars`).join('\n') || 'None'}

Social Posts & Reviews (${userProfile.socialActivity.length}):
${userProfile.socialActivity.slice(0, 5).map(p => `- ${p.title} (${p.type}): ${p.review?.substring(0, 100) || 'No review'}`).join('\n') || 'None'}

Custom List Themes (${userProfile.customListThemes.length}):
${userProfile.customListThemes.join(', ') || 'None'}

TASK:
Generate 8-10 personalized entertainment recommendations based on ALL the data above, not just the DNA profile. Consider:
- What they've actually consumed and loved (ratings, reviews)
- Patterns in their viewing/reading/listening habits
- Their highlighted favorites
- Themes in their custom lists
- Social engagement and reviews

For each recommendation, provide:
- title: exact title
- type: one of [Movie, TV Show, Book, Music, Podcast, Game, YouTube]
- creator: director/author/artist
- reason: specific explanation based on their actual data (2-3 sentences, reference specific titles they've enjoyed)
- confidence: 1-10 score of how well this matches their profile

Return ONLY valid JSON in this format:
{
  "recommendations": [
    {
      "title": "string",
      "type": "string",
      "creator": "string",
      "reason": "string",
      "confidence": number
    }
  ]
}`;

    // Call OpenAI API
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

    console.log("Calling OpenAI API (gpt-4o) for advanced recommendations...");

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

    try {
      const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openaiApiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'gpt-4o', // Full model for better analysis
          messages: [
            {
              role: 'system',
              content: 'You are an expert entertainment recommendation engine that analyzes comprehensive user data to suggest deeply personalized media content. Always respond with valid JSON.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          response_format: { type: "json_object" },
          max_tokens: 1500, // More tokens for detailed reasoning
          temperature: 0.8 // Slightly higher for more creative recommendations
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
        console.error('Failed to parse OpenAI response:', parseError);
        throw new Error('Invalid JSON response from AI');
      }

      console.log("Advanced recommendations generated successfully:", recommendations.recommendations?.length || 0);

      return new Response(JSON.stringify({
        success: true,
        recommendations: recommendations.recommendations || [],
        dataSourcesUsed: {
          dnaProfile: !!userProfile.dnaProfile,
          highlights: userProfile.highlights.length,
          consumption: userProfile.recentConsumption.length,
          ratings: userProfile.highlyRated.length,
          social: userProfile.socialActivity.length,
          customLists: userProfile.customListThemes.length
        }
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });

    } catch (error) {
      clearTimeout(timeoutId);
      console.error('OpenAI request error:', error);
      throw error;
    }

  } catch (error) {
    console.error('Advanced recommendations error:', error);
    return new Response(JSON.stringify({ 
      error: error.message || 'Failed to generate advanced recommendations'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
