import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const jwt = authHeader.replace('Bearer ', '');
  const { data: { user }, error: userErr } = await admin.auth.getUser(jwt);
  if (userErr || !user?.id) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  // Allow fetching alignments for a specific poster (DnaComparePostCard).
  // Falls back to the authenticated user (DnaCompareFeedCard).
  let targetUserId: string | null = null;
  try {
    const body = await req.json();
    targetUserId = body?.target_user_id ?? null;
  } catch { /* no body — use auth user */ }

  // Authorization: a caller may only request another user's alignment data if
  // that user has actually published a dna_compare post (whose feed card already
  // exposes this same data). Otherwise restrict to the caller's own data.
  if (targetUserId && targetUserId !== user.id) {
    const { count } = await admin
      .from('social_posts')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', targetUserId)
      .eq('post_type', 'dna_compare');
    if (!count) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  }

  const userId = targetUserId || user.id;

  const [fsRes, myDnaRes] = await Promise.all([
    admin.from('friendships')
      .select('user_id,friend_id')
      .or(`user_id.eq.${userId},friend_id.eq.${userId}`)
      .eq('status', 'accepted'),
    admin.from('dna_profiles')
      .select('favorite_genres,label')
      .eq('user_id', userId)
      .single(),
  ]);

  const friendships: any[] = fsRes.data ?? [];
  const myDna = myDnaRes.data ?? null;

  const friendIds = [...new Set(
    friendships.map((f: any) => f.user_id === userId ? f.friend_id : f.user_id)
  )].filter((id: string) => id !== userId);

  if (!friendIds.length) {
    return new Response(JSON.stringify({ myDna, friendDnas: [], friendUsers: [], cmp1: [], cmp2: [] }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  const [friendDnaRes, friendUsersRes, cmp1Res, cmp2Res] = await Promise.all([
    admin.from('dna_profiles').select('user_id,favorite_genres,label').in('user_id', friendIds),
    admin.from('users').select('id,display_name,user_name').in('id', friendIds),
    admin.from('dna_comparisons').select('user_id_2,match_score').eq('user_id_1', userId),
    admin.from('dna_comparisons').select('user_id_1,match_score').eq('user_id_2', userId),
  ]);

  return new Response(JSON.stringify({
    myDna,
    friendDnas: friendDnaRes.data ?? [],
    friendUsers: friendUsersRes.data ?? [],
    cmp1: cmp1Res.data ?? [],
    cmp2: cmp2Res.data ?? [],
  }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
});
