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
    console.log('extract-dna-signals: Starting...');
    
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Check for user_id in body (when called by another edge function with service role)
    let targetUserId: string | null = null;
    
    if (req.method === 'POST') {
      try {
        const bodyText = await req.text();
        console.log('extract-dna-signals: Body received:', bodyText);
        if (bodyText) {
          const body = JSON.parse(bodyText);
          if (body.user_id) {
            targetUserId = body.user_id;
            console.log('extract-dna-signals: Using user_id from body:', targetUserId);
          }
        }
      } catch (parseErr) {
        console.log('extract-dna-signals: Body parse error (may be normal):', parseErr);
      }
    }
    
    // If no user_id in body, authenticate via JWT
    if (!targetUserId) {
      const authHeader = req.headers.get('Authorization');
      console.log('extract-dna-signals: Authenticating via JWT');
      if (!authHeader) {
        return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const jwt = authHeader.replace('Bearer ', '');
      const { data: { user }, error: userError } = await supabaseClient.auth.getUser(jwt);

      if (userError || !user) {
        console.log('extract-dna-signals: Auth error:', userError);
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      targetUserId = user.id;
      console.log('extract-dna-signals: User authenticated:', targetUserId);
    }

    if (req.method === 'POST' || targetUserId) {
      console.log('extract-dna-signals: Fetching lists for user:', targetUserId);
      
      // First get user's lists, then get items from those lists
      const { data: userLists, error: listsError } = await supabaseClient
        .from('lists')
        .select('id')
        .eq('user_id', targetUserId);
      
      if (listsError) {
        console.error('extract-dna-signals: Lists error:', listsError);
        throw listsError;
      }
      
      console.log('extract-dna-signals: Found lists:', userLists?.length || 0);
      
      if (!userLists || userLists.length === 0) {
        return new Response(JSON.stringify({ 
          message: 'No lists found for user',
          signals_extracted: 0 
        }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      
      const listIds = userLists.map(l => l.id);
      
      // Fetch all items from user's lists - only select columns that exist
      const { data: listItems, error: itemsError } = await supabaseClient
        .from('list_items')
        .select('title, media_type, creator, external_id, external_source')
        .in('list_id', listIds);

      if (itemsError) {
        console.error('extract-dna-signals: Items error:', itemsError);
        throw itemsError;
      }
      
      console.log('extract-dna-signals: Found items:', listItems?.length || 0);

      if (!listItems || listItems.length === 0) {
        return new Response(JSON.stringify({ 
          message: 'No logged items found',
          signals_extracted: 0 
        }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Extract signals from logged items
      const signals: Map<string, { type: string; value: string; count: number; hasRating: boolean }> = new Map();

      for (const item of listItems) {
        // Media type signal
        if (item.media_type) {
          const key = `media_type:${item.media_type.toLowerCase()}`;
          const existing = signals.get(key);
          signals.set(key, {
            type: 'media_type',
            value: item.media_type.toLowerCase(),
            count: (existing?.count || 0) + 1,
            hasRating: false
          });
        }

        // Creator signal (if present and meaningful)
        if (item.creator && item.creator.trim() && item.creator.length > 1) {
          const key = `creator:${item.creator.trim()}`;
          const existing = signals.get(key);
          signals.set(key, {
            type: 'creator',
            value: item.creator.trim(),
            count: (existing?.count || 0) + 1,
            hasRating: false
          });
        }
      }

      // Fetch genre data from TMDB for movies/tv (batch first 20 items)
      const tmdbItems = listItems
        .filter(item => 
          (item.media_type === 'movie' || item.media_type === 'tv') && 
          item.external_source === 'tmdb' && 
          item.external_id
        )
        .slice(0, 20);

      const tmdbApiKey = Deno.env.get('TMDB_API_KEY');
      
      if (tmdbApiKey && tmdbItems.length > 0) {
        // Fetch genres for each TMDB item (with rate limiting)
        for (const item of tmdbItems) {
          try {
            const response = await fetch(
              `https://api.themoviedb.org/3/${item.media_type}/${item.external_id}?api_key=${tmdbApiKey}`
            );
            
            if (response.ok) {
              const data = await response.json();
              if (data.genres && Array.isArray(data.genres)) {
                for (const genre of data.genres) {
                  const key = `genre:${genre.name.toLowerCase()}`;
                  const existing = signals.get(key);
                  signals.set(key, {
                    type: 'genre',
                    value: genre.name.toLowerCase(),
                    count: (existing?.count || 0) + 1,
                    hasRating: false
                  });
                }
              }
            }
            
            // Rate limit: small delay between requests
            await new Promise(resolve => setTimeout(resolve, 100));
          } catch (e) {
            console.error('TMDB fetch error:', e);
          }
        }
      }

      // Calculate strength for each signal (0.0 to 1.0)
      const totalItems = listItems.length;
      const signalArray = Array.from(signals.values());
      
      // Find max count for normalization
      const maxCount = Math.max(...signalArray.map(s => s.count), 1);

      console.log('extract-dna-signals: Generated signals:', signalArray.length);
      
      // Delete existing signals for this user
      const { error: deleteError } = await supabaseClient
        .from('user_dna_signals')
        .delete()
        .eq('user_id', targetUserId);
      
      if (deleteError) {
        console.error('extract-dna-signals: Delete error:', deleteError);
        throw deleteError;
      }

      // Insert new signals
      const signalsToInsert = signalArray.map(signal => ({
        user_id: targetUserId,
        signal_type: signal.type,
        signal_value: signal.value,
        strength: Math.min(1.0, (signal.count / maxCount) * (signal.hasRating ? 1.2 : 1.0)),
        source_count: signal.count,
        updated_at: new Date().toISOString()
      }));

      console.log('extract-dna-signals: Inserting signals:', signalsToInsert.length);

      if (signalsToInsert.length > 0) {
        const { error: insertError } = await supabaseClient
          .from('user_dna_signals')
          .insert(signalsToInsert);

        if (insertError) {
          console.error('extract-dna-signals: Insert error:', insertError);
          throw insertError;
        }
        console.log('extract-dna-signals: Successfully inserted signals');
      }

      // Calculate DNA level based on item count (without requiring separate table)
      let currentLevel = 1;
      if (totalItems >= 30) {
        currentLevel = 2; // Level 2: Full DNA unlocked
      }

      return new Response(JSON.stringify({
        success: true,
        signals_extracted: signalsToInsert.length,
        items_analyzed: totalItems,
        current_level: currentLevel
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
    console.error('Error in extract-dna-signals function:', error);
    return new Response(JSON.stringify({
      error: 'Internal server error',
      details: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
