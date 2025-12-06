import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

serve(async (req) => {
  console.log("reorder-rank-items function hit!", req.method);
  
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
    const { rankId, itemOrders } = requestBody;

    if (!rankId) {
      return new Response(JSON.stringify({ error: 'rankId is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (!itemOrders || !Array.isArray(itemOrders)) {
      return new Response(JSON.stringify({ 
        error: 'itemOrders array is required with {itemId, position} objects' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { data: rank, error: rankError } = await supabaseAdmin
      .from('ranks')
      .select('id, title, user_id')
      .eq('id', rankId)
      .single();

    if (rankError || !rank) {
      return new Response(JSON.stringify({ error: 'Rank not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (rank.user_id !== appUser.id) {
      return new Response(JSON.stringify({
        error: 'You do not have permission to reorder items in this rank'
      }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const updatePromises = itemOrders.map(({ itemId, position }) => 
      supabaseAdmin
        .from('rank_items')
        .update({ position, updated_at: new Date().toISOString() })
        .eq('id', itemId)
        .eq('rank_id', rankId)
    );

    const results = await Promise.all(updatePromises);

    const errors = results.filter(r => r.error);
    if (errors.length > 0) {
      console.error('Some reorder operations failed:', errors.map(e => e.error));
      return new Response(JSON.stringify({
        error: 'Some items failed to reorder',
        details: errors.map(e => e.error?.message)
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    await supabaseAdmin
      .from('ranks')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', rankId);

    console.log('Successfully reordered items in rank:', rank.title);

    const { data: updatedItems, error: fetchError } = await supabaseAdmin
      .from('rank_items')
      .select('*')
      .eq('rank_id', rankId)
      .order('position', { ascending: true });

    return new Response(JSON.stringify({
      success: true,
      data: updatedItems || []
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Reorder rank items error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
