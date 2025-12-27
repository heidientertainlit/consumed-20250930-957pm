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
      // Verify user has logged at least 30 items
      const { data: levelData } = await supabaseClient
        .from('user_dna_levels')
        .select('items_logged, media_types_count')
        .eq('user_id', user.id)
        .single();

      if (!levelData || levelData.items_logged < 30) {
        return new Response(JSON.stringify({ 
          error: 'Not enough items logged',
          items_logged: levelData?.items_logged || 0,
          items_required: 30
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Get survey responses (40% weight)
      const { data: responses } = await supabaseClient
        .from('edna_responses')
        .select(`question_id, answer_text, edna_questions!inner(question_text)`)
        .eq('user_id', user.id);

      // Get DNA signals from logged behavior (60% weight)
      const { data: signals } = await supabaseClient
        .from('user_dna_signals')
        .select('signal_type, signal_value, strength, source_count')
        .eq('user_id', user.id)
        .order('strength', { ascending: false })
        .limit(50);

      // Get actual logged items for deeper analysis
      const { data: recentItems } = await supabaseClient
        .from('list_items')
        .select('title, media_type, creator, rating, year')
        .eq('user_id', user.id)
        .order('added_at', { ascending: false })
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

      const formattedItems = recentItems
        ?.map((i: any) => `${i.title} (${i.media_type}${i.rating ? `, rated ${i.rating}/5` : ''})`)
        .join('\n') || 'No items';

      // Identify potential anti-preferences (genres/types with low strength despite many items)
      const lowStrengthSignals = signals
        ?.filter((s: any) => s.strength < 0.3 && s.source_count >= 2)
        .map((s: any) => `${s.signal_type}: ${s.signal_value}`)
        .join(', ') || 'None detected';

      const prompt = `You are generating a Level 3 "DNA Blueprint" for a user's Entertainment DNA.

This is their FULL taste profile, heavily weighted toward actual behavior (60%) over survey (40%). This is the deepest level of understanding.

DATA SOURCE: 40% Survey + 60% Logged Behavior

SURVEY RESPONSES (what they said):
${formattedResponses}

BEHAVIORAL SIGNALS (aggregated patterns):
${formattedSignals}

RECENT ITEMS LOGGED:
${formattedItems}

LOW-STRENGTH PATTERNS (potential anti-preferences):
${lowStrengthSignals}

ANALYSIS INSTRUCTIONS:
- This is behavior-based truth, not just self-perception
- Identify contradictions between survey and behavior
- Detect "guilty pleasures" - things they consume but might not admit
- Find anti-preferences - genres/types they consistently avoid
- Note taste evolution if visible

Generate a DNA Blueprint with:

1. **Label** (2-5 words) — Their true archetype based on behavior
2. **Tagline** (≤120 chars) — Captures their authentic taste identity
3. **Profile Text** (100-140 words) — Address as "You...". Reference "Entertainment DNA". Be insightful about the GAP between what they say and do. This is their blueprint.
4. **5 Flavor Notes** — 3-5 words each, nuanced traits
5. **"You Tend To..." Insights** — 3 behavioral observations
6. **Anti-Preferences** — What they consistently avoid
7. **Guilty Pleasures** — Things they consume that might surprise
8. **Taste Contradictions** — Where stated and actual preferences differ

CRITICAL: This is the deepest level. Be perceptive and honest. Synthesize, don't list.

Respond with JSON:
{
  "label": "string",
  "tagline": "string",
  "profileText": "string",
  "flavorNotes": ["string", "string", "string", "string", "string"],
  "tendToInsights": ["string", "string", "string"],
  "antiPreferences": ["string"],
  "guiltyPleasures": ["string"],
  "tasteContradictions": ["string"],
  "favoriteGenres": ["from signals"],
  "favoriteMediaTypes": ["from signals"],
  "topCreators": ["from signals"],
  "favoriteDecades": ["from signals"],
  "dnaLevel": 3,
  "levelName": "DNA Blueprint"
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
              content: 'You are a perceptive brand copywriter for Consumed. Voice: insightful, warm, honest. This is Level 3 - the deepest DNA analysis. You can see contradictions between what users say and do. Be a perceptive friend who "gets" them. Always write "Entertainment DNA" exactly. Respond only with valid JSON.'
            },
            { role: 'user', content: prompt }
          ],
          response_format: { type: "json_object" },
          max_tokens: 1200,
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

      // Update DNA level to 3
      await supabaseClient
        .from('user_dna_levels')
        .update({ 
          current_level: 3,
          last_level_up: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('user_id', user.id);

      return new Response(JSON.stringify({
        ...profileData,
        tend_to_insights: generatedProfile.tendToInsights,
        anti_preferences: generatedProfile.antiPreferences,
        guilty_pleasures: generatedProfile.guiltyPleasures,
        taste_contradictions: generatedProfile.tasteContradictions,
        top_creators: generatedProfile.topCreators,
        favorite_decades: generatedProfile.favoriteDecades,
        dna_level: 3,
        level_name: 'DNA Blueprint',
        unlocks: [
          'Friend DNA matchups',
          'Anti-preferences detected',
          'Guilty pleasures revealed',
          'Taste Face-Offs',
          '"Watch Together" recommendations'
        ]
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
    console.error('Error in generate-dna-blueprint:', error);
    return new Response(JSON.stringify({
      error: 'Internal server error',
      details: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
