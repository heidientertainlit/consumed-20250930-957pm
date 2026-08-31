import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildComparisonReadiness,
  collectPositiveMediaEvidence,
  findSharedPositiveMedia,
} from './compare-readiness.ts';

const favorites = new Set(['favorites']);
const none = new Set<string>();

test('matches different providers through canonical identity', () => {
  const left = collectPositiveMediaEvidence({
    items: [],
    ratings: [{
      media_title: 'The Same Work',
      media_type: 'movie',
      media_external_source: 'tmdb',
      media_external_id: '123',
      canonical_media_id: 'work-1',
      rating: 4,
    }],
    favoriteListIds: none,
    dnfListIds: none,
  });
  const right = collectPositiveMediaEvidence({
    items: [{
      title: 'Same Work: Special Edition',
      media_type: 'film',
      external_source: 'other',
      external_id: 'abc',
      canonical_media_id: 'work-1',
      list_id: 'favorites',
    }],
    ratings: [],
    favoriteListIds: favorites,
    dnfListIds: none,
  });

  assert.equal(findSharedPositiveMedia(left, right).length, 1);
});

test('does not match title text alone', () => {
  const left = collectPositiveMediaEvidence({
    items: [{ title: 'Collision', media_type: 'movie', list_id: 'favorites' }],
    ratings: [],
    favoriteListIds: favorites,
    dnfListIds: none,
  });
  const right = collectPositiveMediaEvidence({
    items: [{ title: 'Collision', media_type: 'movie', list_id: 'favorites' }],
    ratings: [],
    favoriteListIds: favorites,
    dnfListIds: none,
  });

  assert.equal(findSharedPositiveMedia(left, right).length, 0);
});

test('low rating and DNF override favorites', () => {
  const evidence = collectPositiveMediaEvidence({
    items: [
      { title: 'Low Rated', media_type: 'movie', list_id: 'favorites', external_source: 'tmdb', external_id: '1' },
      { title: 'Abandoned', media_type: 'book', list_id: 'favorites', external_source: 'books', external_id: '2' },
      { title: 'Abandoned', media_type: 'book', list_id: 'dnf', external_source: 'books', external_id: '2' },
    ],
    ratings: [{ media_title: 'Low Rated', media_type: 'movie', media_external_source: 'tmdb', media_external_id: '1', rating: 2 }],
    favoriteListIds: favorites,
    dnfListIds: new Set(['dnf']),
  });

  assert.deepEqual(evidence, []);
});

test('negative evidence vetoes an alternate title for the same canonical work', () => {
  const evidence = collectPositiveMediaEvidence({
    items: [{
      title: 'The Fellowship of the Ring',
      media_type: 'book',
      list_id: 'favorites',
      canonical_media_id: 'work:lotr-1',
    }],
    ratings: [{
      media_title: 'Lord of the Rings, Volume One',
      media_type: 'book',
      rating: 2,
      canonical_media_id: 'work:lotr-1',
    }],
    favoriteListIds: favorites,
    dnfListIds: none,
  });

  assert.deepEqual(evidence, []);
});

test('negative evidence does not veto an identified different work with the same title', () => {
  const evidence = collectPositiveMediaEvidence({
    items: [{
      title: 'Crash',
      media_type: 'movie',
      list_id: 'favorites',
      canonical_media_id: 'work:crash-1996',
    }],
    ratings: [{
      media_title: 'Crash',
      media_type: 'movie',
      rating: 2,
      canonical_media_id: 'work:crash-2004',
    }],
    favoriteListIds: favorites,
    dnfListIds: none,
  });

  assert.equal(evidence.length, 1);
  assert.equal(evidence[0].canonical_media_id, 'work:crash-1996');
});

test('requires ten positive items per person and one shared item', () => {
  const make = (side: string) => Array.from({ length: 10 }, (_, index) => ({
    title: `${side} ${index}`,
    media_type: 'movie',
    external_source: 'tmdb',
    external_id: index === 0 ? 'shared' : `${side}-${index}`,
    identity_key: `provider:tmdb:${index === 0 ? 'shared' : `${side}-${index}`}`,
    comparison_key: `provider:tmdb:${index === 0 ? 'shared' : `${side}-${index}`}`,
  }));
  const left = make('left');
  const right = make('right');
  const shared = findSharedPositiveMedia(left, right);

  assert.equal(shared.length, 1);
  assert.equal(buildComparisonReadiness(left, right, shared).status, 'ready');
  assert.equal(buildComparisonReadiness(left.slice(0, 9), right, shared).status, 'developing');
  assert.equal(buildComparisonReadiness(left, right, []).status, 'developing');
});