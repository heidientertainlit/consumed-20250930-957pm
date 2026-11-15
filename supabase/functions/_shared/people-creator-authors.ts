import { isRelevantCreatorAuthor, type CreatorSearchResult } from "./creator-search-ranking.ts";

export type CreatorIdentity = { external_source: string; external_id: string };
export type PeopleCreatorResult = CreatorSearchResult & {
  known_for?: string[];
  aliases?: CreatorIdentity[];
};
type LegacyFollow = CreatorIdentity & { creator_name: string };
type Options = {
  fetcher?: typeof fetch;
  tmdbKey?: string;
  googleBooksKey?: string;
  legacyFollows?: unknown;
};
type Authority = { wikidata?: string; imdb?: string };
const normalize = (s: string) => s.normalize("NFKD").replace(/\p{M}/gu, "")
  .toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
const authorId = (value: unknown): string | undefined =>
  typeof value === "string" ? value.match(/(?:^|\/)(OL\d+A)(?:\/|$)/)?.[1] : undefined;

function authority(data: any): Authority {
  const wikidata = data?.wikidata_id ?? data?.remote_ids?.wikidata;
  const imdb = data?.imdb_id ?? data?.remote_ids?.imdb;
  return {
    wikidata: typeof wikidata === "string" && /^Q[1-9]\d*$/.test(wikidata) ? wikidata : undefined,
    imdb: typeof imdb === "string" && /^nm\d+$/.test(imdb) ? imdb : undefined,
  };
}

/** A shared name is never sufficient; conflicting authority IDs fail closed. */
export function sameCreatorAuthority(a: Authority, b: Authority): boolean {
  let shared = false;
  for (const key of ["wikidata", "imdb"] as const) {
    if (a[key] && b[key]) {
      if (a[key] !== b[key]) return false;
      shared = true;
    }
  }
  return shared;
}

/**
 * People-only author discovery. No database access, follows, or media search.
 * Existing callers of search-creators retain their original provider behavior.
 */
export async function searchPeopleCreatorAuthors(
  query: string, people: PeopleCreatorResult[], options: Options = {},
): Promise<{ results: PeopleCreatorResult[]; warnings: string[] }> {
  const fetcher = options.fetcher ?? fetch;
  const deadline = Date.now() + 12_000;
  const json = async (url: string) => {
    const remaining = Math.min(4_000, deadline - Date.now());
    if (remaining <= 0) throw new Error("Author lookup timed out");
    const response = await fetcher(url, {
      headers: { "User-Agent": "ConsumedCreatorSearch/1.0" },
      signal: AbortSignal.timeout(remaining),
    });
    if (!response.ok) throw new Error(`Catalog request failed (${response.status})`);
    return response.json();
  };
  let search: any;
  try {
    search = await json(`https://openlibrary.org/search/authors.json?q=${encodeURIComponent(query)}&limit=10`);
    if (!Array.isArray(search.docs)) throw new Error("Invalid author response");
  } catch {
    return { results: people, warnings: ["Author search is temporarily unavailable. Other creator results are shown."] };
  }
  const docs = search.docs.filter((a: any) =>
    authorId(a.key) && typeof a.name === "string" && a.work_count > 0 &&
    isRelevantCreatorAuthor(a.name, query),
  ).sort((a: any, b: any) =>
    Number(normalize(b.name) === normalize(query)) - Number(normalize(a.name) === normalize(query)) ||
    b.work_count - a.work_count,
  ).slice(0, 5);
  const authors: { result: PeopleCreatorResult; authority: Authority }[] = [];
  // Limit detailed lookups to three; remaining search hits still have real author IDs.
  for (let offset = 0; offset < docs.length; offset += 2) {
    await Promise.all(docs.slice(offset, offset + 2).map(async (doc: any, index: number) => {
      const id = authorId(doc.key)!;
      let detail: any = {};
      if (offset + index < 3) {
        try {
          const candidate = await json(`https://openlibrary.org/authors/${id}.json`);
          // A redirected/merged author record cannot silently change this identity.
          if (candidate.key === `/authors/${id}`) detail = candidate;
        } catch { /* Keep the independently identified author, without an unverified merge. */ }
      }
      const photo = Array.isArray(detail.photos)
        ? detail.photos.find((value: unknown) => Number.isInteger(value) && Number(value) > 0) : undefined;
      authors[offset + index] = {
        result: {
          name: doc.name, role: "Author", external_source: "openlibrary", external_id: id,
          image: photo ? `https://covers.openlibrary.org/a/id/${photo}-M.jpg?default=false` : "",
          work_count: doc.work_count,
          known_for: typeof doc.top_work === "string" ? [doc.top_work] : [],
          aliases: [{ external_source: "openlibrary", external_id: id }],
        },
        authority: authority(detail),
      };
    }));
  }
  const candidates = people.filter(p => p.external_source === "tmdb" && /^\d+$/.test(p.external_id) &&
    authors.some(a => normalize(a.result.name) === normalize(p.name)),
  ).slice(0, 5);
  const tmdbAuthorities = new Map<string, Authority>();
  if (options.tmdbKey) {
    await Promise.all(candidates.map(async person => {
      try {
        const detail = await json(`https://api.themoviedb.org/3/person/${person.external_id}/external_ids?api_key=${options.tmdbKey}`);
        tmdbAuthorities.set(person.external_id, authority(detail));
      } catch { /* Do not merge on a failed identity lookup. */ }
    }));
  }
  const merged = new Map<string, PeopleCreatorResult>();
  const standalone: PeopleCreatorResult[] = [];
  for (const author of authors) {
    const matches = candidates.filter(p =>
      sameCreatorAuthority(author.authority, tmdbAuthorities.get(p.external_id) ?? {}),
    );
    if (matches.length !== 1) {
      standalone.push(author.result);
      continue;
    }
    const person = matches[0];
    const existing = merged.get(person.external_id);
    if (existing) {
      existing.aliases!.push(...author.result.aliases!);
    } else {
      merged.set(person.external_id, {
        ...person, role: person.role === "Writer" ? "Author" : person.role,
        image: person.image || author.result.image,
        known_for: person.role === "Writer" ? author.result.known_for : person.known_for,
        work_count: author.result.work_count,
        aliases: [
          { external_source: person.external_source, external_id: person.external_id },
          ...author.result.aliases!,
        ],
      });
    }
  }
  const results = [
    ...people.map(p => p.external_source === "tmdb" ? merged.get(p.external_id) ?? p : p),
    ...standalone,
  ];
  // Recognize old book-ID follows only through ISBN -> Open Library author links.
  // Names merely select bounded candidates; names alone never establish an alias.
  const legacy: LegacyFollow[] = Array.isArray(options.legacyFollows)
    ? options.legacyFollows.filter((f: any) =>
      f?.external_source === "googlebooks" && typeof f.external_id === "string" &&
      /^[\w-]{1,80}$/.test(f.external_id) && typeof f.creator_name === "string" &&
      authors.some(a => normalize(a.result.name) === normalize(f.creator_name)),
    ).slice(0, 3) : [];
  await Promise.all(legacy.map(async follow => {
    try {
      const key = options.googleBooksKey ? `?key=${encodeURIComponent(options.googleBooksKey)}` : "";
      const volume = await json(`https://www.googleapis.com/books/v1/volumes/${encodeURIComponent(follow.external_id)}${key}`);
      if (!volume.volumeInfo?.authors?.some((name: string) =>
        normalize(name) === normalize(follow.creator_name))) return;
      const isbns: string[] = (volume.volumeInfo.industryIdentifiers ?? [])
        .filter((i: any) => ["ISBN_10", "ISBN_13"].includes(i.type) &&
          /^(?:\d{13}|\d{9}[\dX])$/.test(i.identifier))
        .map((i: any) => i.identifier).slice(0, 2);
      if (!isbns.length) return;
      const books = await json(`https://openlibrary.org/api/books?bibkeys=${isbns.map(i => `ISBN:${i}`).join(",")}&jscmd=data&format=json`);
      const ids = new Set(Object.values(books).flatMap((book: any) =>
        (book.authors ?? []).map((a: any) => authorId(a.url)).filter(Boolean),
      ));
      const matches = results.filter(result =>
        result.aliases?.some(alias => alias.external_source === "openlibrary" && ids.has(alias.external_id)),
      );
      if (matches.length === 1) matches[0].aliases!.push({
        external_source: "googlebooks", external_id: follow.external_id,
      });
    } catch { /* Leave existing follows untouched when a legacy identity cannot be verified. */ }
  }));
  return { results, warnings: [] };
}
