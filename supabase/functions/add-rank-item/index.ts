import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

serve(async (req) => {
  console.log("add-rank-item function hit!", req.method);
  
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

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
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
      .select('id, email, user_name')
      .eq('email', user.email)
      .single();

    if (appUserError) {
      return new Response(JSON.stringify({ 
        error: 'User lookup failed: ' + appUserError.message 
      }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const requestBody = await req.json();
    const { rankId, media, position, notes } = requestBody;
    const { title, mediaType, creator, imageUrl, externalId, externalSource } = media || {};

    if (!rankId) {
      return new Response(JSON.stringify({ error: 'rankId is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (!title) {
      return new Response(JSON.stringify({ error: 'Media title is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { data: rank, error: rankError } = await supabaseAdmin
      .from('ranks')
      .select('id, title, user_id, max_items')
      .eq('id', rankId)
      .single();

    if (rankError || !rank) {
      console.error('Rank not found:', rankError);
      return new Response(JSON.stringify({
        error: 'Rank not found'
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (rank.user_id !== appUser.id) {
      return new Response(JSON.stringify({
        error: 'You do not have permission to add items to this rank'
      }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { data: existingItems, error: countError } = await supabaseAdmin
      .from('rank_items')
      .select('id, position')
      .eq('rank_id', rankId)
      .order('position', { ascending: false });

    if (countError) {
      console.error('Error counting items:', countError);
    }

    const itemCount = existingItems?.length || 0;
    if (itemCount >= (rank.max_items || 10)) {
      return new Response(JSON.stringify({
        error: `This rank is limited to ${rank.max_items || 10} items`
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const newPosition = position || (itemCount + 1);

    if (position && existingItems && position <= itemCount) {
      const itemsToShift = existingItems.filter(item => item.position >= position);
      for (const item of itemsToShift) {
        await supabaseAdmin
          .from('rank_items')
          .update({ position: item.position + 1 })
          .eq('id', item.id);
      }
    }

    const { data: rankItem, error: insertError } = await supabaseAdmin
      .from('rank_items')
      .insert({
        rank_id: rankId,
        user_id: appUser.id,
        position: newPosition,
        title: title,
        media_type: mediaType || null,
        creator: creator || null,
        image_url: imageUrl || null,
        external_id: externalId || null,
        external_source: externalSource || null,
        notes: notes || null
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error adding rank item:', insertError);
      return new Response(JSON.stringify({
        error: 'Failed to add item: ' + insertError.message
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log('Successfully added item to rank:', rank.title, 'at position', newPosition);

    return new Response(JSON.stringify({
      success: true,
      data: rankItem,
      rankTitle: rank.title
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Add rank item error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
