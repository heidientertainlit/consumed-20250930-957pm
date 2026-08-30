import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { resolveCanonicalMedia, UnverifiedProviderTupleError } from '../_shared/canonical-media.ts';
import { assertApplyConfirmed, parseBackfillRequest } from '../_shared/canonical-backfill-safety.ts';

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (true) {
      const index = next++;
      if (index >= items.length) return;
      results[index] = await worker(items[index]);
    }
  }));
  return results;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return reply({ error: 'POST required' }, 405);
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  const admin = createClient(Deno.env.get('SUPABASE_URL') || '', serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '').trim();
  if (!token) return reply({ error: 'Authorization required' }, 401);
  let requestedBy: string | null = null;
  if (token !== serviceKey) {
    const { data: { user }, error } = await admin.auth.getUser(token);
    if (error || !user) return reply({ error: 'Unauthorized' }, 401);
    const { data: profile } = await admin.from('users').select('is_admin').eq('id', user.id).maybeSingle();
    if (!profile?.is_admin) return reply({ error: 'Administrator authorization required' }, 403);
    requestedBy = user.id;
  }
  let input;
  try { input = parseBackfillRequest(await req.json().catch(() => ({}))); assertApplyConfirmed(input); } catch (e) { return reply({ error: String(e?.message || e) }, 400); }
  if (input.phase === 'apply' && !input.planRunId) return reply({ error: 'apply requires plan_run_id for a completed dry-run plan' }, 400);

  const leaseToken = crypto.randomUUID();
  const { data: fence, error: leaseError } = await admin.rpc('claim_canonical_media_backfill_lease', { p_lease_token: leaseToken, p_ttl_seconds: 120 });
  if (leaseError) return reply({ error: leaseError.message }, 500);
  if (fence === null) return reply({ error: 'Another backfill worker holds the lease' }, 409);
  let runId: string | null = null;
  try {
    if (input.phase === 'apply') {
      const { data: plan } = await admin.from('canonical_media_backfill_runs').select('id,status,phase').eq('id', input.planRunId).maybeSingle();
      if (!plan || plan.phase !== 'plan' || plan.status !== 'complete') throw new Error('plan_run_id must identify a completed plan run');
    }
    if (input.runId) {
      const { data: existing } = await admin.from('canonical_media_backfill_runs').select('id,phase,status,cursor_source,cursor_id').eq('id', input.runId).maybeSingle();
      if (!existing || existing.phase !== input.phase || existing.status !== 'paused') throw new Error('run_id must identify a paused run in this phase');
      runId = existing.id;
      // A paused run resumes from its persisted keyset checkpoint unless an
      // operator explicitly supplies a later cursor.
      if (!input.cursorSource) input.cursorSource = existing.cursor_source;
      if (!input.cursorId) input.cursorId = existing.cursor_id;
      await admin.from('canonical_media_backfill_runs').update({ status: 'running', finished_at: null }).eq('id', runId);
    } else {
      const { data, error } = await admin.from('canonical_media_backfill_runs').insert({ phase: input.phase, parent_run_id: input.phase === 'apply' ? input.planRunId : null, requested_by: requestedBy, cursor_source: input.cursorSource, cursor_id: input.cursorId }).select('id').single();
      if (error) throw error; runId = data.id;
    }
    if (input.phase === 'apply') {
      let plansQuery = admin.from('canonical_media_backfill_plans').select('id').eq('run_id', input.planRunId).order('id').limit(input.limit);
      const afterPlanId = input.cursorId || null;
      if (afterPlanId && /^\d+$/.test(afterPlanId)) plansQuery = plansQuery.gt('id', afterPlanId);
      const { data: plans, error } = await plansQuery;
      if (error) throw error;
      let linked = 0, conflicts = 0;
      for (const plan of plans || []) {
        const { data: result, error: applyError } = await admin.rpc('apply_canonical_media_backfill_plan_row', { p_run_id: runId, p_plan_id: plan.id, p_lease_token: leaseToken, p_fence: fence });
        if (applyError) throw applyError;
        if (result === 'linked') linked++; if (result === 'conflict') conflicts++;
      }
      // A plan is immutable; repeated apply calls safely recheck and skip prior rows.
      const lastPlan = (plans || []).at(-1);
      const complete = (plans || []).length < input.limit;
      await admin.from('canonical_media_backfill_runs').update({ status: complete ? 'complete' : 'paused', cursor_id: lastPlan ? String(lastPlan.id) : input.cursorId, processed_tuples: (plans || []).length, linked_rows: linked, conflict_rows: conflicts, finished_at: complete ? new Date().toISOString() : null }).eq('id', runId);
      return reply({ run_id: runId, phase: 'apply', processed_rows: (plans || []).length, linked_rows: linked, conflict_rows: conflicts, complete, next_cursor: complete || !lastPlan ? null : { id: String(lastPlan.id) } });
    }
    const { data: candidates, error: candidateError } = await admin.rpc('list_canonical_media_backfill_candidates', { p_after_source: input.cursorSource, p_after_id: input.cursorId, p_limit: input.limit });
    if (candidateError) throw candidateError;
    let unresolved = 0, planned = 0;
    if (input.phase === 'catalog') {
      const outcomes = await mapWithConcurrency(candidates || [], 4, async (item: any) => {
        const beat = await admin.rpc('heartbeat_canonical_media_backfill_lease', { p_lease_token: leaseToken, p_fence: fence, p_ttl_seconds: 120 });
        if (beat.error || beat.data !== true) throw new Error('backfill lease lost');
        const { data: alias, error: aliasError } = await admin.from('media_provider_aliases').select('canonical_media_id').eq('external_source', item.external_source).eq('external_id', item.external_id).maybeSingle();
        if (aliasError) throw aliasError;
        if (alias?.canonical_media_id) return 'existing';
        if (!item.title) {
          await admin.from('canonical_media_backfill_audit').insert({ run_id: runId, external_source: item.external_source, external_id: item.external_id, outcome: 'unresolved', details: { reason: 'no historical title available for direct provider-ID verification; no identity created' } });
          return 'unresolved';
        }
        try {
          const resolved = await resolveCanonicalMedia(admin, { externalSource: item.external_source, externalId: item.external_id, mediaType: item.media_type, title: item.title, creator: item.creator, requireVerifiedSource: true, allowVerifiedTitleCreatorYear: false });
          const afterResolve = await admin.rpc('heartbeat_canonical_media_backfill_lease', { p_lease_token: leaseToken, p_fence: fence, p_ttl_seconds: 120 });
          if (afterResolve.error || afterResolve.data !== true) throw new Error('backfill lease lost');
          await admin.from('canonical_media_backfill_audit').insert({ run_id: runId, external_source: item.external_source, external_id: item.external_id, canonical_media_id: resolved.canonicalMediaId, outcome: 'catalog_resolved', details: { strict: true, verification: 'exact_provider_id' } });
          return 'resolved';
        } catch (error) {
          if (!(error instanceof UnverifiedProviderTupleError)) throw error;
          await admin.from('canonical_media_backfill_audit').insert({ run_id: runId, external_source: item.external_source, external_id: item.external_id, outcome: 'unresolved', details: { reason: 'exact provider-ID verification failed or was unavailable; no identity created' } });
          return 'unresolved';
        }
      });
      unresolved = outcomes.filter((outcome) => outcome === 'unresolved').length;
    } else {
      for (const item of candidates || []) {
        const beat = await admin.rpc('heartbeat_canonical_media_backfill_lease', { p_lease_token: leaseToken, p_fence: fence, p_ttl_seconds: 120 });
        if (beat.error || beat.data !== true) throw new Error('backfill lease lost');
        const { data: alias, error: aliasError } = await admin.from('media_provider_aliases').select('canonical_media_id').eq('external_source', item.external_source).eq('external_id', item.external_id).maybeSingle();
        if (aliasError) throw aliasError;
        const canonicalId = alias?.canonical_media_id || null;
        if (canonicalId) {
        const { data: count, error } = await admin.rpc('plan_canonical_media_backfill_tuple', { p_run_id: runId, p_lease_token: leaseToken, p_fence: fence, p_external_source: item.external_source, p_external_id: item.external_id, p_canonical_media_id: canonicalId });
        if (error) throw error; planned += Number(count || 0);
        }
      }
    }
    const last = (candidates || []).at(-1), complete = (candidates || []).length < input.limit;
    await admin.from('canonical_media_backfill_runs').update({ status: complete ? 'complete' : 'paused', cursor_source: last?.external_source || input.cursorSource, cursor_id: last?.external_id || input.cursorId, processed_tuples: (candidates || []).length, linked_rows: planned, unresolved_tuples: unresolved, finished_at: complete ? new Date().toISOString() : null }).eq('id', runId);
    return reply({ run_id: runId, phase: input.phase, processed_tuples: (candidates || []).length, planned_rows: planned, unresolved_tuples: unresolved, complete, next_cursor: complete || !last ? null : { source: last.external_source, id: last.external_id } });
  } catch (e) {
    if (runId) await admin.from('canonical_media_backfill_runs').update({ status: 'failed', error_message: String(e?.message || e).slice(0, 1000), finished_at: new Date().toISOString() }).eq('id', runId);
    return reply({ error: String(e?.message || e), run_id: runId }, 500);
  } finally { await admin.rpc('release_canonical_media_backfill_lease', { p_lease_token: leaseToken, p_fence: fence }); }
});