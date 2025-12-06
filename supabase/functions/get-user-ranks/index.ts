import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

serve(async (req) => {
  console.log("get-user-ranks function hit!", req.method, req.url);
  
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
    
    let appUser = null;
    if (user && !userError) {
      let { data: foundAppUser, error: appUserError } = await supabase
        .from('users')
        .select('id, email, user_name')
        .eq('email', user.email)
        .single();

      if (!appUserError) {
        appUser = foundAppUser;
      }
    }

    const { searchParams } = new URL(req.url);
    const targetUserId = searchParams.get('user_id') || appUser?.id;

    if (!targetUserId) {
      return new Response(JSON.stringify({ error: 'User ID required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const isOwnProfile = appUser?.id === targetUserId;

    let ranksQuery = supabaseAdmin
      .from('ranks')
      .select('*')
      .eq('user_id', targetUserId)
      .order('created_at', { ascending: false });

    if (!isOwnProfile) {
      ranksQuery = ranksQuery.eq('visibility', 'public');
    }

    const { data: ranks, error: ranksError } = await ranksQuery;

    if (ranksError) {
      console.error('Error fetching ranks:', ranksError);
      return new Response(JSON.stringify({
        error: 'Failed to fetch ranks: ' + ranksError.message
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const ranksWithItems = await Promise.all((ranks || []).map(async (rank) => {
      const { data: items, error: itemsError } = await supabaseAdmin
        .from('rank_items')
        .select('*')
        .eq('rank_id', rank.id)
        .order('position', { ascending: true });

      if (itemsError) {
        console.error('Error fetching rank items for rank', rank.id, itemsError);
        return { ...rank, items: [] };
      }

      return { ...rank, items: items || [] };
    }));

    console.log(`Returning ${ranksWithItems.length} ranks for user ${targetUserId}`);

    return new Response(JSON.stringify({ ranks: ranksWithItems }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Get user ranks error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
