import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
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

    // Check for optional user_id param (for viewing other profiles)
    const url = new URL(req.url);
    const targetUserId = url.searchParams.get('user_id') || user.id;

    // Get current DNA level from cache
    const { data: dnaLevel } = await supabaseClient
      .from('user_dna_levels')
      .select('*')
      .eq('user_id', targetUserId)
      .single();

    if (dnaLevel) {
      // Return cached level with progress info
      const itemsToNextLevel = dnaLevel.current_level === 1 
        ? 15 - dnaLevel.items_logged 
        : dnaLevel.current_level === 2 
          ? 30 - dnaLevel.items_logged 
          : 0;

      return new Response(JSON.stringify({
        current_level: dnaLevel.current_level,
        level_name: getLevelName(dnaLevel.current_level),
        level_description: getLevelDescription(dnaLevel.current_level),
        items_logged: dnaLevel.items_logged,
        items_with_ratings: dnaLevel.items_with_ratings,
        media_types_count: dnaLevel.media_types_count,
        items_to_next_level: Math.max(0, itemsToNextLevel),
        next_level_name: dnaLevel.current_level < 3 ? getLevelName(dnaLevel.current_level + 1) : null,
        unlocks: getUnlocks(dnaLevel.current_level),
        next_unlocks: dnaLevel.current_level < 3 ? getUnlocks(dnaLevel.current_level + 1) : null
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // No cached level - calculate from list_items
    const { data: listItems } = await supabaseClient
      .from('list_items')
      .select('id, rating, media_type')
      .eq('user_id', targetUserId);

    const itemsLogged = listItems?.length || 0;
    const itemsWithRatings = listItems?.filter(i => i.rating).length || 0;
    const mediaTypesSet = new Set(listItems?.map(i => i.media_type).filter(Boolean) || []);

    let currentLevel = 1;
    if (itemsLogged >= 30) {
      currentLevel = 3;
    } else if (itemsLogged >= 15) {
      currentLevel = 2;
    }

    // Cache the level for future lookups
    if (targetUserId === user.id) {
      await supabaseClient
        .from('user_dna_levels')
        .upsert({
          user_id: user.id,
          current_level: currentLevel,
          items_logged: itemsLogged,
          items_with_ratings: itemsWithRatings,
          media_types_count: mediaTypesSet.size,
          updated_at: new Date().toISOString()
        }, { onConflict: 'user_id' });
    }

    const itemsToNextLevel = currentLevel === 1 
      ? 15 - itemsLogged 
      : currentLevel === 2 
        ? 30 - itemsLogged 
        : 0;

    return new Response(JSON.stringify({
      current_level: currentLevel,
      level_name: getLevelName(currentLevel),
      level_description: getLevelDescription(currentLevel),
      items_logged: itemsLogged,
      items_with_ratings: itemsWithRatings,
      media_types_count: mediaTypesSet.size,
      items_to_next_level: Math.max(0, itemsToNextLevel),
      next_level_name: currentLevel < 3 ? getLevelName(currentLevel + 1) : null,
      unlocks: getUnlocks(currentLevel),
      next_unlocks: currentLevel < 3 ? getUnlocks(currentLevel + 1) : null
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error in calculate-dna-level function:', error);
    return new Response(JSON.stringify({
      error: 'Internal server error',
      details: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

function getLevelName(level: number): string {
  switch (level) {
    case 1: return 'DNA Snapshot';
    case 2: return 'DNA Profile';
    case 3: return 'DNA Blueprint';
    default: return 'DNA Snapshot';
  }
}

function getLevelDescription(level: number): string {
  switch (level) {
    case 1: return 'How you describe your taste';
    case 2: return 'Your taste, emerging';
    case 3: return 'Your taste in full context';
    default: return 'How you describe your taste';
  }
}

function getUnlocks(level: number): string[] {
  switch (level) {
    case 1: 
      return [
        'DNA title & tagline',
        'Basic genre preferences',
        'View other DNA cards'
      ];
    case 2: 
      return [
        'Celebrity DNA matching',
        'Deeper DNA traits',
        '"You tend to..." insights',
        'Cross-media patterns'
      ];
    case 3: 
      return [
        'Friend DNA matchups',
        'Anti-preferences detected',
        'Guilty pleasures revealed',
        'Taste Face-Offs',
        '"Watch Together" recommendations'
      ];
    default: 
      return [];
  }
}
