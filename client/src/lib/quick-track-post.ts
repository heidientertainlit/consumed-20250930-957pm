export interface QuickTrackEpisode {
  episodeNumber?: number | null;
  episode_number?: number | null;
  name?: string | null;
}

export interface QuickTrackPostMedia {
  title?: string | null;
  type?: string | null;
  mediaType?: string | null;
  image?: string | null;
  image_url?: string | null;
  external_id?: string | null;
  external_source?: string | null;
  volume_number?: number | null;
  volumeNumber?: number | null;
  media_volume_number?: number | null;
}

export interface QuickTrackThoughtPostInput {
  userId: string;
  content: string;
  media: QuickTrackPostMedia;
  selectedSeason?: number | null;
  selectedEpisode?: number | null;
  episodes?: readonly QuickTrackEpisode[];
}

/**
 * Build the direct social_posts row used for a text-only quick-track take.
 *
 * Scope comes from the user's current picker selection only. In particular,
 * this helper does not infer a season or episode from a title. Nullish
 * coalescing is intentional because season 0 and episode 0 are valid values.
 */
export function buildQuickTrackThoughtPostPayload({
  userId,
  content,
  media,
  selectedSeason,
  selectedEpisode,
  episodes = [],
}: QuickTrackThoughtPostInput) {
  const mediaType = (media.type ?? media.mediaType)?.toLowerCase() || null;
  const selectedEpisodeTitle =
    selectedEpisode != null
      ? episodes.find(
          (episode) =>
            (episode.episodeNumber ?? episode.episode_number) === selectedEpisode,
        )?.name ?? null
      : null;
  const episodeTitle = selectedEpisodeTitle;
  const volumeNumber =
    mediaType === "book"
      ? (media.volume_number ?? media.volumeNumber ?? media.media_volume_number)
      : null;

  return {
    user_id: userId,
    content,
    post_type: "thought",
    visibility: "public",
    media_title: media.title || null,
    media_type: mediaType,
    media_external_id: media.external_id || null,
    media_external_source: media.external_source || "tmdb",
    image_url: media.image || media.image_url || "",
    fire_votes: 0,
    ice_votes: 0,
    media_season_number: selectedSeason ?? null,
    media_episode_number: selectedEpisode ?? null,
    media_episode_title: episodeTitle,
    // media_volume_number was added after social_posts shipped. Omit it
    // unless the selected result is an actual book volume so older schemas
    // continue to accept TV, movie, and whole-title inserts.
    ...(typeof volumeNumber === "number"
      ? { media_volume_number: volumeNumber }
      : {}),
  };
}
