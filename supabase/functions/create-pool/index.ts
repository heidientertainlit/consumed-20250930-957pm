import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'OPTIONS, POST'
};
const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

function generateInviteCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
  return code;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'No authorization header' }, 401);

    const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_ANON_KEY') ?? '', { global: { headers: { Authorization: authHeader } } });
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return json({ error: 'Unauthorized' }, 401);

    const { name, is_public = false, description = '' } = await req.json();
    if (!name?.trim()) return json({ error: 'Pool name is required' }, 400);

    const svc = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
    const { data: appUser } = await svc.from('users').select('id').eq('email', user.email).single();
    if (!appUser) return json({ error: 'User not found' }, 404);

    let pool = null;
    for (let i = 0; i < 5; i++) {
      const { data, error } = await svc.from('pools').insert({
        name: name.trim(),
        description: description?.trim() || null,
        host_id: appUser.id,
        invite_code: generateInviteCode(),
        status: 'open',
        is_public: !!is_public,
        points_per_correct: 1,
        pool_type: 'room'
      }).select().single();
      if (error?.code === '23505') continue;
      if (error) return json({ error: error.message }, 500);
      pool = data;
      break;
    }
    if (!pool) return json({ error: 'Failed to create pool' }, 500);

    await svc.from('pool_members').insert({ pool_id: pool.id, user_id: appUser.id, role: 'host', total_points: 0 });

    return json({ success: true, pool: { id: pool.id, name: pool.name, invite_code: pool.invite_code, is_public: pool.is_public, created_at: pool.created_at } });
  } catch (e) {
    return json({ error: e.message }, 500);
  }
});
