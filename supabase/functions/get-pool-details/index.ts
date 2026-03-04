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

    // Check membership
    const { data: membership } = await svc.from('pool_members').select('role').eq('pool_id', poolId).eq('user_id', appUser.id).single();
    const isHost = pool.host_id === appUser.id;
    const isMember = !!membership || isHost;
    if (!isMember) return json({ error: 'You are not a member of this pool' }, 403);

    // Fetch pool_members (without FK join)
    const { data: rawMembers } = await svc.from('pool_members')
      .select('user_id, role, total_points, joined_at')
      .eq('pool_id', poolId)
      .order('total_points', { ascending: false });

    // Fetch pool_prompts (without FK join for creator)
    const { data: rawPrompts } = await svc.from('pool_prompts')
      .select('id, pool_id, prompt_text, prompt_type, options, status, correct_answer, points_value, created_at, created_by')
      .eq('pool_id', poolId)
      .order('created_at', { ascending: true });

    // Collect all user IDs we need to look up
    const memberUserIds: string[] = (rawMembers || []).map((m: any) => m.user_id);
    const creatorIds: string[] = [...new Set((rawPrompts || []).map((p: any) => p.created_by).filter(Boolean))];
    const allUserIds = [...new Set([...memberUserIds, ...creatorIds, pool.host_id])];

    // Single bulk user lookup
    const { data: allUsers } = await svc.from('users')
      .select('id, user_name, display_name, avatar_url')
      .in('id', allUserIds);

    const userMap: Record<string, any> = {};
    for (const u of (allUsers || [])) userMap[u.id] = u;

    // Build members array with user info attached
    const members = (rawMembers || []).map((m: any) => ({
      ...m,
      users: userMap[m.user_id] || null,
    }));

    // Build host info
    const host = userMap[pool.host_id] || null;

    const prompts = rawPrompts || [];
    const promptIds = prompts.map((p: any) => p.id);

    // Fetch current user's answers
    let userAnswers: Record<string, any> = {};
    if (promptIds.length > 0) {
      const { data: myAnswers } = await svc.from('pool_answers')
        .select('prompt_id, answer, is_correct, points_earned')
        .eq('user_id', appUser.id)
        .in('prompt_id', promptIds);
      if (myAnswers) userAnswers = Object.fromEntries(myAnswers.map((a: any) => [a.prompt_id, a]));
    }

    // Fetch all answers for call_it prompts
    let allAnswersMap: Record<string, any[]> = {};
    const callItIds = prompts.filter((p: any) => p.prompt_type === 'call_it').map((p: any) => p.id);
    if (callItIds.length > 0) {
      const { data: allAnswers } = await svc.from('pool_answers')
        .select('id, prompt_id, answer, is_correct, points_earned, user_id')
        .in('prompt_id', callItIds)
        .order('submitted_at', { ascending: true });
      if (allAnswers) {
        // Attach user info
        const answerUserIds = [...new Set((allAnswers || []).map((a: any) => a.user_id))];
        let answerUserMap: Record<string, any> = {};
        if (answerUserIds.length > 0) {
          const { data: answerUsers } = await svc.from('users').select('id, display_name, user_name').in('id', answerUserIds);
          for (const u of (answerUsers || [])) answerUserMap[u.id] = u;
        }
        for (const ans of allAnswers) {
          if (!allAnswersMap[ans.prompt_id]) allAnswersMap[ans.prompt_id] = [];
          allAnswersMap[ans.prompt_id].push({ ...ans, users: answerUserMap[ans.user_id] || null });
        }
      }
    }

    // Fetch vote counts for pick prompts where user has voted
    let voteCountsMap: Record<string, Record<string, number>> = {};
    const votedPickIds = prompts
      .filter((p: any) => p.prompt_type === 'pick' && userAnswers[p.id])
      .map((p: any) => p.id);
    if (votedPickIds.length > 0) {
      const { data: pickAnswers } = await svc.from('pool_answers').select('prompt_id, answer').in('prompt_id', votedPickIds);
      if (pickAnswers) {
        for (const ans of pickAnswers) {
          if (!voteCountsMap[ans.prompt_id]) voteCountsMap[ans.prompt_id] = {};
          voteCountsMap[ans.prompt_id][ans.answer] = (voteCountsMap[ans.prompt_id][ans.answer] || 0) + 1;
        }
      }
    }

    const posts = prompts.map((p: any) => ({
      ...p,
      creator: userMap[p.created_by] || null,
      user_answer: userAnswers[p.id] || null,
      all_answers: p.prompt_type === 'call_it' ? (allAnswersMap[p.id] || []) : undefined,
      vote_counts: p.prompt_type === 'pick' && userAnswers[p.id] ? (voteCountsMap[p.id] || {}) : undefined,
    }));

    return json({
      pool: { ...pool, host },
      posts,
      members,
      is_host: isHost,
      is_member: isMember
    });
  } catch (e) {
    return json({ error: e.message }, 500);
  }
});
