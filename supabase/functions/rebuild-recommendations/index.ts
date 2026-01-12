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
    // Use service role for background operations
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Check if request is from service role (for cron jobs)
    const authHeader = req.headers.get('Authorization') || '';
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    const isServiceRole = authHeader.includes(serviceRoleKey) && serviceRoleKey.length > 0;

    let userId: string;
    const body = await req.json().catch(() => ({}));

    if (isServiceRole) {
      // Service role can rebuild for any user (cron jobs, admin operations)
      if (!body.userId) {
        return new Response(JSON.stringify({ error: 'userId required for service role calls' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      userId = body.userId;
      console.log('Service role rebuild for user:', userId);
    } else {
      // Regular user can only rebuild their own recommendations
      const authClient = createClient(
        Deno.env.get('SUPABASE_URL') ?? '', 
        Deno.env.get('SUPABASE_ANON_KEY') ?? '', 
        {
          global: {
            headers: { Authorization: authHeader }
          }
        }
      );

      const { data: { user }, error: authError } = await authClient.auth.getUser();
      if (authError || !user) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Security: Regular users can ONLY rebuild their own recommendations
      const targetUserId = body.userId;
      if (targetUserId && targetUserId !== user.id) {
        return new Response(JSON.stringify({ error: 'Can only rebuild your own recommendations' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      userId = user.id;
      console.log('User rebuild for:', user.email);
    }
    console.log('Rebuilding recommendations for user:', userId);

    // Check current cache and preserve existing recommendations while generating
    const { data: existingCache } = await supabase
      .from('user_recommendations')
      .select('recommendations')
      .eq('user_id', userId)
      .single();

    // Mark as generating WITHOUT clearing existing recommendations
    await supabase
      .from('user_recommendations')
      .upsert({
        user_id: userId,
        status: 'generating',
        // CRITICAL: Preserve existing recommendations during rebuild
        recommendations: existingCache?.recommendations || { recommendations: [] },
      }, {
        onConflict: 'user_id',
        ignoreDuplicates: false
      });

    // Fetch all data sources
    console.log('Fetching comprehensive user data...');

    // 1. DNA Profile
    const { data: dnaProfile } = await supabase
      .from('dna_profiles')
      .select('*')
      .eq('user_id', userId)
      .single();

    // 2. User Highlights
    const { data: highlights } = await supabase
      .from('user_highlights')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(10);

    // 3. Consumption History
    const { data: consumptionHistory } = await supabase
      .from('list_items')
      .select('title, media_type, creator, external_id, external_source')
      .eq('user_id', userId)
      .order('id', { ascending: false })
      .limit(20);

    // 4. Highly Rated Media
    const { data: highRatings } = await supabase
      .from('media_ratings')
      .select('media_title, media_type, rating, media_external_id, media_external_source')
      .eq('user_id', userId)
      .gte('rating', 4)
      .order('rating', { ascending: false })
      .limit(15);

    // 5. Social Posts
    const { data: socialPosts } = await supabase
      .from('social_posts')
      .select('content, media_title, media_type, rating, media_creator')
      .eq('user_id', userId)
      .not('media_title', 'is', null)
      .order('created_at', { ascending: false })
      .limit(10);

    // 6. Custom Lists
    const { data: customLists } = await supabase
      .from('lists')
      .select('title')
      .eq('user_id', userId)
      .eq('is_default', false)
      .limit(10);

    // 7. Followed Creators
    const { data: followedCreators } = await supabase
      .from('followed_creators')
      .select('creator_name, creator_role')
      .eq('user_id', userId)
      .limit(20);

    const userProfile = {
      dnaProfile: dnaProfile ? {
        label: dnaProfile.label,
        tagline: dnaProfile.tagline,
        profileText: dnaProfile.profile_text,
        favoriteGenres: dnaProfile.favorite_genres,
        favoriteMediaTypes: dnaProfile.favorite_media_types,
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
      customListThemes: customLists?.map(l => l.title) || [],
      followedCreators: followedCreators?.map(c => ({
        name: c.creator_name,
        role: c.creator_role
      })) || []
    };

    console.log('User profile compiled:', {
      hasDNA: !!userProfile.dnaProfile,
      highlightsCount: userProfile.highlights.length,
      consumptionCount: userProfile.recentConsumption.length,
      ratingsCount: userProfile.highlyRated.length,
      postsCount: userProfile.socialActivity.length,
      listsCount: userProfile.customListThemes.length,
      followedCreatorsCount: userProfile.followedCreators.length
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

Followed Creators (${userProfile.followedCreators.length}):
${userProfile.followedCreators.slice(0, 15).map(c => `- ${c.name} (${c.role})`).join('\n') || 'None'}

TASK:
Generate 8-10 personalized entertainment recommendations based on ALL the data above. Consider patterns in their consumption, ratings, engagement, AND the creators they follow. If they follow specific directors, musicians, or authors, PRIORITIZE recommending new/recent work from those creators or similar artists.

For each recommendation, provide:
- title: exact title (must be real, existing media)
- type: one of [Movie, TV Show, Book, Music, Podcast, Game]
- creator: director/author/artist/studio
- reason: specific explanation (2-3 sentences, reference specific titles they've enjoyed)
- confidence: 1-10 score
- year: release year (number)

IMPORTANT: 
- All recommendations must be real, existing media
- DO NOT generate image URLs or IDs - these will be fetched from real APIs
- Be specific with exact titles and years to ensure we can find them

Return ONLY valid JSON:
{
  "recommendations": [
    {
      "title": "string",
      "type": "string",
      "creator": "string",
      "reason": "string",
      "confidence": number,
      "year": number
    }
  ]
}`;

    // Call OpenAI
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    console.log("Calling OpenAI API (gpt-4o)...");

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    try {
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
              content: 'You are an expert entertainment recommendation engine. Always respond with valid JSON.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          response_format: { type: "json_object" },
          max_tokens: 1500,
          temperature: 0.8
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!openaiResponse.ok) {
        const errorText = await openaiResponse.text();
        throw new Error(`OpenAI API error: ${openaiResponse.status} - ${errorText}`);
      }

      const openaiResult = await openaiResponse.json();
      const recommendationsText = openaiResult.choices[0].message.content;
      const aiRecommendations = JSON.parse(recommendationsText);

      console.log("AI recommendations generated:", aiRecommendations.recommendations?.length || 0);

      // Fetch real poster images from actual APIs
      console.log("Fetching real poster images from APIs...");
      const tmdbApiKey = Deno.env.get('TMDB_API_KEY');
      
      const enrichedRecs = await Promise.all(
        (aiRecommendations.recommendations || []).map(async (rec: any) => {
          try {
            const type = rec.type.toLowerCase();
            
            // For movies/TV shows - use TMDB
            if (type.includes('movie') || type.includes('tv') || type.includes('show')) {
              if (!tmdbApiKey) {
                console.warn('TMDB API key not configured, skipping image fetch');
                return { ...rec, external_source: 'tmdb', external_id: '', image_url: '' };
              }

              const mediaType = type.includes('tv') || type.includes('show') ? 'tv' : 'movie';
              const searchUrl = `https://api.themoviedb.org/3/search/${mediaType}?api_key=${tmdbApiKey}&query=${encodeURIComponent(rec.title)}&year=${rec.year || ''}`;
              
              const tmdbRes = await fetch(searchUrl);
              if (tmdbRes.ok) {
                const tmdbData = await tmdbRes.json();
                if (tmdbData.results && tmdbData.results.length > 0) {
                  const result = tmdbData.results[0];
                  return {
                    ...rec,
                    media_type: mediaType === 'tv' ? 'tv' : 'movie',
                    image_url: result.poster_path ? `https://image.tmdb.org/t/p/w500${result.poster_path}` : '',
                    external_id: result.id.toString(),
                    external_source: 'tmdb'
                  };
                }
              }
            }
            
            // For books - use Google Books
            else if (type.includes('book')) {
              const searchUrl = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(rec.title)}`;
              const booksRes = await fetch(searchUrl);
              if (booksRes.ok) {
                const booksData = await booksRes.json();
                if (booksData.items && booksData.items.length > 0) {
                  const book = booksData.items[0];
                  const imageUrl = book.volumeInfo?.imageLinks?.thumbnail || 
                                 book.volumeInfo?.imageLinks?.smallThumbnail || '';
                  const isbn = book.volumeInfo?.industryIdentifiers?.[0]?.identifier || book.id;
                  
                  return {
                    ...rec,
                    media_type: 'book',
                    image_url: imageUrl.replace('http:', 'https:'),
                    external_id: isbn,
                    external_source: 'openlibrary'
                  };
                }
              }
            }
            
            // For music - use Spotify API
            else if (type.includes('music') || type.includes('album') || type.includes('song')) {
              const spotifyClientId = Deno.env.get('SPOTIFY_CLIENT_ID');
              const spotifyClientSecret = Deno.env.get('SPOTIFY_CLIENT_SECRET');
              
              if (spotifyClientId && spotifyClientSecret) {
                try {
                  // Get Spotify access token
                  const tokenRes = await fetch('https://accounts.spotify.com/api/token', {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/x-www-form-urlencoded',
                      'Authorization': 'Basic ' + btoa(`${spotifyClientId}:${spotifyClientSecret}`)
                    },
                    body: 'grant_type=client_credentials'
                  });
                  
                  if (tokenRes.ok) {
                    const tokenData = await tokenRes.json();
                    const searchQuery = rec.creator ? `${rec.title} ${rec.creator}` : rec.title;
                    
                    const spotifyRes = await fetch(
                      `https://api.spotify.com/v1/search?q=${encodeURIComponent(searchQuery)}&type=album&limit=1`,
                      {
                        headers: {
                          'Authorization': `Bearer ${tokenData.access_token}`
                        }
                      }
                    );
                    
                    if (spotifyRes.ok) {
                      const spotifyData = await spotifyRes.json();
                      const album = spotifyData.albums?.items?.[0];
                      if (album) {
                        return {
                          ...rec,
                          media_type: 'music',
                          image_url: album.images?.[0]?.url || '',
                          external_id: album.id,
                          external_source: 'spotify'
                        };
                      }
                    }
                  }
                } catch (spotifyError) {
                  console.error('Spotify API error:', spotifyError);
                }
              }
              return { ...rec, external_source: 'spotify', external_id: '', image_url: '' };
            }
            
            // For unsupported types, return without image
            console.warn(`No API configured for type: ${type}`);
            return { ...rec, external_source: '', external_id: '', image_url: '' };
            
          } catch (error) {
            console.error(`Error fetching metadata for ${rec.title}:`, error);
            return { ...rec, external_source: '', external_id: '', image_url: '' };
          }
        })
      );

      const recommendations = { recommendations: enrichedRecs };
      console.log("Enriched with real poster images:", enrichedRecs.filter((r: any) => r.image_url).length);

      // Save to cache
      const now = new Date();
      const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours
      const staleAfter = new Date(now.getTime() + 6 * 60 * 60 * 1000); // 6 hours

      await supabase
        .from('user_recommendations')
        .upsert({
          user_id: userId,
          recommendations,
          data_sources_used: {
            dnaProfile: !!userProfile.dnaProfile,
            highlights: userProfile.highlights.length,
            consumption: userProfile.recentConsumption.length,
            ratings: userProfile.highlyRated.length,
            social: userProfile.socialActivity.length,
            customLists: userProfile.customListThemes.length
          },
          source_model: 'gpt-4o',
          status: 'ready',
          generated_at: now.toISOString(),
          expires_at: expiresAt.toISOString(),
          stale_after: staleAfter.toISOString()
        }, {
          onConflict: 'user_id'
        });

      console.log("Recommendations cached successfully");

      return new Response(JSON.stringify({
        success: true,
        message: 'Recommendations rebuilt successfully',
        count: recommendations.recommendations?.length || 0
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });

    } catch (error) {
      clearTimeout(timeoutId);
      
      // Mark as failed but PRESERVE existing cache (don't punish users for our errors)
      console.error('OpenAI generation failed, preserving last cache:', error);
      await supabase
        .from('user_recommendations')
        .upsert({
          user_id: userId,
          status: 'failed',
          // CRITICAL: Keep the existing recommendations we preserved earlier
          recommendations: existingCache?.recommendations || { recommendations: [] },
        }, {
          onConflict: 'user_id',
          ignoreDuplicates: false
        });

      throw error;
    }

  } catch (error) {
    console.error('Rebuild recommendations error:', error);
    return new Response(JSON.stringify({ 
      error: error.message || 'Failed to rebuild recommendations'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
