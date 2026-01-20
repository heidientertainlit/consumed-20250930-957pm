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
    const authHeader = req.headers.get('Authorization');
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader || '' } } }
    );

    let userId: string | null = null;
    if (authHeader) {
      const { data: { user } } = await supabase.auth.getUser();
      userId = user?.id || null;
    }

    const { data: casts, error } = await supabase
      .from('friend_casts')
      .select(`
        *,
        creator:users!friend_casts_creator_id_fkey(id, user_name),
        target:users!friend_casts_target_friend_id_fkey(id, user_name),
        responses:friend_cast_responses(
          id,
          celeb_id,
          celeb_name,
          celeb_image,
          responder:users!friend_cast_responses_responder_id_fkey(id, user_name)
        )
      `)
      .eq('is_public', true)
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) {
      console.error('Fetch error:', error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ casts: casts || [] }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Get friend casts error:', error);
    return new Response(JSON.stringify({ error: 'Failed to fetch casts' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
