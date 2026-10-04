export type FeedMediaTarget = {
  mediaTitle?: string | null; mediaType?: string | null; mediaCreator?: string | null;
  externalId?: string | number | null; externalSource?: string | null;
  media_external_id?: string | number | null; media_external_source?: string | null;
  mediaItems?: any[];
};
export type FeedMediaIdentity = { externalId: string; externalSource: string; mediaType: string };

const normalized = (value: unknown) => String(value || "").normalize("NFKD")
  .replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
const typeOf = (value: unknown) => {
  const type = String(value || "").toLowerCase().trim();
  if (["tv", "tv show", "tv_show", "tvshow", "series", "television"].includes(type)) return "tv";
  if (["game", "gaming"].includes(type)) return "game";
  if (["album", "track", "song"].includes(type)) return "music";
  if (["book series", "book-series"].includes(type)) return "book_series";
  return type;
};

export function storedFeedMediaIdentity(post: FeedMediaTarget): FeedMediaIdentity | null {
  const item = post.mediaItems?.[0];
  // Never combine an ID from one record with a source from another.
  for (const record of [post, item]) {
    const id = record?.externalId || record?.external_id || record?.media_external_id;
    const source = record?.externalSource || record?.external_source || record?.media_external_source;
    const mediaType = typeOf(post.mediaType || record?.mediaType || record?.type);
    if (id && source && mediaType && !(source === "tmdb" && !["movie", "tv"].includes(mediaType))) {
      return { externalId: String(id), externalSource: source, mediaType };
    }
  }
  return null;
}

export function feedMediaHref(identity: FeedMediaIdentity): string {
  return `/media/${encodeURIComponent(identity.mediaType)}/${encodeURIComponent(identity.externalSource)}/${encodeURIComponent(identity.externalId)}`;
}

/** Resolve legacy title-only posts on demand; do not navigate to an arbitrary first hit. */
export async function resolveFeedMediaIdentity(
  post: FeedMediaTarget,
  search: (title: string, type: string) => Promise<any[]>,
): Promise<FeedMediaIdentity | null> {
  const stored = storedFeedMediaIdentity(post);
  if (stored) return stored;
  const item = post.mediaItems?.[0];
  const title = post.mediaTitle || item?.title;
  const type = typeOf(post.mediaType || item?.mediaType || item?.type);
  const creator = post.mediaCreator || item?.creator;
  if (!title || !type) return null;
  const matches = new Map<string, FeedMediaIdentity>();
  for (const result of await search(title, type)) {
    if (normalized(result.title) !== normalized(title)) continue;
    if (creator && normalized(result.creator || result.author || result.artist) !== normalized(creator)) continue;
    const resultType = typeOf(result.mediaType || result.type || result.media_type || type);
    if (resultType !== type) continue;
    const identity = storedFeedMediaIdentity({
      mediaType: type,
      externalId: result.externalId || result.external_id || result.id,
      externalSource: result.externalSource || result.external_source,
    });
    if (identity) matches.set(feedMediaHref(identity), identity);
  }
  return matches.size === 1 ? [...matches.values()][0] : null;
}