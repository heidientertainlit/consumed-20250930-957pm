export const APPLY_CONFIRMATION = 'APPLY HISTORICAL CANONICAL MEDIA BACKFILL';
export type BackfillPhase = 'catalog' | 'plan' | 'apply';

export interface BackfillRequest {
  phase: BackfillPhase;
  limit: number;
  cursorSource: string | null;
  cursorId: string | null;
  confirmation: string | null;
  runId: string | null;
  planRunId: string | null;
}

const boundedText = (value: unknown, max: number): string | null => {
  if (typeof value !== 'string') return null;
  const cleaned = value.trim().slice(0, max);
  return cleaned || null;
};

export function parseBackfillRequest(value: unknown): BackfillRequest {
  const body = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const requestedLimit = typeof body.limit === 'number' && Number.isFinite(body.limit)
    ? Math.trunc(body.limit)
    : 50;
  return {
    phase: body.phase === 'catalog' || body.phase === 'plan' || body.phase === 'apply' ? body.phase : 'plan',
    limit: Math.max(1, Math.min(100, requestedLimit)),
    cursorSource: boundedText(body.cursor_source, 50)?.toLowerCase() || null,
    cursorId: boundedText(body.cursor_id, 200),
    confirmation: typeof body.confirmation === 'string' ? body.confirmation : null,
    runId: boundedText(body.run_id, 36),
    planRunId: boundedText(body.plan_run_id, 36),
  };
}

export function assertApplyConfirmed(request: BackfillRequest): void {
  if (request.phase === 'apply' && request.confirmation !== APPLY_CONFIRMATION) {
    throw new Error(`Apply requires exact confirmation: ${APPLY_CONFIRMATION}`);
  }
}

export function verifiedMetadata(candidate: Record<string, unknown>): Record<string, unknown> | null {
  const metadata = candidate.verified_source_metadata;
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return null;
  const title = boundedText((metadata as Record<string, unknown>).title, 300);
  if (!title) return null;
  return { ...(metadata as Record<string, unknown>), title };
}