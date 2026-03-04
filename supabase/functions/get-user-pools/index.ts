import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'OPTIONS, GET, POST'
};
const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

async function enrichPool(svc: any, pool: any, userId: string, isHost: boolean, userPoints: number) {
  const [{ count: memberCount }, { count: roundCount }, { data: host }] = await Promise.all([
    svc.from('pool_members').select('*', { count: 'exact', head: true }).eq('pool_id', pool.id),
    svc.from('pool_rounds').select('*', { count: 'exact', head: true }).eq('pool_id', pool.id),
    svc.from('users').select('user_name, display_name, avatar_url').eq('id', pool.host_id).single()
  ]);
  return {
    id: pool.id,
    name: pool.name,
    host_id: pool.host_id,
    invite_code: pool.invite_code,
    status: pool.status,
    is_public: pool.is_public ?? false,
    created_at: pool.created_at,
    is_host: isHost,
    user_points: userPoints,
    member_count: memberCount || 0,
    round_count: roundCount || 0,
    host
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'No authorization header' }, 401);

    const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_ANON_KEY') ?? '', { global: { headers: { Authorization: authHeader } } });
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return json({ error: 'Unauthorized' }, 401);

    const svc = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
    const { data: appUser } = await svc.from('users').select('id').eq('email', user.email).single();
    if (!appUser) return json({ error: 'User not found' }, 404);

    // 1. Rooms the user is a member of
    const { data: memberships } = await svc
      .from('pool_members')
      .select('pool_id, role, total_points, joined_at, pools:pool_id(id, name, host_id, invite_code, status, is_public, created_at, pool_type)')
      .eq('user_id', appUser.id)
      .order('joined_at', { ascending: false });

    const myRooms = await Promise.all((memberships || []).map(async (m: any) => {
      const pool = m.pools as any;
      if (!pool || pool.pool_type !== 'room') return null;
      return enrichPool(svc, pool, appUser.id, pool.host_id === appUser.id, m.total_points);
    }));

    const myRoomIds = new Set((memberships || []).map((m: any) => m.pool_id));

    // 2. Public rooms the user has NOT joined
    const { data: publicPools } = await svc
      .from('pools')
      .select('id, name, host_id, invite_code, status, is_public, created_at, pool_type')
      .eq('pool_type', 'room')
      .eq('is_public', true)
      .neq('status', 'completed')
      .order('created_at', { ascending: false })
      .limit(20);

    const publicRooms = await Promise.all((publicPools || [])
      .filter((p: any) => !myRoomIds.has(p.id))
      .map(async (pool: any) => enrichPool(svc, pool, appUser.id, false, 0))
    );

    return json({
      pools: myRooms.filter(Boolean),       // backwards-compat field
      myRooms: myRooms.filter(Boolean),
      publicRooms: publicRooms.filter(Boolean)
    });
  } catch (e) {
    return json({ error: e.message }, 500);
  }
});
