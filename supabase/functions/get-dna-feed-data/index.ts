import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  blockedPeerIdsForViewer,
  filterDnaFeedRelationships,
} from '../_shared/dna-feed-access.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function internalError() {
  // Do not return service-role/database details to callers.
  return jsonResponse({ error: 'Unable to load DNA feed data' }, 500);
}

function isUuid(value: unknown): value is string {
  return typeof value === 'string'
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return jsonResponse({ error: 'Unauthorized' }, 401);
  }

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const bearer = /^Bearer\s+(.+)$/i.exec(authHeader);
  if (!bearer) return jsonResponse({ error: 'Unauthorized' }, 401);

  const jwt = bearer[1];
  const { data: { user }, error: userErr } = await admin.auth.getUser(jwt);
  if (userErr || !user?.id) {
    return jsonResponse({ error: 'Unauthorized' }, 401);
  }

  // Allow fetching alignments for a specific poster (DnaComparePostCard).
  // Falls back to the authenticated user (DnaCompareFeedCard).
  let targetUserId: string | null = null;
  try {
    const body = await req.json();
    const requestedTarget = body?.target_user_id ?? null;
    if (requestedTarget !== null && !isUuid(requestedTarget)) {
      return jsonResponse({ error: 'Invalid target user' }, 400);
    }
    targetUserId = requestedTarget;
  } catch { /* no body — use auth user */ }

  // Service-role reads bypass RLS, so explicitly resolve every block in either
  // direction before returning target or relationship data. A block lookup
  // error is an authorization failure, not an empty block list.
  const blockRes = await admin
    .from('user_blocks')
    .select('blocker_id,blocked_id')
    .or(`blocker_id.eq.${user.id},blocked_id.eq.${user.id}`);
  if (blockRes.error) return internalError();
  const blockedPeerIds = blockedPeerIdsForViewer(user.id, blockRes.data ?? []);

  // Authorization: a caller may only request another user's alignment data if
  // that user has actually published a dna_compare post (whose feed card already
  // exposes this same data). A target blocked by either side is never eligible.
  if (targetUserId && targetUserId !== user.id) {
    if (blockedPeerIds.has(targetUserId)) {
      return jsonResponse({ error: 'Forbidden' }, 403);
    }

    const postRes = await admin
      .from('social_posts')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', targetUserId)
      .eq('post_type', 'dna_compare');
    if (postRes.error) return internalError();
    if (!postRes.count) {
      return jsonResponse({ error: 'Forbidden' }, 403);
    }
  }

  const userId = targetUserId || user.id;

  const [fsRes, myDnaRes, myUserRes] = await Promise.all([
    admin.from('friendships')
      .select('user_id,friend_id')
      .or(`user_id.eq.${userId},friend_id.eq.${userId}`)
      .eq('status', 'accepted'),
    admin.from('dna_profiles')
      .select('favorite_genres,label')
      .eq('user_id', userId)
      .maybeSingle(),
    admin.from('users')
      .select('id,display_name,user_name,first_name,last_name,avatar')
      .eq('id', userId)
      .maybeSingle(),
  ]);
  if (fsRes.error || myDnaRes.error || myUserRes.error) return internalError();

  const friendships: any[] = fsRes.data ?? [];
  const myDna = myDnaRes.data ?? null;
  const myUser = myUserRes.data ?? null;

  const friendIds = [...new Set(
    friendships.map((f: any) => f.user_id === userId ? f.friend_id : f.user_id)
  )].filter((id: string) => id !== userId);

  if (!friendIds.length) {
    return jsonResponse({ myDna, myUser, friendDnas: [], friendUsers: [], cmp1: [], cmp2: [] });
  }

  const [friendDnaRes, friendUsersRes, cmp1Res, cmp2Res] = await Promise.all([
    admin.from('dna_profiles').select('user_id,favorite_genres,label').in('user_id', friendIds),
    admin.from('users').select('id,display_name,user_name,first_name,last_name,avatar').in('id', friendIds),
    admin.from('dna_comparisons').select('user_id_2,match_score').eq('user_id_1', userId),
    admin.from('dna_comparisons').select('user_id_1,match_score').eq('user_id_2', userId),
  ]);
  if (friendDnaRes.error || friendUsersRes.error || cmp1Res.error || cmp2Res.error) {
    return internalError();
  }

  const filtered = filterDnaFeedRelationships({
    viewerId: user.id,
    targetUserId: userId,
    friendIds,
    blockedPeerIds,
    friendDnas: friendDnaRes.data ?? [],
    friendUsers: friendUsersRes.data ?? [],
    cmp1: cmp1Res.data ?? [],
    cmp2: cmp2Res.data ?? [],
  });
  if (filtered.targetBlocked) return jsonResponse({ error: 'Forbidden' }, 403);

  return jsonResponse({
    myDna,
    myUser,
    friendDnas: filtered.friendDnas,
    friendUsers: filtered.friendUsers,
    cmp1: filtered.cmp1,
    cmp2: filtered.cmp2,
  });
});
