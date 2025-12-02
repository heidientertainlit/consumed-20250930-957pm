import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS'
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  const tmdbApiKey = Deno.env.get('TMDB_API_KEY') || '';
  
  const adminClient = createClient(supabaseUrl, supabaseServiceKey);

  try {
    console.log('Starting media image backfill...');
    
    if (!tmdbApiKey) {
      return new Response(JSON.stringify({ error: 'TMDB API key not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Find all social_posts with TMDB external_id but missing image_url
    const { data: postsToFix, error: fetchError } = await adminClient
      .from('social_posts')
      .select('id, media_title, media_type, media_external_id, media_external_source')
      .eq('media_external_source', 'tmdb')
      .not('media_external_id', 'is', null)
      .or('image_url.is.null,image_url.eq.')
      .limit(100);

    if (fetchError) {
      console.error('Error fetching posts:', fetchError);
      return new Response(JSON.stringify({ error: 'Failed to fetch posts', details: fetchError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`Found ${postsToFix?.length || 0} posts to fix`);

    if (!postsToFix || postsToFix.length === 0) {
      return new Response(JSON.stringify({ message: 'No posts need fixing', updated: 0 }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Group by external_id to minimize API calls
    const uniqueExternalIds = [...new Set(postsToFix.map(p => p.media_external_id))];
    console.log(`Unique TMDB IDs to fetch: ${uniqueExternalIds.length}`);

    // Fetch poster paths from TMDB
    const posterMap = new Map<string, string>();
    
    for (const externalId of uniqueExternalIds) {
      try {
        // First try as movie
        let response = await fetch(`https://api.themoviedb.org/3/movie/${externalId}?api_key=${tmdbApiKey}`);
        
        if (response.ok) {
          const data = await response.json();
          if (data.poster_path) {
            posterMap.set(externalId, `https://image.tmdb.org/t/p/w300${data.poster_path}`);
            console.log(`Found movie poster for ${externalId}: ${data.poster_path}`);
            continue;
          }
        }
        
        // Try as TV show
        response = await fetch(`https://api.themoviedb.org/3/tv/${externalId}?api_key=${tmdbApiKey}`);
        
        if (response.ok) {
          const data = await response.json();
          if (data.poster_path) {
            posterMap.set(externalId, `https://image.tmdb.org/t/p/w300${data.poster_path}`);
            console.log(`Found TV poster for ${externalId}: ${data.poster_path}`);
          }
        }
      } catch (apiError) {
        console.error(`Error fetching TMDB data for ${externalId}:`, apiError);
      }
    }

    console.log(`Successfully fetched ${posterMap.size} poster URLs`);

    // Update posts with poster URLs
    let updatedCount = 0;
    
    for (const post of postsToFix) {
      const posterUrl = posterMap.get(post.media_external_id);
      if (posterUrl) {
        const { error: updateError } = await adminClient
          .from('social_posts')
          .update({ image_url: posterUrl })
          .eq('id', post.id);

        if (updateError) {
          console.error(`Failed to update post ${post.id}:`, updateError);
        } else {
          updatedCount++;
          console.log(`Updated post ${post.id} with poster URL`);
        }
      }
    }

    return new Response(JSON.stringify({ 
      message: 'Backfill completed', 
      found: postsToFix.length,
      fetched: posterMap.size,
      updated: updatedCount 
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Backfill error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error', details: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
