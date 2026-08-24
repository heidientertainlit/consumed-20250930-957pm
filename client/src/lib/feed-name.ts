/**
 * Presentation-only name formatting for the activity feed.
 * Profile routes and @username handles should continue using the raw username.
 */
export function formatFeedName(
  displayName?: string | null,
  username?: string | null,
  firstName?: string | null,
  lastName?: string | null,
): string {
  const structuredName = [firstName?.trim(), lastName?.trim()].filter(Boolean).join(" ");
  const preferred = structuredName || displayName?.trim();
  if (preferred) {
    const parts = preferred.split(/\s+/).filter(Boolean);
    if (parts.length === 1) return parts[0];
    const lastInitial = Array.from(parts[parts.length - 1]).find((character) => /[\p{L}\p{N}]/u.test(character));
    return lastInitial ? `${parts[0]} ${lastInitial.toUpperCase()}.` : parts[0];
  }

  const fallback = username?.trim().replace(/^@/, "").split("@")[0];
  return fallback || "User";
}