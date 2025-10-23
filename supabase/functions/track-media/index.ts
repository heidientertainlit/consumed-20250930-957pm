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

    console.log('Auth user:', user.email);

    // Look up app user by email, CREATE if doesn't exist
    let { data: appUser, error: appUserError } = await supabase
      .from('users')
      .select('id, email, user_name')
      .eq('email', user.email)
      .single();

    console.log('User lookup result:', { appUser, appUserError });

    // If user doesn't exist, create them
    if (appUserError && appUserError.code === 'PGRST116') {
      console.log('User not found, creating new user:', user.email);
      
      // Use service role to bypass RLS for user creation
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

      // Create personal system lists for new user (idempotent)
      const systemLists = [
        'Currently',
        'Queue',
        'Finished',
        'Did Not Finish',
        'Favorites'
      ];

      // Use individual inserts with error handling for idempotency
      for (const listTitle of systemLists) {
        const { error: listError } = await supabaseAdmin
          .from('lists')
          .insert({
            user_id: newUser.id,
            title: listTitle,
            is_default: true,
            is_private: false
          })
          .select('id, title, is_default, is_private')
          .maybeSingle();
        
        // Ignore duplicate key errors (23505), fail on others
        if (listError && listError.code !== '23505') {
          console.error(`Failed to create ${listTitle} list:`, listError);
          return new Response(JSON.stringify({ 
            error: `Failed to create system list ${listTitle}: ${listError.message}` 
          }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
      }
      console.log('Created personal system lists for new user');
    } else if (appUserError) {
      console.error('User lookup error:', appUserError);
      return new Response(JSON.stringify({ 
        error: 'User lookup failed: ' + appUserError.message 
      }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Parse the request body
    const requestBody = await req.json();
    const { media, rating, review, listType } = requestBody;
    const { title, mediaType, creator, imageUrl, externalId, externalSource } = media || {};

    let targetList = null;

    if (listType && listType !== 'all') {
      // Map listType to actual list title
      const listTitleMapping = {
        'currently': 'Currently',
        'finished': 'Finished', 
        'dnf': 'Did Not Finish',
        'queue': 'Queue',
        'favorites': 'Favorites'
      };

      const listTitle = listTitleMapping[listType] || 'Currently';
      console.log('Looking for personal list with title:', listTitle);

      // Find USER'S personal list by title (is_default = true means it's a system list)
      const { data: systemList, error: listError } = await supabase
        .from('lists')
        .select('id, title')
        .eq('user_id', appUser.id)
        .eq('title', listTitle)
        .eq('is_default', true)
        .single();

      console.log('System list lookup result:', { systemList, listError });

      if (listError || !systemList) {
        console.error('System list not found:', listError);
        return new Response(JSON.stringify({
          error: `System list "${listTitle}" not found. Available lists should be: Currently, Queue, Finished, Did Not Finish, Favorites`
        }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      targetList = systemList;
    }

    // Insert the media item with correct Supabase column names
    const { data: mediaItem, error: mediaError } = await supabase
      .from('list_items')
      .insert({
        list_id: targetList?.id || null,
        user_id: appUser.id,
        title: title || 'Untitled',
        type: mediaType || 'mixed',
        media_type: mediaType || 'mixed', 
        creator: creator || '',
        image_url: imageUrl || null,
        notes: review || null,
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

    console.log('Successfully added media item:', mediaItem);

    // Also save rating to unified media_ratings table for Entertainment DNA
    if (rating && externalId && externalSource && title && mediaType) {
      console.log('Saving rating to media_ratings table...');
      
      // Check if rating already exists
      const { data: existingRating } = await supabase
        .from('media_ratings')
        .select('id')
        .eq('user_id', appUser.id)
        .eq('media_external_id', externalId)
        .eq('media_external_source', externalSource)
        .maybeSingle();

      if (existingRating) {
        // Update existing rating
        const { error: updateError } = await supabase
          .from('media_ratings')
          .update({
            rating,
            media_title: title,
            media_type: mediaType,
            updated_at: new Date().toISOString()
          })
          .eq('id', existingRating.id);

        if (updateError) {
          console.error('Failed to update media_ratings:', updateError);
        } else {
          console.log('Updated existing rating in media_ratings');
        }
      } else {
        // Create new rating
        const { error: insertError } = await supabase
          .from('media_ratings')
          .insert({
            user_id: appUser.id,
            media_external_id: externalId,
            media_external_source: externalSource,
            media_title: title,
            media_type: mediaType,
            rating
          });

        if (insertError) {
          console.error('Failed to insert into media_ratings:', insertError);
        } else {
          console.log('Created new rating in media_ratings');
        }
      }
    }

    return new Response(JSON.stringify({
      success: true,
      data: mediaItem,
      listTitle: targetList?.title || 'All'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Track media error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
