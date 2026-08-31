import assert from 'node:assert/strict';
import test from 'node:test';
import { buildLegacyPeopleSharedTitles } from './people-shared-titles.ts';

test('preserves the People shared-title cache shape and right-side deduplication', () => {
  const shared = buildLegacyPeopleSharedTitles(
    [
      { media_title: 'Shared', media_type: 'movie', media_external_id: 'left', media_external_source: 'tmdb' },
      { media_title: 'Only left', media_type: 'book', media_external_id: 'book-1', media_external_source: 'google_books' },
    ],
    [
      { media_title: 'Shared', media_type: 'movie', media_external_id: 'old', media_external_source: 'legacy' },
      { media_title: 'SHARED', media_type: 'movie', media_external_id: 'right', media_external_source: 'tmdb' },
      { media_title: 'Only right', media_type: 'tv', media_external_id: 'show-1', media_external_source: 'tmdb' },
    ],
  );

  assert.deepEqual(shared, [{
    title: 'SHARED',
    media_type: 'movie',
    external_id: 'right',
    external_source: 'tmdb',
  }]);
});