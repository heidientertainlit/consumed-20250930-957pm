type RatingRow = {
  media_title?: string | null;
  media_type?: string | null;
  media_external_id?: string | null;
  media_external_source?: string | null;
};

// Mirrors people-affinity's existing sharedTitles contract. Compare uses this
// only for the shared dna_comparisons cache column; its stricter evidence is
// stored separately in insights.detailed_shared_titles.
export function buildLegacyPeopleSharedTitles(
  leftRatings: RatingRow[],
  rightRatings: RatingRow[],
) {
  const left = new Map<string, RatingRow>();
  const right = new Map<string, RatingRow>();
  for (const item of leftRatings) {
    if (item.media_title) left.set(item.media_title.toLowerCase(), item);
  }
  for (const item of rightRatings) {
    if (item.media_title) right.set(item.media_title.toLowerCase(), item);
  }
  return [...right]
    .filter(([title]) => left.has(title))
    .slice(0, 10)
    .map(([, item]) => ({
      title: item.media_title,
      media_type: item.media_type,
      external_id: item.media_external_id,
      external_source: item.media_external_source,
    }));
}