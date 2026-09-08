export type FriendshipSearchCandidate = {
  targetExists: boolean;
  targetIsPersona: boolean;
  targetIsDiscoverable: boolean;
  targetHasDnaProfile: boolean;
  targetDnaIsPrivate: boolean | null;
  blocked: boolean;
  isAcceptedFriend: boolean;
};

// Friendship discovery is intentionally separate from DNA readiness: a person
// without a DNA profile may receive a request, while a private DNA profile may
// only be surfaced to an already accepted friend.
export function canAppearInFriendshipSearch(candidate: FriendshipSearchCandidate) {
  if (!candidate.targetExists || candidate.targetIsPersona || candidate.blocked) return false;
  if (candidate.isAcceptedFriend) return true;
  return candidate.targetIsDiscoverable
    && (!candidate.targetHasDnaProfile || candidate.targetDnaIsPrivate === false);
}

export function isValidFriendshipUuid(value: unknown): value is string {
  return typeof value === "string"
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export function normalizeFriendshipSearchQuery(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const query = value.trim();
  if (query.length < 2 || query.length > 64 || /[\x00-\x1f\x7f]/.test(query)) return null;
  return query;
}