import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Create Supabase client with service role key
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    // Get the authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Extract the JWT token
    const jwt = authHeader.replace('Bearer ', '');

    // Get user from JWT token using service role client
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(jwt);

    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized: ' + (userError?.message || 'No user') }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (req.method === 'POST') {
      // Get user's survey responses with question text
      const { data: responses, error: responsesError } = await supabaseClient
        .from('edna_responses')
        .select(`
          question_id, 
          answer_text,
          edna_questions!inner(question_text)
        `)
        .eq('user_id', user.id);

      if (responsesError) {
        throw responsesError;
      }

      if (!responses || responses.length === 0) {
        return new Response(JSON.stringify({ error: 'No survey responses found. Complete the survey first.' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Get OpenAI API key
      const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
      if (!openaiApiKey) {
        return new Response(JSON.stringify({ error: 'OpenAI API key not configured' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Format responses with actual question text for OpenAI
      const formattedResponses = responses
        .map((r) => `Q: ${r.edna_questions.question_text}\nA: ${r.answer_text}`)
        .join('\n\n');

      // Create OpenAI prompt using improved Entertainment DNA specification
      const prompt = `You'll receive Entertainment DNA survey answers. Produce:

1. **Archetype Label** — 2–5 words, punchy and specific. Compose as \`modifier + base\` when helpful (e.g., "Cozy Completionist," "Twist-Hunting Sleuth," "Vibe-Forward Aesthete," "Canon Keeper," "Lore Librarian," "Hype Surfer," "Sideline Strategist"). If sports are prominent, you may append a tasteful modifier (e.g., "• NBA Edition"). Avoid bland words like "Enthusiast/Explorer."
2. **One-Line Tag** — ≤120 characters, playful, riffs on the label.
3. **Bio Paragraph** — 90–130 words. Address the user as "You…". Reference **Entertainment DNA** by name. Weave **2–4 specifics** from their inputs (genres, named favorites, comfort picks, drivers, discovery habits, sports/teams). Use **one** rhetorical device (metaphor, contrast, micro-story, or a crisp claim). No clichés; don't repeat the same opener across users; never invent titles they didn't list.
4. **3 Flavor Notes** — bullets, 3–5 words each, crisp traits.

**Archetype logic**
* **Primary axis = Drivers** → map to base nouns:
  * feel something → *Heart-First* / *Emotion-Seeker*
  * escape → *World-Hopper* / *Escape Artist*
  * connect with others → *Social Watcher* / *Clubhouse Fan*
  * visuals/vibe → *Aesthete* / *Vibe Curator*
  * easy to unwind → *Cozy Sipper*
  * figure things out → *Sleuth* / *Puzzle-Solver*
  * curious about people → *Human-Story Scout*
  * fun/action → *Adrenaline Chaser*
* **Modifiers** from top genres, mediums, discovery methods, comfort preferences, or sports.

**Style guardrails**
* Always say **Entertainment DNA** (not just "DNA").
* Keep it human; one wink of humor max; no sales pitch.
* Vary openings; ban these repeated phrases: "you're the kind of person who," "from bingeing to," "at the end of the day."
* If inputs are sparse, write a shorter bio (≤100 words) without guessing.
* For any fields where no input was provided (discovery method, social sharing, comfort picks, sports), return null or omit from the bio. Never invent data the user didn't provide.

Survey Responses:
${formattedResponses}

Please provide a JSON response with the following structure:
{
  "label": "string (2–5 words archetype label)",
  "tagline": "string (≤120 chars one-line tag)",
  "profileText": "string (90–130 words bio paragraph using 'Entertainment DNA')",
  "favoriteGenres": ["extract exact genres mentioned"],
  "favoriteMediaTypes": ["extract exact media types mentioned"],
  "favoriteSports": ["extract sports mentioned if applicable"],
  "flavorNotes": ["3–5 words", "3–5 words", "3–5 words"],
  "mediaConsumptionStats": {
    "primaryMediaType": "based on their media type answers",
    "viewingStyle": "based on their consumption patterns mentioned",
    "discoveryMethod": "based on their discovery preferences",
    "socialAspect": "based on their sharing/social preferences"
  }
}

Reference their specific answers about teams, shows, genres, and comfort entertainment. Make it personal and varied.`;

      // Call OpenAI API
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
              content: 'You are a brand copywriter for **Consumed** ("entertainment — with benefits"). Voice: witty, warm, smart, fun—not cheesy. Always write **Entertainment DNA** exactly. Keep things positive and human. Avoid politics/religion takes. Use gender only if explicitly relevant to entertainment identity. Vary syntax so outputs don\'t feel templated. Respond only with valid JSON.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          response_format: { type: "json_object" },
          max_tokens: 1200,
          temperature: 0.9
        })
      });

      if (!openaiResponse.ok) {
        throw new Error(`OpenAI API error: ${openaiResponse.status}`);
      }

      const openaiData = await openaiResponse.json();
      const generatedProfile = JSON.parse(openaiData.choices[0].message.content);

      // Save or update the profile in the database
      const { data: existingProfile } = await supabaseClient
        .from('dna_profiles')
        .select('id')
        .eq('user_id', user.id)
        .single();

      let profileData;
      if (existingProfile) {
        // Update existing profile
        const { data: updatedProfile, error } = await supabaseClient
          .from('dna_profiles')
          .update({
            profile_text: generatedProfile.profileText,
            favorite_genres: generatedProfile.favoriteGenres,
            favorite_media_types: generatedProfile.favoriteMediaTypes,
            favorite_sports: generatedProfile.favoriteSports,
            media_consumption_stats: JSON.stringify(generatedProfile.mediaConsumptionStats),
            label: generatedProfile.label,
            tagline: generatedProfile.tagline,
            flavor_notes: generatedProfile.flavorNotes,
            updated_at: new Date().toISOString()
          })
          .eq('user_id', user.id)
          .select()
          .single();

        if (error) {
          throw error;
        }
        
        profileData = updatedProfile;
      } else {
        // Create new profile
        const { data: newProfile, error } = await supabaseClient
          .from('dna_profiles')
          .insert({
            user_id: user.id,
            profile_text: generatedProfile.profileText,
            favorite_genres: generatedProfile.favoriteGenres,
            favorite_media_types: generatedProfile.favoriteMediaTypes,
            favorite_sports: generatedProfile.favoriteSports,
            media_consumption_stats: JSON.stringify(generatedProfile.mediaConsumptionStats),
            label: generatedProfile.label,
            tagline: generatedProfile.tagline,
            flavor_notes: generatedProfile.flavorNotes,
            is_private: false
          })
          .select()
          .single();

        if (error) {
          throw error;
        }
        
        profileData = newProfile;
      }

      return new Response(JSON.stringify(profileData), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error in generate-dna-profile function:', error);
    return new Response(JSON.stringify({
      error: 'Internal server error',
      details: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
