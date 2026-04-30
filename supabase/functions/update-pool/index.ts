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
    const { data: appUser } = await svc.from('users').select('id').eq('email', user.email).single();
    if (!appUser) return json({ error: 'User not found' }, 404);

    const { pool_id, name, description, series_tag, partner_name, media_image } = await req.json();
    if (!pool_id) return json({ error: 'pool_id is required' }, 400);

    // Verify requester is the host
    const { data: pool } = await svc.from('pools').select('host_id').eq('id', pool_id).single();
    if (!pool) return json({ error: 'Room not found' }, 404);
    if (pool.host_id !== appUser.id) return json({ error: 'Only the host can update this room' }, 403);

    const updates: Record<string, any> = {};
    if (name !== undefined) updates.name = name?.trim() || null;
    if (description !== undefined) updates.description = description?.trim() || null;
    if (series_tag !== undefined) updates.series_tag = series_tag?.trim() || null;
    if (partner_name !== undefined) updates.partner_name = partner_name?.trim() || null;
    if (media_image !== undefined) updates.media_image = media_image?.trim() || null;

    if (Object.keys(updates).length === 0) return json({ error: 'No fields to update' }, 400);

    const { error } = await svc.from('pools').update(updates).eq('id', pool_id);
    if (error) return json({ error: error.message }, 500);

    return json({ success: true });
  } catch (e) {
    return json({ error: e.message }, 500);
  }
});
