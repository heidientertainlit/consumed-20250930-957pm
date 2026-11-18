/**
 * Narrow movie/TV pornography exclusion, shared by the catalog endpoints.
 * Provider adult=false (or a missing flag) is not a safety certificate.
 * This is metadata filtering, not a guarantee about unlabelled media or images.
 */
type CatalogMetadata = {
  adult?: unknown;
  title?: unknown;
  name?: unknown;
  original_title?: unknown;
  original_name?: unknown;
  overview?: unknown;
  description?: unknown;
};

function normalized(value: unknown): string {
  return typeof value === "string"
    ? value.normalize("NFKC").replace(/\p{Cf}/gu, "").toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, " ").replace(/\s+/g, " ").trim()
    : "";
}

function hasPornographicLabel(text: string): boolean {
  // "xXx" alone is also a mainstream action franchise. Require an explicit
  // pornography/parody label, rather than banning XXX, sex, adult or romance.
  return /\b(?:xxx|triple x|x rated)\b.{0,100}\b(?:parod(?:y|ies)|spoofs?|porn(?:o|ographic|ography)?)\b/u.test(text)
    || /\b(?:parod(?:y|ies)|spoofs?)\b.{0,100}\b(?:xxx|triple x|x rated)\b/u.test(text)
    || /\b(?:pornographic|porno|porn)\s+(?:(?:adult|movie|film)\s+)?(?:parod(?:y|ies)|spoofs?|collection|compilation|anthology|movies?|films?|videos?)\b/u.test(text)
    || /\b(?:hardcore|hard core|softcore|soft core)\s+(?:porn|porno|pornography|pornographic)\b/u.test(text);
}

export function isAllowedCatalogVideo(item: CatalogMetadata | null | undefined): boolean {
  if (!item || typeof item !== "object" || item.adult === true) return false;
  const titles = [item.title, item.name, item.original_title, item.original_name].map(normalized);
  if (titles.some(hasPornographicLabel)) return false;

  // Inspect self-describing metadata, not every mention of pornography:
  // a documentary *about* the industry or a dramatic plot may mention it.
  for (const value of [item.overview, item.description]) {
    const text = normalized(value);
    const selfDescription = /^(?:(?:this|it)\s+is\s+)?(?:(?:a|an|the)\s+)?(?:(?:explicit|erotic|adult|hardcore|softcore)\s+){0,3}(?:xxx|x rated|pornographic|porno|porn)\b/u.test(text);
    if (selfDescription && hasPornographicLabel(text)) return false;
  }
  return true;
}
