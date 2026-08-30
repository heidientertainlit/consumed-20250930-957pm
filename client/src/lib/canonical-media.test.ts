import assert from 'node:assert/strict';
import test from 'node:test';
import { canonicalMediaIdFrom, mergePreferredMediaRatings } from './canonical-media';

test('keeps a nested canonical identity when adapting a feed post', () => {
  const canonicalId = '11111111-1111-4111-8111-111111111111';
  assert.equal(canonicalMediaIdFrom({}, { canonical_media_id: canonicalId }), canonicalId);
});

test('Funny Story canonical rating wins while community ratings remain visible', () => {
  const rows = mergePreferredMediaRatings(
    [
      {
        user_id: 'current-user',
        rating: 4,
        updated_at: '2026-08-30T01:00:00Z',
        media_external_source: 'goodreads',
        media_external_id: '194802722',
      },
      {
        user_id: 'community-a',
        rating: 5,
        updated_at: '2026-08-30T00:30:00Z',
      },
    ],
    [
      {
        user_id: 'current-user',
        rating: 2,
        updated_at: '2025-01-01T00:00:00Z',
        media_external_source: 'googlebooks',
        media_external_id: 'wcHMEAAAQBAJ',
      },
      {
        user_id: 'community-b',
        rating: 3.5,
        updated_at: '2026-08-29T23:00:00Z',
      },
    ],
  );

  assert.equal(rows.find((row) => row.user_id === 'current-user')?.rating, 4);
  assert.deepEqual(new Set(rows.map((row) => row.user_id)), new Set([
    'current-user',
    'community-a',
    'community-b',
  ]));
});