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

    // 8. Behavioral DNA signals (from extract-dna-signals — aggregated across ratings, trivia, tracking)
    const { data: dnaSignals } = await supabase
      .from('user_dna_signals')
      .select('signal_type, signal_value, strength, source_count, sources')
      .eq('user_id', userId)
      .neq('signal_type', 'engagement')
      .order('strength', { ascending: false })
      .limit(30);

    // 8b. Engagement aggregate rows — tells us how active this user actually is
    const { data: engagementSignals } = await supabase
      .from('user_dna_signals')
      .select('signal_value, source_count, sources')
      .eq('user_id', userId)
      .eq('signal_type', 'engagement');

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
      })) || [],
      behavioralSignals: dnaSignals?.map(s => ({
        type: s.signal_type,
        value: s.signal_value,
        strength: s.strength,
        sourceCount: s.source_count,
        sources: s.sources,
      })) || [],
      engagementProfile: Object.fromEntries(
        (engagementSignals ?? []).map((s: any) => [s.signal_value, s.source_count])
      ),
    };

    console.log('User profile compiled:', {
      hasDNA: !!userProfile.dnaProfile,
      highlightsCount: userProfile.highlights.length,
      consumptionCount: userProfile.recentConsumption.length,
      ratingsCount: userProfile.highlyRated.length,
      postsCount: userProfile.socialActivity.length,
      listsCount: userProfile.customListThemes.length,
      followedCreatorsCount: userProfile.followedCreators.length,
      behavioralSignalsCount: userProfile.behavioralSignals.length,
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

Behavioral DNA Signals (derived from ratings, trivia, tracking, polls — strongest signals first):
${userProfile.behavioralSignals.length > 0
  ? userProfile.behavioralSignals.slice(0, 15).map(s => {
      const src = s.sources ? Object.entries(s.sources).filter(([,v]) => (v as number) > 0).map(([k,v]) => `${k}:${v}`).join(', ') : '';
      return `- [${s.type}] ${s.value} — strength ${s.strength} (${src})`;
    }).join('\n')
  : 'None — run extract-dna-signals to populate'}

Engagement Profile (raw participation counts):
${Object.keys(userProfile.engagementProfile).length > 0
  ? Object.entries(userProfile.engagementProfile).map(([k, v]) => `- ${k}: ${v}`).join('\n')
  : 'No engagement data yet'}

TASK:
Generate 14-16 personalized entertainment recommendations based on ALL the data above. The Behavioral DNA Signals are the strongest indicators of taste — they are derived from actual behavior (what they rated highly, which trivia categories they answer, what they track). Weight signals with higher strength scores more heavily. If they follow specific directors, musicians, or authors, PRIORITIZE recommending new/recent work from those creators or similar artists.

CROSS-MEDIA IS THE GOAL — this is the most important instruction:
- Do NOT just recommend more of the same media type. Deliberately BRIDGE across media types based on the user's taste in their most-consumed type.
- If their strongest signals are movies/TV, recommend BOOKS, PODCASTS, and MUSIC that match those same themes, tones, or worlds (e.g. a true-crime fan who watches docs → a true-crime podcast; a sci-fi show lover → a sci-fi novel; someone obsessed with a director → a podcast that breaks down their films).
- Aim for a MIX: at least 4-5 recommendations should be a DIFFERENT media type than the user's dominant type. Books, podcasts, and music are first-class — not afterthoughts.
- In each "reason", explicitly name the show/movie/etc. that the cross-media pick is bridging FROM (e.g. "Because you loved Severance…").

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

      // Resolve every AI pick against the REAL media-search resolver.
      // This serves two purposes:
      //   1. Guarantees a real poster + external_id/source (no AI-invented image URLs).
      //   2. Acts as a hallucination filter — anything the AI made up won't resolve and gets dropped.
      console.log("Resolving recommendations via media-search...");
      const baseUrl = Deno.env.get('SUPABASE_URL') ?? '';
      const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

      // Map the AI's display type to the media-search `type` param.
      const normalizeType = (t: string): string => {
        const x = (t || '').toLowerCase();
        if (x.includes('tv') || x.includes('show') || x.includes('series')) return 'tv';
        if (x.includes('movie') || x.includes('film')) return 'movie';
        if (x.includes('book') || x.includes('novel')) return 'book';
        if (x.includes('podcast')) return 'podcast';
        if (x.includes('music') || x.includes('album') || x.includes('song')) return 'music';
        if (x.includes('game')) return 'game';
        return 'movie';
      };

      const resolveRec = async (rec: any) => {
        try {
          const mediaType = normalizeType(rec.type);
          // Disambiguate music/podcasts/books with the creator when available.
          const query = rec.creator && (mediaType === 'music' || mediaType === 'podcast' || mediaType === 'book')
            ? `${rec.title} ${rec.creator}`
            : rec.title;

          const ctrl = new AbortController();
          const timer = setTimeout(() => ctrl.abort(), 12000);
          let searchRes: Response;
          try {
            searchRes = await fetch(`${baseUrl}/functions/v1/media-search`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${serviceKey}`,
                'apikey': serviceKey,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({ query, type: mediaType }),
              signal: ctrl.signal
            });
          } finally {
            clearTimeout(timer);
          }

          if (!searchRes.ok) {
            console.warn(`media-search ${searchRes.status} for "${rec.title}" (${mediaType})`);
            return null;
          }

          const searchData = await searchRes.json();
          const results: any[] = searchData.results || [];
          // Only accept a match that has BOTH a real poster and a real external id.
          const match = results.find((r) => (r.poster_url || r.image) && r.external_id);
          if (!match) {
            console.log(`No resolvable match for "${rec.title}" (${mediaType}) — dropping`);
            return null;
          }

          const poster = match.poster_url || match.image;
          const resolvedType = (match.type || mediaType) as string;
          return {
            title: match.title || rec.title,
            type: resolvedType,
            media_type: resolvedType,
            creator: match.creator || rec.creator || '',
            reason: rec.reason || '',
            confidence: rec.confidence ?? null,
            year: match.year || rec.year || null,
            description: match.description || rec.reason || '',
            image_url: poster,
            external_id: String(match.external_id),
            external_source: match.external_source || ''
          };
        } catch (error) {
          console.error(`Error resolving "${rec.title}":`, error);
          return null;
        }
      };

      // Bounded concurrency — resolve in chunks so we don't fan out ~15 internal
      // calls (each hitting several external APIs) all at once.
      const allAiRecs = (aiRecommendations.recommendations || []) as any[];
      const resolved: any[] = [];
      const CHUNK_SIZE = 5;
      for (let i = 0; i < allAiRecs.length; i += CHUNK_SIZE) {
        const batch = allAiRecs.slice(i, i + CHUNK_SIZE);
        const settled = await Promise.all(batch.map(resolveRec));
        resolved.push(...settled);
      }
      const enrichedRecs = resolved.filter((r) => !!r && !!r.image_url && !!r.external_id);

      console.log(`Resolved ${enrichedRecs.length} of ${allAiRecs.length} recommendations with real posters`);

      // Minimum-quality guard: never clobber a good cache with too few/zero results.
      // If media-search was flaky and we resolved fewer than the floor while a
      // previous set exists, keep the old recommendations and retry sooner.
      const MIN_RECS = 4;
      const existingRecs = (existingCache?.recommendations?.recommendations || []) as any[];
      if (enrichedRecs.length < MIN_RECS && existingRecs.length > enrichedRecs.length) {
        console.warn(`Only ${enrichedRecs.length} recs resolved (floor ${MIN_RECS}); preserving previous ${existingRecs.length}`);
        const guardNow = new Date();
        await supabase
          .from('user_recommendations')
          .upsert({
            user_id: userId,
            status: 'ready',
            recommendations: existingCache?.recommendations || { recommendations: [] },
            stale_after: new Date(guardNow.getTime() + 60 * 60 * 1000).toISOString(), // retry in ~1h
            expires_at: new Date(guardNow.getTime() + 24 * 60 * 60 * 1000).toISOString(),
          }, {
            onConflict: 'user_id'
          });

        return new Response(JSON.stringify({
          success: true,
          message: 'Too few resolvable recommendations this run; kept previous set',
          count: existingRecs.length
        }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const recommendations = { recommendations: enrichedRecs };

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
