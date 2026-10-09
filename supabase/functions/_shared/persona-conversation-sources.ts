import { fetchTrendingCandidates, type ProviderKeys } from "./persona-media-candidates.ts";
import { resolveCanonicalMedia } from "./canonical-media.ts";
import type { MediaCandidate } from "./persona-generation.ts";
export type Coverage = { provider: string; types: string[]; status: string; fetchedAt: string; error?: string };

/** Server caches exact provider results; the browser can select only their UUID. */
export async function storeConversationSubject(db: any, item: Pick<MediaCandidate, "title" | "type" | "creator" | "externalId" | "externalSource" | "description">, provenance: unknown, topic?: string) {
  if (!item.externalId || !item.externalSource || item.externalSource === "openai") throw new Error("Verified provider identity required");
  const sources: Record<string, string[]> = {
    tmdb: ["movie", "tv"], googlebooks: ["book"], openlibrary: ["book"],
    itunes: ["music", "podcast"], spotify: ["music", "podcast"], youtube: ["youtube"],
  };
  if (!sources[item.externalSource]?.includes(item.type)) throw new Error("Unsupported provider/media identity");
  const resolution = await resolveCanonicalMedia(db, {
    externalSource: item.externalSource, externalId: item.externalId,
    mediaType: item.type, title: item.title, creator: item.creator || null,
    requireVerifiedSource: true,
    // This function is only called with a just-fetched SERVER provider result.
    // Never expose this trust path to client-supplied metadata. It avoids
    // speculative model enrichment and uses canonical server-owned aliases.
    verifiedSourceMetadata: {
      title: item.title, creator: item.creator || null, description: item.description || null,
      open_library_work_id: item.externalSource === "openlibrary" ? item.externalId.match(/OL\d+W/i)?.[0] : null,
    },
  });
  if (!resolution.sourceVerified) throw new Error("Could not verify provider subject");
  const subject = { title: resolution.metadata.title || item.title, type: item.type,
    creator: resolution.metadata.creator || item.creator || null,
    externalId: item.externalId, externalSource: item.externalSource,
    canonicalId: resolution.canonicalMediaId,
    description: resolution.metadata.description || item.description || null };
  const { data, error } = await db.from("persona_conversation_subjects").insert({ subject, provenance, topic: topic || null }).select("id,subject,topic,provenance").single();
  if (error) throw new Error("Could not save private subject selection");
  return data;
}
export async function conversationTrends(db: any, keys: ProviderKeys) {
  const coverage: Coverage[] = [];
  let candidates: MediaCandidate[] = [];
  try { candidates = await fetchTrendingCandidates(keys, item => coverage.push(item)); }
  catch { /* Failures are explicitly reported below; no guessed fallback. */ }
  const suggestions: any[] = [];
  // Bound canonical-provider verification; spread across supported media types.
  const chosen = ["movie", "tv", "book"].flatMap(type => candidates.filter(c => c.type === type).slice(0, 3));
  await Promise.all(chosen.map(async candidate => {
    const provider = candidate.externalSource === "tmdb" ? "TMDB" : "Open Library";
    const fetchedAt = coverage.find(c => c.provider === provider && c.types.includes(candidate.type))?.fetchedAt;
    const provenance = [{ provider, fetchedAt, types: [candidate.type],
      url: candidate.externalSource === "tmdb" ? `https://www.themoviedb.org/${candidate.type}/${candidate.externalId}` : `https://openlibrary.org/${candidate.externalId}`,
      claim: "Provider weekly trending list; not verified news, episodes, releases or music trends" }];
    try {
      const stored = await storeConversationSubject(db, candidate, provenance,
        `What is your reaction to ${candidate.title}?`);
      suggestions.push(stored);
    } catch {
      coverage.push({ provider, types: [candidate.type], fetchedAt: new Date().toISOString(), status: "failed",
        error: `Could not verify selected candidate ${candidate.title}; omitted` });
    }
  }));
  return { suggestions, coverage };
}
