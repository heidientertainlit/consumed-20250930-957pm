export const fingerprintKey = (value) => {
  const source = String(value?.media_external_source ?? value?.external_source ?? '');
  const id = String(value?.media_external_id ?? value?.external_id ?? '');
  return source && id ? `${source}:${id}` : null;
};

export function chunkValues(values, size = 100) {
  if (!Number.isInteger(size) || size < 1) throw new Error('chunk size must be a positive integer');
  const chunks = [];
  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }
  return chunks;
}

/**
 * Returns every unique, addressable rating without a cached fingerprint.
 * Input order is retained so coverage never depends on a ranking heuristic.
 */
export function ratingsMissingFingerprints(ratings, cachedKeys) {
  const cached = cachedKeys instanceof Set ? cachedKeys : new Set(cachedKeys || []);
  const queued = new Set();
  return (ratings || []).filter((rating) => {
    const key = fingerprintKey(rating);
    if (!key || cached.has(key) || queued.has(key)) return false;
    queued.add(key);
    return true;
  });
}

export function planFingerprintCoverage(ratings, cachedKeys) {
  const missing = ratingsMissingFingerprints(ratings, cachedKeys);
  const batch = missing.slice(0, 6);
  return {
    missingCount: missing.length,
    batch,
    completeAfterBatch: missing.length <= batch.length,
  };
}