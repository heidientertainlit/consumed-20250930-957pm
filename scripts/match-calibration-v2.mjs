import assert from 'node:assert/strict';
import { scoreMediaMatchV2 } from '../supabase/functions/score-media-match/v2.mjs';

const ratings = [
  { media_title: 'Emma', media_type: 'movie', rating: 5, genres: ['romance', 'period drama', 'comedy'] },
  { media_title: 'Sense and Sensibility', media_type: 'movie', rating: 5, genres: ['romance', 'period drama', 'drama'] },
  { media_title: 'Downton Abbey', media_type: 'tv', rating: 4.5, genres: ['period drama', 'drama'] },
  { media_title: 'Saw X', media_type: 'movie', rating: 1, genres: ['horror', 'thriller'] },
  { media_title: 'Hostel', media_type: 'movie', rating: 1.5, genres: ['horror', 'thriller'] },
];

const strong = scoreMediaMatchV2({ ratings, mediaGenres: ['romance', 'period drama'], mediaType: 'movie' });
assert.ok(strong.score >= 80, `expected strong match, got ${strong.score}`);
assert.ok(strong.confidence >= 40);

const poor = scoreMediaMatchV2({ ratings, mediaGenres: ['horror', 'thriller'], mediaType: 'movie' });
assert.ok(poor.score <= 30, `expected poor match, got ${poor.score}`);

const unknown = scoreMediaMatchV2({ ratings, mediaGenres: [], mediaType: 'movie' });
assert.equal(unknown.score, null);

const repeat = scoreMediaMatchV2({ ratings, mediaGenres: ['romance', 'period drama'], mediaType: 'movie' });
assert.deepEqual(repeat, strong);

console.log('All deterministic v2 media-match calibration checks passed.');