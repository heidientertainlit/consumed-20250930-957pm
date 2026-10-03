import { normalizedTitle, type MediaCandidate, type Persona, type RecentPost } from "./persona-generation.ts";
import type { IntentContext } from "./persona-post-intents.ts";
import { creatorMatches, knownFavoriteIdentity, mediaResolutionKey, normalizedCreator } from "./persona-favorite-identity.ts";

export type ProviderKeys = { tmdb?: string; books?: string; rawg?: string };
const genres: Record<number, string> = { 28: "action", 12: "adventure", 16: "animation", 35: "comedy", 80: "crime", 99: "documentary", 18: "drama", 10751: "family", 14: "fantasy", 36: "history", 27: "horror", 10402: "music", 9648: "mystery", 10749: "romance", 878: "sci-fi", 53: "thriller", 10765: "sci-fi fantasy", 10764: "reality", 10759: "action adventure" };
async function json(url: string): Promise<any> {
  const response = await fetch(url, { signal: AbortSignal.timeout(12000) });
  if (!response.ok) throw new Error(`Media provider returned ${response.status}`);
  return response.json();
}
function matches(requested: string, actual: string): boolean {
  const a = normalizedTitle(requested), b = normalizedTitle(actual);
  // Match a real subtitle, not derivative "Summary"/workbook books or malformed records.
  if ((actual.match(/\[/g)?.length || 0) !== (actual.match(/\]/g)?.length || 0)) return false;
  if (/\b(?:summary|study guide|workbook)\b/i.test(actual) && !/\b(?:summary|study guide|workbook)\b/i.test(requested)) return false;
  return a === b || a.length >= 6 && normalizedTitle(actual.split(":")[0]) === a;
}
function released(date: unknown): boolean {
  return typeof date === "string" && date.length >= 4 && date.slice(0, 10) <= new Date().toISOString().slice(0, 10);
}
/** Direct GET-only provider lookups: no Supabase/cache writes, including dry runs. */
export async function resolveMediaCandidate(title: string, type: string, keys: ProviderKeys, expectedCreator?: string): Promise<Omit<MediaCandidate, "source" | "fit"> | null> {
  if (expectedCreator !== undefined && !normalizedCreator(expectedCreator)) throw new Error("Expected creator must be nonempty");
  // No creator verification is available in these existing search responses.
  if (expectedCreator !== undefined && !["music", "podcast", "book"].includes(type)) return null;
  if ((type === "movie" || type === "tv") && keys.tmdb) {
    const data = await json(`https://api.themoviedb.org/3/search/${type}?api_key=${keys.tmdb}&query=${encodeURIComponent(title)}&include_adult=false`);
    const item = data.results?.find((r: any) => matches(title, r.title || r.name || "") && released(r.release_date || r.first_air_date));
    if (!item) return null;
    return { title: item.title || item.name, type, externalId: String(item.id), externalSource: "tmdb", description: item.overview, genres: (item.genre_ids || []).map((id: number) => genres[id]).filter(Boolean) };
  }
  if (type === "book") {
    const data = await json(`https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(`intitle:${title}${expectedCreator !== undefined ? ` inauthor:${expectedCreator}` : ""}`)}&maxResults=5${keys.books ? `&key=${keys.books}` : ""}`);
    const item = data.items?.find((r: any) => matches(title, r.volumeInfo?.title || "") && released(r.volumeInfo?.publishedDate) && (expectedCreator === undefined || creatorMatches(expectedCreator, r.volumeInfo?.authors)));
    if (!item) return null;
    return { title: item.volumeInfo.title, type, creator: expectedCreator === undefined ? item.volumeInfo.authors?.[0] : item.volumeInfo.authors.find((author: unknown) => creatorMatches(expectedCreator, author)), externalId: item.id, externalSource: "googlebooks", description: item.volumeInfo.description?.replace(/<[^>]+>/g, " "), genres: item.volumeInfo.categories || [] };
  }
  if (type === "podcast" || type === "music") {
    const data = await json(`https://itunes.apple.com/search?term=${encodeURIComponent(expectedCreator === undefined ? title : `${title} ${expectedCreator}`)}&entity=${type === "podcast" ? "podcast" : "album"}&limit=8`);
    const item = data.results?.find((r: any) => matches(title, r.collectionName || r.trackName || "") && (expectedCreator === undefined || creatorMatches(expectedCreator, r.artistName)));
    if (!item) return null;
    return { title: item.collectionName || item.trackName, type, creator: item.artistName, externalId: String(item.collectionId || item.trackId), externalSource: "itunes", genres: item.genres || [item.primaryGenreName].filter(Boolean) };
  }
  if (type === "game" && keys.rawg) {
    const data = await json(`https://api.rawg.io/api/games?key=${keys.rawg}&search=${encodeURIComponent(title)}&page_size=5`);
    const item = data.results?.find((r: any) => matches(title, r.name || ""));
    if (!item) return null;
    return { title: item.name, type, externalId: String(item.id), externalSource: "rawg", genres: item.genres?.map((g: any) => g.name) || [] };
  }
  return null;
}
export type MediaResolutionDebug = {
  requested: { title: string; type: string; expectedCreator?: string };
  cacheKey: string; cacheHit: boolean; status: "verified" | "rejected" | "error";
  resolved: Pick<MediaCandidate, "title" | "type" | "creator" | "externalId" | "externalSource"> | null;
};
export type PersonaMediaResolver = (title: string, type: string, expectedCreator?: string) => Promise<Omit<MediaCandidate, "source" | "fit"> | null>;
/** Same lookup cache in local and backend paths; known creators cannot share title-only entries. */
export function createCachedPersonaMediaResolver(keys: ProviderKeys, trace?: (entry: MediaResolutionDebug) => void): PersonaMediaResolver {
  const cache = new Map<string, ReturnType<PersonaMediaResolver>>();
  return async (title, type, expectedCreator) => {
    const cacheKey = mediaResolutionKey(title, type, expectedCreator);
    const cacheHit = cache.has(cacheKey);
    if (!cacheHit) cache.set(cacheKey, resolveMediaCandidate(title, type, keys, expectedCreator));
    try {
      const item = await cache.get(cacheKey)!;
      trace?.({ requested: { title, type, expectedCreator }, cacheKey, cacheHit, status: item ? "verified" : "rejected",
        resolved: item ? { title: item.title, type: item.type, creator: item.creator, externalId: item.externalId, externalSource: item.externalSource } : null });
      return item;
    } catch (error) {
      trace?.({ requested: { title, type, expectedCreator }, cacheKey, cacheHit, status: "error", resolved: null });
      throw error;
    }
  };
}
export async function fetchTrendingCandidates(keys: ProviderKeys): Promise<MediaCandidate[]> {
  const jobs: Promise<MediaCandidate[]>[] = [];
  if (keys.tmdb) for (const type of ["tv", "movie"]) jobs.push(json(`https://api.themoviedb.org/3/trending/${type}/week?api_key=${keys.tmdb}`).then(data =>
    (data.results || []).slice(0, 10).filter((r: any) => released(r.release_date || r.first_air_date)).map((r: any) => ({ title: r.title || r.name, type, externalId: String(r.id), externalSource: "tmdb", description: r.overview, genres: (r.genre_ids || []).map((id: number) => genres[id]).filter(Boolean), source: "Trending", fit: .5 })),
  ));
  jobs.push(json("https://openlibrary.org/trending/weekly.json?limit=8").then(data =>
    (data.works || []).slice(0, 8).map((r: any) => ({ title: r.title, type: "book", externalId: r.key?.replace(/^\//, ""), externalSource: "openlibrary", creator: r.author_name?.[0], source: "Trending", fit: .5 })),
  ));
  const results = await Promise.allSettled(jobs);
  if (results.every(r => r.status === "rejected")) throw new Error("Trending providers unavailable");
  return results.flatMap(r => r.status === "fulfilled" ? r.value : []);
}
/** Enrich only the selected title. Provider facts, never model-invented characters or episodes. */
export async function loadPersonaIntentContext(media: MediaCandidate, keys: ProviderKeys): Promise<IntentContext> {
  if (media.externalSource !== "tmdb" || !media.externalId || !keys.tmdb || !["movie", "tv"].includes(media.type)) return media.intentContext || {};
  const data = await json(`https://api.themoviedb.org/3/${media.type}/${encodeURIComponent(media.externalId)}/credits?api_key=${keys.tmdb}`);
  const people: NonNullable<IntentContext["people"]> = [...(media.intentContext?.people || [])];
  for (const item of (data.cast || []).slice(0, 5)) {
    if (typeof item.character === "string" && item.character.trim() && !/^(?:self|himself|herself)$/i.test(item.character.trim())) people.push({ name: item.character.trim(), kind: "character" });
    if (typeof item.name === "string" && item.name.trim()) people.push({ name: item.name.trim(), kind: "performer" });
  }
  return { ...media.intentContext, people };
}
export function personaFit(persona: Persona, item: MediaCandidate): number {
  const config = persona.persona_config;
  if (!(config.media_types || []).map(t => t.toLowerCase()).includes(item.type.toLowerCase())) return .12;
  if (item.source === "Persona Favorite") return 1;
  const traits = (config.interests || []).join(" ").toLowerCase().split(/[^a-z0-9]+/).filter(w => w.length > 3);
  const evidence = `${(item.genres || []).join(" ")} ${item.description || ""}`.toLowerCase();
  const overlaps = traits.filter(w => evidence.includes(w)).length;
  return Math.min(1, (item.source === "Discovery" || item.source === "History" ? .72 : .18) + overlaps * .18);
}
export type Chat = (messages: { role: string; content: string }[]) => Promise<string>;
export function createPersonaChat(apiKey: string): Chat {
  return async messages => {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST", signal: AbortSignal.timeout(35000),
      headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "gpt-4o", temperature: .95, max_tokens: 1100, response_format: { type: "json_object" }, messages }),
    });
    if (!response.ok) throw new Error(`Writing provider returned ${response.status}`);
    const data = await response.json();
    const text = data.choices?.[0]?.message?.content;
    if (!text) throw new Error("Writing provider returned empty output");
    return text;
  };
}
export async function buildPersonaCandidates(persona: Persona, trending: MediaCandidate[], recent: RecentPost[], chat: Chat, resolve: PersonaMediaResolver): Promise<MediaCandidate[]> {
  const config = persona.persona_config;
  const types = (config.media_types || ["movie", "tv", "book"]).map(t => t.toLowerCase());
  const raw = await chat([
    { role: "system", content: "Suggest real entertainment titles fitting the provided tastes, not posts. Choose exact searchable titles, including older discoveries and comfort rewatches. Do not invent titles or factual context. Return JSON only." },
    { role: "user", content: `Persona tastes: ${JSON.stringify({ interests: config.interests, favorites: config.favorite_media, media_types: types })}. Return {"candidates":[{"title":"exact real title","type":"movie|tv|book|podcast|music|game","source":"Persona Favorite|Discovery"}]} with up to 3 favorites from the supplied list and 5 other discoveries spanning this person's preferred media types. Identify the correct medium of each favorite; don't invent a book adaptation of a TV favorite. Prefer original works, not summary/study-guide editions. No global trending requirement. Avoid these recent titles when choosing discoveries: ${recent.filter(p => p.personaId === persona.id).slice(0, 15).map(p => p.title).join(", ")}. Favorites may still recur.` },
  ]);
  const ideas = JSON.parse(raw).candidates;
  if (!Array.isArray(ideas)) throw new Error("Invalid candidate suggestions");
  const requests = ideas.slice(0, 8).filter((r: any) => typeof r.title === "string" && types.includes(r.type));
  // Recently consumed/post topics are candidates, not mandatory repeat assignments.
  for (const p of recent.filter(r => r.personaId === persona.id).slice(0, 2)) {
    if (types.includes(p.type)) requests.push({ title: p.title, type: p.type, source: "History" });
  }
  const resolved = await Promise.allSettled(requests.map(async (r: any) => {
    const identity = knownFavoriteIdentity(persona, r.title);
    if (identity && r.source === "Persona Favorite" && identity.type !== r.type) return null;
    const expectedCreator = identity && identity.type === r.type ? identity.creator : undefined;
    const item = await resolve(r.title, r.type, expectedCreator);
    if (!item) return null;
    // Fail closed even if a custom resolver forgets to enforce the supplied identity.
    if (expectedCreator !== undefined && !creatorMatches(expectedCreator, item.creator)) return null;
    const isFavorite = r.source === "Persona Favorite" && (config.favorite_media || []).some(t => matches(t, item.title));
    const source = isFavorite ? "Persona Favorite" : r.source === "History" ? "History" : "Discovery";
    return { ...item, source, fit: 0 } as MediaCandidate;
  }));
  const items = resolved.flatMap(r => r.status === "fulfilled" && r.value ? [r.value] : []);
  const compatibleTrends = trending.filter(item => types.includes(item.type)).map(item => ({ ...item }));
  return [...items, ...compatibleTrends].map(item => ({ ...item, fit: personaFit(persona, item) }));
}