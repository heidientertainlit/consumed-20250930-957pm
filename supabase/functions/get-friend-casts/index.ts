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

    // Get unique creator IDs for casts that don't have creator_name stored
    const castsNeedingLookup = (casts || []).filter((c: any) => !c.creator_name);
    const creatorIds = [...new Set(castsNeedingLookup.map((c: any) => c.creator_id))];
    
    // Batch fetch creators for legacy casts
    let creatorMap = new Map();
    if (creatorIds.length > 0) {
      const { data: creators } = await supabase
        .from('users')
        .select('id, user_name, display_name')
        .in('id', creatorIds);
      
      if (creators) {
        creatorMap = new Map(creators.map(c => [c.id, c]));
        console.log('Looked up creators:', creators.map(c => c.user_name));
      }
    }
    
    // Add creator info to each cast
    const castsWithCreators = (casts || []).map((cast: any) => {
      // Use stored creator_name first, then lookup, then fallback
      const storedName = cast.creator_name;
      const lookedUp = creatorMap.get(cast.creator_id);
      const displayName = storedName || lookedUp?.user_name || lookedUp?.display_name || 'a friend';
      
      return {
        ...cast,
        creator: {
          id: cast.creator_id,
          user_name: displayName,
          display_name: displayName
        }
      };
    });

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
