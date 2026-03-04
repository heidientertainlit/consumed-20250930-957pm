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

    const { pool_id, is_public } = await req.json();
    if (!pool_id) return json({ error: 'pool_id is required' }, 400);
    if (typeof is_public !== 'boolean') return json({ error: 'is_public must be a boolean' }, 400);

    const svc = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
    const { data: appUser } = await svc.from('users').select('id').eq('email', user.email).single();
    if (!appUser) return json({ error: 'User not found' }, 404);

    // Verify host
    const { data: pool } = await svc.from('pools').select('id, host_id, is_public').eq('id', pool_id).single();
    if (!pool) return json({ error: 'Room not found' }, 404);
    if (pool.host_id !== appUser.id) return json({ error: 'Only the host can change room visibility' }, 403);

    const { error } = await svc.from('pools').update({ is_public }).eq('id', pool_id);
    if (error) return json({ error: error.message }, 500);

    return json({ success: true, is_public });
  } catch (e) {
    return json({ error: e.message }, 500);
  }
});
