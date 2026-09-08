import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const pageSource = readFileSync(new URL('./dna.tsx', import.meta.url), 'utf8');
const buttonSource = readFileSync(
  new URL('../components/friend-dna-comparison.tsx', import.meta.url),
  'utf8',
);

test('puts the active friend above the comparison and the other choices below', () => {
  const activeLabel = pageSource.indexOf('Comparing with</p>');
  const resultCard = pageSource.indexOf('ref={comparisonCardRef}');
  const othersLabel = pageSource.indexOf('Others you can compare with');

  assert.ok(activeLabel > -1);
  assert.ok(resultCard > activeLabel);
  assert.ok(othersLabel > resultCard);
  assert.match(
    pageSource,
    /const otherEligibleFriends = eligibleFriends\.filter\(\(f: any\) => f\.id !== selectedFriendId\)/,
  );
});

test('uses pill-shaped Compare DNA buttons on friend profiles', () => {
  assert.match(buttonSource, /className="opacity-60 rounded-full"/);
  assert.match(
    buttonSource,
    /className="rounded-full border-purple-200 hover:border-purple-300 hover:bg-purple-50"/,
  );
});