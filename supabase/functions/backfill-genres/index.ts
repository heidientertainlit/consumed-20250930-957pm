/**
 * backfill-genres
 *
 * One-time (re-runnable) sweep that resolves and caches the genre of every
 * already-tracked title into the `media_genres` cache.
 *
 * Gathers distinct (external_source, external_id) from the live media stores
 * (media_ratings, list_items, media_engagements), drops anything already cached,
 * resolves the rest via the shared genre-cache helpers (which write back as they
 * go), and reports progress. Idempotent: re-running picks up the next uncached
 * batch, so call repeatedly until `remaining` is 0.
 *
 * Body: { limit?: number }  (default 250). Service-role only.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { resolveRawGenres, cacheGenres, SUPPORTED_GENRE_SOURCES } from '../_shared/genre-cache.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const ok = (data: unknown) =>
  new Response(JSON.stringify(data), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
const err = (msg: string, status = 400) =>
  new Response(JSON.stringify({ error: msg }), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

interface Candidate { source: string; id: string; mediaType: string | null; }

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const svc = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    // ── Restricted: this endpoint runs with service-role and triggers external
    //    API work + DB writes, so it must never be publicly callable.
    //    Allowed callers: the pg_cron scheduler (service-role key) or an admin user JWT.
    const token = (req.headers.get('Authorization') ?? '').replace('Bearer ', '').trim();
    if (!token) return err('Missing authorization header', 401);
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    if (!(serviceKey && token === serviceKey)) {
      const { data: { user }, error: authErr } = await svc.auth.getUser(token);
      if (authErr || !user) return err('Unauthorized', 401);
      const { data: profile } = await svc
        .from('users')
        .select('is_admin')
        .eq('id', user.id)
        .maybeSingle();
      if (!profile?.is_admin) return err('Forbidden: admin only', 403);
    }

    let limit = 250;
    const bodyText = await req.text().catch(() => '');
    if (bodyText) {
      try { const b = JSON.parse(bodyText); if (Number.isFinite(b?.limit)) limit = Math.max(1, Math.min(500, b.limit)); } catch (_) { /* ok */ }
    }

    // ── Gather candidate titles from the three live media stores ──────────────
    const [{ data: ratings }, { data: items }, { data: engagements }, { data: poolMedia }] = await Promise.all([
      svc.from('media_ratings').select('media_external_source, media_external_id, media_type'),
      svc.from('list_items').select('external_source, external_id, media_type, type'),
      svc.from('media_engagements').select('media_external_source, media_external_id, media_type'),
      svc.from('prediction_pools').select('media_external_source, media_external_id, media_type').not('media_external_id', 'is', null),
    ]);

    const candidates = new Map<string, Candidate>();
    const add = (source: string | null, id: string | null, mediaType: string | null) => {
      if (!source || !id) return;
      if (!SUPPORTED_GENRE_SOURCES.includes(source)) return;
      const key = `${source}::${id}`;
      if (!candidates.has(key)) candidates.set(key, { source, id, mediaType: mediaType || null });
    };
    for (const r of ratings ?? []) add(r.media_external_source, r.media_external_id, r.media_type);
    for (const it of items ?? []) add(it.external_source, it.external_id, it.media_type || it.type);
    for (const e of engagements ?? []) add(e.media_external_source, e.media_external_id, e.media_type);
    for (const p of poolMedia ?? []) add(p.media_external_source, p.media_external_id, p.media_type);

    // ── Drop the ones already cached ──────────────────────────────────────────
    const { data: cached } = await svc.from('media_genres').select('external_source, external_id');
    for (const c of cached ?? []) candidates.delete(`${c.external_source}::${c.external_id}`);

    const todo = [...candidates.values()];
    const totalUncached = todo.length;
    const batch = todo.slice(0, limit);

    // ── Resolve + cache each (the helpers write back) ─────────────────────────
    let resolved = 0, empty = 0, failed = 0;
    const sample: { source: string; id: string; genres: string[] }[] = [];
    for (const c of batch) {
      try {
        const raw = await resolveRawGenres(c.source, c.id, c.mediaType);
        if (raw === null) { failed++; continue; }
        const canonical = await cacheGenres(svc, c.source, c.id, c.mediaType, raw);
        if (canonical.length) {
          resolved++;
          if (sample.length < 15) sample.push({ source: c.source, id: c.id, genres: canonical });
        } else {
          empty++; // cached as empty so we don't re-hit it every run
        }
      } catch (_) {
        failed++;
      }
      // be polite to the source APIs
      await new Promise((r) => setTimeout(r, 90));
    }

    return ok({
      success: true,
      limit,
      processed: batch.length,
      resolved_with_genres: resolved,
      resolved_empty: empty,
      failed,
      remaining: Math.max(0, totalUncached - batch.length),
      sample,
    });
  } catch (e: any) {
    console.error('backfill-genres error:', e);
    return err('Internal server error: ' + e.message, 500);
  }
});
