import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

// Helper function to fetch poster URL from TMDB when not provided
async function fetchTmdbPosterUrl(externalId: string | null, externalSource: string | null, mediaType?: string): Promise<string | null> {
  if (!externalId || (externalSource !== 'tmdb' && externalSource !== 'movie' && externalSource !== 'tv')) return null;
  
  const tmdbApiKey = Deno.env.get('TMDB_API_KEY');
  if (!tmdbApiKey) return null;
  
  try {
    const tryMovie = !mediaType || mediaType === 'movie';
    const tryTv = !mediaType || mediaType === 'tv';
    
    if (tryMovie) {
      const response = await fetch(`https://api.themoviedb.org/3/movie/${externalId}?api_key=${tmdbApiKey}`);
      if (response.ok) {
        const data = await response.json();
        if (data.poster_path) {
          return `https://image.tmdb.org/t/p/w300${data.poster_path}`;
        }
      }
    }
    
    if (tryTv) {
      const response = await fetch(`https://api.themoviedb.org/3/tv/${externalId}?api_key=${tmdbApiKey}`);
      if (response.ok) {
        const data = await response.json();
        if (data.poster_path) {
          return `https://image.tmdb.org/t/p/w300${data.poster_path}`;
        }
      }
    }
  } catch (error) {
    console.error('Error fetching TMDB poster:', error);
  }
  
  return null;
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

    // Look up app user by email
    let { data: appUser, error: appUserError } = await supabase
      .from('users')
      .select('id, email, user_name')
      .eq('email', user.email)
      .single();

    // Auto-create user if doesn't exist
    if (appUserError && appUserError.code === 'PGRST116') {
      const { data: newUser, error: createError } = await supabase
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
        return new Response(JSON.stringify({ 
          error: 'Failed to create user: ' + createError.message 
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      
      appUser = newUser;
    } else if (appUserError) {
      return new Response(JSON.stringify({ 
        error: 'User lookup failed: ' + appUserError.message 
      }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Parse request
    const requestBody = await req.json();
    const { media, rating, review, customListId, skip_social_post, dnf_reason, dnf_other_reason, rewatchCount } = requestBody;
    const { title, mediaType, mediaSubtype, creator, imageUrl, externalId, externalSource, seasonNumber, episodeNumber, episodeTitle } = media || {};

    if (!customListId) {
      return new Response(JSON.stringify({
        error: 'customListId is required'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Verify the custom list exists and belongs to the user
    const { data: customList, error: listError } = await supabase
      .from('lists')
      .select('id, title')
      .eq('id', customListId)
      .eq('user_id', appUser.id)
      .single();

    if (listError || !customList) {
      console.error('Custom list not found or unauthorized:', listError);
      return new Response(JSON.stringify({
        error: 'Custom list not found or you do not have permission to add to it'
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // CRITICAL: Ensure we have a poster image URL before inserting
    // This prevents the "random stock image" bug in the activity feed
    let finalImageUrl = imageUrl || null;
    if (!finalImageUrl) {
      console.log('No image URL provided, fetching from TMDB for:', title);
      finalImageUrl = await fetchTmdbPosterUrl(externalId, externalSource, mediaType);
      if (finalImageUrl) {
        console.log('Fetched poster URL:', finalImageUrl);
      } else {
        console.log('Could not fetch poster URL for:', title);
      }
    }

    // Insert the media item with core columns only
    const { data: mediaItem, error: mediaError } = await supabase
      .from('list_items')
      .insert({
        list_id: customList.id,
        user_id: appUser.id,
        title: title || 'Untitled',
        media_type: mediaType || 'mixed',
        creator: creator || '',
        image_url: finalImageUrl,
        external_id: externalId || null,
        external_source: externalSource || null,
        rewatch_count: rewatchCount || 1
      })
      .select()
      .single();

    if (mediaError) {
      console.error('Error adding media item:', mediaError);
      return new Response(JSON.stringify({
        error: 'Failed to add media item: ' + mediaError.message
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log('Successfully added media to custom list:', customList.title);

    // Save DNF reason if provided (for "Did Not Finish" lists)
    if (dnf_reason && dnf_reason !== 'skipped' && mediaItem) {
      try {
        const { error: dnfError } = await supabase
          .from('dnf_reasons')
          .insert({
            user_id: appUser.id,
            list_item_id: mediaItem.id,
            media_external_id: externalId || null,
            media_external_source: externalSource || null,
            media_title: title || null,
            media_type: mediaType || null,
            reason: dnf_reason,
            other_reason: dnf_other_reason || null
          });
        
        if (dnfError) {
          console.error('Failed to save DNF reason:', dnfError);
        } else {
          console.log('Saved DNF reason:', dnf_reason);
        }
      } catch (dnfSaveError) {
        console.error('Error saving DNF reason:', dnfSaveError);
      }
    }

    // Create a social post for this addition (skip if caller will handle it, e.g. when rating is also being added)
    if (mediaItem && !skip_social_post) {
      try {
        // Determine post type based on rewatch count and rating
        const isRewatch = rewatchCount && rewatchCount > 1;
        const postType = isRewatch ? 'rewatch' : (rating ? 'rate-review' : 'add-to-list');
        
        // Format ordinal suffix for rewatch count
        const getOrdinalSuffix = (n: number): string => {
          const s = ["th", "st", "nd", "rd"];
          const v = n % 100;
          return n + (s[(v - 20) % 10] || s[v] || s[0]);
        };
        
        // Generate content based on post type
        let content: string;
        if (isRewatch) {
          content = `is consuming ${title} for the ${getOrdinalSuffix(rewatchCount)} time`;
        } else if (rating) {
          content = `Rated ${title}`;
        } else {
          content = `Added ${title} to ${customList.title}`;
        }
        
        // Use finalImageUrl from earlier fetch (already populated before list_items insert)
        const { error: postError } = await supabase
          .from('social_posts')
          .insert({
            user_id: appUser.id,
            post_type: postType,
            list_id: customList.id,
            content,
            media_title: title,
            media_type: mediaType,
            media_creator: creator,
            image_url: finalImageUrl,
            media_external_id: externalId,
            media_external_source: externalSource,
            rating: rating || null
          });
        
        if (postError) {
          console.error('Failed to create social post:', postError);
          // Don't fail the whole request if post creation fails
        } else {
          console.log('Created social post for custom list addition with post_type:', postType);
        }
      } catch (postCreateError) {
        console.error('Error creating social post:', postCreateError);
      }
    } else if (skip_social_post) {
      console.log('Skipping social post creation (skip_social_post=true)');
    }

    return new Response(JSON.stringify({
      success: true,
      data: mediaItem,
      listTitle: customList.title
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Add to custom list error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
