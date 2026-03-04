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

    const { prompt_id, action } = await req.json();
    if (!prompt_id) return json({ error: 'Prompt ID is required' }, 400);
    if (!action || !['close', 'delete'].includes(action)) return json({ error: 'Action must be close or delete' }, 400);

    const svc = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
    const { data: appUser } = await svc.from('users').select('id').eq('email', user.email).single();
    if (!appUser) return json({ error: 'User not found' }, 404);

    const { data: prompt } = await svc.from('pool_prompts').select('id, pool_id, status').eq('id', prompt_id).single();
    if (!prompt) return json({ error: 'Prompt not found' }, 404);

    const { data: pool } = await svc.from('pools').select('host_id').eq('id', prompt.pool_id).single();
    if (!pool || pool.host_id !== appUser.id) return json({ error: 'Only the host can manage picks' }, 403);

    if (action === 'close') {
      if (prompt.status === 'resolved') return json({ error: 'Already closed' }, 400);
      await svc.from('pool_prompts').update({ status: 'resolved', resolved_at: new Date().toISOString() }).eq('id', prompt_id);
      return json({ success: true });
    }

    if (action === 'delete') {
      await svc.from('pool_answers').delete().eq('prompt_id', prompt_id);
      await svc.from('pool_prompts').delete().eq('id', prompt_id);
      return json({ success: true });
    }
  } catch (e) {
    return json({ error: e.message }, 500);
  }
});
