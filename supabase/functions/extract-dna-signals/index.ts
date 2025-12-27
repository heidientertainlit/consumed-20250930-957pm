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
      // Fetch all user's logged media items
      const { data: listItems, error: itemsError } = await supabaseClient
        .from('list_items')
        .select('title, media_type, creator, year, rating, external_id, external_source')
        .eq('user_id', user.id);

      if (itemsError) throw itemsError;

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
            hasRating: existing?.hasRating || !!item.rating
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
            hasRating: existing?.hasRating || !!item.rating
          });
        }

        // Decade signal (from year)
        if (item.year && item.year >= 1900 && item.year <= 2030) {
          const decade = `${Math.floor(item.year / 10) * 10}s`;
          const key = `decade:${decade}`;
          const existing = signals.get(key);
          signals.set(key, {
            type: 'decade',
            value: decade,
            count: (existing?.count || 0) + 1,
            hasRating: existing?.hasRating || !!item.rating
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
                    hasRating: existing?.hasRating || !!item.rating
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

      // Delete existing signals for this user
      await supabaseClient
        .from('user_dna_signals')
        .delete()
        .eq('user_id', user.id);

      // Insert new signals
      const signalsToInsert = signalArray.map(signal => ({
        user_id: user.id,
        signal_type: signal.type,
        signal_value: signal.value,
        strength: Math.min(1.0, (signal.count / maxCount) * (signal.hasRating ? 1.2 : 1.0)),
        source_count: signal.count,
        updated_at: new Date().toISOString()
      }));

      if (signalsToInsert.length > 0) {
        const { error: insertError } = await supabaseClient
          .from('user_dna_signals')
          .insert(signalsToInsert);

        if (insertError) throw insertError;
      }

      // Update user's DNA level based on item count
      const itemsWithRatings = listItems.filter(i => i.rating).length;
      const mediaTypesSet = new Set(listItems.map(i => i.media_type).filter(Boolean));
      
      let currentLevel = 1;
      if (totalItems >= 30) {
        currentLevel = 3; // Blueprint
      } else if (totalItems >= 15) {
        currentLevel = 2; // Profile
      }

      // Upsert DNA level
      const { error: levelError } = await supabaseClient
        .from('user_dna_levels')
        .upsert({
          user_id: user.id,
          current_level: currentLevel,
          items_logged: totalItems,
          items_with_ratings: itemsWithRatings,
          media_types_count: mediaTypesSet.size,
          updated_at: new Date().toISOString(),
          ...(currentLevel > 1 ? { last_level_up: new Date().toISOString() } : {})
        }, {
          onConflict: 'user_id'
        });

      if (levelError) throw levelError;

      return new Response(JSON.stringify({
        success: true,
        signals_extracted: signalsToInsert.length,
        items_analyzed: totalItems,
        current_level: currentLevel,
        level_name: currentLevel === 1 ? 'Snapshot' : currentLevel === 2 ? 'Profile' : 'Blueprint'
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
