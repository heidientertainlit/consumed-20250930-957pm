/**
 * Service-role-only, source-backed media enrichment cache.  It intentionally
 * never produces a recommendation score; its optional model call only maps
 * provider text into a small controlled vocabulary.
 */

export const FINGERPRINT_VERSION = 7;

const DAY = 86_400_000;
const READY_TTL = 30 * DAY;
const RETRY_TTL = DAY;
const MAX_TEXT = 1_500;

const VOCAB = {
  themes: ['adventure', 'coming-of-age', 'family', 'friendship', 'identity', 'justice', 'love', 'loss', 'power', 'redemption', 'survival'],
  tones: ['dark', 'emotional', 'funny', 'hopeful', 'lighthearted', 'romantic', 'serious', 'suspenseful', 'uplifting'],
  audience: ['adult', 'children', 'family', 'general', 'mature', 'teen'],
  styles: ['action', 'animation', 'comedy', 'documentary', 'drama', 'fantasy', 'horror', 'mystery', 'romance', 'science-fiction', 'thriller'],
  pacing: ['fast', 'measured', 'slow'],
} as const;

type ControlledKey = keyof typeof VOCAB;
type SourceMetadata = {
  title: string;
  creator: string | null;
  description: string | null;
  subjects: string[];
  keywords: string[];
  collection: string | null;
  source_url?: string | null;
  imdb_id?: string | null;
  isbn_identifiers?: string[];
  open_library_work_id?: string | null;
  release_year?: number | null;
};

export interface MediaFingerprint {
  version: number;
  source_verified: boolean;
  embedding: number[];
  themes: string[];
  tones: string[];
  audience: string[];
  styles: string[];
  pacing: string[];
  franchise: string | null;
  story_key: string | null;
  source_metadata: SourceMetadata;
}

export interface MediaFingerprintInput {
  externalSource: string;
  externalId: string;
  mediaType: string;
  title: string;
  creator?: string | null;
  description?: string | null;
  genres?: string[] | null;
}

const text = (value: unknown, max = MAX_TEXT): string | null => {
  if (typeof value !== 'string') return null;
  const clean = value.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
  return clean || null;
};
const strings = (value: unknown, max = 12, itemMax = 100): string[] =>
  Array.isArray(value) ? value.map((v) => text(v, itemMax)).filter((v): v is string => !!v).slice(0, max) : [];
const releaseYear = (value: unknown): number | null => {
  const match = String(value || '').match(/\b(1\d{3}|20\d{2})\b/);
  return match ? Number(match[1]) : null;
};

async function getJson(url: string, init: RequestInit = {}, timeout = 7_000): Promise<any | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const res = await fetch(url, { ...init, signal: controller.signal });
    return res.ok ? await res.json() : null;
  } catch (_) {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function initialMetadata(input: MediaFingerprintInput): SourceMetadata {
  return {
    title: text(input.title, 300) || 'Untitled',
    creator: text(input.creator, 300),
    description: text(input.description),
    subjects: strings(input.genres, 8),
    keywords: [],
    collection: null,
  };
}

function tmdbTypes(mediaType: string): ('movie' | 'tv')[] {
  const lower = mediaType.toLowerCase();
  return lower.includes('tv') || lower.includes('series') ? ['tv', 'movie'] : ['movie', 'tv'];
}

const normalizedTitle = (value: unknown): string =>
  String(value || '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/**
 * Google Books can exhaust its project quota even for IDs that media search
 * resolved earlier. In that case, corroborate the title against Open Library
 * and use only provider-returned metadata. Ambiguous title collisions fail
 * closed instead of inheriting caller metadata.
 */
async function resolveOpenLibraryByTitle(
  input: MediaFingerprintInput,
  fallback: SourceMetadata,
): Promise<{ metadata: SourceMetadata; found: boolean }> {
  const queryTitle = normalizedTitle(input.title);
  if (!queryTitle) return { metadata: fallback, found: false };
  const search = await getJson(
    `https://openlibrary.org/search.json?title=${encodeURIComponent(input.title)}&limit=8&fields=key,title,author_name,subject,isbn,first_publish_year,publish_year`,
    { headers: { 'User-Agent': 'ConsumedApp-MediaFingerprint/1.0' } },
  );
  const exact = Array.isArray(search?.docs)
    ? search.docs.filter((doc: any) =>
        normalizedTitle(doc?.title) === queryTitle
        && /^\/works\/OL\d+W$/i.test(String(doc?.key || ''))
      )
    : [];
  const creator = normalizedTitle(input.creator);
  const creatorMatches = creator
    ? exact.filter((doc: any) =>
        strings(doc?.author_name, 8, 200).some((name) => {
          const normalized = normalizedTitle(name);
          return normalized === creator || normalized.includes(creator) || creator.includes(normalized);
        })
      )
    : [];
  const candidates = creatorMatches.length > 0 ? creatorMatches : exact;
  const informative = candidates.filter((doc: any) =>
    strings(doc?.author_name, 8, 200).length > 0
    || strings(doc?.subject, 12, 100).length > 0
  );
  const informativeAuthors = new Set(
    informative
      .map((doc: any) => strings(doc?.author_name, 8, 200).map(normalizedTitle).filter(Boolean).sort().join('|'))
      .filter(Boolean),
  );
  const selected = informative.length === 1
    ? informative[0]
    : informative.length > 1 && informativeAuthors.size === 1
      ? informative[0]
      : candidates.length === 1
        ? candidates[0]
        : null;
  if (!selected) return { metadata: fallback, found: false };

  const workKey = String(selected.key);
  const work = await getJson(`https://openlibrary.org${workKey}.json`, {
    headers: { 'User-Agent': 'ConsumedApp-MediaFingerprint/1.0' },
  });
  if (!work) return { metadata: fallback, found: false };
  const workId = text(workKey.replace(/^\/works\//, ''), 30);
  return {
    found: true,
    metadata: {
      title: text(work.title || selected.title, 300) || fallback.title,
      creator: text(strings(selected.author_name, 8, 200).join(', '), 300),
      description: text(typeof work.description === 'string' ? work.description : work.description?.value),
      subjects: strings(
        Array.isArray(work.subjects) && work.subjects.length > 0 ? work.subjects : selected.subject,
        12,
      ),
      keywords: strings(work.subject_people, 6),
      collection: text(work.series?.[0], 200),
      source_url: `https://openlibrary.org${workKey}`,
      open_library_work_id: workId,
      isbn_identifiers: strings(selected.isbn, 4, 20),
      release_year: releaseYear(selected.first_publish_year || selected.publish_year?.[0]),
    },
  };
}

async function resolveSource(input: MediaFingerprintInput): Promise<{ metadata: SourceMetadata; found: boolean }> {
  const fallback = initialMetadata(input);
  const source = input.externalSource.toLowerCase();
  if (source === 'tmdb') {
    const key = Deno.env.get('TMDB_API_KEY');
    if (!key) return { metadata: fallback, found: false };
    for (const kind of tmdbTypes(input.mediaType || '')) {
      const d = await getJson(`https://api.themoviedb.org/3/${kind}/${encodeURIComponent(input.externalId)}?api_key=${encodeURIComponent(key)}&append_to_response=keywords,credits,external_ids`);
      if (!d) continue;
      let collection: string | null = text(d.belongs_to_collection?.name, 200);
      // A single bounded follow-up gives TV collections/parts a useful name.
      if (!collection && d.belongs_to_collection?.id) {
        const c = await getJson(`https://api.themoviedb.org/3/collection/${d.belongs_to_collection.id}?api_key=${encodeURIComponent(key)}`);
        collection = text(c?.name, 200);
      }
      return { found: true, metadata: {
        title: text(d.title || d.name, 300) || fallback.title,
        creator: text(d.credits?.crew?.find((p: any) => p.job === 'Director' || p.job === 'Creator')?.name || d.created_by?.[0]?.name, 300) || fallback.creator,
        description: text(d.overview) || fallback.description,
        subjects: strings((d.genres || []).map((g: any) => g?.name), 10),
        keywords: strings(d.keywords?.keywords?.map((k: any) => k?.name) || d.keywords?.results?.map((k: any) => k?.name), 12),
        collection,
        imdb_id: text(d.imdb_id || d.external_ids?.imdb_id, 20),
         release_year: releaseYear(d.release_date || d.first_air_date),
      }};
    }
  } else if (source === 'googlebooks') {
    const key = Deno.env.get('GOOGLE_BOOKS_API_KEY');
    const d = await getJson(`https://www.googleapis.com/books/v1/volumes/${encodeURIComponent(input.externalId)}${key ? `?key=${encodeURIComponent(key)}` : ''}`);
    const v = d?.volumeInfo;
    if (v) return { found: true, metadata: { title: text(v.title, 300) || fallback.title, creator: text((v.authors || []).join(', '), 300) || fallback.creator, description: text(v.description) || fallback.description, subjects: strings(v.categories, 10), keywords: [], collection: text(v.seriesInfo?.bookDisplayNumber, 200), source_url: text(v.infoLink, 500), isbn_identifiers: strings((v.industryIdentifiers || []).filter((i: any) => i?.type === 'ISBN_10' || i?.type === 'ISBN_13').map((i: any) => i.identifier), 4, 20), release_year: releaseYear(v.publishedDate) } };
    return await resolveOpenLibraryByTitle(input, fallback);
  } else if (source === 'goodreads') {
    // Goodreads exports provide a stable book ID but no public metadata API.
    // Corroborate the imported title against Open Library before scoring it.
    return await resolveOpenLibraryByTitle(input, fallback);
  } else if (source === 'openlibrary' || source === 'open_library') {
    const isbn = /^[0-9Xx-]{10,17}$/.test(input.externalId);
    let work: any = null;
    let edition: any = null;
    let workId: string | null = null;
    if (isbn) {
      edition = await getJson(`https://openlibrary.org/isbn/${encodeURIComponent(input.externalId)}.json`);
      const key = edition?.works?.[0]?.key;
      if (key) {
        workId = text(String(key).replace(/^\/works\//, ''), 30);
        work = await getJson(`https://openlibrary.org${key}.json`);
      }
    } else {
      const id = input.externalId.replace(/^\/?(works\/)?/i, '');
      workId = text(id, 30);
      work = await getJson(`https://openlibrary.org/works/${encodeURIComponent(id)}.json`);
    }
    if (work) return { found: true, metadata: { title: text(work.title, 300) || fallback.title, creator: text(work.by_statement, 300) || fallback.creator, description: text(typeof work.description === 'string' ? work.description : work.description?.value) || fallback.description, subjects: strings(work.subjects, 12), keywords: strings(work.subject_people, 6), collection: text(work.series?.[0], 200), open_library_work_id: workId, isbn_identifiers: strings([...(edition?.isbn_13 || []), ...(edition?.isbn_10 || []), ...(isbn ? [input.externalId] : [])], 4, 20), release_year: releaseYear(edition?.publish_date || work.first_publish_date) } };
    return await resolveOpenLibraryByTitle(input, fallback);
  } else if (source === 'itunes') {
    const d = await getJson(`https://itunes.apple.com/lookup?id=${encodeURIComponent(input.externalId)}&limit=1`);
    const v = d?.results?.[0];
    if (v) return { found: true, metadata: { title: text(v.collectionName || v.trackName, 300) || fallback.title, creator: text(v.artistName, 300) || fallback.creator, description: text(v.longDescription || v.description) || fallback.description, subjects: strings(v.genres || [v.primaryGenreName], 10), keywords: [], collection: text(v.collectionName, 200), source_url: text(v.collectionViewUrl || v.trackViewUrl, 500), release_year: releaseYear(v.releaseDate) } };
  } else if (source === 'spotify') {
    // Client-credentials access is optional; do one type-directed request rather
    // than probing every Spotify endpoint.
    const clientId = Deno.env.get('SPOTIFY_CLIENT_ID');
    const secret = Deno.env.get('SPOTIFY_CLIENT_SECRET');
    if (!clientId || !secret) return { metadata: fallback, found: false };
    const tokenResponse = await getJson('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: { Authorization: `Basic ${btoa(`${clientId}:${secret}`)}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'grant_type=client_credentials',
    });
    const token = tokenResponse?.access_token;
    if (!token) return { metadata: fallback, found: false };
    const type = input.mediaType.toLowerCase();
    const endpoint = type.includes('podcast') || type.includes('show') ? 'shows'
      : type.includes('episode') ? 'episodes' : type.includes('album') ? 'albums' : 'tracks';
    const v = await getJson(`https://api.spotify.com/v1/${endpoint}/${encodeURIComponent(input.externalId)}`, { headers: { Authorization: `Bearer ${token}` } });
    if (v) return { found: true, metadata: {
      title: text(v.name, 300) || fallback.title,
      creator: text(v.artists?.map((a: any) => a.name).join(', ') || v.publisher || v.show?.publisher, 300) || fallback.creator,
      description: text(v.description || v.html_description) || fallback.description,
      subjects: strings(v.genres, 10),
      keywords: [],
      collection: text(v.album?.name || v.show?.name, 200),
      source_url: text(v.external_urls?.spotify, 500),
      release_year: releaseYear(v.release_date || v.album?.release_date),
    }};
  }
  return { metadata: fallback, found: false };
}

function deterministicFingerprint(metadata: SourceMetadata, sourceVerified: boolean): MediaFingerprint {
  const haystack = [...metadata.subjects, ...metadata.keywords].join(' ').toLowerCase();
  const styles = sourceVerified
    ? VOCAB.styles.filter((v) => haystack.includes(v) || (v === 'science-fiction' && /\bsci[- ]?fi\b/.test(haystack)))
    : [];
  return { version: FINGERPRINT_VERSION, source_verified: sourceVerified, embedding: [], themes: [], tones: [], audience: [], styles, pacing: [], franchise: sourceVerified ? metadata.collection : null, story_key: null, source_metadata: metadata };
}

function controlled(value: unknown, key: ControlledKey): string[] {
  const allowed: readonly string[] = VOCAB[key];
  return strings(value, 6, 40).map((s) => s.toLowerCase()).filter((s) => allowed.includes(s));
}

function groundedProposal(value: unknown, metadata: SourceMetadata): string | null {
  const candidate = text(value, 200);
  if (!candidate || !/^[\p{L}\p{N} .:'’&_-]+$/u.test(candidate)) return null;
  const normal = candidate.toLowerCase().replace(/[-_]/g, ' ').replace(/\s+/g, ' ').trim();
  const evidence = [metadata.title, metadata.collection, metadata.description, ...metadata.subjects, ...metadata.keywords]
    .filter(Boolean).join(' ').toLowerCase().replace(/[-_]/g, ' ');
  return evidence.includes(normal) ? candidate : null;
}

function sourceText(metadata: SourceMetadata): string {
  return [metadata.title, metadata.creator, metadata.description, metadata.subjects.join(', '), metadata.keywords.join(', ')]
    .filter(Boolean).join('\n').slice(0, 4_500);
}

async function classify(metadata: SourceMetadata, base: MediaFingerprint): Promise<MediaFingerprint> {
  const apiKey = Deno.env.get('OPENAI_API_KEY');
  const evidence = sourceText(metadata);
  if (!apiKey || !evidence) return base;
  const prompt = `Classify ONLY this source text. Do not score, rank, recommend, or infer facts not present. Return JSON with themes, tones, audience, styles, pacing arrays using only the allowed values, plus a franchise string or null. Allowed: ${JSON.stringify(VOCAB)}. A franchise may only repeat or normalize an explicitly supported collection/series fact.\nSOURCE TEXT:\n${evidence}`;
  const d = await getJson('https://api.openai.com/v1/chat/completions', { method: 'POST', headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ model: 'gpt-4o-mini', temperature: 0, response_format: { type: 'json_object' }, max_tokens: 180, messages: [{ role: 'user', content: prompt }] }) }, 10_000);
  try {
    const p = JSON.parse(d?.choices?.[0]?.message?.content || '{}');
    return { ...base, themes: controlled(p.themes, 'themes'), tones: controlled(p.tones, 'tones'), audience: controlled(p.audience, 'audience'), styles: controlled(p.styles, 'styles'), pacing: controlled(p.pacing, 'pacing'), franchise: groundedProposal(p.franchise, metadata) || base.franchise, story_key: null };
  } catch (_) { return base; }
}

async function embed(metadata: SourceMetadata): Promise<number[]> {
  const apiKey = Deno.env.get('OPENAI_API_KEY');
  const input = sourceText(metadata);
  if (!apiKey || !input) return [];
  const response = await getJson('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    // This is source representation only; embeddings are never used here to
    // score, rank, or recommend anything.
    body: JSON.stringify({ model: 'text-embedding-3-small', input, dimensions: 256 }),
  }, 10_000);
  const vector = response?.data?.[0]?.embedding;
  return Array.isArray(vector) && vector.length >= 64 && vector.every((n: unknown) => typeof n === 'number' && Number.isFinite(n))
    ? vector
    : [];
}

/**
 * Resolves stable story identity from authoritative Wikidata properties in one
 * bounded SPARQL request. IMDb adaptations only resolve through "based on"
 * (P144); direct book identifiers resolve the work itself.
 */
async function resolveWikidataStoryKey(metadata: SourceMetadata): Promise<string | null> {
  const imdb = metadata.imdb_id?.match(/^tt\d{5,12}$/i)?.[0] || null;
  const openLibrary = metadata.open_library_work_id?.match(/^OL\d+W$/i)?.[0].toUpperCase() || null;
  const isbns = strings(metadata.isbn_identifiers, 4, 20)
    .map((value) => value.replace(/[^0-9X]/gi, '').toUpperCase())
    .filter((value) => /^(?:\d{13}|\d{9}[\dX])$/.test(value));
  const isbn13 = isbns.filter((value) => value.length === 13);
  const isbn10 = isbns.filter((value) => value.length === 10);
  const branches: string[] = [];
  const values = (items: string[]) => items.map((item) => `"${item}"`).join(' ');
  if (imdb) branches.push(`{ VALUES ?identifier { "${imdb}" } ?adaptation wdt:P345 ?identifier; wdt:P144 ?item. BIND(0 AS ?priority) }`);
  if (openLibrary) branches.push(`{ VALUES ?identifier { "${openLibrary}" } ?item wdt:P648 ?identifier. BIND(1 AS ?priority) }`);
  if (isbn13.length) branches.push(`{ VALUES ?identifier { ${values(isbn13)} } ?item wdt:P212 ?identifier. BIND(2 AS ?priority) }`);
  if (isbn10.length) branches.push(`{ VALUES ?identifier { ${values(isbn10)} } ?item wdt:P957 ?identifier. BIND(3 AS ?priority) }`);
  if (!branches.length) return null;
  const query = `SELECT ?item ?priority WHERE { ${branches.join(' UNION ')} } ORDER BY ?priority LIMIT 1`;
  const response = await getJson(`https://query.wikidata.org/sparql?query=${encodeURIComponent(query)}&format=json`, {
    headers: {
      Accept: 'application/sparql-results+json',
      'User-Agent': 'TasteWeb-MediaFingerprint/1.0 (source-backed story identity resolver)',
    },
  });
  const uri = response?.results?.bindings?.[0]?.item?.value;
  const qid = typeof uri === 'string' ? uri.match(/\/(Q\d+)$/)?.[1] : null;
  return qid ? `wikidata:${qid}` : null;
}

/** Reads a fresh cache row or resolves, classifies, and write-backs one bounded source lookup. */
export async function getOrResolveMediaFingerprint(admin: any, input: MediaFingerprintInput): Promise<MediaFingerprint> {
  if (!input?.externalSource || !input?.externalId || !input?.title) throw new Error('externalSource, externalId and title are required');
  const source = String(input.externalSource).slice(0, 50);
  const id = String(input.externalId).slice(0, 200);
  const { data: cached } = await admin.from('media_fingerprints').select('*').eq('external_source', source).eq('external_id', id).maybeSingle();
  const age = cached?.resolved_at ? Date.now() - new Date(cached.resolved_at).getTime() : Infinity;
  const ttl = cached?.status === 'ready' ? READY_TTL : RETRY_TTL;
  if (
    cached?.fingerprint_version === FINGERPRINT_VERSION &&
    cached?.fingerprint &&
    typeof cached.fingerprint.source_verified === 'boolean' &&
    age >= 0 &&
    age < ttl
  ) return cached.fingerprint as MediaFingerprint;
  try {
    const resolved = await resolveSource({ ...input, externalSource: source, externalId: id });
    if (!resolved.found) {
      const fingerprint = deterministicFingerprint(resolved.metadata, false);
      await admin.from('media_fingerprints').upsert({ external_source: source, external_id: id, media_type: text(input.mediaType, 50), fingerprint_version: FINGERPRINT_VERSION, status: 'empty', source_metadata: resolved.metadata, fingerprint, error_message: null, resolved_at: new Date().toISOString(), updated_at: new Date().toISOString() }, { onConflict: 'external_source,external_id' });
      return fingerprint;
    }
    const base = deterministicFingerprint(resolved.metadata, true);
    // Classification, embedding, and the single authoritative identity lookup
    // are independent, so keep enrichment latency bounded to the slowest call.
    const [classified, embedding, authoritativeStoryKey] = await Promise.all([
      classify(resolved.metadata, base),
      embed(resolved.metadata),
      resolveWikidataStoryKey(resolved.metadata),
    ]);
    const fingerprint = {
      ...classified,
      embedding,
      story_key: authoritativeStoryKey,
    };
    const status = resolved.found ? 'ready' : 'empty';
    await admin.from('media_fingerprints').upsert({ external_source: source, external_id: id, media_type: text(input.mediaType, 50), fingerprint_version: FINGERPRINT_VERSION, status, source_metadata: resolved.metadata, fingerprint, error_message: null, resolved_at: new Date().toISOString(), updated_at: new Date().toISOString() }, { onConflict: 'external_source,external_id' });
    return fingerprint;
  } catch (error) {
    const fallback = deterministicFingerprint(initialMetadata(input), false);
    await admin.from('media_fingerprints').upsert({ external_source: source, external_id: id, media_type: text(input.mediaType, 50), fingerprint_version: FINGERPRINT_VERSION, status: 'failed', source_metadata: fallback.source_metadata, fingerprint: fallback, error_message: String(error?.message || error).slice(0, 500), resolved_at: new Date().toISOString(), updated_at: new Date().toISOString() }, { onConflict: 'external_source,external_id' });
    return fallback;
  }
}