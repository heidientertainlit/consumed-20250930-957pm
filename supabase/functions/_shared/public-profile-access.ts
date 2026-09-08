export type PublicProfileAccess = {
  targetExists: boolean;
  targetIsPersona: boolean;
  targetIsDiscoverable: boolean;
  targetDnaIsPrivate: boolean;
  blocked: boolean;
  isSelf: boolean;
  isFriend: boolean;
};

export function canAccessPublicProfile(access: PublicProfileAccess) {
  if (!access.targetExists || access.targetIsPersona || access.blocked) return false;
  if (access.isSelf || access.isFriend) return true;
  return access.targetIsDiscoverable && !access.targetDnaIsPrivate;
}

// Public share links permit a teaser, never the member's full DNA or history.
export function canAccessFullProfile(access: PublicProfileAccess) {
  return canAccessPublicProfile(access) && (access.isSelf || access.isFriend);
}

export const isProfileId = (value: unknown): value is string =>
  typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

// Never silently downgrade an invalid/expired user token to anonymous access.
export async function resolveProfileViewer(client: any, authorization: string | null, anonKey: string) {
  if (!authorization) return null;
  const match = /^Bearer (.+)$/i.exec(authorization);
  if (!match) throw new Error("Invalid authorization");
  if (anonKey && match[1] === anonKey) return null;
  const { data, error } = await client.auth.getUser(match[1]);
  if (error || !data?.user || !isProfileId(data.user.id)) throw new Error("Invalid authorization");
  return data.user.id as string;
}

export async function loadProfileAccess(client: any, targetId: string, viewerId: string | null) {
  if (!isProfileId(targetId) || (viewerId && !isProfileId(viewerId))) throw new Error("Invalid profile");
  const [target, privacy, friends, blocks] = await Promise.all([
    client.from("users").select("id, people_discoverable, is_persona").eq("id", targetId).maybeSingle(),
    client.from("dna_profiles").select("is_private").eq("user_id", targetId).maybeSingle(),
    viewerId && viewerId !== targetId
      ? client.from("friendships").select("id").eq("status", "accepted")
        .or(`and(user_id.eq.${viewerId},friend_id.eq.${targetId}),and(user_id.eq.${targetId},friend_id.eq.${viewerId})`).limit(1)
      : Promise.resolve({ data: [], error: null }),
    viewerId && viewerId !== targetId
      ? client.from("user_blocks").select("id")
        .or(`and(blocker_id.eq.${viewerId},blocked_id.eq.${targetId}),and(blocker_id.eq.${targetId},blocked_id.eq.${viewerId})`).limit(1)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if ([target, privacy, friends, blocks].some((result) => result.error)) {
    throw new Error("Profile access could not be verified");
  }
  return {
    targetExists: Boolean(target.data),
    targetIsPersona: target.data?.is_persona === true,
    targetIsDiscoverable: target.data?.people_discoverable === true,
    // No DNA yet is fine for an invite teaser; unknown privacy on an existing row is not.
    targetDnaIsPrivate: privacy.data ? privacy.data.is_private !== false : false,
    blocked: Boolean(blocks.data?.length),
    isSelf: viewerId === targetId,
    isFriend: Boolean(friends.data?.length),
  } satisfies PublicProfileAccess;
}