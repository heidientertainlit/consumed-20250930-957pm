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
    let userId: string | null = null;
    if (authHeader) {
      const token = authHeader.replace('Bearer ', '');
      const { data: { user } } = await supabaseAdmin.auth.getUser(token);
      userId = user?.id ?? null;
    }

    let answeredMomentIds: string[] = [];
    if (userId) {
      const { data: userResponses } = await supabaseAdmin
        .from('dna_moment_responses')
        .select('moment_id')
        .eq('user_id', userId);
      
      answeredMomentIds = (userResponses || []).map((r: { moment_id: string }) => r.moment_id);
    }

    let query = supabaseAdmin
      .from('dna_moments')
      .select('*')
      .eq('is_active', true);

    if (answeredMomentIds.length > 0) {
      query = query.not('id', 'in', `(${answeredMomentIds.join(',')})`);
    }

    const { data: availableMoments, error: momentsError } = await query;

    if (momentsError) {
      console.error('Error fetching moments:', momentsError);
      throw momentsError;
    }

    if (!availableMoments || availableMoments.length === 0) {
      return new Response(JSON.stringify({ 
        moments: [], 
        answeredIds: answeredMomentIds,
        allAnswered: true,
        message: 'You have answered all DNA moments!' 
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const shuffled = availableMoments.sort(() => Math.random() - 0.5);
    const selected = shuffled.slice(0, requestedCount);

    const moments = selected.map((m: {
      id: string;
      question_text: string;
      option_a: string;
      option_b: string;
      option_c?: string;
      option_d?: string;
      option_e?: string;
      category: string;
      is_multi_select?: boolean;
    }) => ({
      id: m.id,
      questionText: m.question_text,
      optionA: m.option_a,
      optionB: m.option_b,
      optionC: m.option_c || null,
      optionD: m.option_d || null,
      optionE: m.option_e || null,
      category: m.category,
      isMultiSelect: m.is_multi_select || false
    }));

    if (requestedCount === 1 && moments.length === 1) {
      const moment = moments[0];

      const { data: allResponses } = await supabaseAdmin
        .from('dna_moment_responses')
        .select('answer')
        .eq('moment_id', moment.id);

      const totalResponses = allResponses?.length || 0;
      const optionACount = allResponses?.filter((r: { answer: string }) => r.answer === 'a').length || 0;
      const optionBCount = allResponses?.filter((r: { answer: string }) => r.answer === 'b').length || 0;
      const optionCCount = allResponses?.filter((r: { answer: string }) => r.answer === 'c').length || 0;
      const optionDCount = allResponses?.filter((r: { answer: string }) => r.answer === 'd').length || 0;
      const optionECount = allResponses?.filter((r: { answer: string }) => r.answer === 'e').length || 0;

      const stats = {
        totalResponses,
        optionAPercent: totalResponses > 0 ? Math.round((optionACount / totalResponses) * 100) : 50,
        optionBPercent: totalResponses > 0 ? Math.round((optionBCount / totalResponses) * 100) : 50,
        optionCPercent: totalResponses > 0 ? Math.round((optionCCount / totalResponses) * 100) : 0,
        optionDPercent: totalResponses > 0 ? Math.round((optionDCount / totalResponses) * 100) : 0,
        optionEPercent: totalResponses > 0 ? Math.round((optionECount / totalResponses) * 100) : 0,
      };

      return new Response(JSON.stringify({
        moment,
        hasAnswered: false,
        userAnswer: null,
        stats,
        friendResponses: [],
        remainingCount: availableMoments.length - 1
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({
      moments,
      answeredIds: answeredMomentIds,
      remainingCount: availableMoments.length - moments.length
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
