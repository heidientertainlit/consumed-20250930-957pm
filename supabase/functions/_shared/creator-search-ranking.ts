export type CreatorSearchResult = {
  name: string;
  role: string;
  image?: string;
  external_id: string;
  external_source: string;
  popularity?: number;
  followers?: number;
  work_count?: number;
};

function normalizedName(value: string): string {
  return value.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ").trim().replace(/\s+/g, " ");
}

/** Google Books returns every coauthor of a matching volume, not just the searched person. */
export function isRelevantCreatorAuthor(name: string, query: string): boolean {
  const normalized = normalizedName(name);
  if (/\bfan\s*club\b|\btribute\b|\bstudy guides?\b/.test(normalized)) return false;
  const terms = normalizedName(query).split(" ").filter(Boolean);
  const nameParts = normalized.split(" ");
  return terms.length > 0 && terms.every(term => nameParts.some(part => part.startsWith(term)));
}

function nameRank(name: string, query: string): number {
  const normalized = normalizedName(name);
  const term = normalizedName(query);
  if (normalized === term) return 0;
  if (normalized.startsWith(term)) return 1;
  if (term.split(" ").every(word => normalized.split(" ").some(part => part.startsWith(word)))) return 2;
  return 3;
}

/** Relevance first; book frequency must not replace a distinct film/music identity. */
export function rankCreatorSearchResults<T extends CreatorSearchResult>(results: T[], query: string): T[] {
  const identities = new Map<string, T>();
  for (const result of results) {
    if (result.external_source === "googlebooks" && !isRelevantCreatorAuthor(result.name, query)) continue;
    const key = `${result.external_source}:${result.external_id}`;
    const existing = identities.get(key);
    if (!existing || nameRank(result.name, query) < nameRank(existing.name, query)) {
      identities.set(key, result);
    }
  }
  return [...identities.values()].sort((a, b) => {
    const relevance = nameRank(a.name, query) - nameRank(b.name, query);
    if (relevance) return relevance;
    // Film/music catalogs identify people directly; Books only supplies volume author credits.
    const authorDifference = Number(a.external_source === "googlebooks") - Number(b.external_source === "googlebooks");
    if (authorDifference) return authorDifference;
    if (a.external_source === b.external_source) {
      return (b.followers ?? b.popularity ?? b.work_count ?? 0) - (a.followers ?? a.popularity ?? a.work_count ?? 0);
    }
    return 0;
  });
}
