export const USERNAME_PATTERN = /^[a-z0-9_]{3,20}$/;

export function normalizeUsername(value: string): string {
  return value.trim().replace(/^@+/, "").toLowerCase();
}

export function hasConfirmedProfileIdentity(
  profile?: { identity_confirmed_at?: string | null } | null,
): boolean {
  return Boolean(profile?.identity_confirmed_at);
}