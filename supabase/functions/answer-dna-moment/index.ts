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
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
    
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { momentId, answer, answers } = await req.json();

    const validOptions = ['a', 'b', 'c', 'd', 'e'];
    const finalAnswer = answers ? answers.sort().join(',') : answer;
    
    if (!momentId || (!answer && !answers)) {
      return new Response(JSON.stringify({ error: 'Invalid request. momentId and answer or answers required.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    if (answer && !validOptions.includes(answer)) {
      return new Response(JSON.stringify({ error: 'Invalid answer option.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    if (answers && !Array.isArray(answers)) {
      return new Response(JSON.stringify({ error: 'Answers must be an array.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { data: existingResponse } = await supabaseAdmin
      .from('dna_moment_responses')
      .select('id')
      .eq('user_id', user.id)
      .eq('moment_id', momentId)
      .single();

    if (existingResponse) {
      return new Response(JSON.stringify({ error: 'Already answered this DNA moment' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { data: moment } = await supabaseAdmin
      .from('dna_moments')
      .select('*')
      .eq('id', momentId)
      .eq('is_active', true)
      .single();

    if (!moment) {
      return new Response(JSON.stringify({ error: 'DNA moment not found or inactive' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const pointsEarned = 5;

    const { error: insertError } = await supabaseAdmin
      .from('dna_moment_responses')
      .insert({
        user_id: user.id,
        moment_id: momentId,
        answer: finalAnswer,
        points_earned: pointsEarned,
      });

    if (insertError) throw insertError;

    const { data: currentPoints } = await supabaseAdmin
      .from('users')
      .select('points')
      .eq('id', user.id)
      .single();

    await supabaseAdmin
      .from('users')
      .update({ 
        points: (currentPoints?.points || 0) + pointsEarned 
      })
      .eq('id', user.id);

    const { data: allResponses } = await supabaseAdmin
      .from('dna_moment_responses')
      .select('answer')
      .eq('moment_id', momentId);

    const totalResponses = allResponses?.length || 0;
    const optionACount = allResponses?.filter(r => r.answer?.includes('a')).length || 0;
    const optionBCount = allResponses?.filter(r => r.answer?.includes('b')).length || 0;
    const optionCCount = allResponses?.filter(r => r.answer?.includes('c')).length || 0;
    const optionDCount = allResponses?.filter(r => r.answer?.includes('d')).length || 0;
    const optionECount = allResponses?.filter(r => r.answer?.includes('e')).length || 0;

    const stats = {
      totalResponses,
      optionAPercent: totalResponses > 0 ? Math.round((optionACount / totalResponses) * 100) : 20,
      optionBPercent: totalResponses > 0 ? Math.round((optionBCount / totalResponses) * 100) : 20,
      optionCPercent: totalResponses > 0 ? Math.round((optionCCount / totalResponses) * 100) : 20,
      optionDPercent: totalResponses > 0 ? Math.round((optionDCount / totalResponses) * 100) : 20,
      optionEPercent: totalResponses > 0 ? Math.round((optionECount / totalResponses) * 100) : 20,
    };

    const { data: friends } = await supabaseAdmin
      .from('friendships')
      .select('friend_id, user_id')
      .or(`user_id.eq.${user.id},friend_id.eq.${user.id}`)
      .eq('status', 'accepted')
      .limit(10);

    let friendResponses: any[] = [];
    if (friends && friends.length > 0) {
      const friendIds = friends.map(f => f.user_id === user.id ? f.friend_id : f.user_id);
      
      const { data: friendAnswers } = await supabaseAdmin
        .from('dna_moment_responses')
        .select(`
          answer,
          user_id,
          users:user_id(display_name, avatar)
        `)
        .eq('moment_id', momentId)
        .in('user_id', friendIds)
        .limit(5);

      friendResponses = friendAnswers || [];
    }

    const optionMap: Record<string, string> = {
      'a': moment.option_a,
      'b': moment.option_b,
      'c': moment.option_c,
      'd': moment.option_d,
      'e': moment.option_e,
    };
    
    const selectedOptions = answers || [answer];
    const yourChoices = selectedOptions.map((o: string) => optionMap[o]).filter(Boolean);
    const yourChoice = yourChoices.length > 1 ? `${yourChoices.length} items` : yourChoices[0] || 'your pick';
    const yourPercent = answers 
      ? Math.round(selectedOptions.reduce((sum: number, o: string) => {
          const key = `option${o.toUpperCase()}Percent` as keyof typeof stats;
          return sum + (stats[key] || 0);
        }, 0) / selectedOptions.length)
      : answer === 'a' ? stats.optionAPercent : answer === 'b' ? stats.optionBPercent : stats.optionCPercent;
    const matchingFriends = friendResponses.filter(f => {
      if (answers) return answers.some((a: string) => f.answer?.includes(a));
      return f.answer === answer;
    });

    return new Response(JSON.stringify({
      success: true,
      pointsEarned,
      stats,
      yourChoice,
      yourPercent,
      friendResponses,
      matchingFriends,
      message: yourPercent > 50 
        ? `You're with the majority! ${yourPercent}% chose ${yourChoice}` 
        : `You're in the minority! Only ${yourPercent}% chose ${yourChoice}`,
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
