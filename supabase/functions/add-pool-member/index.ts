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

    const svc = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');

    const { pool_id, target_user_id } = await req.json();
    if (!pool_id || !target_user_id) return json({ error: 'pool_id and target_user_id are required' }, 400);

    const { data: requester } = await svc.from('users').select('id').eq('email', user.email).single();
    if (!requester) return json({ error: 'User not found' }, 404);

    const { data: pool } = await svc.from('pools').select('id, host_id, status, name').eq('id', pool_id).single();
    if (!pool) return json({ error: 'Pool not found' }, 404);
    if (pool.host_id !== requester.id) return json({ error: 'Only the host can add members' }, 403);
    if (pool.status === 'completed') return json({ error: 'This pool has ended' }, 400);

    const { data: target } = await svc.from('users').select('id, display_name, user_name').eq('id', target_user_id).single();
    if (!target) return json({ error: 'User not found' }, 404);

    const { data: existing } = await svc.from('pool_members').select('id').eq('pool_id', pool_id).eq('user_id', target_user_id).single();
    if (existing) return json({ success: true, already_member: true });

    const { error } = await svc.from('pool_members').insert({ pool_id, user_id: target_user_id, role: 'member', total_points: 0 });
    if (error) return json({ error: error.message }, 500);

    // Look up host's name for the notification message
    const { data: host } = await svc.from('users').select('display_name, user_name').eq('id', requester.id).single();
    const hostName = host?.display_name || host?.user_name || 'Someone';
    const roomName = pool.name || 'a room';

    try {
      await svc.from('notifications').insert({
        user_id: target_user_id,
        type: 'room_added',
        triggered_by_user_id: requester.id,
        message: `${hostName} added you to the Room "${roomName}"`,
        list_id: pool_id,
        read: false,
      });
    } catch (_e) {} // Non-blocking — member is added regardless

    return json({ success: true, user: target });
  } catch (e) {
    return json({ error: e.message }, 500);
  }
});
