import assert from 'node:assert/strict';
import { scoreMediaMatchV3 } from '../supabase/functions/score-media-match/v3.mjs';
import {
  fingerprintKey,
  planFingerprintCoverage,
  ratingsMissingFingerprints,
} from '../supabase/functions/score-media-match/coverage.mjs';

const helpBookLove = { title: 'The Help', media_type: 'book', rating: 5, story_key: 'wikidata:Q461303', creators: ['Kathryn Stockett'], source_verified: true };
const adaptation = { title: 'The Help', media_type: 'movie', story_key: 'wikidata:Q461303', creators: ['Tate Taylor'], source_verified: true };

const adaptationLove = scoreMediaMatchV3({ ratings: [helpBookLove], candidate: adaptation });
assert.ok(adaptationLove.score >= 90, `5-star adaptation should be strong: ${adaptationLove.score}`);
assert.match(adaptationLove.reason, /The Help/);

const adaptationDislike = scoreMediaMatchV3({
  ratings: [{ ...helpBookLove, rating: 0.5 }],
  candidate: adaptation,
});
assert.ok(adaptationDislike.score <= 12, `disliked adaptation should be low: ${adaptationDislike.score}`);

const analogue = scoreMediaMatchV3({
  ratings: [{ title: 'Station Eleven', media_type: 'tv', rating: 5, embedding: [0.9, 0.4, 0.2], source_verified: true }],
  candidate: { title: 'The Dog Stars', media_type: 'book', embedding: [0.9, 0.4, 0.2], source_verified: true },
});
assert.ok(analogue.score >= 75, `structured cross-media analogue should score: ${analogue.score}`);

const lowSimilarityAnalogue = scoreMediaMatchV3({
  ratings: [{ title: 'Station Eleven', media_type: 'tv', rating: 5, embedding: [1, 0, 0], source_verified: true }],
  candidate: { title: 'Different Story', media_type: 'book', embedding: [0, 1, 0], source_verified: true },
});
assert.equal(lowSimilarityAnalogue.score, null, 'low semantic similarity must not expose a score');

const creator = scoreMediaMatchV3({
  ratings: [{ title: 'Arrival', media_type: 'movie', rating: 5, creators: ['Denis Villeneuve'], source_verified: true }],
  candidate: { title: 'Dune', media_type: 'movie', creator: 'Denis Villeneuve', source_verified: true },
});
assert.ok(creator.score >= 80, `creator affinity should score: ${creator.score}`);

const weakGenreOnly = scoreMediaMatchV3({
  ratings: [{ title: 'Random Space Film', media_type: 'movie', rating: 5, genres: ['science fiction'], source_verified: true }],
  candidate: { title: 'Random Space Novel', media_type: 'book', genres: ['science fiction'], source_verified: true },
});
assert.equal(weakGenreOnly.score, null, 'cross-media genre alone must not expose a score');

const genericTraits = scoreMediaMatchV3({
  ratings: [
    { title: 'Atomic Habits', media_type: 'book', rating: 5, themes: ['personal growth'], tones: ['uplifting'], styles: ['accessible'], audience: ['general'], pacing: ['brisk'], source_verified: true },
    { title: 'Harry Potter', media_type: 'book', rating: 5, themes: ['friendship'], tones: ['uplifting'], styles: ['accessible'], audience: ['general'], pacing: ['brisk'], source_verified: true },
  ],
  candidate: { title: 'Calamity', media_type: 'book', themes: ['personal growth', 'friendship'], tones: ['uplifting'], styles: ['accessible'], audience: ['general'], pacing: ['brisk'], source_verified: true },
});
assert.equal(genericTraits.score, null, 'generic controlled traits must not become a match');

const sparse = scoreMediaMatchV3({ ratings: [{ title: 'Unrelated', rating: 5, source_verified: true }], candidate: { title: 'Unknown', media_type: 'book', source_verified: true } });
assert.equal(sparse.score, null, 'sparse metadata must hide the score');

const followedCreatorOnly = scoreMediaMatchV3({
  candidate: { title: 'Dune', media_type: 'movie', creators: ['Denis Villeneuve'], source_verified: true },
  followedCreators: ['Denis Villeneuve'],
});
assert.equal(followedCreatorOnly.score, null, 'followed-creator support alone must not expose a score');

const dnaOnly = scoreMediaMatchV3({
  candidate: { title: 'A Period Story', media_type: 'book', genres: ['period drama'], source_verified: true },
  dnaSignals: [{ signal_type: 'genre', signal_value: 'period drama', source: 'rating', preference: 1 }],
});
assert.equal(dnaOnly.score, null, 'DNA support alone must not expose a score');

const titleCollision = scoreMediaMatchV3({
  ratings: [{ title: 'Crash', media_type: 'book', rating: 5, source_verified: true }],
  candidate: { title: 'Crash', media_type: 'movie', source_verified: true },
});
assert.equal(titleCollision.score, null, 'same title without an authoritative story key must not establish identity');

const unverifiedCandidate = scoreMediaMatchV3({
  ratings: [{ title: 'Arrival', media_type: 'movie', rating: 5, creators: ['Denis Villeneuve'], embedding: [1, 0], source_verified: true }],
  candidate: { title: 'Dune', media_type: 'movie', creators: ['Denis Villeneuve'], embedding: [1, 0] },
});
assert.equal(unverifiedCandidate.score, null, 'an unverified candidate must never receive a score');

const unverifiedRating = scoreMediaMatchV3({
  ratings: [{ title: 'Arrival', media_type: 'movie', rating: 5, creators: ['Denis Villeneuve'] }],
  candidate: { title: 'Dune', media_type: 'movie', creators: ['Denis Villeneuve'], source_verified: true },
});
assert.equal(unverifiedRating.score, null, 'an unverified rating must not qualify a score');

for (const [result, ratedTitle] of [
  [adaptationLove, 'The Help'],
  [adaptationDislike, 'The Help'],
  [analogue, 'Station Eleven'],
  [creator, 'Arrival'],
]) {
  assert.notEqual(result.score, null);
  assert.ok(result.reason.includes(ratedTitle), `scored reason must cite rated title "${ratedTitle}": ${result.reason}`);
}

const repeat = scoreMediaMatchV3({ ratings: [helpBookLove], candidate: adaptation });
assert.deepEqual(repeat, adaptationLove, 'scoring must be deterministic');

const coverageRatings = Array.from({ length: 12 }, (_, index) => ({
  media_external_source: 'test',
  media_external_id: String(index + 1),
  media_title: index === 11 ? 'Matching Rating Beyond Six' : `History Rating ${index + 1}`,
}));
coverageRatings.push({ ...coverageRatings[11] });
const cachedCoverageKeys = new Set(coverageRatings.slice(0, 2).map(fingerprintKey));
const enrichmentCoverage = ratingsMissingFingerprints(coverageRatings, cachedCoverageKeys);
assert.ok(
  enrichmentCoverage.includes(coverageRatings[11]),
  'a matching rating at position 12 must be selected for enrichment',
);
assert.ok(
  enrichmentCoverage.every((rating) => !cachedCoverageKeys.has(fingerprintKey(rating))),
  'already-cached ratings must not be selected for enrichment',
);
assert.equal(
  enrichmentCoverage.filter((rating) => fingerprintKey(rating) === fingerprintKey(coverageRatings[11])).length,
  1,
  'duplicate rating rows must not duplicate enrichment',
);
const coveredAdaptationRatings = enrichmentCoverage.map((rating) => (
  rating === coverageRatings[11]
    ? { ...helpBookLove, title: rating.media_title }
    : { title: rating.media_title, media_type: 'book', rating: 5, source_verified: true }
));
const coveredAdaptation = scoreMediaMatchV3({
  ratings: coveredAdaptationRatings,
  candidate: adaptation,
});
assert.ok(
  coveredAdaptation.score >= 90,
  `an authoritative adaptation beyond the old six-item cutoff must score: ${coveredAdaptation.score}`,
);
assert.match(
  coveredAdaptation.reason,
  /Matching Rating Beyond Six/,
  'the beyond-six adaptation rating must be cited',
);

const coldHistory = Array.from({ length: 100 }, (_, index) => ({
  media_external_source: 'test',
  media_external_id: `cold-${index + 1}`,
}));
const coldPlan = planFingerprintCoverage(coldHistory, new Set());
assert.equal(coldPlan.missingCount, 100);
assert.ok(coldPlan.batch.length <= 6, 'a cold-history continuation batch must contain at most six items');
assert.equal(coldPlan.completeAfterBatch, false, 'a 100-item cold history cannot complete in one batch');

const finalHistory = coldHistory.slice(0, 6);
const finalPlan = planFingerprintCoverage(finalHistory, new Set());
assert.equal(finalPlan.missingCount, 6);
assert.equal(finalPlan.batch.length, 6);
assert.equal(finalPlan.completeAfterBatch, true, 'the final six missing fingerprints complete coverage');

console.log('All deterministic v3 media-match calibration checks passed.');