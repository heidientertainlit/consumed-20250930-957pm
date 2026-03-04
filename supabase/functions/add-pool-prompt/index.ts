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

    const body = await req.json();
    const { pool_id, round_id, question, options, question_type = 'pick', parent_id = null } = body;

    if (!question?.trim()) return json({ error: 'Question is required' }, 400);

    const isPick = question_type === 'pick';
    const isCommentary = question_type === 'commentary';
    if (isPick && (!options || !Array.isArray(options) || options.filter((o: string) => o.trim()).length < 2)) {
      return json({ error: 'At least 2 options required for Pick questions' }, 400);
    }

    const svc = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
    const { data: appUser } = await svc.from('users').select('id').eq('email', user.email).single();
    if (!appUser) return json({ error: 'User not found' }, 404);

    // Resolve pool_id — either passed directly or looked up from round
    let resolvedPoolId = pool_id;
    let resolvedRoundId = round_id || null;

    if (!resolvedPoolId && round_id) {
      const { data: round } = await svc.from('pool_rounds').select('id, pool_id, status').eq('id', round_id).single();
      if (!round) return json({ error: 'Round not found' }, 404);
      if (round.status === 'locked' || round.status === 'resolved') return json({ error: 'Round is locked' }, 400);
      resolvedPoolId = round.pool_id;
      resolvedRoundId = round.id;
    }

    if (!resolvedPoolId) return json({ error: 'Pool ID is required' }, 400);

    const { data: pool } = await svc.from('pools').select('id, name, host_id').eq('id', resolvedPoolId).single();
    if (!pool) return json({ error: 'Pool not found' }, 404);

    // Check membership — any member can post commentary, only host can post picks/call_it
    const { data: membership } = await svc.from('pool_members').select('id').eq('pool_id', resolvedPoolId).eq('user_id', appUser.id).single();
    const isHost = pool.host_id === appUser.id;
    const isMember = !!membership || isHost;

    if (!isMember) return json({ error: 'You must be a member to post' }, 403);
    if (!isCommentary && !isHost) return json({ error: 'Only the host can post picks' }, 403);

    const filteredOptions = isPick ? options.map((o: string) => o.trim()).filter((o: string) => o.length > 0) : [];
    const promptType = isCommentary ? 'commentary' : question_type === 'call_it' ? 'call_it' : 'pick';

    const insertData: any = {
      pool_id: resolvedPoolId,
      prompt_text: question.trim(),
      prompt_type: promptType,
      options: filteredOptions,
      points_value: isCommentary ? 0 : 1,
      status: 'open',
      created_by: appUser.id
    };
    if (resolvedRoundId) insertData.round_id = resolvedRoundId;
    if (parent_id) insertData.parent_id = parent_id;

    // For commentary replies, store parent_id in correct_answer column (already in schema cache).
    // correct_answer is only meaningful for pick/call_it; for commentary it's always null otherwise.
    // This avoids the PostgREST schema cache issue with the parent_id column entirely.
    const { parent_id: _skip, ...insertWithoutParent } = insertData;
    if (parent_id && isCommentary) {
      insertWithoutParent.correct_answer = parent_id;
    }

    const { data: prompt, error: insertErr } = await svc
      .from('pool_prompts')
      .insert(insertWithoutParent)
      .select('*, creator:created_by(id, user_name, display_name)')
      .single();
    if (insertErr) return json({ error: insertErr.message }, 500);

    // Surface parent_id in response so client can handle threading
    if (parent_id && isCommentary && prompt) {
      prompt.parent_id = parent_id;
    }

    // Notify all members (except the host) — skip for commentary if desired
    if (!isCommentary) {
      const { data: members } = await svc.from('pool_members').select('user_id').eq('pool_id', pool.id).neq('user_id', appUser.id);
      if (members && members.length > 0) {
        const questionPreview = question.trim().length > 60 ? question.trim().slice(0, 57) + '...' : question.trim();
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
    }

    return json({ success: true, prompt });
  } catch (e) {
    return json({ error: e.message }, 500);
  }
});
