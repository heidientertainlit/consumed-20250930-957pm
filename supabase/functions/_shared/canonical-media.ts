import {
  FINGERPRINT_VERSION,
  getOrResolveMediaFingerprint,
  type MediaFingerprint,
  type MediaFingerprintInput,
} from './media-fingerprint.ts';

export interface CanonicalMediaInput extends MediaFingerprintInput {
  year?: number | string | null;
  verifiedSourceMetadata?: Partial<MediaFingerprint['source_metadata']>;
  /** Reject provider failures instead of creating an unverified identity. */
  requireVerifiedSource?: boolean;
  /** Opt out of weak verified title/creator/year reconciliation. */
  allowVerifiedTitleCreatorYear?: boolean;
}

export interface CanonicalMediaResolution {
  canonicalMediaId: string;
  fingerprint: MediaFingerprint;
  metadata: MediaFingerprint['source_metadata'];
  sourceVerified: boolean;
}

export class UnverifiedProviderTupleError extends Error {
  readonly code = 'UNVERIFIED_PROVIDER_TUPLE';

  constructor() {
    super('Provider tuple could not be verified; no canonical identity was created');
    this.name = 'UnverifiedProviderTupleError';
  }
}

type CanonicalRow = { id: string; release_year?: number | null };

const clean = (value: unknown, max: number): string | null => {
  if (typeof value !== 'string') return null;
  const result = value.replace(/\s+/g, ' ').trim().slice(0, max);
  return result || null;
};

/** Exported for small, Node-compatible unit tests and consistent database keys. */
export const normalizeMediaIdentityText = (value: unknown): string =>
  String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const normalizedIsbn = (value: unknown): string | null => {
  const isbn = String(value || '').replace(/[^0-9X]/gi, '').toUpperCase();
  return /^(?:\d{13}|\d{9}[\dX])$/.test(isbn) ? isbn : null;
};

const yearOf = (value: unknown): number | null => {
  const year = typeof value === 'number' ? value : Number(String(value || '').match(/\b(\d{4})\b/)?.[1]);
  return Number.isInteger(year) && year >= 1000 && year <= 9999 ? year : null;
};

const sourceKey = (value: unknown): string =>
  String(value || '').trim().toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 50);

const idKey = (value: unknown): string => String(value || '').trim().slice(0, 200);

async function aliasCanonicalId(admin: any, source: string, id: string): Promise<string | null> {
  const { data, error } = await admin
    .from('media_provider_aliases')
    .select('canonical_media_id')
    .eq('external_source', source)
    .eq('external_id', id)
    .maybeSingle();
  if (error) throw error;
  return data?.canonical_media_id || null;
}

async function canonicalByField(admin: any, field: string, value: string): Promise<CanonicalRow | null> {
  const { data, error } = await admin.from('canonical_media').select('id,release_year').eq(field, value).maybeSingle();
  if (error) throw error;
  return data || null;
}

async function insertAlias(
  admin: any,
  canonicalMediaId: string,
  source: string,
  id: string,
  sourceVerified: boolean,
  metadata: unknown,
): Promise<string> {
  const { error } = await admin.from('media_provider_aliases').insert({
    canonical_media_id: canonicalMediaId,
    external_source: source,
    external_id: id,
    source_verified: sourceVerified,
    metadata,
  });
  if (!error) return canonicalMediaId;
  // The unique provider key is the concurrency arbiter. Never overwrite a
  // pre-existing mapping, particularly from an unverified caller.
  const winner = await aliasCanonicalId(admin, source, id);
  if (winner) return winner;
  throw error;
}

async function addAuthoritativeAliases(admin: any, canonicalMediaId: string, fingerprint: MediaFingerprint): Promise<string> {
  if (!fingerprint.source_verified) return canonicalMediaId;
  const metadata = fingerprint.source_metadata || ({} as MediaFingerprint['source_metadata']);
  const aliases: Array<[string, string | null]> = [
    ['story_key', clean(fingerprint.story_key, 200)],
    ['openlibrary_work', clean(metadata.open_library_work_id, 50)?.toUpperCase() || null],
    ...((metadata.isbn_identifiers || []).map((isbn) => ['isbn', normalizedIsbn(isbn)] as [string, string | null])),
  ];
  let id = canonicalMediaId;
  for (const [source, externalId] of aliases) {
    if (externalId) id = await insertAlias(admin, id, source, externalId, true, { authoritative: true });
  }
  return id;
}

/**
 * Resolve only through server-owned source evidence. Precedence is exact
 * provider alias, authoritative work identifiers, then verified title+creator
 * with compatible years. In particular, title-only matching is impossible.
 */
export async function resolveCanonicalMedia(admin: any, input: CanonicalMediaInput): Promise<CanonicalMediaResolution> {
  if (!admin?.from) throw new Error('A service-role Supabase client is required');
  const externalSource = sourceKey(input?.externalSource);
  const externalId = idKey(input?.externalId);
  const title = clean(input?.title, 300);
  if (!externalSource || !externalId || !title) throw new Error('externalSource, externalId and title are required');

  const exact = await aliasCanonicalId(admin, externalSource, externalId);
  const trusted = input.verifiedSourceMetadata;
  const fingerprint: MediaFingerprint = trusted ? {
    version: FINGERPRINT_VERSION,
    source_verified: true,
    embedding: [],
    themes: [],
    tones: [],
    audience: [],
    styles: [],
    pacing: [],
    franchise: clean(trusted.collection, 200),
    story_key: null,
    source_metadata: {
      title: clean(trusted.title || title, 300) || title,
      creator: clean(trusted.creator || input.creator, 300),
      description: clean(trusted.description || input.description, 1500),
      subjects: Array.isArray(trusted.subjects) ? trusted.subjects.map((value) => clean(value, 100)).filter((value): value is string => !!value).slice(0, 12) : [],
      keywords: [],
      collection: clean(trusted.collection, 200),
      source_url: clean(trusted.source_url, 500),
      imdb_id: clean(trusted.imdb_id, 20),
      isbn_identifiers: Array.isArray(trusted.isbn_identifiers) ? trusted.isbn_identifiers.map(String).slice(0, 4) : [],
      open_library_work_id: clean(trusted.open_library_work_id, 50),
      release_year: yearOf(trusted.release_year),
    },
  } : await getOrResolveMediaFingerprint(admin, {
    ...input,
    externalSource,
    externalId,
    title,
    requireExactProviderMatch: input.requireVerifiedSource === true,
  });
  if (exact) {
    const { error } = await admin.from('media_fingerprints')
      .update({ canonical_media_id: exact })
      .eq('external_source', externalSource)
      .eq('external_id', externalId);
    if (error) throw error;
    return { canonicalMediaId: exact, fingerprint, metadata: fingerprint.source_metadata, sourceVerified: fingerprint.source_verified };
  }

  const metadata = fingerprint.source_metadata;
  if (input.requireVerifiedSource && !fingerprint.source_verified) {
    throw new UnverifiedProviderTupleError();
  }
  const creator = clean(metadata.creator || input.creator, 300);
  // Weak title+creator reconciliation requires a year returned by a verified
  // provider lookup. Caller-supplied years are retained only as display hints;
  // they are never sufficient to merge works.
  const releaseYear = fingerprint.source_verified ? yearOf(metadata.release_year) : null;
  const normalizedTitle = normalizeMediaIdentityText(metadata.title || title);
  const normalizedCreator = normalizeMediaIdentityText(creator);
  const storyKey = fingerprint.source_verified ? clean(fingerprint.story_key, 200) : null;
  const openLibraryWorkId = fingerprint.source_verified ? clean(metadata.open_library_work_id, 50)?.toUpperCase() || null : null;
  const isbn = fingerprint.source_verified ? (metadata.isbn_identifiers || []).map(normalizedIsbn).find(Boolean) || null : null;
  // Strict backfills intentionally isolate provider tuples that lack an
  // authoritative cross-provider key. Keep the verified year in metadata, but
  // do not populate the weak title/creator/year unique-key column because that
  // would either force a text-based merge or reject the isolated identity.
  const canonicalReleaseYear = input.allowVerifiedTitleCreatorYear === false
    && !storyKey
    && !openLibraryWorkId
    && !isbn
    ? null
    : releaseYear;

  let existing: CanonicalRow | null = null;
  for (const [field, value] of [['story_key', storyKey], ['open_library_work_id', openLibraryWorkId], ['isbn_identifier', isbn]] as const) {
    if (!value) continue;
    existing = await canonicalByField(admin, field, value);
    if (existing) break;
    const viaAlias = await aliasCanonicalId(admin, field === 'story_key' ? 'story_key' : field === 'open_library_work_id' ? 'openlibrary_work' : 'isbn', value);
    if (viaAlias) existing = { id: viaAlias };
    if (existing) break;
  }

  // Weak identity is intentionally gated on evidence from the source lookup.
  if (!existing && input.allowVerifiedTitleCreatorYear !== false
    && fingerprint.source_verified && normalizedTitle && normalizedCreator && releaseYear !== null) {
    const { data, error } = await admin.from('canonical_media')
      .select('id,release_year')
      .eq('source_verified', true)
      .eq('normalized_title', normalizedTitle)
      .eq('normalized_creator', normalizedCreator)
      .eq('release_year', releaseYear);
    if (error) throw error;
    if ((data || []).length === 1) existing = data[0];
  }

  let canonicalMediaId = existing?.id;
  if (!canonicalMediaId) {
    const { data, error } = await admin.from('canonical_media').insert({
      media_type: clean(input.mediaType, 50),
      title: clean(metadata.title, 300) || title,
      creator,
      release_year: canonicalReleaseYear,
      normalized_title: normalizedTitle,
      normalized_creator: normalizedCreator || null,
      story_key: storyKey,
      open_library_work_id: openLibraryWorkId,
      isbn_identifier: isbn,
      source_verified: fingerprint.source_verified,
      metadata,
    }).select('id').single();
    if (error) {
      // Authoritative unique indexes can win a concurrent insert.
      for (const [field, value] of [['story_key', storyKey], ['open_library_work_id', openLibraryWorkId], ['isbn_identifier', isbn]] as const) {
        if (value) canonicalMediaId = (await canonicalByField(admin, field, value))?.id || canonicalMediaId;
        if (canonicalMediaId) break;
      }
      if (!canonicalMediaId && input.allowVerifiedTitleCreatorYear !== false
        && fingerprint.source_verified && normalizedTitle && normalizedCreator && releaseYear !== null) {
        const { data: raced, error: raceError } = await admin.from('canonical_media')
          .select('id')
          .eq('source_verified', true)
          .eq('normalized_title', normalizedTitle)
          .eq('normalized_creator', normalizedCreator)
          .eq('release_year', releaseYear)
          .maybeSingle();
        if (raceError) throw raceError;
        canonicalMediaId = raced?.id || canonicalMediaId;
      }
      if (!canonicalMediaId) throw error;
    } else canonicalMediaId = data.id;
  }

  canonicalMediaId = await insertAlias(admin, canonicalMediaId, externalSource, externalId, fingerprint.source_verified, { provider_metadata: metadata });
  canonicalMediaId = await addAuthoritativeAliases(admin, canonicalMediaId, fingerprint);
  // Keep the enrichment cache linked without changing its legacy cache key.
  const { error: fingerprintLinkError } = await admin.from('media_fingerprints')
    .update({ canonical_media_id: canonicalMediaId })
    .eq('external_source', externalSource)
    .eq('external_id', externalId);
  if (fingerprintLinkError) throw fingerprintLinkError;
  return { canonicalMediaId, fingerprint, metadata, sourceVerified: fingerprint.source_verified };
}