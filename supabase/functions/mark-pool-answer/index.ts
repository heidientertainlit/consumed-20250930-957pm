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

    const { answer_id, is_correct } = await req.json();
    if (!answer_id) return json({ error: 'Answer ID is required' }, 400);
    if (typeof is_correct !== 'boolean') return json({ error: 'is_correct must be a boolean' }, 400);

    const svc = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
    const { data: appUser } = await svc.from('users').select('id').eq('email', user.email).single();
    if (!appUser) return json({ error: 'User not found' }, 404);

    // Fetch the answer and its prompt
    const { data: answer } = await svc.from('pool_answers')
      .select('id, user_id, prompt_id, is_correct, points_earned')
      .eq('id', answer_id)
      .single();
    if (!answer) return json({ error: 'Answer not found' }, 404);

    const { data: prompt } = await svc.from('pool_prompts')
      .select('id, pool_id, prompt_type, status')
      .eq('id', answer.prompt_id)
      .single();
    if (!prompt) return json({ error: 'Prompt not found' }, 404);
    if (prompt.prompt_type !== 'call_it') return json({ error: 'Only call_it prompts can be marked this way' }, 400);
    if (prompt.status === 'resolved') return json({ error: 'Prompt is already closed' }, 400);

    // Verify caller is the host
    const { data: pool } = await svc.from('pools').select('host_id').eq('id', prompt.pool_id).single();
    if (!pool || pool.host_id !== appUser.id) return json({ error: 'Only the host can mark answers' }, 403);

    const wasCorrect = answer.is_correct === true;
    const nowCorrect = is_correct;

    // Update the answer
    await svc.from('pool_answers').update({
      is_correct: nowCorrect,
      points_earned: nowCorrect ? 1 : 0
    }).eq('id', answer_id);

    // Adjust member points if correctness changed
    if (wasCorrect !== nowCorrect) {
      const { data: member } = await svc.from('pool_members')
        .select('total_points')
        .eq('pool_id', prompt.pool_id)
        .eq('user_id', answer.user_id)
        .single();
      if (member) {
        const delta = nowCorrect ? 1 : -1;
        await svc.from('pool_members').update({
          total_points: Math.max(0, (member.total_points || 0) + delta)
        }).eq('pool_id', prompt.pool_id).eq('user_id', answer.user_id);
      }
    }

    return json({ success: true, answer_id, is_correct: nowCorrect });
  } catch (e) {
    return json({ error: e.message }, 500);
  }
});
