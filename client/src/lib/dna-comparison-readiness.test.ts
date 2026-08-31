import assert from 'node:assert/strict';
import test from 'node:test';
import { getDnaComparisonUpdateDetail } from './dna-comparison-readiness.ts';

test('a developing Compare response never broadcasts its score to the feed', () => {
  assert.equal(getDnaComparisonUpdateDetail('friend-1', {
    match_score: 53,
    comparison_status: 'developing',
  }), null);
});

test('a ready Compare response may refresh the existing feed alignment', () => {
  assert.deepEqual(getDnaComparisonUpdateDetail('friend-1', {
    match_score: 53,
    comparison_status: 'ready',
  }), {
    friendId: 'friend-1',
    matchScore: 53,
  });
});