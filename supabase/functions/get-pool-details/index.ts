import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'OPTIONS, GET, POST'
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

    const url = new URL(req.url);
    let poolId = url.searchParams.get('pool_id');
    if (!poolId && req.method === 'POST') {
      const body = await req.json();
      poolId = body.pool_id;
    }
    if (!poolId) return json({ error: 'Pool ID is required' }, 400);

    const svc = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
    const { data: appUser } = await svc.from('users').select('id').eq('email', user.email).single();
    if (!appUser) return json({ error: 'User not found' }, 404);

    const { data: pool } = await svc.from('pools').select('*').eq('id', poolId).single();
    if (!pool) return json({ error: 'Pool not found' }, 404);

    const { data: membership } = await svc.from('pool_members').select('role').eq('pool_id', poolId).eq('user_id', appUser.id).single();
    const isHost = pool.host_id === appUser.id;
    const isMember = !!membership;
    if (!isMember) return json({ error: 'You are not a member of this pool' }, 403);

    const [{ data: members }, { data: rounds }, { data: host }] = await Promise.all([
      svc.from('pool_members').select('user_id, role, total_points, joined_at, users:user_id(id, user_name, display_name, avatar_url)').eq('pool_id', poolId).order('total_points', { ascending: false }),
      svc.from('pool_rounds').select('*').eq('pool_id', poolId).order('created_at', { ascending: true }),
      svc.from('users').select('id, user_name, display_name, avatar_url').eq('id', pool.host_id).single()
    ]);

    const roundsWithPrompts = await Promise.all((rounds || []).map(async (round) => {
      const { data: prompts } = await svc.from('pool_prompts').select('*').eq('round_id', round.id).order('created_at', { ascending: true });

      let userAnswers: Record<string, any> = {};
      let allAnswersMap: Record<string, any[]> = {};

      if (prompts && prompts.length > 0) {
        const promptIds = prompts.map((p: any) => p.id);

        const { data: myAnswers } = await svc.from('pool_answers')
          .select('prompt_id, answer, is_correct, points_earned')
          .eq('user_id', appUser.id)
          .in('prompt_id', promptIds);
        if (myAnswers) userAnswers = Object.fromEntries(myAnswers.map((a: any) => [a.prompt_id, a]));

        // For call_it prompts, fetch all member submissions so host can mark correct ones
        const callItIds = prompts.filter((p: any) => p.prompt_type === 'call_it').map((p: any) => p.id);
        if (callItIds.length > 0) {
          const { data: allAnswers } = await svc.from('pool_answers')
            .select('id, prompt_id, answer, is_correct, points_earned, user_id, users:user_id(display_name, user_name)')
            .in('prompt_id', callItIds)
            .order('submitted_at', { ascending: true });
          if (allAnswers) {
            for (const ans of allAnswers) {
              if (!allAnswersMap[ans.prompt_id]) allAnswersMap[ans.prompt_id] = [];
              allAnswersMap[ans.prompt_id].push(ans);
            }
          }
        }
      }

      return {
        ...round,
        prompts: (prompts || []).map((p: any) => ({
          ...p,
          user_answer: userAnswers[p.id] || null,
          all_answers: p.prompt_type === 'call_it' ? (allAnswersMap[p.id] || []) : undefined
        }))
      };
    }));

    return json({
      pool: { ...pool, host },
      rounds: roundsWithPrompts,
      members: members || [],
      is_host: isHost,
      is_member: isMember
    });
  } catch (e) {
    return json({ error: e.message }, 500);
  }
});
