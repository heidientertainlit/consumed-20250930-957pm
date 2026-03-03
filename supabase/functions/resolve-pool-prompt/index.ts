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

    const { prompt_id, correct_answer } = await req.json();
    if (!prompt_id) return json({ error: 'Prompt ID is required' }, 400);

    const svc = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
    const { data: appUser } = await svc.from('users').select('id').eq('email', user.email).single();
    if (!appUser) return json({ error: 'User not found' }, 404);

    const { data: prompt } = await svc.from('pool_prompts').select('id, pool_id, prompt_type, points_value, status').eq('id', prompt_id).single();
    if (!prompt) return json({ error: 'Prompt not found' }, 404);
    if (prompt.status === 'resolved') return json({ error: 'Already resolved' }, 400);

    const { data: pool } = await svc.from('pools').select('host_id').eq('id', prompt.pool_id).single();
    if (!pool || pool.host_id !== appUser.id) return json({ error: 'Only the host can resolve prompts' }, 403);

    // Call It prompts: answers were already scored individually via mark-pool-answer.
    // Just close the prompt without re-scoring.
    if (prompt.prompt_type === 'call_it') {
      await svc.from('pool_prompts').update({ status: 'resolved', resolved_at: new Date().toISOString() }).eq('id', prompt_id);
      const { data: answers } = await svc.from('pool_answers').select('id').eq('prompt_id', prompt_id).eq('is_correct', true);
      return json({ success: true, type: 'call_it', winners_count: answers?.length || 0 });
    }

    // Pick prompts: match correct answer text and score all at once.
    if (!correct_answer?.trim()) return json({ error: 'Correct answer is required' }, 400);

    await svc.from('pool_prompts').update({ correct_answer: correct_answer.trim(), status: 'resolved', resolved_at: new Date().toISOString() }).eq('id', prompt_id);

    const { data: answers } = await svc.from('pool_answers').select('id, user_id, answer').eq('prompt_id', prompt_id);
    const normalized = correct_answer.trim().toLowerCase();
    let winnersCount = 0;

    for (const ans of answers || []) {
      const isCorrect = ans.answer.trim().toLowerCase() === normalized;
      await svc.from('pool_answers').update({ is_correct: isCorrect, points_earned: isCorrect ? 1 : 0 }).eq('id', ans.id);
      if (isCorrect) {
        winnersCount++;
        const { data: member } = await svc.from('pool_members').select('total_points').eq('pool_id', prompt.pool_id).eq('user_id', ans.user_id).single();
        if (member) await svc.from('pool_members').update({ total_points: (member.total_points || 0) + 1 }).eq('pool_id', prompt.pool_id).eq('user_id', ans.user_id);
      }
    }

    return json({ success: true, type: 'pick', correct_answer: correct_answer.trim(), total_answers: answers?.length || 0, winners_count: winnersCount });
  } catch (e) {
    return json({ error: e.message }, 500);
  }
});
