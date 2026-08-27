import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { AFFINITY_ALGORITHM_VERSION, scoreAffinitySignals } from '../_shared/affinity-score.ts';
import { canAccessDnaComparison } from '../_shared/comparison-access.ts';

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

      if (friend_id === user.id) {
        return new Response(JSON.stringify({ error: 'You cannot compare DNA with yourself' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // A comparison is not a profile lookup. Check blocks in both directions
      // before reading or returning cache data.
      const [targetUserResult, targetProfileResult, relationResult, blockResult, targetEligibilityResult] = await Promise.all([
        supabaseClient.from('users').select('id,is_persona,people_discoverable').eq('id', friend_id).maybeSingle(),
        supabaseClient.from('dna_profiles').select('id,is_private').eq('user_id', friend_id).maybeSingle(),
        supabaseClient.from('friendships').select('id').eq('status', 'accepted')
          .or(`and(user_id.eq.${user.id},friend_id.eq.${friend_id}),and(user_id.eq.${friend_id},friend_id.eq.${user.id})`).limit(1).maybeSingle(),
        supabaseClient.from('user_blocks').select('id')
          .or(`and(blocker_id.eq.${user.id},blocked_id.eq.${friend_id}),and(blocker_id.eq.${friend_id},blocked_id.eq.${user.id})`).limit(1).maybeSingle(),
        supabaseClient.from('people_affinity_eligibility').select('tracked_items').eq('user_id', friend_id).maybeSingle(),
      ]);
      const eligibilityError = targetUserResult.error || targetProfileResult.error || relationResult.error || blockResult.error || targetEligibilityResult.error;
      if (eligibilityError) {
        console.error('Failed to check DNA comparison eligibility:', eligibilityError);
        return new Response(JSON.stringify({ error: 'Could not verify DNA comparison eligibility' }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      const targetUser = targetUserResult.data;
      const targetProfile = targetProfileResult.data;
      const relation = relationResult.data;
      const block = blockResult.data;
      const isFriend = !!relation;
      let hasDiscoveryRelationship = false;
      if (!isFriend && targetUser && !targetUser.is_persona && !block && targetProfile && !targetProfile.is_private
        && targetUser.people_discoverable && Number(targetEligibilityResult.data?.tracked_items || 0) >= 10) {
        const { data: discoveryComparison, error: discoveryError } = await supabaseClient
          .from('dna_comparisons')
          .select('user_id_1')
          .or(`and(user_id_1.eq.${user.id},user_id_2.eq.${friend_id}),and(user_id_1.eq.${friend_id},user_id_2.eq.${user.id})`)
          .contains('insights', { algorithm_version: AFFINITY_ALGORITHM_VERSION })
          .limit(1)
          .maybeSingle();
        if (discoveryError) {
          console.error('Failed to verify discovery relationship:', discoveryError);
          return new Response(JSON.stringify({ error: 'Could not verify DNA comparison eligibility' }), {
            status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        hasDiscoveryRelationship = !!discoveryComparison;
      }
      const canCompare = canAccessDnaComparison({
        targetExists: !!targetUser,
        targetHasProfile: !!targetProfile,
        targetEligible: Number(targetEligibilityResult.data?.tracked_items || 0) >= 10,
        targetIsPersona: !!targetUser?.is_persona,
        blocked: !!block,
        isFriend,
        targetIsPrivate: !!targetProfile?.is_private,
        targetIsDiscoverable: !!targetUser?.people_discoverable,
        hasDiscoveryRelationship,
      });
      if (!canCompare) {
        return new Response(JSON.stringify({ error: 'This person is not eligible for DNA comparison' }), {
          status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const [{ data: userDnaProfile }, { data: userEligibility }] = await Promise.all([
        supabaseClient.from('dna_profiles').select('id').eq('user_id', user.id).maybeSingle(),
        supabaseClient.from('people_affinity_eligibility').select('tracked_items').eq('user_id', user.id).maybeSingle(),
      ]);

      const hasSurvey = !!userDnaProfile;
      const itemCount = Number(userEligibility?.tracked_items || 0);

      // DNA Level system (2 levels):
      // Level 0: No survey completed
      // Level 1: Survey completed, less than 10 items
      // Level 2: Survey completed + 10 items = Friend comparisons unlocked
      const currentLevel = !hasSurvey ? 0 : itemCount >= 10 ? 2 : 1;

      if (currentLevel < 2) {
        const itemsNeeded = Math.max(0, 10 - itemCount);
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

      if (cachedComparison?.insights?.algorithm_version === AFFINITY_ALGORITHM_VERSION) {
        return new Response(JSON.stringify({
          ...cachedComparison,
          from_cache: true
        }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Get both users' signals
      let [userSignalsRes, friendSignalsRes] = await Promise.all([
        supabaseClient
          .from('user_dna_signals')
          .select('signal_type, signal_value, strength')
          .eq('user_id', user.id),
        supabaseClient
          .from('user_dna_signals')
          .select('signal_type, signal_value, strength')
          .eq('user_id', friend_id)
      ]);

      let userSignals = userSignalsRes.data || [];
      let friendSignals = friendSignalsRes.data || [];

      // If signals are missing, try to extract them on the fly
      if (userSignals.length === 0 || friendSignals.length === 0) {
        console.log('Signals missing, attempting to extract...');
        
        // Call extract-dna-signals for users missing signals
        const extractPromises = [];
        if (userSignals.length === 0) {
          extractPromises.push(
            fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/extract-dna-signals`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({ user_id: user.id })
            })
          );
        }
        if (friendSignals.length === 0) {
          extractPromises.push(
            fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/extract-dna-signals`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({ user_id: friend_id })
            })
          );
        }
        
        try {
          await Promise.all(extractPromises);
          
          // Wait a moment for signals to be written
          await new Promise(resolve => setTimeout(resolve, 500));
          
          // Re-fetch signals
          const [newUserSignalsRes, newFriendSignalsRes] = await Promise.all([
            supabaseClient
              .from('user_dna_signals')
              .select('signal_type, signal_value, strength')
              .eq('user_id', user.id),
            supabaseClient
              .from('user_dna_signals')
              .select('signal_type, signal_value, strength')
              .eq('user_id', friend_id)
          ]);
          
          userSignals = newUserSignalsRes.data || [];
          friendSignals = newFriendSignalsRes.data || [];
        } catch (extractError) {
          console.error('Error extracting signals:', extractError);
        }
      }

      // If still no signals, return helpful error
      if (userSignals.length === 0 || friendSignals.length === 0) {
        return new Response(JSON.stringify({ 
          error: 'Could not generate DNA signals for comparison. Try again in a moment.',
          user_has_signals: userSignals.length > 0,
          friend_has_signals: friendSignals.length > 0,
          hint: 'DNA signals are extracted from your tracked items. Make sure both users have logged media.'
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
        .select('display_name, user_name, first_name, last_name')
        .eq('id', friend_id)
        .single();

      // Calculate match score
      const affinityEvidence = scoreAffinitySignals(userSignals, friendSignals);
      const normalizedScore = affinityEvidence.match_score;
      const sharedGenres = affinityEvidence.shared_genres;
      const sharedCreators = affinityEvidence.shared_creators;
      const userUnique = affinityEvidence.differences.user_unique;
      const friendUnique = affinityEvidence.differences.friend_unique;

      // Get shared LOVED titles - only items rated 4-5 stars OR in Favorites list
      // "Loved" = rating >= 4 OR in a Favorites list
      
      // First, find Favorites and DNF list IDs for both users
      const [userListsRes, friendListsRes] = await Promise.all([
        supabaseClient.from('lists').select('id, title').eq('user_id', user.id),
        supabaseClient.from('lists').select('id, title').eq('user_id', friend_id)
      ]);
      
      const userFavListIds = new Set((userListsRes.data || [])
        .filter((l: any) => l.title?.toLowerCase().includes('favorite'))
        .map((l: any) => l.id));
      const userDnfListIds = new Set((userListsRes.data || [])
        .filter((l: any) => l.title?.toLowerCase().includes('did not finish'))
        .map((l: any) => l.id));
        
      const friendFavListIds = new Set((friendListsRes.data || [])
        .filter((l: any) => l.title?.toLowerCase().includes('favorite'))
        .map((l: any) => l.id));
      const friendDnfListIds = new Set((friendListsRes.data || [])
        .filter((l: any) => l.title?.toLowerCase().includes('did not finish'))
        .map((l: any) => l.id));

      const [userItemsRes, friendItemsRes, userRatingsRes, friendRatingsRes] = await Promise.all([
        supabaseClient.from('list_items').select('title, media_type, list_id').eq('user_id', user.id),
        supabaseClient.from('list_items').select('title, media_type, list_id').eq('user_id', friend_id),
        supabaseClient.from('media_ratings').select('media_title, media_type, rating').eq('user_id', user.id).gte('rating', 4),
        supabaseClient.from('media_ratings').select('media_title, media_type, rating').eq('user_id', friend_id).gte('rating', 4)
      ]);
      const titleError = userItemsRes.error || friendItemsRes.error || userRatingsRes.error || friendRatingsRes.error;
      if (titleError) throw new Error(`Could not load shared title evidence: ${titleError.message}`);

      const lovedItems = (items: any[], ratings: any[], favListIds: Set<any>, dnfListIds: Set<any>) => {
        const loved = new Map<string, { title: string; media_type?: string }>();
        for (const item of items) {
          if (item.title && favListIds.has(item.list_id) && !dnfListIds.has(item.list_id)) {
            loved.set(item.title.toLowerCase(), { title: item.title, media_type: item.media_type });
          }
        }
        for (const rating of ratings) {
          if (rating.media_title) {
            loved.set(rating.media_title.toLowerCase(), { title: rating.media_title, media_type: rating.media_type });
          }
        }
        return [...loved.values()];
      };
      const userLovedItems = lovedItems(userItemsRes.data || [], userRatingsRes.data || [], userFavListIds, userDnfListIds);
      const friendLovedItems = lovedItems(friendItemsRes.data || [], friendRatingsRes.data || [], friendFavListIds, friendDnfListIds);

      // Create lookup of user's loved titles
      const userLovedTitles = new Set(userLovedItems.map((i: any) => i.title.toLowerCase()));
      
      // Find titles that BOTH users love
      const sharedTitles = friendLovedItems
        .filter((i: any) => userLovedTitles.has(i.title.toLowerCase()))
        .slice(0, 10)
        .map((i: any) => ({ title: i.title, media_type: i.media_type }));

      // Generate AI insights
      const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
      let insights: any = { algorithm_version: AFFINITY_ALGORITHM_VERSION };

      if (openaiApiKey) {
        const insightPrompt = `Given two users' entertainment DNA comparison:

User 1 DNA: ${userProfileRes.data?.label || 'Unknown'} - "${userProfileRes.data?.tagline || ''}"
User 2 (${friendUser?.display_name || 'Friend'}) DNA: ${friendProfileRes.data?.label || 'Unknown'} - "${friendProfileRes.data?.tagline || ''}"

Match Score: ${normalizedScore}%
Shared Genres: ${sharedGenres.slice(0, 5).join(', ') || 'None'}
Shared Creators: ${sharedCreators.slice(0, 5).join(', ') || 'None'}
Titles They Both Rated 4-5 Stars or Favorited: ${sharedTitles.slice(0, 5).map((t: any) => t.title).join(', ') || 'None'}

Based on their shared interests, recommend SPECIFIC entertainment they should consume together.
Generate:
1. A short, natural compatibility line (1 sentence, conversational tone — NO metaphors, NO hyperbole, NO "puzzle pieces" or "narrative" type language). It should sound like something a real person would text a friend. Examples of the right tone: "You two have seriously similar taste.", "Your watchlists probably look almost identical.", "You'd argue about the same shows for hours and both be right."
2. 4-6 SPECIFIC recommendations of movies, TV shows, books, podcasts, or music they'd both enjoy based on their shared tastes. Be specific with actual titles - not generic descriptions. Group by media type.

Respond with JSON:
{
  "compatibilityLine": "string (short, natural, conversational — no metaphors or flowery language)",
  "consumeTogether": {
    "movies": ["Specific Movie Title 1", "Specific Movie Title 2"],
    "tv": ["Specific TV Show 1"],
    "books": ["Specific Book Title"],
    "podcasts": ["Specific Podcast Name"],
    "music": ["Specific Artist or Album"]
  }
}

Only include media types where you have good recommendations. It's fine to have 0 in some categories.`;

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
            insights = {
              ...JSON.parse(data.choices[0].message.content),
              algorithm_version: AFFINITY_ALGORITHM_VERSION,
            };
          }
        } catch (e) {
          console.error('OpenAI insights error:', e);
        }
      }

      // Cache the comparison (expires in 24 hours)
      // Store every pair in one deterministic orientation.  This avoids a
      // second cache row when the other person opens the same comparison.
      const [userId1, userId2] = user.id < friend_id ? [user.id, friend_id] : [friend_id, user.id];
      const comparisonData = {
        user_id_1: userId1,
        user_id_2: userId2,
        match_score: normalizedScore,
        shared_genres: sharedGenres.slice(0, 10),
        shared_creators: sharedCreators.slice(0, 10),
        shared_titles: sharedTitles,
        differences: { user_unique: userUnique.slice(0, 5), friend_unique: friendUnique.slice(0, 5) },
        insights,
        computed_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      };

      // Old callers wrote requester-first rows. Remove only the opposite
      // orientation for this pair before the canonical upsert; this leaves any
      // canonical row intact and is safe with the existing pair uniqueness rule.
      await supabaseClient
        .from('dna_comparisons')
        .delete()
        .eq('user_id_1', userId2)
        .eq('user_id_2', userId1);
      await supabaseClient
        .from('dna_comparisons')
        .upsert(comparisonData, { onConflict: 'user_id_1,user_id_2' });

      return new Response(JSON.stringify({
        ...comparisonData,
        friend_name: [friendUser?.first_name, friendUser?.last_name].filter(Boolean).join(' ')
          || friendUser?.display_name
          || friendUser?.user_name
          || 'Friend',
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
