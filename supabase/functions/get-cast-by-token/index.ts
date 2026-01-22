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
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    );

    const url = new URL(req.url);
    const token = url.searchParams.get('token');

    if (!token) {
      return new Response(JSON.stringify({ error: 'Token required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { data: cast, error } = await supabase
      .from('friend_casts')
      .select(`
        id,
        creator_pick_celeb_id,
        creator_pick_celeb_name,
        creator_pick_celeb_image,
        target_friend_name,
        status,
        counter_celeb_id,
        counter_celeb_name,
        counter_celeb_image,
        share_token,
        created_at,
        creator:users!friend_casts_creator_id_fkey(id, user_name, avatar_url),
        target:users!friend_casts_target_friend_id_fkey(id, user_name, avatar_url)
      `)
      .eq('share_token', token)
      .single();

    if (error || !cast) {
      return new Response(JSON.stringify({ error: 'Cast not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ cast }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Get cast by token error:', error);
    return new Response(JSON.stringify({ error: 'Failed to fetch cast' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
