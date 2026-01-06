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
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const authHeader = req.headers.get('Authorization');
    let userId = null;
    if (authHeader) {
      const token = authHeader.replace('Bearer ', '');
      const { data: { user } } = await supabaseAdmin.auth.getUser(token);
      userId = user?.id;
    }

    const { searchParams } = new URL(req.url);
    const category = searchParams.get('category');
    const genre = searchParams.get('genre');
    const search = searchParams.get('search');

    let query = supabaseAdmin
      .from('prediction_pools')
      .select('*')
      .eq('status', 'open')
      .eq('type', 'trivia');

    if (category) {
      query = query.eq('category', category);
    }

    if (search) {
      query = query.ilike('title', `%${search}%`);
    }

    const { data: pools, error } = await query.order('created_at', { ascending: false });

    if (error) throw error;

    // Enhance pools with origin info
    const enhancedPools = (pools || []).map(pool => ({
      ...pool,
      isConsumed: pool.id?.startsWith('consumed-trivia-') || pool.origin_type === 'consumed',
    }));

    return new Response(JSON.stringify({ trivia: enhancedPools }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
