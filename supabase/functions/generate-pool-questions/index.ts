import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'OPTIONS, POST'
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'No authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const body = await req.json();
    const { pool_id, media_title, media_type, pool_type } = body;

    if (!pool_id) {
      return new Response(JSON.stringify({ error: 'Pool ID is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const openaiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiKey) {
      return new Response(JSON.stringify({ error: 'OpenAI not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    let prompt = '';
    if (media_title) {
      if (pool_type === 'eliminations') {
        prompt = `Generate 5 fun prediction questions for a friend group watching "${media_title}" (${media_type || 'TV show'}). Focus on elimination predictions, like "Who gets eliminated next?", "Who makes it to the finale?", etc. Each question should have 2-4 possible answer options that are generic (like "Main character 1", "Fan favorite", "Dark horse", "Wildcard pick") since you don't know the actual contestants.

Return JSON array with format:
[{"question": "...", "type": "prediction", "options": ["Option 1", "Option 2", "Option 3"]}]`;
      } else if (pool_type === 'tournament') {
        prompt = `Generate 5 fun bracket-style prediction questions for a friend group discussing "${media_title}" (${media_type || 'TV show'}). Focus on matchup-style questions like "Who would win in a showdown?", "Best episode?", "Most iconic moment?". Each question should have 2-4 options.

Return JSON array with format:
[{"question": "...", "type": "prediction", "options": ["Option 1", "Option 2", "Option 3"]}]`;
      } else {
        prompt = `Generate 5 fun prediction and trivia questions for a friend group discussing "${media_title}" (${media_type || 'TV show'}). Mix of:
- 2 predictions (things that haven't happened yet or fan opinions)
- 2 polls (no right answer, just opinions like "Who's the best character?")
- 1 trivia (factual question about the show)

Each question should have 2-4 answer options.

Return JSON array with format:
[{"question": "...", "type": "prediction|poll|trivia", "options": ["Option 1", "Option 2"]}]`;
      }
    } else {
      prompt = `Generate 5 fun general entertainment prediction questions for a friend group. Mix of predictions and polls about TV, movies, music, etc. Each question should have 2-4 answer options.

Return JSON array with format:
[{"question": "...", "type": "prediction|poll", "options": ["Option 1", "Option 2", "Option 3"]}]`;
    }

    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are a helpful assistant that generates fun prediction and trivia questions for friend groups. Always respond with valid JSON only, no markdown or explanations.'
          },
          { role: 'user', content: prompt }
        ],
        temperature: 0.8,
        max_tokens: 1000,
      }),
    });

    if (!openaiResponse.ok) {
      const errText = await openaiResponse.text();
      console.error('OpenAI error:', errText);
      return new Response(JSON.stringify({ error: 'Failed to generate questions' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const openaiData = await openaiResponse.json();
    const content = openaiData.choices?.[0]?.message?.content || '[]';
    
    let questions = [];
    try {
      const cleanContent = content.replace(/```json\n?|\n?```/g, '').trim();
      questions = JSON.parse(cleanContent);
    } catch (e) {
      console.error('Failed to parse OpenAI response:', content);
      return new Response(JSON.stringify({ error: 'Failed to parse generated questions' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({
      success: true,
      questions: questions
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ error: error.message || 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
