// Consumer-only contracts. No personal DNA, lab authorization, or shared-search writes.
export const SIMILARITY_VERSION = 1;
export const SIMILARITY_TYPES = ["movie", "tv", "book", "music", "podcast", "youtube"] as const;
export type SimilarityType = typeof SIMILARITY_TYPES[number];
export type SimilarityIdentity = { source: string; externalId: string; type: SimilarityType };
export type SimilarityCard = {
  title: string; type: SimilarityType; poster_url: string; external_source: string; external_id: string;
};
export type SimilarityResponse = { items: SimilarityCard[]; preparing: boolean };

export function similarityIdentity(value: unknown): SimilarityIdentity {
  const v = value as Record<string, unknown> | null;
  if (!v || typeof v.source !== "string" || typeof v.externalId !== "string" || typeof v.type !== "string")
    throw new Error("A provider, provider ID and media type are required");
  const aliases: Record<string, string> = { open_library: "openlibrary", google_books: "googlebooks",
    album: "music", song: "music", track: "music", film: "movie", "tv show": "tv", tv_show: "tv" };
  const source = aliases[v.source.toLowerCase()] || v.source.toLowerCase();
  const type = aliases[v.type.toLowerCase()] || v.type.toLowerCase();
  const externalId = source === "openlibrary" ? v.externalId.replace(/^\/?works\//, "") : v.externalId;
  if (!/^[a-z][a-z0-9_]{0,49}$/.test(source) || !externalId || externalId.length > 200 ||
      /[\x00-\x20?#]/.test(externalId) || !SIMILARITY_TYPES.includes(type as SimilarityType))
    throw new Error("Invalid media identity");
  return { source, externalId, type: type as SimilarityType };
}
export function similarityKey(id: SimilarityIdentity) {
  return JSON.stringify([SIMILARITY_VERSION, id.type, id.source, id.externalId]);
}

export function similarityCards(value: unknown): SimilarityCard[] {
  if (!Array.isArray(value)) return [];
  const cards: SimilarityCard[] = [];
  for (const row of value.slice(0, 8)) {
    try {
      if (!row || typeof row.title !== "string" || !row.title.trim() || row.title.length > 500) continue;
      const identity = similarityIdentity({ source: row.external_source, externalId: row.external_id, type: row.type });
      if (cards.some(c => similarityKey({ source: c.external_source, externalId: c.external_id, type: c.type }) === similarityKey(identity))) continue;
      cards.push({ title: row.title, type: identity.type, external_source: identity.source, external_id: identity.externalId,
        poster_url: typeof row.poster_url === "string" && /^https:\/\//.test(row.poster_url) ? row.poster_url : "" });
    } catch { /* Reject malformed cards, never invent a destination. */ }
  }
  return cards;
}
