export const COMPARISON_POSITIVE_ITEM_MINIMUM = 10;
export const COMPARISON_READINESS_VERSION = 3;

export type ComparisonStatus = 'ready' | 'developing';

export type ComparisonMediaItem = {
  title: string;
  media_type?: string | null;
  canonical_media_id?: string | null;
  external_source?: string | null;
  external_id?: string | null;
};

type ListItem = ComparisonMediaItem & { list_id?: string | null };
type RatingItem = {
  media_title?: string | null;
  media_type?: string | null;
  canonical_media_id?: string | null;
  media_external_source?: string | null;
  media_external_id?: string | null;
  rating?: number | string | null;
};

type EvidenceInput = {
  items: ListItem[];
  ratings: RatingItem[];
  favoriteListIds: Set<string>;
  dnfListIds: Set<string>;
  canonicalByProvider?: Map<string, string>;
};

export type PositiveMediaEvidence = ComparisonMediaItem & {
  identity_key: string;
  comparison_key: string | null;
};

const normalizeText = (value: unknown) =>
  String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const normalizeMediaType = (value: unknown) => {
  const type = normalizeText(value);
  if (['tv', 'tv show', 'show', 'series', 'television'].includes(type)) return 'tv';
  if (['movie', 'film'].includes(type)) return 'movie';
  if (type.includes('book')) return 'book';
  if (type.includes('music') || type.includes('track') || type.includes('album')) return 'music';
  if (type.includes('podcast')) return 'podcast';
  if (type.includes('game')) return 'game';
  if (type.includes('youtube') || type.includes('video') || type.includes('channel')) return 'youtube';
  return type || 'unknown';
};

export const comparisonProviderKey = (source: unknown, id: unknown) => {
  const normalizedSource = normalizeText(source).replace(/\s+/g, '');
  const normalizedId = String(id || '').trim();
  return normalizedSource && normalizedId ? `${normalizedSource}:${normalizedId}` : null;
};

function normalizeItem(
  item: ComparisonMediaItem,
  canonicalByProvider: Map<string, string>,
): PositiveMediaEvidence | null {
  const title = String(item.title || '').trim();
  if (!title) return null;
  const mediaType = normalizeMediaType(item.media_type);
  const providerKey = comparisonProviderKey(item.external_source, item.external_id);
  const canonicalId = String(item.canonical_media_id || '').trim()
    || (providerKey ? canonicalByProvider.get(providerKey) || '' : '');
  const comparisonKey = canonicalId
    ? `canonical:${canonicalId}`
    : providerKey
      ? `provider:${providerKey}`
      : null;
  return {
    title,
    media_type: mediaType,
    canonical_media_id: canonicalId || null,
    external_source: item.external_source || null,
    external_id: item.external_id || null,
    identity_key: comparisonKey || `local:${mediaType}:${normalizeText(title)}`,
    comparison_key: comparisonKey,
  };
}

export function collectPositiveMediaEvidence(input: EvidenceInput): PositiveMediaEvidence[] {
  const aliases = input.canonicalByProvider || new Map<string, string>();
  const negativeIdentityKeys = new Set<string>();
  const allNegativeFallbackKeys = new Set<string>();
  const unresolvedNegativeFallbackKeys = new Set<string>();

  const addNegative = (item: ComparisonMediaItem) => {
    const normalized = normalizeItem(item, aliases);
    if (!normalized) return;
    const fallbackKey = `${normalizeMediaType(item.media_type)}:${normalizeText(item.title)}`;
    allNegativeFallbackKeys.add(fallbackKey);
    if (normalized.comparison_key) {
      negativeIdentityKeys.add(normalized.comparison_key);
    } else {
      unresolvedNegativeFallbackKeys.add(fallbackKey);
    }
  };
  for (const item of input.items) {
    if (item.title && item.list_id && input.dnfListIds.has(item.list_id)) {
      addNegative(item);
    }
  }
  for (const rating of input.ratings) {
    if (rating.media_title && Number(rating.rating) < 3.5) {
      addNegative({
        title: rating.media_title,
        media_type: rating.media_type,
        canonical_media_id: rating.canonical_media_id,
        external_source: rating.media_external_source,
        external_id: rating.media_external_id,
      });
    }
  }

  const positives = new Map<string, PositiveMediaEvidence>();
  const add = (item: ComparisonMediaItem) => {
    const normalized = normalizeItem(item, aliases);
    if (!normalized) return;
    const fallbackKey = `${normalizeMediaType(item.media_type)}:${normalizeText(item.title)}`;
    if (
      (normalized.comparison_key && negativeIdentityKeys.has(normalized.comparison_key))
      || (normalized.comparison_key && unresolvedNegativeFallbackKeys.has(fallbackKey))
      || (!normalized.comparison_key && allNegativeFallbackKeys.has(fallbackKey))
    ) return;
    const existing = positives.get(normalized.identity_key);
    if (!existing || (!existing.external_id && normalized.external_id)) {
      positives.set(normalized.identity_key, normalized);
    }
  };

  for (const item of input.items) {
    if (item.list_id && input.favoriteListIds.has(item.list_id) && !input.dnfListIds.has(item.list_id)) {
      add(item);
    }
  }
  for (const rating of input.ratings) {
    if (rating.media_title && Number(rating.rating) >= 3.5) {
      add({
        title: rating.media_title,
        media_type: rating.media_type,
        canonical_media_id: rating.canonical_media_id,
        external_source: rating.media_external_source,
        external_id: rating.media_external_id,
      });
    }
  }

  return [...positives.values()];
}

export function findSharedPositiveMedia(
  left: PositiveMediaEvidence[],
  right: PositiveMediaEvidence[],
): ComparisonMediaItem[] {
  const leftByIdentity = new Map(
    left.filter((item) => item.comparison_key).map((item) => [item.comparison_key, item]),
  );
  const shared = new Map<string, ComparisonMediaItem>();
  for (const rightItem of right) {
    if (!rightItem.comparison_key || !leftByIdentity.has(rightItem.comparison_key)) continue;
    const leftItem = leftByIdentity.get(rightItem.comparison_key)!;
    const routeItem = rightItem.external_source && rightItem.external_id ? rightItem : leftItem;
    shared.set(rightItem.comparison_key, {
      title: rightItem.title || leftItem.title,
      media_type: routeItem.media_type || rightItem.media_type || leftItem.media_type,
      canonical_media_id: rightItem.canonical_media_id || leftItem.canonical_media_id || null,
      external_source: routeItem.external_source || null,
      external_id: routeItem.external_id || null,
    });
  }
  return [...shared.values()];
}

export function buildComparisonReadiness(
  left: PositiveMediaEvidence[],
  right: PositiveMediaEvidence[],
  shared: ComparisonMediaItem[],
) {
  const bothHaveMinimum = left.length >= COMPARISON_POSITIVE_ITEM_MINIMUM
    && right.length >= COMPARISON_POSITIVE_ITEM_MINIMUM;
  const hasSharedPositiveTitle = shared.length > 0;
  const status: ComparisonStatus = bothHaveMinimum && hasSharedPositiveTitle ? 'ready' : 'developing';
  return {
    version: COMPARISON_READINESS_VERSION,
    status,
    required_positive_items: COMPARISON_POSITIVE_ITEM_MINIMUM,
    both_have_minimum: bothHaveMinimum,
    has_shared_positive_title: hasSharedPositiveTitle,
  };
}