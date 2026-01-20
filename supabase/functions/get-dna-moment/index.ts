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

    const url = new URL(req.url);
    const count = parseInt(url.searchParams.get('count') || '1');
    const requestedCount = Math.min(Math.max(count, 1), 10);

    const authHeader = req.headers.get('Authorization');
    let userId = null;
    if (authHeader) {
      const token = authHeader.replace('Bearer ', '');
      const { data: { user } } = await supabaseAdmin.auth.getUser(token);
      userId = user?.id;
    }

    let answeredMomentIds: string[] = [];
    if (userId) {
      const { data: userResponses } = await supabaseAdmin
        .from('dna_moment_responses')
        .select('moment_id')
        .eq('user_id', userId);
      
      answeredMomentIds = (userResponses || []).map((r: any) => r.moment_id);
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const moments: any[] = [];

    const { data: scheduledMoment } = await supabaseAdmin
      .from('dna_moments')
      .select('*')
      .eq('is_active', true)
      .gte('display_date', today.toISOString())
      .lt('display_date', tomorrow.toISOString())
      .limit(1)
      .single();

    if (scheduledMoment) {
      moments.push({
        id: scheduledMoment.id,
        questionText: scheduledMoment.question_text,
        optionA: scheduledMoment.option_a,
        optionB: scheduledMoment.option_b,
        optionC: scheduledMoment.option_c || null,
        optionD: scheduledMoment.option_d || null,
        optionE: scheduledMoment.option_e || null,
        category: scheduledMoment.category,
        isMultiSelect: scheduledMoment.is_multi_select || false
      });
    }

    if (moments.length < requestedCount) {
      let query = supabaseAdmin
        .from('dna_moments')
        .select('*')
        .eq('is_active', true)
        .is('display_date', null);

      const existingIds = moments.map(m => m.id);
      const excludeIds = [...answeredMomentIds, ...existingIds];
      
      if (excludeIds.length > 0) {
        query = query.not('id', 'in', `(${excludeIds.join(',')})`);
      }

      const { data: randomMoments } = await query.limit(requestedCount * 2);

      if (randomMoments && randomMoments.length > 0) {
        const shuffled = randomMoments.sort(() => Math.random() - 0.5);
        const needed = requestedCount - moments.length;
        
        for (let i = 0; i < Math.min(needed, shuffled.length); i++) {
          const m = shuffled[i];
          moments.push({
            id: m.id,
            questionText: m.question_text,
            optionA: m.option_a,
            optionB: m.option_b,
            optionC: m.option_c || null,
            optionD: m.option_d || null,
            optionE: m.option_e || null,
            category: m.category,
            isMultiSelect: m.is_multi_select || false
          });
        }
      }
    }

    if (moments.length === 0) {
      return new Response(JSON.stringify({ 
        moments: [], 
        answeredIds: answeredMomentIds,
        message: 'No DNA moments available' 
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (requestedCount === 1 && moments.length === 1) {
      const moment = moments[0];
      const hasAnswered = answeredMomentIds.includes(moment.id);
      let userAnswer = null;

      if (hasAnswered && userId) {
        const { data: response } = await supabaseAdmin
          .from('dna_moment_responses')
          .select('answer')
          .eq('user_id', userId)
          .eq('moment_id', moment.id)
          .single();
        userAnswer = response?.answer;
      }

      const { data: allResponses } = await supabaseAdmin
        .from('dna_moment_responses')
        .select('answer')
        .eq('moment_id', moment.id);

      const totalResponses = allResponses?.length || 0;
      const optionACount = allResponses?.filter((r: any) => r.answer === 'a').length || 0;
      const optionBCount = allResponses?.filter((r: any) => r.answer === 'b').length || 0;
      const optionCCount = allResponses?.filter((r: any) => r.answer === 'c').length || 0;

      const optionDCount = allResponses?.filter((r: any) => r.answer?.includes('d')).length || 0;
      const optionECount = allResponses?.filter((r: any) => r.answer?.includes('e')).length || 0;

      const stats = {
        totalResponses,
        optionAPercent: totalResponses > 0 ? Math.round((optionACount / totalResponses) * 100) : 20,
        optionBPercent: totalResponses > 0 ? Math.round((optionBCount / totalResponses) * 100) : 20,
        optionCPercent: totalResponses > 0 ? Math.round((optionCCount / totalResponses) * 100) : 20,
        optionDPercent: totalResponses > 0 ? Math.round((optionDCount / totalResponses) * 100) : 20,
        optionEPercent: totalResponses > 0 ? Math.round((optionECount / totalResponses) * 100) : 20,
      };

      return new Response(JSON.stringify({
        moment,
        hasAnswered,
        userAnswer,
        stats,
        friendResponses: []
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({
      moments,
      answeredIds: answeredMomentIds
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
