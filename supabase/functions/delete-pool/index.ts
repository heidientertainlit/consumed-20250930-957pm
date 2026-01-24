import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'OPTIONS, POST, DELETE'
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'No authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { pool_id } = await req.json();

    if (!pool_id) {
      return new Response(JSON.stringify({ error: 'Pool ID is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const serviceSupabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: appUser } = await serviceSupabase
      .from('users')
      .select('id')
      .eq('email', user.email)
      .single();

    if (!appUser) {
      return new Response(JSON.stringify({ error: 'User not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { data: pool } = await serviceSupabase
      .from('pools')
      .select('id, host_id')
      .eq('id', pool_id)
      .single();

    if (!pool) {
      return new Response(JSON.stringify({ error: 'Pool not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (pool.host_id !== appUser.id) {
      return new Response(JSON.stringify({ error: 'Only the host can delete this pool' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // First get all prompt IDs for this pool
    const { data: prompts } = await serviceSupabase
      .from('pool_prompts')
      .select('id')
      .eq('pool_id', pool_id);
    
    const promptIds = prompts?.map((p: { id: string }) => p.id) || [];
    
    // Delete answers for those prompts
    if (promptIds.length > 0) {
      await serviceSupabase
        .from('pool_answers')
        .delete()
        .in('prompt_id', promptIds);
    }

    // Delete prompts
    await serviceSupabase
      .from('pool_prompts')
      .delete()
      .eq('pool_id', pool_id);

    // Delete members
    await serviceSupabase
      .from('pool_members')
      .delete()
      .eq('pool_id', pool_id);

    // Finally delete the pool
    const { error: deleteError } = await serviceSupabase
      .from('pools')
      .delete()
      .eq('id', pool_id);

    if (deleteError) {
      throw deleteError;
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ error: error.message || 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
