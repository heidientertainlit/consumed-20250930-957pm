import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Monthly sweep: creates a dna_snapshot for every user who has a dna_profiles
// record but no snapshot for the prior month. Safe to run on the 1st of each
// month, or call ad-hoc with ?user_id=... to snapshot a single user.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS'
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

    // This function requires service-role access — verify via header or anon
    // key check. In practice, call it from a cron or admin context only.
    const url    = new URL(req.url);
    const userId = url.searchParams.get('user_id') ?? null;

    // Determine which month to snapshot (prior month when run on the 1st)
    const now       = new Date();
    const priorDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const targetMonth = priorDate.toISOString().slice(0, 7); // e.g. "2026-04"

    // Fetch users to process
    let profileQuery = supabaseClient
      .from('dna_profiles')
      .select('user_id, core_archetype, secondary_archetypes, flavor_notes, current_era, evidence, evolution_note, confidence_score, label, favorite_genres, favorite_media_types');

    if (userId) {
      profileQuery = profileQuery.eq('user_id', userId);
    }

    const { data: profiles, error: profilesError } = await profileQuery;
    if (profilesError) throw profilesError;
    if (!profiles || profiles.length === 0) {
      return new Response(JSON.stringify({ message: 'No profiles found', snapshots_created: 0 }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    let created = 0;
    let skipped = 0;

    for (const profile of profiles) {
      // Check if a snapshot already exists for this user + target month
      const { data: existing } = await supabaseClient
        .from('dna_snapshots')
        .select('id')
        .eq('user_id', profile.user_id)
        .eq('snapshot_month', targetMonth)
        .maybeSingle();

      if (existing) {
        skipped++;
        continue;
      }

      // Pull their top show signals for notable_shows
      const { data: showSignals } = await supabaseClient
        .from('user_dna_signals')
        .select('signal_value')
        .eq('user_id', profile.user_id)
        .eq('signal_type', 'show')
        .order('strength', { ascending: false })
        .limit(5);

      const notableShows = (showSignals || []).map((s: any) => s.signal_value);

      // Convert flavor_notes (text labels) back to what we have
      // core_archetype and flavor_traits are stored as keys in new profiles,
      // but older profiles may only have the label field — handle gracefully.
      const { error: insertError } = await supabaseClient
        .from('dna_snapshots')
        .insert({
          user_id:              profile.user_id,
          snapshot_month:       targetMonth,
          core_archetype:       profile.core_archetype ?? null,
          secondary_archetypes: profile.secondary_archetypes ?? [],
          flavor_traits:        [],
          current_era:          profile.current_era ?? null,
          reputation_titles:    [],
          top_genres:           profile.favorite_genres ?? [],
          top_media_types:      profile.favorite_media_types ?? [],
          notable_shows:        notableShows,
          ai_summary:           null,
          evolution_note:       profile.evolution_note ?? null,
          confidence_score:     profile.confidence_score ?? null
        });

      if (!insertError) created++;
    }

    return new Response(JSON.stringify({
      target_month:      targetMonth,
      profiles_checked:  profiles.length,
      snapshots_created: created,
      snapshots_skipped: skipped
    }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error in create-dna-snapshot:', error);
    return new Response(JSON.stringify({
      error: 'Internal server error', details: error.message
    }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
