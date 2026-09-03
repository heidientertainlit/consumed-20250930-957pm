import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { resolveCanonicalMedia } from '../_shared/canonical-media.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false }
});

// Helper function to fetch poster URL from TMDB when not provided
async function fetchTmdbPosterUrl(externalId: string | null, externalSource: string | null, mediaType?: string, title?: string): Promise<string | null> {
  const tmdbApiKey = Deno.env.get('TMDB_API_KEY');
  if (!tmdbApiKey) {
    console.log('TMDB_API_KEY not available for poster fetch');
    return null;
  }
  
  try {
    const isTmdbSource = !externalSource || externalSource === 'tmdb' || externalSource === 'movie' || externalSource === 'tv';
    const tryMovie = !mediaType || mediaType === 'movie';
    const tryTv = !mediaType || mediaType === 'tv';
    
    // Try by external ID first if we have one
    if (externalId && isTmdbSource) {
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
    }
    
    // Fallback: search by title if no externalId or ID lookup failed
    if (title && isTmdbSource) {
      console.log('TMDB title search for:', title);
      
      if (tryTv) {
        const response = await fetch(`https://api.themoviedb.org/3/search/tv?api_key=${tmdbApiKey}&query=${encodeURIComponent(title)}&page=1`);
        if (response.ok) {
          const data = await response.json();
          if (data.results?.[0]?.poster_path) {
            console.log('Found TV poster for:', title);
            return `https://image.tmdb.org/t/p/w300${data.results[0].poster_path}`;
          }
        }
      }
      
      if (tryMovie) {
        const response = await fetch(`https://api.themoviedb.org/3/search/movie?api_key=${tmdbApiKey}&query=${encodeURIComponent(title)}&page=1`);
        if (response.ok) {
          const data = await response.json();
          if (data.results?.[0]?.poster_path) {
            console.log('Found movie poster for:', title);
            return `https://image.tmdb.org/t/p/w300${data.results[0].poster_path}`;
          }
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
      supabaseUrl, 
      Deno.env.get('SUPABASE_ANON_KEY') ?? '', 
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization') ?? '' }
        }
      }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    let { data: appUser, error: appUserError } = await adminClient
      .from('users')
      .select('id, email, user_name, display_name')
      .eq('id', user.id)
      .single();

    if (appUserError && appUserError.code === 'PGRST116') {
      const { data: newUser, error: createError } = await adminClient
        .from('users')
        .insert({
          id: user.id,
          email: user.email,
          user_name: user.user_metadata?.user_name || user.email?.split('@')[0] || 'user',
          display_name: user.user_metadata?.display_name || user.email?.split('@')[0] || 'User',
          first_name: user.user_metadata?.first_name || '',
          last_name: user.user_metadata?.last_name || ''
        })
        .select('id, email, user_name, display_name')
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

    const requestBody = await req.json();
    const { 
      list_id, 
      media_title, 
      media_type,
      media_subtype,
      media_creator, 
      media_image_url,
      media_external_id,
      media_external_source,
      season_number,
      episode_number,
      episode_title,
      rating,
      review,
      skip_social_post,
      series_name
    } = requestBody;

    console.log('add-media-to-list request:', { 
      list_id, 
      media_title, 
      media_type,
      media_image_url,
      media_external_id,
      media_external_source,
      appUserId: appUser?.id
    });

    if (!list_id) {
      return new Response(JSON.stringify({
        error: 'list_id is required'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { data: list, error: listError } = await supabase
      .from('lists')
      .select('id, title, user_id')
      .eq('id', list_id)
      .single();

    if (listError || !list) {
      console.error('List lookup error:', listError);
      return new Response(JSON.stringify({
        error: 'List not found'
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (list.user_id !== appUser?.id) {
      const { data: collab } = await supabase
        .from('list_collaborators')
        .select('id')
        .eq('list_id', list_id)
        .eq('user_id', appUser?.id)
        .single();
      
      if (!collab) {
        return new Response(JSON.stringify({
          error: 'You do not have permission to add to this list'
        }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    let canonicalMediaId: string | null = null;
    if (media_external_id && media_external_source && media_title && media_type) {
      try {
        canonicalMediaId = (await resolveCanonicalMedia(adminClient, {
          externalId: media_external_id,
          externalSource: media_external_source,
          title: media_title,
          mediaType: media_type,
          creator: media_creator,
          year: requestBody.media_year || requestBody.year || requestBody.release_year,
        })).canonicalMediaId;
      } catch (error) {
        console.error('Canonical resolution failed; preserving provider list write:', error);
      }
    }

    let existingItem: any = null;
    if (canonicalMediaId) {
      const canonical = await adminClient.from('list_items').select()
        .eq('user_id', appUser?.id).eq('list_id', list_id)
        .eq('canonical_media_id', canonicalMediaId).maybeSingle();
      existingItem = canonical.data;
    }
    if (!existingItem) {
      const legacy = await adminClient.from('list_items').select()
        .eq('user_id', appUser?.id).eq('list_id', list_id)
        .eq('external_id', media_external_id)
        .eq('external_source', media_external_source || 'tmdb')
        .maybeSingle();
      existingItem = legacy.data;
      if (existingItem && canonicalMediaId && existingItem.canonical_media_id !== canonicalMediaId) {
        const linked = await adminClient.from('list_items')
          .update({ canonical_media_id: canonicalMediaId }).eq('id', existingItem.id).select().maybeSingle();
        if (linked.data) existingItem = linked.data;
      }
    }

    if (existingItem) {
      return new Response(JSON.stringify({
        success: true,
        message: 'Item already exists in this list',
        data: existingItem,
        listTitle: list.title
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // CRITICAL: Ensure we have a poster image URL before inserting
    // This prevents the "random stock image" bug in the activity feed
    let finalImageUrl = media_image_url || null;
    if (!finalImageUrl && media_external_source !== 'youtube') {
      console.log('No image URL provided, fetching from TMDB for:', media_title);
      finalImageUrl = await fetchTmdbPosterUrl(media_external_id, media_external_source, media_type, media_title);
      if (finalImageUrl) {
        console.log('Fetched poster URL:', finalImageUrl);
      } else {
        console.log('Could not fetch poster URL for:', media_title);
      }
    }

    const listItemPayload = {
        list_id: list_id,
        user_id: appUser?.id,
        title: media_title || 'Untitled',
        media_type: media_type || null,
        creator: media_creator || '',
        image_url: finalImageUrl,
        external_id: media_external_id || null,
        external_source: media_external_source || 'tmdb',
        ...(canonicalMediaId ? { canonical_media_id: canonicalMediaId } : {}),
        ...(media_subtype ? { media_subtype } : {}),
        ...(series_name ? { series_name } : {})
      };
    const listItemWrite = canonicalMediaId
      ? adminClient.from('list_items').upsert(listItemPayload, {
          onConflict: 'user_id,list_id,canonical_media_id',
        })
      : adminClient.from('list_items').insert(listItemPayload);
    const { data: mediaItem, error: mediaError } = await listItemWrite
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

    console.log('Successfully added media to list:', list.title);

    let socialPostCreated = false;
    let socialPostError = null;
    
    // Skip social post creation if flag is set (e.g., when inline-post already created the post)
    if (mediaItem && !skip_social_post) {
      try {
        const postType = rating ? 'rate-review' : 'added_to_list';
        const content = rating 
          ? `Rated ${media_title}` 
          : `Added ${media_title} to ${list.title}`;
        
        // Match the exact structure used by inline-post (which works)
        // Use finalImageUrl which was fetched if missing
        const postData = {
          user_id: appUser?.id,
          content: content,
          post_type: postType,
          rating: rating || null,
          media_title: media_title || null,
          media_type: media_type || null,
          media_creator: media_creator || null,
          image_url: finalImageUrl,
          media_external_id: media_external_id || null,
          media_external_source: media_external_source || null,
          ...(canonicalMediaId ? { canonical_media_id: canonicalMediaId } : {}),
          visibility: 'public',
          contains_spoilers: false,
          list_id: list_id // Store list_id for list preview in feed
        };
        
        console.log('Creating social post with data (matching inline-post):', postData);
        
        const { data: createdPost, error: postError } = await adminClient
          .from('social_posts')
          .insert(postData)
          .select()
          .single();
        
        if (postError) {
          console.error('Failed to create social post:', postError);
          socialPostError = postError.message;
        } else {
          console.log('Created social post for list addition:', createdPost);
          socialPostCreated = true;
        }
      } catch (postCreateError) {
        console.error('Error creating social post:', postCreateError);
        socialPostError = postCreateError.message;
      }
    }

    return new Response(JSON.stringify({
      success: true,
      data: mediaItem,
      listTitle: list.title,
      socialPostCreated,
      socialPostError
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Add media to list error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
