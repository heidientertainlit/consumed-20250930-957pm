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

    const { round_id, question, options, question_type = 'pick' } = await req.json();
    if (!round_id) return json({ error: 'Round ID is required' }, 400);
    if (!question?.trim()) return json({ error: 'Question is required' }, 400);

    const isPick = question_type !== 'call_it';
    if (isPick && (!options || !Array.isArray(options) || options.filter((o: string) => o.trim()).length < 2)) {
      return json({ error: 'At least 2 options required for Pick questions' }, 400);
    }

    const svc = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
    const { data: appUser } = await svc.from('users').select('id').eq('email', user.email).single();
    if (!appUser) return json({ error: 'User not found' }, 404);

    const { data: round } = await svc.from('pool_rounds').select('id, pool_id, status').eq('id', round_id).single();
    if (!round) return json({ error: 'Round not found' }, 404);
    if (round.status === 'locked' || round.status === 'resolved') return json({ error: 'Round is locked' }, 400);

    const { data: pool } = await svc.from('pools').select('id, name, host_id').eq('id', round.pool_id).single();
    if (!pool || pool.host_id !== appUser.id) return json({ error: 'Only the host can add prompts' }, 403);

    const filteredOptions = isPick ? options.map((o: string) => o.trim()).filter((o: string) => o.length > 0) : [];

    const { data: prompt, error } = await svc.from('pool_prompts').insert({
      round_id,
      pool_id: round.pool_id,
      prompt_text: question.trim(),
      prompt_type: question_type === 'call_it' ? 'call_it' : 'pick',
      options: filteredOptions,
      points_value: 1,
      status: 'open',
      created_by: appUser.id
    }).select().single();

    if (error) return json({ error: error.message }, 500);

    // Notify all members (except the host) that a new question is live
    const { data: members } = await svc
      .from('pool_members')
      .select('user_id')
      .eq('pool_id', pool.id)
      .neq('user_id', appUser.id);

    if (members && members.length > 0) {
      const questionPreview = question.trim().length > 60
        ? question.trim().slice(0, 57) + '...'
        : question.trim();

      const notifications = members.map((m: any) => ({
        user_id: m.user_id,
        type: 'room_new_question',
        triggered_by_user_id: appUser.id,
        message: `New question in "${pool.name}": ${questionPreview}`,
        list_id: pool.id,
        read: false,
      }));

      await svc.from('notifications').insert(notifications);
    }

    return json({ success: true, prompt });
  } catch (e) {
    return json({ error: e.message }, 500);
  }
});
