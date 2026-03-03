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

    const { pool_id, title, lock_time } = await req.json();
    if (!pool_id) return json({ error: 'Pool ID is required' }, 400);
    if (!title?.trim()) return json({ error: 'Round title is required' }, 400);

    const svc = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
    const { data: appUser } = await svc.from('users').select('id').eq('email', user.email).single();
    if (!appUser) return json({ error: 'User not found' }, 404);

    const { data: pool } = await svc.from('pools').select('host_id').eq('id', pool_id).single();
    if (!pool) return json({ error: 'Pool not found' }, 404);
    if (pool.host_id !== appUser.id) return json({ error: 'Only the host can create rounds' }, 403);

    const { data: round, error } = await svc.from('pool_rounds').insert({
      pool_id,
      title: title.trim(),
      lock_time: lock_time || null,
      status: 'open'
    }).select().single();

    if (error) return json({ error: error.message }, 500);
    return json({ success: true, round });
  } catch (e) {
    return json({ error: e.message }, 500);
  }
});
