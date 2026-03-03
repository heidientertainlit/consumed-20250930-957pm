import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'OPTIONS, POST'
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

    const { invite_code } = await req.json();
    if (!invite_code?.trim()) return json({ error: 'Invite code is required' }, 400);

    const svc = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
    const { data: appUser } = await svc.from('users').select('id').eq('email', user.email).single();
    if (!appUser) return json({ error: 'User not found' }, 404);

    const { data: pool } = await svc.from('pools').select('id, name, host_id, status').eq('invite_code', invite_code.toUpperCase().trim()).single();
    if (!pool) return json({ error: 'Invalid invite link' }, 404);
    if (pool.status === 'completed') return json({ error: 'This pool has ended' }, 400);

    const { data: existing } = await svc.from('pool_members').select('id').eq('pool_id', pool.id).eq('user_id', appUser.id).single();
    if (existing) return json({ success: true, already_member: true, pool_id: pool.id, pool_name: pool.name });

    const { error } = await svc.from('pool_members').insert({ pool_id: pool.id, user_id: appUser.id, role: 'member', total_points: 0 });
    if (error) return json({ error: error.message }, 500);

    return json({ success: true, pool_id: pool.id, pool_name: pool.name });
  } catch (e) {
    return json({ error: e.message }, 500);
  }
});
