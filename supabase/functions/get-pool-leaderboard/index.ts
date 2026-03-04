import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'OPTIONS, GET, POST'
};
const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'No authorization header' }, 401);

    const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_ANON_KEY') ?? '', { global: { headers: { Authorization: authHeader } } });
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return json({ error: 'Unauthorized' }, 401);

    const url = new URL(req.url);
    let poolId = url.searchParams.get('pool_id');
    if (!poolId && req.method === 'POST') { const body = await req.json(); poolId = body.pool_id; }
    if (!poolId) return json({ error: 'Pool ID is required' }, 400);

    const svc = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
    const { data: appUser } = await svc.from('users').select('id').eq('email', user.email).single();
    if (!appUser) return json({ error: 'User not found' }, 404);

    const { data: membership } = await svc.from('pool_members').select('id').eq('pool_id', poolId).eq('user_id', appUser.id).single();
    if (!membership) return json({ error: 'Not a member' }, 403);

    const { data: members } = await svc
      .from('pool_members')
      .select('user_id, total_points, role, users:user_id(id, user_name, display_name)')
      .eq('pool_id', poolId)
      .order('total_points', { ascending: false });

    const leaderboard = (members || []).map((m, i) => ({
      rank: i + 1,
      user_id: m.user_id,
      display_name: (m.users as any)?.display_name || (m.users as any)?.user_name || 'Unknown',
      username: (m.users as any)?.user_name,
      total_points: m.total_points || 0,
      is_current_user: m.user_id === appUser.id
    }));

    return json({ leaderboard });
  } catch (e) {
    return json({ error: e.message }, 500);
  }
});
