import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  DNA_ARCHETYPES,
  DNA_FLAVOR_TRAITS,
  DNA_ERA_LABELS,
  getArchetype,
} from "../_shared/dna-taxonomy.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

// ── Blend ramp: how much weight to give behavior vs survey ──────────────────
function getBlendWeights(itemsLogged: number): { survey: number; behavior: number } {
  if (itemsLogged <= 10)  return { survey: 0.90, behavior: 0.10 };
  if (itemsLogged <= 25)  return { survey: 0.75, behavior: 0.25 };
  if (itemsLogged <= 60)  return { survey: 0.60, behavior: 0.40 };
  return { survey: 0.45, behavior: 0.55 };
}

// ── Score all 18 archetypes from behavioral signals ─────────────────────────
function scoreArchetypes(signals: any[]): Record<string, number> {
  const scores: Record<string, number> = {};
  for (const a of DNA_ARCHETYPES) scores[a.key] = 0;

  const byType = (type: string) => signals.filter(s => s.signal_type === type);
  const genreSignals     = byType('genre');
  const mediaTypeSignals = byType('media_type');
  const showSignals      = byType('show');
  const engagementSignals = byType('engagement');

  const eng = (val: string) =>
    engagementSignals.find(s => s.signal_value === val)?.source_count || 0;

  const triviaCorrect  = eng('trivia_correct');
  const triviaAttempts = eng('trivia_attempts');
  const pollVotes      = eng('poll_votes');
  const ratingsGiven   = eng('ratings_given');
  const itemsTracked   = eng('items_tracked');
  const triviaAccuracy = triviaAttempts > 0 ? triviaCorrect / triviaAttempts : 0;

  // Aggregate rated_high across all sources
  const ratedHigh = signals.reduce((sum, s) => sum + ((s.sources as any)?.rated_high || 0), 0);

  const topGenres = genreSignals
    .sort((a, b) => b.strength - a.strength)
    .slice(0, 8)
    .map(s => (s.signal_value as string).toLowerCase());

  const genreVariety = genreSignals.length;
  const showVariety  = showSignals.length;
  const mediaVariety = mediaTypeSignals.length;

  const totalGenreStrength = genreSignals.reduce((s, g) => s + g.strength, 0);
  const topGenreConcentration = totalGenreStrength > 0 && genreSignals.length > 0
    ? genreSignals.sort((a, b) => b.strength - a.strength)[0].strength / totalGenreStrength
    : 0;

  const hasGenre = (...names: string[]) => names.some(n => topGenres.includes(n));

  // theory_crafter
  if (triviaAccuracy > 0.70) scores.theory_crafter += 3;
  else if (triviaAccuracy > 0.50) scores.theory_crafter += 1.5;
  if (triviaCorrect > 20) scores.theory_crafter += 2;
  if (hasGenre('mystery', 'thriller', 'crime', 'science fiction')) scores.theory_crafter += 2;
  if (pollVotes > 10) scores.theory_crafter += 0.5;

  // comfort_rewatcher
  if (hasGenre('comedy', 'romance', 'animation', 'family')) scores.comfort_rewatcher += 2;
  if (genreVariety < 4 && itemsTracked > 10) scores.comfort_rewatcher += 2;
  if (ratedHigh > 10 && topGenreConcentration > 0.5) scores.comfort_rewatcher += 1.5;

  // prestige_detective
  if (hasGenre('drama', 'documentary')) scores.prestige_detective += 2;
  if (ratedHigh > 15) scores.prestige_detective += 2;
  if (triviaAccuracy > 0.60) scores.prestige_detective += 1;

  // emotional_binger
  if (hasGenre('drama', 'romance', 'biography')) scores.emotional_binger += 2;
  if (itemsTracked > 20 && ratingsGiven > 10) scores.emotional_binger += 2;
  if (ratingsGiven > 0 && ratedHigh / ratingsGiven > 0.5) scores.emotional_binger += 1;

  // first_episode_judge
  if (ratingsGiven > 10 && ratedHigh / Math.max(ratingsGiven, 1) < 0.3) scores.first_episode_judge += 3;
  if (ratingsGiven > itemsTracked * 0.8 && itemsTracked > 5) scores.first_episode_judge += 1;

  // hidden_gem_hunter
  if (genreVariety >= 6) scores.hidden_gem_hunter += 2;
  if (showVariety >= 10) scores.hidden_gem_hunter += 2;

  // dark_season_devotee
  if (hasGenre('thriller', 'horror', 'crime', 'mystery')) scores.dark_season_devotee += 3;

  // story_sharer
  if (pollVotes > 20) scores.story_sharer += 2;
  if (ratingsGiven > 20) scores.story_sharer += 1;
  if (triviaAttempts > 30) scores.story_sharer += 1;

  // slow_burn_devotee
  if (hasGenre('drama', 'history', 'documentary', 'biography')) scores.slow_burn_devotee += 1.5;
  if (itemsTracked > 10 && ratingsGiven / Math.max(itemsTracked, 1) > 0.7)
    scores.slow_burn_devotee += 2;

  // genre_loyalist
  if (topGenreConcentration > 0.6 && itemsTracked > 10) scores.genre_loyalist += 4;
  else if (topGenreConcentration > 0.45) scores.genre_loyalist += 2;
  if (triviaCorrect > 15 && topGenreConcentration > 0.4) scores.genre_loyalist += 1.5;

  // era_hopper
  if (genreVariety >= 8) scores.era_hopper += 3;
  else if (genreVariety >= 6) scores.era_hopper += 1.5;
  if (showVariety >= 15) scores.era_hopper += 2;

  // taste_signaler
  if (ratedHigh > 10 && ratedHigh / Math.max(ratingsGiven, 1) > 0.6) scores.taste_signaler += 3;
  if (ratingsGiven > 15) scores.taste_signaler += 1;

  // chaos_watcher
  if (hasGenre('reality', 'competition', 'talk show', 'game show')) scores.chaos_watcher += 4;
  if (pollVotes > 15) scores.chaos_watcher += 1;

  // lore_diver
  if (hasGenre('science fiction', 'fantasy', 'adventure', 'action')) scores.lore_diver += 2;
  if (showVariety > 5 && hasGenre('science fiction', 'fantasy')) scores.lore_diver += 2;
  if (triviaAttempts > 20 && hasGenre('science fiction', 'fantasy')) scores.lore_diver += 1.5;

  // completionist
  if (itemsTracked > 20) scores.completionist += 2;
  if (itemsTracked > 40) scores.completionist += 2;
  if (ratingsGiven / Math.max(itemsTracked, 1) > 0.8) scores.completionist += 2;

  // mood_matcher
  if (mediaVariety >= 3) scores.mood_matcher += 2;
  if (genreVariety >= 5 && mediaVariety >= 3) scores.mood_matcher += 2;

  // culture_tracker
  if (pollVotes > 25) scores.culture_tracker += 2;
  if (ratingsGiven > 25) scores.culture_tracker += 1;
  if (mediaVariety >= 4) scores.culture_tracker += 1;

  // nostalgia_keeper
  if (hasGenre('animation', 'classic', 'vintage', 'family')) scores.nostalgia_keeper += 3;
  if (itemsTracked > 10 && ratedHigh > 5) scores.nostalgia_keeper += 1;

  return scores;
}

// ── Detect current era from recent 30-day signals ───────────────────────────
function detectEra(recentSignals: any[]): string {
  const recentGenres = recentSignals
    .filter(s => s.signal_type === 'genre')
    .sort((a, b) => b.strength - a.strength)
    .map(s => (s.signal_value as string).toLowerCase());

  const recentMediaTypes = recentSignals
    .filter(s => s.signal_type === 'media_type')
    .sort((a, b) => b.strength - a.strength)
    .map(s => (s.signal_value as string).toLowerCase());

  const hasG = (...names: string[]) => names.some(n => recentGenres.includes(n));
  const hasM = (...names: string[]) => names.some(n => recentMediaTypes.includes(n));

  if (hasG('thriller', 'psychological', 'mystery', 'crime') && hasG('drama')) return 'psychological_thriller_era';
  if (hasG('thriller', 'horror', 'crime', 'mystery')) return 'psychological_thriller_era';
  if (hasG('fantasy', 'adventure') && hasG('science fiction')) return 'fantasy_worldbuilding_era';
  if (hasG('science fiction', 'fantasy')) return 'franchise_lore_era';
  if (hasG('reality', 'competition')) return 'reality_chaos_era';
  if (hasG('documentary')) return 'documentary_deep_dive_era';
  if (hasG('romance', 'rom-com')) return 'rom_com_reset_era';
  if (hasG('drama') && recentGenres.length < 3) return 'prestige_drama_era';
  if (hasG('drama')) return 'character_study_era';
  if (hasG('comedy', 'sitcom', 'animation', 'family')) return 'comfort_sitcom_era';
  if (hasM('music')) return 'music_discovery_era';
  if (hasM('podcast')) return 'podcast_spiral_era';
  if (hasM('game')) return 'gaming_quest_era';
  if (hasM('book')) return 'slow_burn_era';
  if (recentGenres.length >= 5) return 'hidden_gem_era';
  return 'culture_catch_up_era';
}

// ── Main handler ─────────────────────────────────────────────────────────────
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
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const jwt = authHeader.replace('Bearer ', '');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    let userId: string;

    if (jwt === serviceRoleKey) {
      // Admin mode: service role key + user_id in body
      const body = await req.json().catch(() => ({}));
      if (!body.user_id) {
        return new Response(JSON.stringify({ error: 'user_id required for admin calls' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      userId = body.user_id;
    } else {
      const { data: { user }, error: userError } = await supabaseClient.auth.getUser(jwt);
      if (userError || !user) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      userId = user.id;
    }

    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // ── 1. Check items logged — count directly from list_items (source of truth) ──
    const { count: itemsLoggedCount } = await supabaseClient
      .from('list_items')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);

    const itemsLogged = itemsLoggedCount || 0;
    if (itemsLogged < 15) {
      return new Response(JSON.stringify({
        error: 'Not enough items logged',
        items_logged: itemsLogged,
        items_required: 15
      }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const blend = getBlendWeights(itemsLogged);

    // ── 2. Fetch data in parallel ────────────────────────────────────────────
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const [
      { data: responses },
      { data: allSignals },
      { data: recentSignals },
      { data: showSignalsRaw },
      { data: existingProfile }
    ] = await Promise.all([
      supabaseClient
        .from('edna_responses')
        .select('question_id, answer_text, edna_questions!inner(question_text)')
        .eq('user_id', userId),
      supabaseClient
        .from('user_dna_signals')
        .select('signal_type, signal_value, strength, source_count, sources, last_signal_at')
        .eq('user_id', userId)
        .order('strength', { ascending: false })
        .limit(50),
      supabaseClient
        .from('user_dna_signals')
        .select('signal_type, signal_value, strength, source_count')
        .eq('user_id', userId)
        .gte('last_signal_at', thirtyDaysAgo)
        .order('strength', { ascending: false }),
      supabaseClient
        .from('user_dna_signals')
        .select('signal_value, strength, source_count')
        .eq('user_id', userId)
        .eq('signal_type', 'show')
        .order('strength', { ascending: false })
        .limit(5),
      supabaseClient
        .from('dna_profiles')
        .select('id, core_archetype, label')
        .eq('user_id', userId)
        .single()
    ]);

    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiApiKey) {
      return new Response(JSON.stringify({ error: 'OpenAI API key not configured' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // ── 3. Score archetypes deterministically ────────────────────────────────
    const archetypeScores = scoreArchetypes(allSignals || []);
    const sortedArchetypes = Object.entries(archetypeScores)
      .sort(([, a], [, b]) => b - a);

    const primaryKey    = sortedArchetypes[0][0];
    const primaryScore  = sortedArchetypes[0][1];
    const secondaryKeys = sortedArchetypes.slice(1, 3)
      .filter(([, score]) => score > 0)
      .map(([key]) => key);

    const maxScore = primaryScore || 1;
    const confidenceScore = Math.min(primaryScore / maxScore, 1.0);

    // ── 4. Detect current era ────────────────────────────────────────────────
    const detectedEraKey = detectEra(recentSignals || []);
    const eraLabel = DNA_ERA_LABELS.find(e => e.key === detectedEraKey)?.label
      ?? 'In your discovery era';

    // ── 5. Build top 5 archetype candidates for AI context ──────────────────
    const topArchetypesForAI = sortedArchetypes.slice(0, 5).map(([key, score]) => {
      const a = getArchetype(key)!;
      return `${a.displayName} (score: ${score.toFixed(1)}): ${a.oneLiner}`;
    }).join('\n');

    const archetypeDefinitionsForAI = DNA_ARCHETYPES.map(a =>
      `- ${a.displayName} [key: ${a.key}]: ${a.oneLiner}`
    ).join('\n');

    const flavorTraitListForAI = DNA_FLAVOR_TRAITS.map(t =>
      `- ${t.label} [key: ${t.key}]`
    ).join('\n');

    const eraListForAI = DNA_ERA_LABELS.map(e =>
      `- ${e.label} [key: ${e.key}]`
    ).join('\n');

    const formattedResponses = responses
      ?.map((r: any) => `Q: ${r.edna_questions.question_text}\nA: ${r.answer_text}`)
      .join('\n\n') || 'No survey responses';

    const formattedSignals = (allSignals || [])
      .filter(s => s.signal_type !== 'engagement')
      .map(s => `${s.signal_type}: ${s.signal_value} (strength: ${Number(s.strength).toFixed(2)})`)
      .join('\n') || 'No behavioral signals';

    const topShows = (showSignalsRaw || [])
      .map(s => s.signal_value)
      .join(', ') || 'none detected yet';

    const previousArchetype = existingProfile?.core_archetype
      ? (getArchetype(existingProfile.core_archetype)?.displayName ?? existingProfile.label)
      : null;

    // ── 6. Build taxonomy-constrained prompt ─────────────────────────────────
    const prompt = `You are assigning and writing an Entertainment DNA profile for a user on Consumed.

RULES — YOU MUST FOLLOW THESE EXACTLY:
- core_archetype MUST be one of the exact keys from the approved archetype list.
- secondary_archetypes MUST be keys from the approved archetype list (up to 2, or empty array).
- flavor_traits MUST be keys from the approved flavor trait list (pick 2–4 that best fit).
- current_era MUST be one of the exact keys from the approved era list.
- profile_headline: one punchy sentence (≤80 chars), no archetype name in it.
- profile_summary: 90–120 words, address as "You...", smart and warm tone, not clinical.
- evidence: 2–3 specific observations grounded in the actual data (reference specific shows/genres if available).
- evolution_note: one sentence about how this compares to their previous identity (or "This is your first full profile." if no previous).
- Do NOT invent archetype names. Do NOT use keys not in the approved lists.

BLEND WEIGHTS: Survey ${Math.round(blend.survey * 100)}% / Behavior ${Math.round(blend.behavior * 100)}%
(User has ${itemsLogged} items logged — behavior data carries ${Math.round(blend.behavior * 100)}% weight.)

SURVEY RESPONSES (what they say they like):
${formattedResponses}

BEHAVIORAL SIGNALS (what they actually consume — ordered by strength):
${formattedSignals}

TOP SHOWS/FRANCHISES ENGAGED WITH: ${topShows}

PRE-SCORED ARCHETYPES (from behavior — use this to inform your assignment):
${topArchetypesForAI}

PREVIOUS ARCHETYPE: ${previousArchetype ?? 'none (first profile)'}
DETECTED CURRENT ERA: ${eraLabel} [key: ${detectedEraKey}]

APPROVED ARCHETYPES (use only these keys):
${archetypeDefinitionsForAI}

APPROVED FLAVOR TRAITS (use only these keys):
${flavorTraitListForAI}

APPROVED ERA LABELS (use only these keys):
${eraListForAI}

Respond with valid JSON only:
{
  "core_archetype": "approved_key",
  "secondary_archetypes": ["approved_key", "approved_key"],
  "flavor_traits": ["approved_key", "approved_key", "approved_key"],
  "current_era": "approved_key",
  "label": "display name of core archetype (2-5 words, can match archetype name)",
  "tagline": "one playful line ≤120 chars",
  "profile_headline": "one punchy sentence ≤80 chars",
  "profile_summary": "90-120 word paragraph addressing user as You...",
  "evidence": ["specific observation 1", "specific observation 2"],
  "evolution_note": "one sentence comparing to previous or noting this is first profile",
  "favoriteGenres": ["genre1", "genre2", "genre3"],
  "favoriteMediaTypes": ["type1", "type2"],
  "flavorNotes": ["short trait 1", "short trait 2", "short trait 3"]
}`;

    // ── 7. Call GPT-4o ───────────────────────────────────────────────────────
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
            content: 'You are a brand writer for Consumed — an entertainment identity app. Voice: smart, warm, specific, never cringe. You MUST use only the approved archetype keys, flavor trait keys, and era keys provided. Always respond with valid JSON only.'
          },
          { role: 'user', content: prompt }
        ],
        response_format: { type: 'json_object' },
        max_tokens: 1200,
        temperature: 0.75
      })
    });

    if (!openaiResponse.ok) {
      throw new Error(`OpenAI API error: ${openaiResponse.status}`);
    }

    const openaiData = await openaiResponse.json();
    const gpt = JSON.parse(openaiData.choices[0].message.content);

    // ── 8. Validate AI output uses approved keys ─────────────────────────────
    const validArchetypeKeys = new Set(DNA_ARCHETYPES.map(a => a.key));
    const validFlavorKeys    = new Set(DNA_FLAVOR_TRAITS.map(t => t.key));
    const validEraKeys       = new Set(DNA_ERA_LABELS.map(e => e.key));

    const safeCore       = validArchetypeKeys.has(gpt.core_archetype) ? gpt.core_archetype : primaryKey;
    const safeSecondary  = (gpt.secondary_archetypes || []).filter((k: string) => validArchetypeKeys.has(k)).slice(0, 2);
    const safeFlavorKeys = (gpt.flavor_traits || []).filter((k: string) => validFlavorKeys.has(k)).slice(0, 4);
    const safeEra        = validEraKeys.has(gpt.current_era) ? gpt.current_era : detectedEraKey;

    // Convert flavor trait keys back to display labels for the existing flavor_notes column
    const flavorNoteLabels = safeFlavorKeys.map((k: string) =>
      DNA_FLAVOR_TRAITS.find(t => t.key === k)?.label ?? k
    );

    // Get archetype display name for the label field
    const archetypeDisplayName = getArchetype(safeCore)?.displayName ?? gpt.label ?? 'Entertainment DNA';

    // ── 9. Build profile payload (all existing + new fields) ─────────────────
    const profilePayload = {
      user_id:              userId,
      // existing fields — unchanged
      label:                archetypeDisplayName,
      tagline:              gpt.tagline || '',
      profile_text:         gpt.profile_summary || '',
      flavor_notes:         flavorNoteLabels.length > 0 ? flavorNoteLabels : (gpt.flavorNotes || []),
      favorite_genres:      gpt.favoriteGenres || [],
      favorite_media_types: gpt.favoriteMediaTypes || [],
      is_private:           false,
      updated_at:           new Date().toISOString(),
      // new fields
      core_archetype:       safeCore,
      secondary_archetypes: safeSecondary,
      current_era:          safeEra,
      evidence:             gpt.evidence || [],
      evolution_note:       gpt.evolution_note || null,
      confidence_score:     Math.min(Math.max(confidenceScore, 0), 1)
    };

    // ── 10. Upsert dna_profiles ──────────────────────────────────────────────
    let profileData;
    if (existingProfile) {
      const { data, error } = await supabaseClient
        .from('dna_profiles')
        .update(profilePayload)
        .eq('user_id', userId)
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

    // ── 11. Update DNA level to 2 (unchanged) ───────────────────────────────
    await supabaseClient
      .from('user_dna_levels')
      .update({
        current_level: 2,
        last_level_up: new Date().toISOString(),
        updated_at:    new Date().toISOString()
      })
      .eq('user_id', userId);

    // ── 11b. Write a snapshot row on every regeneration ─────────────────────
    // Every profile generation is a data point. Multiple rows per month are
    // intentional — they show how the identity evolved within the month.
    const snapshotMonth = new Date().toISOString().slice(0, 7); // e.g. "2026-05"
    const notableShows = (showSignalsRaw || []).map((s: any) => s.signal_value);
    await supabaseClient.from('dna_snapshots').insert({
      user_id:              userId,
      snapshot_month:       snapshotMonth,
      core_archetype:       safeCore,
      secondary_archetypes: safeSecondary,
      flavor_traits:        safeFlavorKeys,
      current_era:          safeEra,
      reputation_titles:    [],
      top_genres:           gpt.favoriteGenres || [],
      top_media_types:      gpt.favoriteMediaTypes || [],
      notable_shows:        notableShows,
      ai_summary:           gpt.profile_summary || '',
      evolution_note:       gpt.evolution_note || null,
      confidence_score:     profilePayload.confidence_score
    });

    // ── 12. Return response (backward-compatible + new fields) ───────────────
    return new Response(JSON.stringify({
      ...profileData,
      // legacy fields still returned for any existing frontend callers
      tend_to_insights:      gpt.evidence || [],
      cross_media_patterns:  [],
      top_creators:          [],
      dna_level:             2,
      level_name:            'DNA Profile',
      unlocks:               ['Celebrity DNA matching', '"You tend to..." insights', 'Cross-media patterns'],
      // new fields surfaced
      profile_headline:      gpt.profile_headline || '',
      secondary_archetypes:  safeSecondary,
      secondary_display:     safeSecondary.map((k: string) => getArchetype(k)?.displayName ?? k),
      current_era_label:     eraLabel,
      evidence:              gpt.evidence || [],
      evolution_note:        gpt.evolution_note || null,
      confidence_score:      profilePayload.confidence_score
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error in generate-dna-profile-v2:', error);
    return new Response(JSON.stringify({
      error: 'Internal server error',
      details: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
