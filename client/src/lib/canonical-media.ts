export type MediaRatingRow = {
  user_id?: string | null;
  rating?: number | null;
  created_at?: string | null;
  updated_at?: string | null;
  [key: string]: unknown;
};

export function canonicalMediaIdFrom(post: any, media?: any): string | undefined {
  return media?.canonical_media_id
    || media?.canonicalMediaId
    || post?.canonical_media_id
    || post?.canonicalMediaId
    || undefined;
}

const ratingTimestamp = (row: MediaRatingRow) =>
  Date.parse(String(row.updated_at || row.created_at || '')) || 0;

function newestByUser(rows: MediaRatingRow[]): Map<string, MediaRatingRow> {
  const result = new Map<string, MediaRatingRow>();
  [...rows]
    .sort((a, b) => ratingTimestamp(b) - ratingTimestamp(a))
    .forEach((row) => {
      const key = row.user_id || `${row.created_at}:${row.rating}`;
      if (!result.has(key)) result.set(key, row);
    });
  return result;
}

/**
 * During rollout, legacy provider rows remain readable. A canonical row for a
 * user supersedes that user's provider-tuple row while unrelated community
 * ratings remain visible.
 */
export function mergePreferredMediaRatings(
  canonicalRows: MediaRatingRow[],
  legacyRows: MediaRatingRow[],
): MediaRatingRow[] {
  const merged = newestByUser(legacyRows);
  newestByUser(canonicalRows).forEach((row, key) => merged.set(key, row));
  return Array.from(merged.values());
}