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
      const { friend_id } = await req.json();

      if (!friend_id) {
        return new Response(JSON.stringify({ error: 'friend_id is required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Calculate user's DNA level from logged items
      // Get all lists for user and count items
      const { data: userLists } = await supabaseClient
        .from('lists')
        .select('id')
        .eq('user_id', user.id);

      let itemCount = 0;
      if (userLists && userLists.length > 0) {
        const listIds = userLists.map((l: any) => l.id);
        const { count } = await supabaseClient
          .from('list_items')
          .select('*', { count: 'exact', head: true })
          .in('list_id', listIds);
        itemCount = count || 0;
      }

      // Check if user has completed DNA survey
      const { data: userDnaProfile } = await supabaseClient
        .from('dna_profiles')
        .select('id')
        .eq('user_id', user.id)
        .single();

      const hasSurvey = !!userDnaProfile;

      // DNA Level system (2 levels):
      // Level 0: No survey completed
      // Level 1: Survey completed, less than 30 items
      // Level 2: Survey completed + 30 items = Friend comparisons unlocked
      const currentLevel = !hasSurvey ? 0 : itemCount >= 30 ? 2 : 1;

      if (currentLevel < 2) {
        const itemsNeeded = Math.max(0, 30 - itemCount);
        return new Response(JSON.stringify({ 
          error: !hasSurvey 
            ? 'Complete the DNA survey first to unlock friend comparisons'
            : `Log ${itemsNeeded} more items to unlock friend comparisons`,
          current_level: currentLevel,
          required_level: 2,
          items_logged: itemCount,
          items_needed: itemsNeeded,
          has_survey: hasSurvey
        }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Check cache first
      const { data: cachedComparison } = await supabaseClient
        .from('dna_comparisons')
        .select('*')
        .or(`and(user_id_1.eq.${user.id},user_id_2.eq.${friend_id}),and(user_id_1.eq.${friend_id},user_id_2.eq.${user.id})`)
        .gte('expires_at', new Date().toISOString())
        .single();

      if (cachedComparison) {
        return new Response(JSON.stringify({
          ...cachedComparison,
          from_cache: true
        }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Get both users' signals
      const [userSignalsRes, friendSignalsRes] = await Promise.all([
        supabaseClient
          .from('user_dna_signals')
          .select('signal_type, signal_value, strength')
          .eq('user_id', user.id),
        supabaseClient
          .from('user_dna_signals')
          .select('signal_type, signal_value, strength')
          .eq('user_id', friend_id)
      ]);

      const userSignals = userSignalsRes.data || [];
      const friendSignals = friendSignalsRes.data || [];

      if (userSignals.length === 0 || friendSignals.length === 0) {
        return new Response(JSON.stringify({ 
          error: 'Both users need DNA signals for comparison',
          user_has_signals: userSignals.length > 0,
          friend_has_signals: friendSignals.length > 0
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Get DNA profiles for both users
      const [userProfileRes, friendProfileRes] = await Promise.all([
        supabaseClient.from('dna_profiles').select('label, tagline').eq('user_id', user.id).single(),
        supabaseClient.from('dna_profiles').select('label, tagline').eq('user_id', friend_id).single()
      ]);

      // Get friend's display name
      const { data: friendUser } = await supabaseClient
        .from('users')
        .select('display_name, user_name')
        .eq('id', friend_id)
        .single();

      // Calculate match score
      const userSignalMap = new Map(userSignals.map((s: any) => [`${s.signal_type}:${s.signal_value}`, s.strength]));
      const friendSignalMap = new Map(friendSignals.map((s: any) => [`${s.signal_type}:${s.signal_value}`, s.strength]));

      let matchScore = 0;
      let totalWeight = 0;
      const sharedGenres: string[] = [];
      const sharedCreators: string[] = [];
      const userUnique: string[] = [];
      const friendUnique: string[] = [];

      // Compare signals
      for (const [key, strength] of userSignalMap) {
        const [type, value] = key.split(':');
        if (friendSignalMap.has(key)) {
          const friendStrength = friendSignalMap.get(key) || 0;
          const similarity = 1 - Math.abs(Number(strength) - Number(friendStrength));
          matchScore += similarity * Number(strength);
          totalWeight += Number(strength);

          if (type === 'genre') sharedGenres.push(value);
          if (type === 'creator') sharedCreators.push(value);
        } else {
          if (Number(strength) > 0.5) {
            userUnique.push(`${type}: ${value}`);
          }
        }
      }

      // Find friend's unique signals
      for (const [key, strength] of friendSignalMap) {
        if (!userSignalMap.has(key) && Number(strength) > 0.5) {
          const [type, value] = key.split(':');
          friendUnique.push(`${type}: ${value}`);
        }
      }

      // Normalize match score to 0-100
      const normalizedScore = totalWeight > 0 
        ? Math.round((matchScore / totalWeight) * 100)
        : 50;

      // Get shared titles
      const [userItemsRes, friendItemsRes] = await Promise.all([
        supabaseClient.from('list_items').select('title, media_type').eq('user_id', user.id),
        supabaseClient.from('list_items').select('title, media_type').eq('user_id', friend_id)
      ]);

      const userTitles = new Set((userItemsRes.data || []).map((i: any) => i.title.toLowerCase()));
      const sharedTitles = (friendItemsRes.data || [])
        .filter((i: any) => userTitles.has(i.title.toLowerCase()))
        .slice(0, 10)
        .map((i: any) => ({ title: i.title, media_type: i.media_type }));

      // Generate AI insights
      const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
      let insights: any = {};

      if (openaiApiKey) {
        const insightPrompt = `Given two users' entertainment DNA comparison:

User 1 DNA: ${userProfileRes.data?.label || 'Unknown'} - "${userProfileRes.data?.tagline || ''}"
User 2 (${friendUser?.display_name || 'Friend'}) DNA: ${friendProfileRes.data?.label || 'Unknown'} - "${friendProfileRes.data?.tagline || ''}"

Match Score: ${normalizedScore}%
Shared Genres: ${sharedGenres.slice(0, 5).join(', ') || 'None'}
Shared Creators: ${sharedCreators.slice(0, 5).join(', ') || 'None'}
Shared Titles: ${sharedTitles.slice(0, 5).map((t: any) => t.title).join(', ') || 'None'}
User 1 Unique: ${userUnique.slice(0, 3).join(', ') || 'None'}
User 2 Unique: ${friendUnique.slice(0, 3).join(', ') || 'None'}

Generate brief, fun insights:
1. A one-liner about their compatibility
2. What they'd enjoy together (1-2 suggestions)
3. What User 2 could introduce User 1 to
4. What User 1 could introduce User 2 to

Respond with JSON:
{
  "compatibilityLine": "string (fun one-liner)",
  "enjoyTogether": ["suggestion"],
  "theyCouldIntroduce": ["what friend brings"],
  "youCouldIntroduce": ["what user brings"]
}`;

        try {
          const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${openaiApiKey}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              model: 'gpt-4o-mini',
              messages: [
                { role: 'system', content: 'Generate fun, brief entertainment compatibility insights. Respond only with valid JSON.' },
                { role: 'user', content: insightPrompt }
              ],
              response_format: { type: "json_object" },
              max_tokens: 400,
              temperature: 0.9
            })
          });

          if (openaiResponse.ok) {
            const data = await openaiResponse.json();
            insights = JSON.parse(data.choices[0].message.content);
          }
        } catch (e) {
          console.error('OpenAI insights error:', e);
        }
      }

      // Cache the comparison (expires in 24 hours)
      const comparisonData = {
        user_id_1: user.id,
        user_id_2: friend_id,
        match_score: normalizedScore,
        shared_genres: sharedGenres.slice(0, 10),
        shared_creators: sharedCreators.slice(0, 10),
        shared_titles: sharedTitles,
        differences: { user_unique: userUnique.slice(0, 5), friend_unique: friendUnique.slice(0, 5) },
        insights,
        computed_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      };

      await supabaseClient
        .from('dna_comparisons')
        .upsert(comparisonData, { onConflict: 'user_id_1,user_id_2' });

      return new Response(JSON.stringify({
        ...comparisonData,
        friend_name: friendUser?.display_name || friendUser?.user_name || 'Friend',
        friend_dna_label: friendProfileRes.data?.label,
        friend_dna_tagline: friendProfileRes.data?.tagline,
        your_dna_label: userProfileRes.data?.label,
        your_dna_tagline: userProfileRes.data?.tagline,
        from_cache: false
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
    console.error('Error in compare-dna-friend:', error);
    return new Response(JSON.stringify({
      error: 'Internal server error',
      details: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
