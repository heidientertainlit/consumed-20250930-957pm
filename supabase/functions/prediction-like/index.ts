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
    console.log('prediction-like called, method:', req.method);
    
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '', 
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization') }
        }
      }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    console.log('Auth result:', { userId: user?.id, error: userError?.message });
    
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const body = await req.json();
    const { pool_id } = body;
    console.log('Request body:', { pool_id });

    if (!pool_id) {
      return new Response(JSON.stringify({ error: 'Missing pool_id' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Use service role for all database operations
    const serviceSupabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '', 
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '', 
    );

    if (req.method === 'POST') {
      console.log('POST: Adding like for pool_id:', pool_id, 'user_id:', user.id);
      
      // Add like - but first check if already exists
      const { data: existingLike, error: checkError } = await serviceSupabase
        .from('prediction_likes')
        .select('id')
        .eq('pool_id', pool_id)
        .eq('user_id', user.id)
        .single();

      console.log('Existing like check:', { existingLike, checkError: checkError?.message });

      if (existingLike) {
        // Already liked - return success (idempotent)
        console.log('Already liked, returning success');
        return new Response(JSON.stringify({ success: true, already_liked: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const { error } = await serviceSupabase
        .from('prediction_likes')
        .insert({ pool_id: pool_id, user_id: user.id });

      console.log('Insert result:', { error: error?.message });

      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Increment likes_count on the prediction pool
      const { data: pool } = await serviceSupabase
        .from('prediction_pools')
        .select('likes_count')
        .eq('id', pool_id)
        .single();

      // Increment likes_count
      if (pool) {
        await serviceSupabase
          .from('prediction_pools')
          .update({ likes_count: (pool.likes_count || 0) + 1 })
          .eq('id', pool_id);
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (req.method === 'DELETE') {
      // Check if like exists first
      const { data: existingLike } = await serviceSupabase
        .from('prediction_likes')
        .select('id')
        .eq('pool_id', pool_id)
        .eq('user_id', user.id)
        .single();

      if (!existingLike) {
        // Not liked - return success (idempotent)
        return new Response(JSON.stringify({ success: true, not_liked: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Remove like
      const { error } = await serviceSupabase
        .from('prediction_likes')
        .delete()
        .eq('pool_id', pool_id)
        .eq('user_id', user.id);

      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Decrement likes_count on the prediction pool
      const { data: pool } = await serviceSupabase
        .from('prediction_pools')
        .select('likes_count')
        .eq('id', pool_id)
        .single();

      if (pool && pool.likes_count > 0) {
        await serviceSupabase
          .from('prediction_pools')
          .update({ likes_count: pool.likes_count - 1 })
          .eq('id', pool_id);
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
