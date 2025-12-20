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
    const { media, rating, review, customListId } = requestBody;
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

    // Insert the media item with core columns only
    const { data: mediaItem, error: mediaError } = await supabase
      .from('list_items')
      .insert({
        list_id: customList.id,
        user_id: appUser.id,
        title: title || 'Untitled',
        media_type: mediaType || 'mixed',
        creator: creator || '',
        image_url: imageUrl || null,
        external_id: externalId || null,
        external_source: externalSource || null
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

    // Create a social post for this addition
    if (mediaItem) {
      try {
        // Determine post type based on whether there's a rating
        const postType = rating ? 'rate-review' : 'add-to-list';
        
        const { error: postError } = await supabase
          .from('social_posts')
          .insert({
            user_id: appUser.id,
            post_type: postType,
            list_id: customList.id,
            content: rating ? `Rated ${title}` : `Added ${title} to ${customList.title}`,
            media_title: title,
            media_type: mediaType,
            media_creator: creator,
            image_url: imageUrl,
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
