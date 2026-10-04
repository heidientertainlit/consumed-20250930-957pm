/** Persistence checks only. Identity must come from the existing provider resolver,
 * never from writer output or a later title lookup. */
export type PersonaMediaIdentity = {
  media_external_id: string;
  media_external_source: string;
};

export function requirePersonaMediaIdentity(id: unknown, source: unknown): PersonaMediaIdentity {
  const valid = (value: unknown): value is string =>
    typeof value === "string" && value.length > 0 && value === value.trim() &&
    !/^(undefined|null|nan)$/i.test(value);
  if (!valid(id) || !valid(source)) {
    throw new Error("Verified media provider ID and source are required; no title-based fallback is permitted.");
  }
  return { media_external_id: id, media_external_source: source };
}

export function persistedPersonaMediaIdentity(row: {
  media_title?: string | null;
  media_type?: string | null;
  media_external_id?: unknown;
  media_external_source?: unknown;
}): PersonaMediaIdentity | { media_external_id: null; media_external_source: null } {
  // Preserve existing support for genuinely media-free posts.
  const hasMedia = Boolean(row.media_title?.trim() || row.media_type?.trim()) ||
    row.media_external_id != null || row.media_external_source != null;
  return hasMedia
    ? requirePersonaMediaIdentity(row.media_external_id, row.media_external_source)
    : { media_external_id: null, media_external_source: null };
}