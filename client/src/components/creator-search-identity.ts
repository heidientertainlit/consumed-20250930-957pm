export type CreatorIdentity = { external_id: string; external_source: string };
export type LinkedCreator = CreatorIdentity & { aliases?: CreatorIdentity[] };
export const creatorIdentity = (creator: CreatorIdentity) =>
  `${creator.external_source}:${creator.external_id}`;

export function creatorMatches(result: LinkedCreator, followed: CreatorIdentity): boolean {
  const id = creatorIdentity(followed);
  return creatorIdentity(result) === id ||
    !!result.aliases?.some(alias => creatorIdentity(alias) === id);
}

export function matchingCreatorFollows<T extends CreatorIdentity>(result: LinkedCreator, follows: T[]): T[] {
  return follows.filter(row => creatorMatches(result, row));
}
