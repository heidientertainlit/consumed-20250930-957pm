export const USERNAME_PATTERN = /^[a-z0-9_]{3,20}$/;

export interface ProfileIdentity {
  first_name?: string | null;
  last_name?: string | null;
  user_name?: string | null;
  identity_confirmed_at?: string | null;
}

export interface IdentityUserLike {
  email?: string | null;
  app_metadata?: Record<string, unknown> | null;
  user_metadata?: Record<string, unknown> | null;
  identities?: Array<{ provider?: string | null }> | null;
}

export type IdentityProvider = "email" | "google" | "apple" | "unknown";

export function normalizeUsername(value: string): string {
  return value.trim().replace(/^@+/, "").toLowerCase();
}

export function hasConfirmedProfileIdentity(
  profile?: { identity_confirmed_at?: string | null } | null,
): boolean {
  return Boolean(profile?.identity_confirmed_at);
}

export function hasCompleteProfileIdentity(
  profile?: ProfileIdentity | null,
): boolean {
  return Boolean(
    profile?.first_name?.trim()
    && profile?.last_name?.trim()
    && USERNAME_PATTERN.test(normalizeUsername(profile.user_name || "")),
  );
}

export function getIdentityProvider(user?: IdentityUserLike | null): IdentityProvider {
  const candidates = [
    user?.app_metadata?.provider,
    ...(user?.identities || []).map((identity) => identity.provider),
  ].map((provider) => String(provider || "").toLowerCase());

  if (candidates.includes("google")) return "google";
  if (candidates.includes("apple")) return "apple";
  if (candidates.includes("email")) return "email";
  return "unknown";
}

export function getProfileIdentityDefaults(
  user?: IdentityUserLike | null,
  profile?: ProfileIdentity | null,
) {
  const metadata = user?.user_metadata || {};
  const fullName = String(metadata.full_name || metadata.name || "").trim().split(/\s+/);
  const firstName = String(
    profile?.first_name
    || metadata.first_name
    || metadata.given_name
    || fullName[0]
    || "",
  ).trim();
  const lastName = String(
    profile?.last_name
    || metadata.last_name
    || metadata.family_name
    || fullName.slice(1).join(" ")
    || "",
  ).trim();
  const canonicalUsername = normalizeUsername(profile?.user_name || "");
  const metadataUsername = normalizeUsername(String(metadata.user_name || ""));
  const emailSuggestion = normalizeUsername(user?.email?.split("@")[0] || "");
  const username = canonicalUsername || metadataUsername || emailSuggestion;

  return {
    firstName,
    lastName,
    username,
    hasCanonicalUsername: USERNAME_PATTERN.test(canonicalUsername),
    hasMetadataUsername: USERNAME_PATTERN.test(metadataUsername),
    missingFirstName: !firstName,
    missingLastName: !lastName,
    missingUsername: !USERNAME_PATTERN.test(canonicalUsername),
  };
}

export function isCorrectableProfileCompletionStatus(status: number): boolean {
  return status === 400 || status === 409 || status === 422;
}