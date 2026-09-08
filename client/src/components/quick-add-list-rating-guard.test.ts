import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(
  new URL('./quick-add-list-sheet.tsx', import.meta.url),
  'utf8',
);

test('does not automatically ask for a rating when the media is already rated', () => {
  assert.match(source, /const hasExistingRating = async \(\) =>/);
  assert.match(source, /\.from\('media_ratings'\)/);
  assert.match(source, /\.eq\('user_id', session\.user\.id\)/);
  assert.match(source, /\.eq\('media_external_id', effectiveMedia\.externalId\)/);
  assert.match(source, /\.eq\('media_external_source', effectiveMedia\.externalSource \|\| 'tmdb'\)/);
  assert.match(source, /setStep\(await hasExistingRating\(\) \? 'just-tracked' : 'rate'\)/);
});