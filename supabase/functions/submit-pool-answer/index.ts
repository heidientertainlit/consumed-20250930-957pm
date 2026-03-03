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

    const { prompt_id, answer } = await req.json();
    if (!prompt_id) return json({ error: 'Prompt ID is required' }, 400);
    if (!answer?.trim()) return json({ error: 'Answer is required' }, 400);

    const svc = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
    const { data: appUser } = await svc.from('users').select('id').eq('email', user.email).single();
    if (!appUser) return json({ error: 'User not found' }, 404);

    const { data: prompt } = await svc.from('pool_prompts').select('id, pool_id, round_id, status').eq('id', prompt_id).single();
    if (!prompt) return json({ error: 'Prompt not found' }, 404);
    if (prompt.status !== 'open') return json({ error: 'This prompt is no longer accepting answers' }, 400);

    if (prompt.round_id) {
      const { data: round } = await svc.from('pool_rounds').select('status, lock_time').eq('id', prompt.round_id).single();
      if (round?.status === 'locked' || round?.status === 'resolved') return json({ error: 'Round is locked' }, 400);
      if (round?.lock_time && new Date(round.lock_time) < new Date()) return json({ error: 'Round lock time has passed' }, 400);
    }

    const { data: membership } = await svc.from('pool_members').select('id').eq('pool_id', prompt.pool_id).eq('user_id', appUser.id).single();
    if (!membership) return json({ error: 'You must join this pool to submit answers' }, 403);

    const { data: existing } = await svc.from('pool_answers').select('id').eq('prompt_id', prompt_id).eq('user_id', appUser.id).single();

    if (existing) {
      const { data: updated, error } = await svc.from('pool_answers').update({ answer: answer.trim(), submitted_at: new Date().toISOString() }).eq('id', existing.id).select().single();
      if (error) return json({ error: error.message }, 500);
      return json({ success: true, updated: true, answer: updated });
    }

    const { data: newAnswer, error } = await svc.from('pool_answers').insert({ prompt_id, user_id: appUser.id, answer: answer.trim() }).select().single();
    if (error) return json({ error: error.message }, 500);
    return json({ success: true, answer: newAnswer });
  } catch (e) {
    return json({ error: e.message }, 500);
  }
});
