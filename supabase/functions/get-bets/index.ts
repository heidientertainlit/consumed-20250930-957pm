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
          headers: { Authorization: req.headers.get('Authorization')! }
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

    const { data: appUser, error: appUserError } = await supabase
      .from('users')
      .select('id, user_name')
      .eq('email', user.email)
      .single();

    if (appUserError || !appUser) {
      return new Response(JSON.stringify({ error: 'User not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const url = new URL(req.url);
    const type = url.searchParams.get('type') || 'placed';

    let bets = [];

    if (type === 'placed') {
      const { data, error } = await supabaseAdmin
        .from('bets')
        .select('*')
        .eq('user_id', appUser.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) {
        console.error('Error fetching placed bets:', error);
        throw error;
      }
      
      // Fetch target user info separately
      const betsWithUsers = await Promise.all((data || []).map(async (bet) => {
        const { data: targetUser } = await supabaseAdmin
          .from('users')
          .select('user_name, display_name')
          .eq('id', bet.target_user_id)
          .single();
        return { ...bet, target_user: targetUser };
      }));
      bets = betsWithUsers;
    } else if (type === 'received') {
      const { data, error } = await supabaseAdmin
        .from('bets')
        .select('*')
        .eq('target_user_id', appUser.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) {
        console.error('Error fetching received bets:', error);
        throw error;
      }
      
      // Fetch bettor info separately
      const betsWithUsers = await Promise.all((data || []).map(async (bet) => {
        const { data: bettor } = await supabaseAdmin
          .from('users')
          .select('user_name, display_name')
          .eq('id', bet.user_id)
          .single();
        return { ...bet, bettor };
      }));
      bets = betsWithUsers;
    }

    return new Response(JSON.stringify({ 
      bets,
      user_id: appUser.id
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(JSON.stringify({ 
      error: 'Internal server error: ' + error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
