/**
 * A title's scope is display metadata, not part of its canonical identity.
 *
 * Feed responses have existed in both shapes for a while: the post-level
 * response uses snake_case names while mediaItems uses camelCase names. Keep
 * the formatting in one pure helper so every feed surface can preserve the
 * raw title and render the scope consistently.
 */
export interface MediaScopeFields {
  media_season_number?: number | string | null;
  media_episode_number?: number | string | null;
  media_episode_title?: string | null;
  media_volume_number?: number | string | null;
  seasonNumber?: number | string | null;
  episodeNumber?: number | string | null;
  episodeTitle?: string | null;
  volumeNumber?: number | string | null;
  // These aliases make the formatter safe to use with normalized client
  // objects as well as the raw feed response.
  mediaSeasonNumber?: number | string | null;
  mediaEpisodeNumber?: number | string | null;
  mediaEpisodeTitle?: string | null;
  mediaVolumeNumber?: number | string | null;
}

export type MediaScopeSource = MediaScopeFields & {
  mediaItems?: MediaScopeFields[] | null;
};

function scopeNumber(value: number | string | null | undefined): string | undefined {
  if (value === null || value === undefined) return undefined;
  if (typeof value === 'string' && value.trim() === '') return undefined;

  const normalized = typeof value === 'string' ? Number(value.trim()) : value;
  if (typeof normalized !== 'number' || !Number.isFinite(normalized)) return undefined;
  // Scope values are ordinal integers. Number() also makes string "0" work,
  // while preserving a useful value for any older non-integer data.
  return Number.isInteger(normalized) ? String(normalized) : String(normalized);
}

function scopeText(value: string | null | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized || undefined;
}

/**
 * Formats season/episode/volume metadata for display directly below a title.
 *
 * `source` is normally the post (and may contain mediaItems); `media` can be
 * supplied when callers already have the selected media item. Values on the
 * post take precedence, with media-item values filling in missing fields.
 */
export function formatMediaScopeLabel(
  source?: MediaScopeSource | null,
  media?: MediaScopeFields | null,
): string | undefined {
  const item = media || source?.mediaItems?.[0];
  const season = scopeNumber(
    source?.media_season_number
      ?? source?.mediaSeasonNumber
      ?? source?.seasonNumber
      ?? item?.seasonNumber
      ?? item?.media_season_number
      ?? item?.mediaSeasonNumber,
  );
  const episode = scopeNumber(
    source?.media_episode_number
      ?? source?.mediaEpisodeNumber
      ?? source?.episodeNumber
      ?? item?.episodeNumber
      ?? item?.media_episode_number
      ?? item?.mediaEpisodeNumber,
  );
  const episodeTitle = scopeText(
    source?.media_episode_title
      ?? source?.mediaEpisodeTitle
      ?? source?.episodeTitle
      ?? item?.episodeTitle
      ?? item?.media_episode_title
      ?? item?.mediaEpisodeTitle,
  );
  const volume = scopeNumber(
    source?.media_volume_number
      ?? source?.mediaVolumeNumber
      ?? source?.volumeNumber
      ?? item?.volumeNumber
      ?? item?.media_volume_number
      ?? item?.mediaVolumeNumber,
  );

  const parts: string[] = [];
  if (season !== undefined) parts.push(`Season ${season}`);
  if (episode !== undefined) {
    parts.push(`Episode ${episode}${episodeTitle ? ` — ${episodeTitle}` : ''}`);
  }
  if (volume !== undefined) parts.push(`Volume ${volume}`);

  return parts.length > 0 ? parts.join(' · ') : undefined;
}
