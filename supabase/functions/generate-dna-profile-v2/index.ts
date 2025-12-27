import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const jwt = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(jwt);

    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (req.method === 'POST') {
      // Verify user has logged at least 15 items
      const { data: levelData } = await supabaseClient
        .from('user_dna_levels')
        .select('items_logged')
        .eq('user_id', user.id)
        .single();

      if (!levelData || levelData.items_logged < 15) {
        return new Response(JSON.stringify({ 
          error: 'Not enough items logged',
          items_logged: levelData?.items_logged || 0,
          items_required: 15
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Get survey responses (60% weight)
      const { data: responses } = await supabaseClient
        .from('edna_responses')
        .select(`question_id, answer_text, edna_questions!inner(question_text)`)
        .eq('user_id', user.id);

      // Get DNA signals from logged behavior (40% weight)
      const { data: signals } = await supabaseClient
        .from('user_dna_signals')
        .select('signal_type, signal_value, strength, source_count')
        .eq('user_id', user.id)
        .order('strength', { ascending: false })
        .limit(30);

      const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
      if (!openaiApiKey) {
        return new Response(JSON.stringify({ error: 'OpenAI API key not configured' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const formattedResponses = responses
        ?.map((r: any) => `Q: ${r.edna_questions.question_text}\nA: ${r.answer_text}`)
        .join('\n\n') || 'No survey responses';

      const formattedSignals = signals
        ?.map((s: any) => `${s.signal_type}: ${s.signal_value} (strength: ${s.strength}, from ${s.source_count} items)`)
        .join('\n') || 'No behavioral signals';

      const prompt = `You are generating a Level 2 "DNA Profile" for a user's Entertainment DNA.

This blends their survey responses (60%) with actual logged behavior (40%). Their DNA is now EMERGING based on real consumption.

DATA SOURCE: 60% Survey + 40% Logged Behavior

SURVEY RESPONSES (what they say they like):
${formattedResponses}

BEHAVIORAL SIGNALS (what they actually consume):
${formattedSignals}

BLENDING INSTRUCTIONS:
- If behavior contradicts survey, gently incorporate the reality without shaming
- Highlight patterns emerging from their actual consumption
- Note any interesting gaps between stated and actual preferences

Generate a DNA Profile with:

1. **Label** (2-5 words) — A punchy archetype name, now informed by behavior
2. **Tagline** (≤120 chars) — One playful line capturing their emerging identity
3. **Profile Text** (90-120 words) — Address as "You...". Reference "Entertainment DNA". Blend survey + behavior insights. Acknowledge their taste is becoming clearer.
4. **4 Flavor Notes** — 3-5 words each
5. **"You Tend To..." Insights** — 2-3 behavioral observations based on their logged patterns
6. **Cross-Media Patterns** — Note any patterns across different media types

IMPORTANT: Synthesize, don't list. Focus on the psychology behind their choices.

Respond with JSON:
{
  "label": "string",
  "tagline": "string",
  "profileText": "string",
  "flavorNotes": ["string", "string", "string", "string"],
  "tendToInsights": ["string", "string"],
  "crossMediaPatterns": ["string"],
  "favoriteGenres": ["from signals"],
  "favoriteMediaTypes": ["from signals"],
  "topCreators": ["from signals"],
  "dnaLevel": 2,
  "levelName": "DNA Profile"
}`;

      const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openaiApiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          messages: [
            {
              role: 'system',
              content: 'You are a brand copywriter for Consumed. Voice: witty, warm, insightful. Always write "Entertainment DNA" exactly. You can now see real behavioral data - use it to create deeper insights. Respond only with valid JSON.'
            },
            { role: 'user', content: prompt }
          ],
          response_format: { type: "json_object" },
          max_tokens: 1000,
          temperature: 0.85
        })
      });

      if (!openaiResponse.ok) {
        throw new Error(`OpenAI API error: ${openaiResponse.status}`);
      }

      const openaiData = await openaiResponse.json();
      const generatedProfile = JSON.parse(openaiData.choices[0].message.content);

      // Save to dna_profiles
      const { data: existingProfile } = await supabaseClient
        .from('dna_profiles')
        .select('id')
        .eq('user_id', user.id)
        .single();

      const profilePayload = {
        user_id: user.id,
        profile_text: generatedProfile.profileText,
        favorite_genres: generatedProfile.favoriteGenres,
        favorite_media_types: generatedProfile.favoriteMediaTypes,
        label: generatedProfile.label,
        tagline: generatedProfile.tagline,
        flavor_notes: generatedProfile.flavorNotes,
        superpowers: generatedProfile.tendToInsights,
        is_private: false,
        updated_at: new Date().toISOString()
      };

      let profileData;
      if (existingProfile) {
        const { data, error } = await supabaseClient
          .from('dna_profiles')
          .update(profilePayload)
          .eq('user_id', user.id)
          .select()
          .single();
        if (error) throw error;
        profileData = data;
      } else {
        const { data, error } = await supabaseClient
          .from('dna_profiles')
          .insert(profilePayload)
          .select()
          .single();
        if (error) throw error;
        profileData = data;
      }

      // Update DNA level to 2
      await supabaseClient
        .from('user_dna_levels')
        .update({ 
          current_level: 2,
          last_level_up: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('user_id', user.id);

      return new Response(JSON.stringify({
        ...profileData,
        tend_to_insights: generatedProfile.tendToInsights,
        cross_media_patterns: generatedProfile.crossMediaPatterns,
        top_creators: generatedProfile.topCreators,
        dna_level: 2,
        level_name: 'DNA Profile',
        unlocks: ['Celebrity DNA matching', '"You tend to..." insights', 'Cross-media patterns']
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error in generate-dna-profile-v2:', error);
    return new Response(JSON.stringify({
      error: 'Internal server error',
      details: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
