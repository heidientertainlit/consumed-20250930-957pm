import assert from 'node:assert/strict';
import test from 'node:test';
import {
  APPLY_CONFIRMATION,
  assertApplyConfirmed,
  parseBackfillRequest,
  verifiedMetadata,
} from './canonical-backfill-safety.ts';

test('defaults to a bounded dry run', () => {
  assert.deepEqual(parseBackfillRequest({ limit: 999 }), {
    phase: 'plan',
    limit: 100,
    cursorSource: null,
    cursorId: null,
    confirmation: null,
    runId: null,
    planRunId: null,
  });
});

test('apply requires the exact case-sensitive confirmation', () => {
  assert.throws(() => assertApplyConfirmed(parseBackfillRequest({ phase: 'apply', confirmation: APPLY_CONFIRMATION.toLowerCase() })));
  assert.doesNotThrow(() => assertApplyConfirmed(parseBackfillRequest({ phase: 'apply', confirmation: APPLY_CONFIRMATION })));
});

test('only explicitly verified provider metadata is accepted', () => {
  assert.equal(verifiedMetadata({ verified_source_metadata: null, title: 'caller title' }), null);
  assert.equal(verifiedMetadata({ verified_source_metadata: { creator: 'Someone' } }), null);
  assert.deepEqual(verifiedMetadata({ verified_source_metadata: { title: ' Provider Title ', release_year: 2020 } }), {
    title: 'Provider Title',
    release_year: 2020,
  });
});