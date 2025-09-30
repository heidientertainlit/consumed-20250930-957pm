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

      // Create OpenAI prompt with actual questions and answers
      const prompt = `Based on the following entertainment survey responses, create a personalized Entertainment DNA profile that SPECIFICALLY reflects their actual answers. Pay close attention to their exact preferences mentioned.

Survey Responses:
${formattedResponses}

Create a profile that directly reflects their specific answers about:
- Their favorite sports teams/players mentioned
- Their exact genre preferences listed
- Their comfort shows and entertainment mentioned
- Their discovery methods and social preferences

Please provide a JSON response with the following structure:
{
  "profileText": "A 2-3 paragraph personalized profile that directly references their specific answers (teams, shows, genres, etc.)",
  "favoriteGenres": ["extract exact genres they mentioned"],
  "favoriteMediaTypes": ["extract exact media types they prefer"],
  "favoriteSports": ["extract sports they mentioned"] (if applicable),
  "mediaConsumptionStats": {
    "primaryMediaType": "based on their media type answers",
    "viewingStyle": "based on their consumption patterns mentioned",
    "discoveryMethod": "based on their discovery preferences",
    "socialAspect": "based on their sharing/social preferences"
  }
}

Make sure the profile specifically mentions their actual preferences like teams, shows, genres they listed, not generic entertainment descriptions.`;

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
              content: 'You are an expert entertainment analyst who creates highly personalized Entertainment DNA profiles based on specific user responses. Always reference their exact answers and preferences. Respond only with valid JSON.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          response_format: { type: "json_object" },
          max_tokens: 1000,
          temperature: 0.7
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
