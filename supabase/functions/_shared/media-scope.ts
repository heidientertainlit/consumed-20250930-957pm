export type MediaScope = {
  seasonNumber: number | null;
  episodeNumber: number | null;
  episodeTitle: string | null;
  volumeNumber: number | null;
};

/**
 * Read the media scope fields accepted by the feed APIs.
 *
 * The feed stores these values in snake_case, while mediaItems expose the
 * existing client-facing camelCase shape. Nullish coalescing is intentional:
 * season 0 and episode 0 are valid metadata and must not be treated as
 * "missing".
 */
export function normalizeMediaScope(source: any): MediaScope {
  return {
    seasonNumber: source?.seasonNumber
      ?? source?.season_number
      ?? source?.mediaSeasonNumber
      ?? source?.media_season_number
      ?? null,
    episodeNumber: source?.episodeNumber
      ?? source?.episode_number
      ?? source?.mediaEpisodeNumber
      ?? source?.media_episode_number
      ?? null,
    episodeTitle: source?.episodeTitle
      ?? source?.episode_title
      ?? source?.mediaEpisodeTitle
      ?? source?.media_episode_title
      ?? null,
    volumeNumber: source?.volumeNumber
      ?? source?.volume_number
      ?? source?.mediaVolumeNumber
      ?? source?.media_volume_number
      ?? null,
  };
}

/** The persisted social_posts column names. */
export function mediaScopeToPostColumns(source: any): {
  media_season_number: number | null;
  media_episode_number: number | null;
  media_episode_title: string | null;
  media_volume_number: number | null;
} {
  const scope = normalizeMediaScope(source);
  return {
    media_season_number: scope.seasonNumber,
    media_episode_number: scope.episodeNumber,
    media_episode_title: scope.episodeTitle,
    media_volume_number: scope.volumeNumber,
  };
}

/** The camelCase fields attached to every feed mediaItems entry. */
export function mediaScopeToItemFields(source: any): {
  seasonNumber: number | null;
  episodeNumber: number | null;
  episodeTitle: string | null;
  volumeNumber: number | null;
} {
  return normalizeMediaScope(source);
}