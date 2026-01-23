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
    
    // Use service role for database operations
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );
    
    // Use anon client for auth
    const authClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader || '' } } }
    );

    let userId: string | null = null;
    if (authHeader) {
      const { data: { user } } = await authClient.auth.getUser();
      userId = user?.id || null;
    }
    
    console.log('=== GET FRIEND CASTS ===');
    console.log('userId:', userId);

    const url = new URL(req.url);
    const pendingOnly = url.searchParams.get('pending') === 'true';
    const forMe = url.searchParams.get('forMe') === 'true';

    // First get the casts without joins (no FK relationships)
    let query = supabase
      .from('friend_casts')
      .select('*')
      .order('created_at', { ascending: false });

    if (forMe && userId) {
      query = query.eq('target_friend_id', userId);
      if (pendingOnly) {
        query = query.eq('status', 'pending');
      }
    } else {
      query = query.eq('is_public', true).eq('status', 'approved');
    }

    const { data: casts, error } = await query.limit(20);
    
    console.log('Query result count:', casts?.length || 0);
    console.log('Query error:', error);

    if (error) {
      console.error('Fetch error:', error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Fetch creator info for each cast
    const castsWithCreators = await Promise.all((casts || []).map(async (cast: any) => {
      const { data: creator, error: creatorError } = await supabase
        .from('users')
        .select('id, user_name, display_name, avatar_url')
        .eq('id', cast.creator_id)
        .single();
      
      if (creatorError) {
        console.log('Creator lookup error for', cast.creator_id, ':', creatorError.message);
      } else {
        console.log('Found creator:', creator?.user_name, creator?.display_name);
      }
      
      return {
        ...cast,
        creator: creator || { id: cast.creator_id, user_name: 'a friend', display_name: 'A friend' }
      };
    }));

    return new Response(JSON.stringify({ casts: castsWithCreators }), {
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
