import prepared from "../data/prepared-similar-media.json";
import { recommendationType, type ResolvedRecommendation } from "./similar-media";

// Frozen public-card export of the existing saved semantic rankings, for this
// bounded local consumer test. Not a second catalog or a new ranking engine.
function identity(source: string, externalId: string, type: string) {
  const openLibrary = source === "open_library" || source === "openlibrary";
  return [
    recommendationType(type) || type,
    openLibrary ? "openlibrary" : source,
    openLibrary ? externalId.replace(/^\/?works\//, "") : externalId,
  ].join(":");
}
export function preparedSimilarMedia(source?: string, externalId?: string, type?: string): ResolvedRecommendation[] | null {
  if (!source || !externalId || !type) return null;
  const key = identity(source, externalId, type);
  const match = prepared.find(row => identity(row.source.external_source, row.source.external_id, row.source.type) === key);
  // null means use the existing consumer path; [] is a prepared empty result.
  return match ? match.recommendations as ResolvedRecommendation[] : null;
}
