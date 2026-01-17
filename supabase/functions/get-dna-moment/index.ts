import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const authHeader = req.headers.get('Authorization');
    let userId = null;
    if (authHeader) {
      const token = authHeader.replace('Bearer ', '');
      const { data: { user } } = await supabaseAdmin.auth.getUser(token);
      userId = user?.id;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    let moment = null;
    let hasAnswered = false;
    let userAnswer = null;

    const { data: scheduledMoment } = await supabaseAdmin
      .from('dna_moments')
      .select('*')
      .eq('is_active', true)
      .gte('display_date', today.toISOString())
      .lt('display_date', tomorrow.toISOString())
      .limit(1)
      .single();

    if (scheduledMoment) {
      moment = scheduledMoment;
    } else {
      let answeredMomentIds: string[] = [];
      if (userId) {
        const { data: userResponses } = await supabaseAdmin
          .from('dna_moment_responses')
          .select('moment_id')
          .eq('user_id', userId);
        
        answeredMomentIds = (userResponses || []).map(r => r.moment_id);
      }

      let query = supabaseAdmin
        .from('dna_moments')
        .select('*')
        .eq('is_active', true)
        .is('display_date', null);

      if (answeredMomentIds.length > 0) {
        query = query.not('id', 'in', `(${answeredMomentIds.join(',')})`);
      }

      const { data: randomMoments } = await query.limit(10);

      if (randomMoments && randomMoments.length > 0) {
        moment = randomMoments[Math.floor(Math.random() * randomMoments.length)];
      }
    }

    if (!moment) {
      return new Response(JSON.stringify({ 
        moment: null, 
        message: 'No DNA moments available' 
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (userId) {
      const { data: existingResponse } = await supabaseAdmin
        .from('dna_moment_responses')
        .select('answer')
        .eq('user_id', userId)
        .eq('moment_id', moment.id)
        .single();

      if (existingResponse) {
        hasAnswered = true;
        userAnswer = existingResponse.answer;
      }
    }

    const { data: allResponses } = await supabaseAdmin
      .from('dna_moment_responses')
      .select('answer')
      .eq('moment_id', moment.id);

    const totalResponses = allResponses?.length || 0;
    const optionACount = allResponses?.filter(r => r.answer === 'a').length || 0;
    const optionBCount = totalResponses - optionACount;

    const stats = {
      totalResponses,
      optionAPercent: totalResponses > 0 ? Math.round((optionACount / totalResponses) * 100) : 50,
      optionBPercent: totalResponses > 0 ? Math.round((optionBCount / totalResponses) * 100) : 50,
    };

    let friendResponses: any[] = [];
    if (userId && hasAnswered) {
      const { data: friends } = await supabaseAdmin
        .from('friendships')
        .select('friend_id, user_id')
        .or(`user_id.eq.${userId},friend_id.eq.${userId}`)
        .eq('status', 'accepted')
        .limit(10);

      if (friends && friends.length > 0) {
        const friendIds = friends.map(f => f.user_id === userId ? f.friend_id : f.user_id);
        
        const { data: friendAnswers } = await supabaseAdmin
          .from('dna_moment_responses')
          .select(`
            answer,
            user_id,
            users:user_id(display_name, avatar_url)
          `)
          .eq('moment_id', moment.id)
          .in('user_id', friendIds)
          .limit(5);

        friendResponses = friendAnswers || [];
      }
    }

    return new Response(JSON.stringify({
      moment: {
        id: moment.id,
        questionText: moment.question_text,
        optionA: moment.option_a,
        optionB: moment.option_b,
        category: moment.category,
      },
      hasAnswered,
      userAnswer,
      stats,
      friendResponses,
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
