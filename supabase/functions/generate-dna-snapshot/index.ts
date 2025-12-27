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
      // Get user's survey responses
      const { data: responses, error: responsesError } = await supabaseClient
        .from('edna_responses')
        .select(`question_id, answer_text, edna_questions!inner(question_text)`)
        .eq('user_id', user.id);

      if (responsesError) throw responsesError;

      if (!responses || responses.length === 0) {
        return new Response(JSON.stringify({ error: 'No survey responses found. Complete the survey first.' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
      if (!openaiApiKey) {
        return new Response(JSON.stringify({ error: 'OpenAI API key not configured' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const formattedResponses = responses
        .map((r: any) => `Q: ${r.edna_questions.question_text}\nA: ${r.answer_text}`)
        .join('\n\n');

      const prompt = `You are generating a Level 1 "DNA Snapshot" for a user's Entertainment DNA.

This is based ONLY on their survey responses (self-reported preferences). This is their starting point.

DATA SOURCE: 100% Survey (self-perception)

Survey Responses:
${formattedResponses}

Generate a DNA Snapshot with:

1. **Label** (2-5 words) — A punchy archetype name. Examples: "Cozy Completionist", "Twist-Hunting Sleuth", "Vibe-Forward Aesthete"
2. **Tagline** (≤120 chars) — One playful line that captures their essence
3. **Profile Text** (60-90 words) — Address them as "You...". Reference "Entertainment DNA" by name. Keep it warm but acknowledge this is their starting point based on what they SAY they like.
4. **3 Flavor Notes** — 3-5 words each, capturing broad traits

IMPORTANT: Synthesize patterns, don't just list what they said. Focus on the WHY behind their preferences.

Respond with JSON:
{
  "label": "string",
  "tagline": "string", 
  "profileText": "string",
  "flavorNotes": ["string", "string", "string"],
  "favoriteGenres": ["extracted from responses"],
  "favoriteMediaTypes": ["extracted from responses"],
  "dnaLevel": 1,
  "levelName": "DNA Snapshot"
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
              content: 'You are a brand copywriter for Consumed ("entertainment — with benefits"). Voice: witty, warm, smart. Always write "Entertainment DNA" exactly. Respond only with valid JSON.'
            },
            { role: 'user', content: prompt }
          ],
          response_format: { type: "json_object" },
          max_tokens: 800,
          temperature: 0.85
        })
      });

      if (!openaiResponse.ok) {
        throw new Error(`OpenAI API error: ${openaiResponse.status}`);
      }

      const openaiData = await openaiResponse.json();
      const generatedProfile = JSON.parse(openaiData.choices[0].message.content);

      // Save to dna_profiles table
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

      // Ensure DNA level is set to at least 1
      await supabaseClient
        .from('user_dna_levels')
        .upsert({
          user_id: user.id,
          current_level: 1,
          items_logged: 0,
          updated_at: new Date().toISOString()
        }, { onConflict: 'user_id' });

      return new Response(JSON.stringify({
        ...profileData,
        dna_level: 1,
        level_name: 'DNA Snapshot'
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
    console.error('Error in generate-dna-snapshot:', error);
    return new Response(JSON.stringify({
      error: 'Internal server error',
      details: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
