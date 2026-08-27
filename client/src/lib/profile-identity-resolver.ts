import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import {
  getIdentityProvider,
  getProfileIdentityDefaults,
  type ProfileIdentity,
} from "@/lib/profile-identity";
import {
  allowsLegacyDnaIdentityBypass,
  ProfileCompletionError,
  resolveKnownProfileIdentity,
} from "@/lib/profile-identity-resolution";

export interface ResolvedProfileIdentity {
  complete: boolean;
  profile: ProfileIdentity | null;
  provider: ReturnType<typeof getIdentityProvider>;
  defaults: ReturnType<typeof getProfileIdentityDefaults>;
}

const identityRequests = new Map<string, Promise<ResolvedProfileIdentity>>();
const completedIdentityOverrides = new Map<
  string,
  { value: ResolvedProfileIdentity; expiresAt: number }
>();

async function completeProfile(
  accessToken: string,
  body: Record<string, unknown>,
): Promise<ProfileIdentity> {
  const response = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/complete-profile`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    },
  );
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new ProfileCompletionError(
      result.error || "We couldn't finish setting up your profile.",
      response.status,
    );
  }
  return {
    first_name: result.profile?.first_name || null,
    last_name: result.profile?.last_name || null,
    user_name: result.profile?.user_name || null,
    identity_confirmed_at: result.profile?.identity_confirmed_at || new Date().toISOString(),
  };
}

async function resolveIdentity(
  user: User,
  accessToken: string,
): Promise<ResolvedProfileIdentity> {
  const [profileResult, dnaResult] = await Promise.all([
    supabase
      .from("users")
      .select("first_name, last_name, user_name, identity_confirmed_at")
      .eq("id", user.id)
      .maybeSingle(),
    supabase
      .from("dna_profiles")
      .select("user_id, requires_identity_customization")
      .eq("user_id", user.id)
      .maybeSingle(),
  ]);
  if (profileResult.error) throw profileResult.error;
  if (dnaResult.error) throw dnaResult.error;

  return resolveKnownProfileIdentity(
    user,
    profileResult.data as ProfileIdentity | null,
    (body) => completeProfile(accessToken, body),
    {
      allowLegacyDnaBypass: allowsLegacyDnaIdentityBypass(dnaResult.data),
    },
  );
}

export function loadProfileIdentity(
  user: User,
  accessToken: string,
  options: { force?: boolean } = {},
): Promise<ResolvedProfileIdentity> {
  if (options.force) {
    identityRequests.delete(user.id);
    completedIdentityOverrides.delete(user.id);
  }
  const completedOverride = completedIdentityOverrides.get(user.id);
  if (completedOverride && completedOverride.expiresAt > Date.now()) {
    return Promise.resolve(completedOverride.value);
  }
  if (completedOverride) completedIdentityOverrides.delete(user.id);

  const cached = identityRequests.get(user.id);
  if (cached) return cached;

  const request = resolveIdentity(user, accessToken);
  identityRequests.set(user.id, request);
  void request.then(() => {
    if (identityRequests.get(user.id) === request) identityRequests.delete(user.id);
  }, () => {
    identityRequests.delete(user.id);
  });
  return request;
}

export function cacheCompletedProfileIdentity(
  user: User,
  profile: ProfileIdentity,
): void {
  const value = {
    complete: true,
    profile,
    provider: getIdentityProvider(user),
    defaults: getProfileIdentityDefaults(user, profile),
  };
  completedIdentityOverrides.set(user.id, {
    value,
    expiresAt: Date.now() + 15_000,
  });
}