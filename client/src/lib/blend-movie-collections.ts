import type { MovieCollectionSummary } from "../../../shared/movie-collections";

type MediaTitle = { title?: string };
export type BlendedSearchRow<T> =
  | { kind: "media"; media: T }
  | { kind: "collection"; collection: MovieCollectionSummary };

function normalized(value: string): string {
  return value.normalize("NFKD").replace(/\p{M}|\p{Cf}/gu, "").toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ").trim().replace(/\s+/g, " ")
    .replace(/^(?:the|an|a) /, "");
}
const rootTitle = (value: string) => normalized(value).replace(/(?: movie)? collections?$/, "").trim();
const words = (value: string) => value.split(" ").filter(word => word && !/^(?:the|a|an|and|of|in|on|to|for)$/.test(word));

function collectionRelevance(query: string, collection: MovieCollectionSummary): number {
  const base = rootTitle(collection.title), search = rootTitle(query);
  if (search.length < 2 || !base) return 0;
  const explicitCollection = /\bcollections?$/.test(normalized(query));
  if (base === search) return explicitCollection ? 110 : 84;
  const queryWords = words(search), baseWords = words(base);
  if (!queryWords.length || !baseWords.length) return 0;
  const overlap = queryWords.filter(word => baseWords.includes(word)).length;
  // Word boundaries and substantial franchise overlap, not arbitrary provider
  // substring matches (e.g. "office" vs "Love in the Bosses Office").
  if (overlap === queryWords.length && overlap / baseWords.length >= 0.5) return 68;
  if (search.startsWith(`${base} `) && baseWords.length >= 2) return 65;
  return 0;
}
function individualRelevance(query: string, item: MediaTitle): number {
  const title = normalized(item.title || ""), search = rootTitle(query);
  if (!title || !search) return 0;
  if (title === normalized(query)) return 120;
  if (title === search) return 100;
  if (title.startsWith(`${search} `)) return 78;
  const queryWords = words(search), titleWords = words(title);
  if (queryWords.length && queryWords.every(word => titleWords.includes(word))) return 72;
  return 0;
}

/**
 * Inserts relevant collections without re-ranking ordinary provider results.
 * The position is based on the current query/results, never arrival order.
 * Exact individual matches outrank an implicitly requested collection.
 */
export function blendMovieCollections<T extends MediaTitle>(
  query: string, media: T[], collections: MovieCollectionSummary[], limit = 12,
): BlendedSearchRow<T>[] {
  const seen = new Set<string>();
  const ranked = collections.flatMap(collection => {
    if (!collection.id || seen.has(collection.id)) return [];
    seen.add(collection.id);
    const score = collectionRelevance(query, collection);
    if (!score) return [];
    let position = 0;
    for (let index = 0; index < media.length; index++) {
      if (individualRelevance(query, media[index]) >= score) position = index + 1;
    }
    return [{ collection, score, position }];
  }).sort((a, b) => a.position - b.position || b.score - a.score);
  const rows: BlendedSearchRow<T>[] = [];
  for (let index = 0; index <= media.length; index++) {
    for (const { collection, position } of ranked) {
      if (position === index) rows.push({ kind: "collection", collection });
    }
    if (index < media.length) rows.push({ kind: "media", media: media[index] });
  }
  return rows.slice(0, limit);
}
