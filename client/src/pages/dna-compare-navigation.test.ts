import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const appSource = readFileSync(new URL('../App.tsx', import.meta.url), 'utf8');
const buttonSource = readFileSync(
  new URL('../components/friend-dna-comparison.tsx', import.meta.url),
  'utf8',
);
const profileSource = readFileSync(new URL('./user-profile.tsx', import.meta.url), 'utf8');

test('the DNA route renders the comparison page instead of redirecting to the current profile', () => {
  assert.match(appSource, /import DnaPage from "@\/pages\/dna"/);
  assert.match(
    appSource,
    /<Route path="\/dna">\s*<ProtectedRoute>\s*<DnaPage \/>\s*<\/ProtectedRoute>\s*<\/Route>/,
  );
  assert.doesNotMatch(appSource, /<Route path="\/dna">\s*<RedirectTo to="\/me" \/>/);
});

test('friend profile and reusable button preserve the selected friend in the comparison link', () => {
  assert.match(
    profileSource,
    /setLocation\(`\/dna\?tab=compare&friend=\$\{encodeURIComponent\(viewingUserId\)\}`\)/,
  );
  assert.match(
    buttonSource,
    /`\/dna\?tab=compare&friend=\$\{encodeURIComponent\(friendId\)\}`/,
  );
  assert.doesNotMatch(buttonSource, /\/me\?tab=dna/);
});