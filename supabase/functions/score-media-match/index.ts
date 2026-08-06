import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

const CACHE_DAYS = 14;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization') } } }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const body = await req.json();
    const cap = (v: unknown, n: number) => (typeof v === 'string' ? v.slice(0, n) : v == null ? v : String(v).slice(0, n));
    const external_source = cap(body?.external_source, 50);
    const external_id = cap(body?.external_id, 100);
    const media_type = cap(body?.media_type, 30);
    const title = cap(body?.title, 300);
    const creator = cap(body?.creator, 200);
    const description = cap(body?.description, 1000);
    const genres = Array.isArray(body?.genres) ? body.genres.slice(0, 8).map((g: unknown) => String(g).slice(0, 50)) : [];
    if (!external_source || !external_id || !title) {
      return new Response(JSON.stringify({ error: 'external_source, external_id and title are required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const admin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Cache hit? (score = -1 means another request is generating right now)
    const readCache = async () => {
      const { data } = await admin
        .from('media_match_scores')
        .select('score, reason, created_at')
        .eq('user_id', user.id)
        .eq('external_source', String(external_source))
        .eq('external_id', String(external_id))
        .maybeSingle();
      return data;
    };
    const isFresh = (row: any) => Date.now() - new Date(row.created_at).getTime() < CACHE_DAYS * 24 * 60 * 60 * 1000;
    const isPendingFresh = (row: any) => row.score < 0 && Date.now() - new Date(row.created_at).getTime() < 2 * 60 * 1000;

    let cached = await readCache();
    if (cached) {
      if (cached.score >= 0 && isFresh(cached)) {
        return new Response(JSON.stringify({ score: cached.score, reason: cached.reason, cached: true }), {
          status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      if (isPendingFresh(cached)) {
        // Another request is already paying for this AI call — don't duplicate it
        return new Response(JSON.stringify({ score: null, pending: true }), {
          status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    // Reserve the slot so concurrent requests don't each call the AI
    const { error: reserveErr } = await admin.from('media_match_scores').upsert({
      user_id: user.id,
      external_source: String(external_source),
      external_id: String(external_id),
      media_type: media_type || null,
      score: -1,
      reason: 'pending',
      created_at: new Date().toISOString(),
    }, { onConflict: 'user_id,external_source,external_id' });
    if (reserveErr) {
      console.error('Failed to reserve score slot:', reserveErr);
    }

    // Compile a compact taste profile
    const [{ data: dnaProfile }, { data: highRatings }, { data: lowRatings }, { data: dnaSignals }] = await Promise.all([
      admin.from('dna_profiles').select('label, tagline, profile_text, favorite_genres, favorite_media_types').eq('user_id', user.id).maybeSingle(),
      admin.from('media_ratings').select('media_title, media_type, rating').eq('user_id', user.id).gte('rating', 4).order('rating', { ascending: false }).limit(20),
      admin.from('media_ratings').select('media_title, media_type, rating').eq('user_id', user.id).lte('rating', 2).order('rating', { ascending: true }).limit(10),
      admin.from('user_dna_signals').select('signal_type, signal_value, strength').eq('user_id', user.id).neq('signal_type', 'engagement').order('strength', { ascending: false }).limit(25),
    ]);

    const releaseReservation = async () => {
      await admin.from('media_match_scores').delete()
        .eq('user_id', user.id)
        .eq('external_source', String(external_source))
        .eq('external_id', String(external_id))
        .lt('score', 0);
    };

    const hasTasteData = !!dnaProfile || (highRatings?.length ?? 0) > 0 || (dnaSignals?.length ?? 0) > 0;
    if (!hasTasteData) {
      await releaseReservation();
      return new Response(JSON.stringify({ score: null, reason: 'Not enough taste data yet' }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const prompt = `You are an entertainment taste-matching engine. Score how well a title matches a specific user's taste, from 0-100.

USER TASTE PROFILE:
${dnaProfile ? `DNA: ${dnaProfile.label || ''} — ${dnaProfile.tagline || ''}
${dnaProfile.profile_text || ''}
Favorite genres: ${JSON.stringify(dnaProfile.favorite_genres) || 'unknown'}
Favorite media types: ${JSON.stringify(dnaProfile.favorite_media_types) || 'unknown'}` : 'No DNA profile yet.'}

Loved (rated 4-5 stars): ${(highRatings || []).map((r: any) => `${r.media_title} (${r.media_type}, ${r.rating}★)`).join('; ') || 'none'}
Disliked (rated 1-2 stars): ${(lowRatings || []).map((r: any) => `${r.media_title} (${r.media_type}, ${r.rating}★)`).join('; ') || 'none'}
Behavioral signals (strongest first): ${(dnaSignals || []).map((s: any) => `${s.signal_type}:${s.signal_value}`).join(', ') || 'none'}

TITLE TO SCORE:
"${title}"${creator ? ` by ${creator}` : ''} (${media_type || 'unknown type'})
${Array.isArray(genres) && genres.length ? `Genres: ${genres.join(', ')}` : ''}
${description ? `About: ${String(description).slice(0, 500)}` : ''}

Rules:
- Be honest and calibrated. Use the full range: a poor fit should score below 40, a mixed fit 40-69, a strong fit 70-89, a near-perfect fit 90+.
- Base the score on concrete evidence from their profile (loved/disliked titles, genres, creators), not generic appeal.
- The reason must be ONE short sentence (max 20 words) naming specific evidence, e.g. "You loved Little Fires Everywhere and rate character-driven drama highly."

Respond with ONLY valid JSON: {"score": <0-100>, "reason": "<one sentence>"}`;

    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiApiKey) throw new Error('OPENAI_API_KEY not configured');

    const aiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${openaiApiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
        temperature: 0.3,
        max_tokens: 150,
      }),
    });
    let score: number;
    let reason: string;
    try {
      if (!aiRes.ok) throw new Error(`OpenAI error ${aiRes.status}: ${await aiRes.text()}`);
      const aiJson = await aiRes.json();
      const parsed = JSON.parse(aiJson.choices[0].message.content);
      score = Math.max(0, Math.min(100, Math.round(Number(parsed.score))));
      reason = String(parsed.reason || '').slice(0, 300);
      if (!Number.isFinite(score)) throw new Error('AI returned invalid score');
    } catch (aiErr) {
      await releaseReservation();
      throw aiErr;
    }

    const { error: upsertErr } = await admin.from('media_match_scores').upsert({
      user_id: user.id,
      external_source: String(external_source),
      external_id: String(external_id),
      media_type: media_type || null,
      score,
      reason,
      created_at: new Date().toISOString(),
    }, { onConflict: 'user_id,external_source,external_id' });
    if (upsertErr) console.error('Failed to cache score:', upsertErr);

    return new Response(JSON.stringify({ score, reason, cached: false }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (err) {
    console.error('score-media-match error:', err);
    return new Response(JSON.stringify({ error: String(err?.message || err) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
