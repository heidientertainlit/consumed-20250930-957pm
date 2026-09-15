import assert from 'node:assert/strict';
import test from 'node:test';
import {
  mediaScopeToItemFields,
  mediaScopeToPostColumns,
  normalizeMediaScope,
} from './media-scope.ts';

test('maps selected season, episode, and volume to the mediaItems shape', () => {
  assert.deepEqual(
    mediaScopeToItemFields({
      media_season_number: 0,
      media_episode_number: 0,
      media_episode_title: 'Pilot',
      media_volume_number: 3,
    }),
    {
      seasonNumber: 0,
      episodeNumber: 0,
      episodeTitle: 'Pilot',
      volumeNumber: 3,
    },
  );
});

test('maps camelCase composer metadata to persisted snake_case columns', () => {
  assert.deepEqual(
    mediaScopeToPostColumns({
      seasonNumber: 2,
      episodeNumber: 4,
      episodeTitle: 'The Scope',
      volumeNumber: 7,
    }),
    {
      media_season_number: 2,
      media_episode_number: 4,
      media_episode_title: 'The Scope',
      media_volume_number: 7,
    },
  );
});

test('no selected scope is represented as nullable fields', () => {
  assert.deepEqual(normalizeMediaScope({}), {
    seasonNumber: null,
    episodeNumber: null,
    episodeTitle: null,
    volumeNumber: null,
  });
  assert.deepEqual(mediaScopeToPostColumns(null), {
    media_season_number: null,
    media_episode_number: null,
    media_episode_title: null,
    media_volume_number: null,
  });
});

test('old rows without volume metadata remain backward compatible', () => {
  assert.deepEqual(
    mediaScopeToItemFields({
      media_season_number: 1,
      media_episode_number: 2,
      media_episode_title: 'Old row',
    }),
    {
      seasonNumber: 1,
      episodeNumber: 2,
      episodeTitle: 'Old row',
      volumeNumber: null,
    },
  );
});