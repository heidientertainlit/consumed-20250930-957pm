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
      .select('id, email, user_name')  // FIXED: using user_name instead of username
      .eq('email', user.email)
      .single();

    console.log('User lookup result:', { appUser, appUserError });

    // If user doesn't exist, create them
    if (appUserError && appUserError.code === 'PGRST116') {
      console.log('User not found, creating new user:', user.email);
      const { data: newUser, error: createError } = await supabase
        .from('users')
        .insert({
          id: user.id,
          email: user.email,
          user_name: user.email.split('@')[0] || 'user'  // FIXED: using user_name
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

    // Parse the request body
    const requestBody = await req.json();
    const { media, rating, review, listType } = requestBody;
    const { title, mediaType, creator, imageUrl } = media || {};

    let targetList = null;

    if (listType && listType !== 'all') {
      // Map listType to actual list title
      const listTitleMapping = {
        'currently': 'Currently',
        'finished': 'Finished', 
        'dnf': 'Did Not Finish',
        'queue': 'Queue'
      };

      const listTitle = listTitleMapping[listType] || 'Currently';
      console.log('Looking for system list with title:', listTitle);

      // Find SYSTEM list by title (user_id IS NULL)
      const { data: systemList, error: listError } = await supabase
        .from('lists')
        .select('id, title')
        .is('user_id', null)
        .eq('title', listTitle)
        .single();

      console.log('System list lookup result:', { systemList, listError });

      if (listError || !systemList) {
        console.error('System list not found:', listError);
        return new Response(JSON.stringify({
          error: `System list "${listTitle}" not found. Available lists should be: Currently, Queue, Finished, Did Not Finish`
        }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      targetList = systemList;
    }

    // Insert the media item (use notes instead of review, let added_at default)
    const { data: mediaItem, error: mediaError } = await supabase
      .from('list_items')
      .insert({
        list_id: targetList?.id || null,
        user_id: appUser.id,
        title: title || 'Untitled',
        media_type: mediaType || 'mixed',
        creator: creator || '',
        image_url: imageUrl || null
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

    return new Response(JSON.stringify({
      success: true,
      data: mediaItem
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