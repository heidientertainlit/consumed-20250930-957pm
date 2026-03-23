import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const userClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization') } } }
    );

    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    );

    const { data: { user } } = await userClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ items: [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { friendIds = [] } = await req.json().catch(() => ({ friendIds: [] }));
    const allUserIds = [...new Set([user.id, ...friendIds])];

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const results: any[] = [];

    // Fetch user display names
    const { data: users } = await adminClient
      .from('users')
      .select('id, user_name, display_name')
      .in('id', allUserIds);

    const userMap: Record<string, string> = {};
    (users || []).forEach((u: any) => {
      userMap[u.id] = u.display_name || u.user_name || 'Someone';
    });

    const getName = (userId: string) => userMap[userId] || 'Someone';

    // Prediction wins
    const { data: wins } = await adminClient
      .from('user_predictions')
      .select('user_id, points_earned, created_at')
      .in('user_id', allUserIds)
      .eq('is_winner', true)
      .gte('created_at', thirtyDaysAgo)
      .order('created_at', { ascending: false })
      .limit(10);

    (wins || []).forEach((w: any) => {
      const pts = w.points_earned || 20;
      results.push({
        id: `win-${w.user_id}-${w.created_at}`,
        type: 'prediction_win',
        text: `${getName(w.user_id)} called it — prediction correct (+${pts} pts)`,
        icon: 'trophy',
        ts: w.created_at,
      });
    });

    // Streak milestones (any streak >= 3 days)
    const { data: streaks } = await adminClient
      .from('login_streaks')
      .select('user_id, current_streak, updated_at')
      .in('user_id', allUserIds)
      .gte('current_streak', 3)
      .order('current_streak', { ascending: false });

    (streaks || []).forEach((s: any) => {
      results.push({
        id: `streak-${s.user_id}-${s.current_streak}`,
        type: 'streak',
        text: `${getName(s.user_id)} is on a ${s.current_streak}-day streak`,
        icon: 'flame',
        ts: s.updated_at,
      });
    });

    // Shuffle and return up to 3
    const shuffled = results.sort(() => Math.random() - 0.5).slice(0, 3);

    return new Response(JSON.stringify({ items: shuffled }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (err) {
    return new Response(JSON.stringify({ items: [], error: String(err) }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
