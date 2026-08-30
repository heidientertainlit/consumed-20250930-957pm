// A deliberately small, deterministic scorer.  It is kept dependency-free so it
// can be used by the edge function as well as by calibration scripts.
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const normalize = (value) => String(value || '')
  .toLowerCase()
  .trim()
  .replace(/&/g, ' and ')
  .replace(/[^\p{L}\p{N}]+/gu, ' ')
  .replace(/\s+/g, ' ')
  .trim();

const values = (value) => {
  const input = Array.isArray(value) ? value : value == null ? [] : [value];
  return [...new Set(input.map(normalize).filter(Boolean))];
};

const field = (item, name) => values(item?.[name]);
const creators = (item) => [...new Set([...field(item, 'creator'), ...field(item, 'creators')])];
const titleOf = (item) => item?.title || item?.media_title || '';
const authoritativeStoryKey = (value) => {
  const key = String(value || '').trim();
  return /^wikidata:Q\d+$/i.test(key) ? key.toLowerCase() : '';
};
const overlap = (left, right) => {
  if (!left.length || !right.length) return 0;
  const rightSet = new Set(right);
  const shared = left.filter((value) => rightSet.has(value)).length;
  return shared / new Set([...left, ...right]).size;
};

const sharedValues = (left, right) => {
  const rightSet = new Set(right);
  return left.filter((value) => rightSet.has(value));
};

const cosineSimilarity = (left, right) => {
  if (!Array.isArray(left) || !Array.isArray(right) || !left.length || left.length !== right.length) return null;
  let dot = 0;
  let leftMagnitude = 0;
  let rightMagnitude = 0;
  for (let index = 0; index < left.length; index += 1) {
    const a = Number(left[index]);
    const b = Number(right[index]);
    if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
    dot += a * b;
    leftMagnitude += a * a;
    rightMagnitude += b * b;
  }
  return leftMagnitude && rightMagnitude ? clamp(dot / Math.sqrt(leftMagnitude * rightMagnitude), -1, 1) : null;
};

// Ratings are centered on a neutral three-star rating.  This intentionally
// preserves a dislike as evidence instead of treating missing enthusiasm as one.
const preferenceFor = (rating) => {
  const value = Number(rating?.rating);
  return Number.isFinite(value) ? clamp((value - 3) / 2, -1, 1) : 0;
};

const traitDefinitions = [
  ['themes', 0.35, 'themes'],
  ['tones', 0.22, 'tone'],
  ['styles', 0.22, 'style'],
  ['audience', 0.16, 'audience'],
  ['pacing', 0.14, 'pacing'],
  ['keywords', 0.2, 'keywords'],
];

const evidenceRank = (item) => item.weight * Math.abs(item.value);
const GENERIC_GENRES = new Set([
  'action', 'adventure', 'comedy', 'drama', 'fantasy', 'romance', 'science fiction',
  'thriller', 'mystery', 'horror', 'family',
]);

const nameRating = (rating) => titleOf(rating) || 'an untitled rating';

// A DNA row is only usable when it carries an explicitly established taste
// direction.  In particular, a bare embedding/engagement strength is not taste.
const dnaPreference = (signal) => {
  const source = normalize(signal?.source || signal?.signal_source || signal?.origin);
  const explicitlyTasteBased = ['rating', 'rated', 'explicit', 'taste', 'followed creator', 'follow'].includes(source);
  const explicit = Number(signal?.preference ?? signal?.taste ?? signal?.rating);
  if (Number.isFinite(explicit)) {
    const signed = signal?.rating != null && signal?.preference == null && signal?.taste == null
      ? clamp((explicit - 3) / 2, -1, 1)
      : clamp(explicit, -1, 1);
    return explicitlyTasteBased || signal?.preference != null || signal?.taste != null ? signed : null;
  }
  if (explicitlyTasteBased && typeof signal?.direction === 'string') {
    return normalize(signal.direction) === 'negative' ? -1 : normalize(signal.direction) === 'positive' ? 1 : null;
  }
  return null;
};

export function scoreMediaMatchV3({
  ratings = [],
  candidate = {},
  dnaSignals = [],
  followedCreators = [],
} = {}) {
  if (candidate.source_verified !== true) {
    return {
      score: null,
      confidence: 0,
      reason: 'Not enough verified source evidence for this title.',
      evidence: [],
    };
  }
  const candidateType = normalize(candidate.media_type);
  const candidateStory = authoritativeStoryKey(candidate.story_key);
  const candidateCreators = creators(candidate);
  const evidence = [];

  for (const rating of ratings) {
    if (rating?.source_verified !== true) continue;
    const preference = preferenceFor(rating);
    if (!preference) continue;
    const ratingType = normalize(rating.media_type);
    const ratingStory = authoritativeStoryKey(rating.story_key);
    const labels = [];
    let weight = 0;
    let substantive = false;
    let reliability = 0;

    // Only an authoritative Wikidata work key can establish story identity.
    // Titles are presentation labels and are never identity evidence.
    const sameStory = Boolean(candidateStory && ratingStory && candidateStory === ratingStory);
    if (sameStory) {
      weight += 8;
      labels.push('same story');
      substantive = true;
      reliability = 1;
    }

    if (overlap(candidateCreators, creators(rating))) {
      weight += 2.7;
      labels.push('creator');
      substantive = true;
      reliability = Math.max(reliability, 0.85);
    }
    if (overlap(field(candidate, 'franchise'), field(rating, 'franchise'))) {
      weight += 3.1;
      labels.push('franchise');
      substantive = true;
      reliability = Math.max(reliability, 0.86);
    }

    const semanticSimilarity = cosineSimilarity(candidate.embedding, rating.embedding);
    if (semanticSimilarity != null && semanticSimilarity >= 0.62) {
      const excess = (semanticSimilarity - 0.62) / 0.38;
      weight += 1 + 5 * excess * excess;
      labels.push('semantic embedding');
      substantive = true;
      reliability = Math.max(reliability, 0.56 + 0.36 * excess);
    }

    for (const [key, traitWeight, label] of traitDefinitions) {
      const shared = overlap(field(candidate, key), field(rating, key));
      if (shared) {
        weight += traitWeight * shared;
        labels.push(label);
      }
    }
    // Controlled metadata explains a relationship qualified by identity,
    // creator, franchise, embedding, or specific same-format genres. It never
    // creates a relationship by itself.

    const sharedGenres = sharedValues(field(candidate, 'genres'), field(rating, 'genres'));
    const specificGenres = sharedGenres.filter((genre) => !GENERIC_GENRES.has(genre));
    if (sharedGenres.length) {
      weight += overlap(field(candidate, 'genres'), field(rating, 'genres'))
        * (candidateType && candidateType === ratingType ? 0.65 : 0.12);
      labels.push('genre');
      // Generic genre overlap is never enough.  Same-format, specific, multi-tag
      // overlap is useful but intentionally calibrated below an identity signal.
      if (candidateType === ratingType && specificGenres.length >= 2) {
        substantive = true;
        reliability = Math.max(reliability, 0.32);
      }
    }
    if (!weight || !substantive) continue;
    evidence.push({
      label: nameRating(rating),
      kind: sameStory ? 'identity match' : labels.join(', '),
      value: preference,
      weight,
      substantive,
      reliability,
      source: 'rating',
      detail: labels,
    });
  }

  const followed = new Set(values(followedCreators));
  const followedMatch = candidateCreators.find((creator) => followed.has(creator));
  if (followedMatch) {
    evidence.push({ label: followedMatch, kind: 'followed creator', value: 0.65, weight: 1.25, substantive: false, reliability: 0, source: 'support', detail: ['followed creator'] });
  }

  for (const signal of Array.isArray(dnaSignals) ? dnaSignals : []) {
    if (normalize(signal?.type || signal?.signal_type) === 'engagement') continue;
    const preference = dnaPreference(signal);
    if (preference == null || !preference) continue;
    const type = normalize(signal?.type || signal?.signal_type);
    const value = normalize(signal?.value || signal?.signal_value);
    const dnaField = {
      genre: 'genres',
      theme: 'themes',
      tone: 'tones',
      style: 'styles',
      keyword: 'keywords',
      audience: 'audience',
      pacing: 'pacing',
      franchise: 'franchise',
    }[type] || type;
    const candidateValues = type === 'creator' ? candidateCreators : field(candidate, dnaField);
    if (!value || !candidateValues.includes(value)) continue;
    evidence.push({ label: value, kind: 'established DNA taste', value: preference, weight: 0.35, substantive: false, reliability: 0, source: 'support', detail: ['DNA'] });
  }

  const substantive = evidence.filter((item) =>
    item.source === 'rating' && item.substantive && item.value !== 0 && item.label !== 'an untitled rating'
  );
  const substantiveWeight = substantive.reduce((sum, item) => sum + item.weight, 0);
  if (!substantive.length || substantiveWeight < 0.8) {
    return {
      score: null,
      confidence: 0,
      reason: 'Not enough substantive rating evidence for this title.',
      evidence: [],
    };
  }

  const ratingEvidence = evidence.filter((item) => item.source === 'rating');
  const supportEvidence = evidence.filter((item) => item.source === 'support');
  const ratingWeight = ratingEvidence.reduce((sum, item) => sum + item.weight, 0);
  const supportWeight = supportEvidence.reduce((sum, item) => sum + item.weight, 0);
  // Support can break a close call, but cannot overwhelm what the user
  // explicitly rated. This also prevents many DNA rows from stacking.
  const supportScale = supportWeight ? Math.min(1, ratingWeight * 0.2 / supportWeight) : 0;
  const effectiveSupportWeight = supportWeight * supportScale;
  const preference = (
    ratingEvidence.reduce((sum, item) => sum + item.value * item.weight, 0)
    + supportEvidence.reduce((sum, item) => sum + item.value * item.weight * supportScale, 0)
  ) / (ratingWeight + effectiveSupportWeight);
  const distinctRatings = new Set(substantive.map((item) => item.label)).size;
  const identity = substantive.some((item) => item.kind === 'identity match');
  const confidence = clamp(
    (identity ? 0.72 : 0.18) + Math.min(0.2, substantiveWeight / 16) + Math.min(0.12, distinctRatings * 0.04),
    0,
    0.96,
  );
  const reliability = Math.max(...substantive.map((item) => item.reliability || 0));
  const score = Math.round(clamp(50 + 45 * preference * reliability * (0.7 + confidence * 0.3), 3, 97));
  const ranked = evidence.sort((a, b) => evidenceRank(b) - evidenceRank(a)).slice(0, 5);
  const rankedRatings = ratingEvidence.sort((a, b) => evidenceRank(b) - evidenceRank(a));
  const positive = rankedRatings.filter((item) => item.value > 0.1);
  const negative = rankedRatings.filter((item) => item.value < -0.1);
  const cited = (negative.length && (!positive.length || preference < 0))
    ? negative
    : positive;
  const names = cited.slice(0, 2).map((item) => item.label);
  const reason = names.length
    ? `${preference < 0 ? 'Grounded in lower ratings for' : 'Grounded in your ratings for'} ${names.join(' and ')}.`
    : 'Your relevant ratings are mixed for this title.';

  return {
    score,
    confidence: Math.round(confidence * 100),
    reason,
    evidence: ranked.map(({ label, kind, value, source }) => ({
      label,
      kind,
      direction: value >= 0 ? 'positive' : 'negative',
      source,
    })),
  };
}