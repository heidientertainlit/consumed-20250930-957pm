const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const normalize = (value) => String(value || '')
  .toLowerCase()
  .trim()
  .replace(/&/g, 'and')
  .replace(/[^\p{L}\p{N}]+/gu, ' ')
  .replace(/\s+/g, ' ')
  .trim();

const unique = (values) => [...new Set((values || []).map(normalize).filter(Boolean))];

const REQUIRED_CONTEXT_GENRES = new Set([
  'animation',
  'children',
  'childrens',
  'documentary',
  'family',
  'juvenile fiction',
  'juvenile nonfiction',
  'musical',
  'young adult',
]);

const ratingPreference = (rating) => {
  const value = Number(rating);
  if (value >= 5) return 1;
  if (value >= 4.5) return 0.85;
  if (value >= 4) return 0.65;
  if (value >= 3.5) return 0.2;
  if (value >= 3) return 0;
  if (value >= 2.5) return -0.25;
  if (value >= 2) return -0.65;
  if (value >= 1.5) return -0.85;
  return -1;
};

const overlap = (left, right) => {
  if (!left.length || !right.length) return 0;
  const rightSet = new Set(right);
  const shared = left.filter((value) => rightSet.has(value)).length;
  return shared / new Set([...left, ...right]).size;
};

export function scoreMediaMatchV2({ ratings = [], mediaGenres = [], mediaType }) {
  const candidateGenres = unique(mediaGenres);
  const candidateType = normalize(mediaType);

  const genreRatings = new Map();
  const typeRatings = new Map();
  const similarRatings = [];

  for (const rating of ratings) {
    const preference = ratingPreference(rating.rating);
    const genres = unique(rating.genres);
    const type = normalize(rating.media_type);
    // A movie match must be grounded primarily in movie ratings, a book match
    // in book ratings, etc. Cross-media genre labels are too broad to prove fit.
    if (type === candidateType) {
      for (const genre of genres) {
        const current = genreRatings.get(genre) || { total: 0, weight: 0, count: 0 };
        current.total += preference;
        current.weight += 1;
        current.count += 1;
        genreRatings.set(genre, current);
      }
    }
    if (type) {
      const current = typeRatings.get(type) || { total: 0, weight: 0, count: 0 };
      current.total += preference;
      current.weight += 1;
      current.count += 1;
      typeRatings.set(type, current);
    }
    const similarity = type === candidateType ? overlap(candidateGenres, genres) : 0;
    if (similarity > 0) similarRatings.push({ similarity, preference, title: rating.media_title });
  }

  const evidence = [];
  const addEvidence = (value, weight, label, kind) => {
    if (!Number.isFinite(value) || weight <= 0) return;
    evidence.push({ value: clamp(value, -1, 1), weight, label, kind });
  };

  for (const genre of candidateGenres) {
    const history = genreRatings.get(genre);
    if (history?.count) {
      addEvidence(history.total / history.weight, Math.min(2.5, 0.9 + history.count * 0.35), genre, 'rated genre');
    }
  }

  const typeHistory = typeRatings.get(candidateType);
  if (typeHistory?.count >= 3) {
    addEvidence(typeHistory.total / typeHistory.weight, 0.35, candidateType, 'media type');
  }
  similarRatings
    .sort((a, b) => (b.similarity * Math.abs(b.preference)) - (a.similarity * Math.abs(a.preference)))
    .slice(0, 5)
    .forEach((item) => addEvidence(item.preference, item.similarity * 1.4, item.title, 'similar rating'));

  const substantive = evidence.filter((item) => item.kind !== 'media type');
  const weight = evidence.reduce((sum, item) => sum + item.weight, 0);
  const genreCoverage = candidateGenres.map((genre) => genreRatings.get(genre)?.count || 0);
  const minimumGenreEvidence = candidateGenres.length === 1 ? 3 : 2;
  const supportedGenreCounts = genreCoverage.filter((count) => count >= minimumGenreEvidence);
  const requiredSupportedGenres = candidateGenres.length === 1 ? 1 : Math.min(2, candidateGenres.length);
  const hasCoreSupport = supportedGenreCounts.length >= requiredSupportedGenres;
  const hasRequiredContextSupport = candidateGenres.every((genre, index) =>
    !REQUIRED_CONTEXT_GENRES.has(genre) || genreCoverage[index] >= 2
  );
  const confidence = hasCoreSupport && hasRequiredContextSupport
    ? clamp(
      supportedGenreCounts
        .sort((a, b) => b - a)
        .slice(0, requiredSupportedGenres)
        .reduce((sum, count) => sum + Math.min(count, 5), 0)
        / (requiredSupportedGenres * 5),
      0,
      1,
    )
    : 0;
  if (candidateGenres.length === 0 || substantive.length === 0 || !hasCoreSupport || !hasRequiredContextSupport || confidence < 0.4) {
    return {
      score: null,
      confidence: Math.round(confidence * 100),
      reason: 'Not enough same-format rating evidence for this title’s defining traits.',
      evidence: [],
    };
  }

  const preference = evidence.reduce((sum, item) => sum + item.value * item.weight, 0) / weight;
  const score = Math.round(clamp(50 + 45 * preference * (0.55 + confidence * 0.45), 3, 97));
  const ranked = substantive
    .sort((a, b) => (b.weight * Math.abs(b.value)) - (a.weight * Math.abs(a.value)))
    .slice(0, 3);
  const positive = ranked.filter((item) => item.value > 0.15);
  const negative = ranked.filter((item) => item.value < -0.15);
  const reason = negative.length && (!positive.length || score < 50)
    ? `Your ratings suggest ${negative.map((item) => item.label).join(' and ')} may not fit your taste.`
    : positive.length
      ? `Grounded in your ratings for ${positive.map((item) => item.label).join(' and ')}.`
      : 'Your evidence is mixed for this title.';

  return {
    score,
    confidence: Math.round(confidence * 100),
    reason,
    evidence: ranked.map(({ label, kind, value }) => ({ label, kind, direction: value >= 0 ? 'positive' : 'negative' })),
  };
}