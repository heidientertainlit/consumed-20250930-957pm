import { normalizedTitle, type Persona } from "./persona-generation.ts";

export type FavoriteIdentity = { title: string; type: string; creator: string };
// Trusted work identity, not an author-profile change or a model-suggested artist.
const FAVORITE_IDENTITIES: Readonly<Record<string, readonly FavoriteIdentity[]>> = {
  brooksj: [{ title: "Blonde", type: "music", creator: "Frank Ocean" }],
};

export function knownFavoriteIdentity(persona: Persona, title: string): FavoriteIdentity | undefined {
  const requested = normalizedTitle(title);
  if (!(persona.persona_config.favorite_media || []).some(t => normalizedTitle(t) === requested)) return undefined;
  const username = persona.user_name.trim().toLowerCase();
  if (!Object.hasOwn(FAVORITE_IDENTITIES, username)) return undefined;
  return FAVORITE_IDENTITIES[username].find(item => normalizedTitle(item.title) === requested);
}

export function normalizedCreator(creator: string): string {
  return creator.normalize("NFKC").trim().toLowerCase().replace(/\s+/g, " ");
}
export function creatorMatches(expected: string, actual: unknown): boolean {
  const wanted = normalizedCreator(expected);
  const creators = Array.isArray(actual) ? actual : [actual];
  return !!wanted && creators.some(value => typeof value === "string" && normalizedCreator(value) === wanted);
}
export function mediaResolutionKey(title: string, type: string, expectedCreator?: string): string {
  return JSON.stringify([type.trim().toLowerCase(), normalizedTitle(title), expectedCreator === undefined ? null : normalizedCreator(expectedCreator)]);
}