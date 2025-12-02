import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false }
});

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

    let { data: appUser, error: appUserError } = await supabase
      .from('users')
      .select('id, email, user_name, display_name')
      .eq('email', user.email)
      .single();

    if (appUserError && appUserError.code === 'PGRST116') {
      const { data: newUser, error: createError } = await supabase
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
      media_creator, 
      media_image_url,
      media_external_id,
      media_external_source,
      rating,
      review
    } = requestBody;

    console.log('add-media-to-list request:', { list_id, media_title, media_type });

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

    const { data: existingItem } = await supabase
      .from('list_items')
      .select('id')
      .eq('list_id', list_id)
      .eq('external_id', media_external_id)
      .eq('external_source', media_external_source || 'tmdb')
      .single();

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

    const { data: mediaItem, error: mediaError } = await adminClient
      .from('list_items')
      .insert({
        list_id: list_id,
        user_id: appUser?.id,
        title: media_title || 'Untitled',
        media_type: media_type || 'mixed',
        creator: media_creator || '',
        image_url: media_image_url || null,
        notes: review || null,
        external_id: media_external_id || null,
        external_source: media_external_source || 'tmdb'
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

    console.log('Successfully added media to list:', list.title);

    if (mediaItem) {
      try {
        const postType = rating ? 'rate-review' : 'added_to_list';
        const content = rating 
          ? `Rated ${media_title}` 
          : '';
        
        const { error: postError } = await adminClient
          .from('social_posts')
          .insert({
            user_id: appUser?.id,
            post_type: postType,
            list_id: list.id,
            content: content,
            media_title: media_title,
            media_type: media_type,
            media_creator: media_creator,
            image_url: media_image_url,
            media_external_id: media_external_id,
            media_external_source: media_external_source,
            rating: rating || null
          });
        
        if (postError) {
          console.error('Failed to create social post:', postError);
        } else {
          console.log('Created social post for list addition with post_type:', postType);
        }
      } catch (postCreateError) {
        console.error('Error creating social post:', postCreateError);
      }
    }

    return new Response(JSON.stringify({
      success: true,
      data: mediaItem,
      listTitle: list.title
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
