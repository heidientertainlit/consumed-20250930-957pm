export const IMPORT_POINT_WEIGHTS: Record<string, number> = {
  book: 15, movie: 8, tv: 10, music: 1, podcast: 3, game: 5, youtube: 2,
};

export type ImportOutcome = 'inserted' | 'skipped_existing' | 'skipped_duplicate' | 'failed';

export function reconcileImportOutcomes(outcomes: ImportOutcome[]): Record<ImportOutcome, number> {
  return outcomes.reduce((counts, outcome) => {
    counts[outcome] += 1;
    return counts;
  }, { inserted: 0, skipped_existing: 0, skipped_duplicate: 0, failed: 0 });
}

export function importPointsForInserted(mediaTypes: string[]): number {
  return mediaTypes.reduce((total, mediaType) => total + (IMPORT_POINT_WEIGHTS[mediaType] || 0), 0);
}