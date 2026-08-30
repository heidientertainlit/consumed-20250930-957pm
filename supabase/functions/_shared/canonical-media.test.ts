import assert from 'node:assert/strict';
import test from 'node:test';
import {
  normalizeMediaIdentityText,
  resolveCanonicalMedia,
} from './canonical-media.ts';
import {
  FINGERPRINT_VERSION,
  getOrResolveMediaFingerprint,
  type MediaFingerprint,
} from './media-fingerprint.ts';

type Row = Record<string, any>;

class FakeQuery implements PromiseLike<{ data: any; error: any }> {
  private filters: Array<[string, unknown]> = [];
  private limitCount: number | null = null;
  private operation: 'select' | 'insert' | 'update' | 'upsert' = 'select';
  private payload: any = null;
  private conflictColumns: string[] = [];

  constructor(private db: FakeAdmin, private table: string) {}

  select(_columns = '*') { return this; }
  eq(column: string, value: unknown) { this.filters.push([column, value]); return this; }
  order(_column: string, _options?: unknown) { return this; }
  limit(count: number) { this.limitCount = count; return this; }
  insert(payload: any) { this.operation = 'insert'; this.payload = payload; return this; }
  update(payload: any) { this.operation = 'update'; this.payload = payload; return this; }
  upsert(payload: any, options?: { onConflict?: string }) {
    this.operation = 'upsert';
    this.payload = payload;
    this.conflictColumns = String(options?.onConflict || '').split(',').filter(Boolean);
    return this;
  }

  private matchingRows() {
    const rows = this.db.tables[this.table] || [];
    const matches = rows.filter((row) => this.filters.every(([column, value]) => row[column] === value));
    return this.limitCount === null ? matches : matches.slice(0, this.limitCount);
  }

  private execute() {
    if (this.operation === 'insert' || this.operation === 'upsert') {
      const inputs = Array.isArray(this.payload) ? this.payload : [this.payload];
      const inserted: Row[] = [];
      for (const input of inputs) {
        if (this.operation === 'upsert' && this.conflictColumns.length) {
          const existing = (this.db.tables[this.table] || []).find((row) =>
            this.conflictColumns.every((column) => row[column] === input[column])
          );
          if (existing) {
            Object.assign(existing, input);
            inserted.push(existing);
            continue;
          }
        }
        if (
          this.table === 'media_provider_aliases'
          && (this.db.tables[this.table] || []).some((row) =>
            row.external_source === input.external_source && row.external_id === input.external_id
          )
        ) {
          return { data: null, error: { code: '23505', message: 'duplicate alias' } };
        }
        const row = {
          id: input.id || `00000000-0000-4000-8000-${String(++this.db.sequence).padStart(12, '0')}`,
          created_at: new Date().toISOString(),
          ...input,
        };
        (this.db.tables[this.table] ||= []).push(row);
        inserted.push(row);
      }
      return { data: Array.isArray(this.payload) ? inserted : inserted[0], error: null };
    }

    if (this.operation === 'update') {
      const rows = this.matchingRows();
      rows.forEach((row) => Object.assign(row, this.payload));
      return { data: rows, error: null };
    }

    return { data: this.matchingRows(), error: null };
  }

  async maybeSingle() {
    const result = this.execute();
    if (result.error) return result;
    const rows = Array.isArray(result.data) ? result.data : result.data ? [result.data] : [];
    if (rows.length > 1) return { data: null, error: { code: 'PGRST116', message: 'multiple rows' } };
    return { data: rows[0] || null, error: null };
  }

  async single() {
    const result = this.execute();
    if (result.error) return result;
    const rows = Array.isArray(result.data) ? result.data : result.data ? [result.data] : [];
    return rows.length === 1
      ? { data: rows[0], error: null }
      : { data: null, error: { code: 'PGRST116', message: 'expected one row' } };
  }

  then<TResult1 = { data: any; error: any }, TResult2 = never>(
    onfulfilled?: ((value: { data: any; error: any }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return Promise.resolve(this.execute()).then(onfulfilled, onrejected);
  }
}

class FakeAdmin {
  sequence = 0;
  tables: Record<string, Row[]> = {
    canonical_media: [],
    media_provider_aliases: [],
    media_fingerprints: [],
  };

  from(table: string) {
    return new FakeQuery(this, table);
  }
}

function fingerprint(
  title: string,
  creator: string,
  options: Partial<MediaFingerprint> & {
    isbn?: string[];
    openLibraryWorkId?: string | null;
    releaseYear?: number | null;
  } = {},
): MediaFingerprint {
  return {
    version: FINGERPRINT_VERSION,
    source_verified: options.source_verified ?? true,
    embedding: [],
    themes: [],
    tones: [],
    audience: [],
    styles: [],
    pacing: [],
    franchise: null,
    story_key: options.story_key ?? null,
    source_metadata: {
      title,
      creator,
      description: null,
      subjects: [],
      keywords: [],
      collection: null,
      isbn_identifiers: options.isbn || [],
      open_library_work_id: options.openLibraryWorkId || null,
      release_year: options.releaseYear || null,
    },
  };
}

function seedFingerprint(admin: FakeAdmin, source: string, id: string, value: MediaFingerprint) {
  admin.tables.media_fingerprints.push({
    external_source: source,
    external_id: id,
    fingerprint_version: FINGERPRINT_VERSION,
    status: value.source_verified ? 'ready' : 'empty',
    fingerprint: value,
    resolved_at: new Date().toISOString(),
  });
}

test('normalizes identity text without making title alone authoritative', () => {
  assert.equal(normalizeMediaIdentityText('  Héllo & Goodbye! '), 'hello and goodbye');
});

test('links different providers through a verified ISBN', async () => {
  const admin = new FakeAdmin();
  const isbn = '9780593441282';
  seedFingerprint(admin, 'goodreads', '194802722', fingerprint('Funny Story', 'Emily Henry', { isbn: [isbn] }));
  seedFingerprint(admin, 'googlebooks', 'wcHMEAAAQBAJ', fingerprint('Funny Story', 'Emily Henry', { isbn: [isbn] }));

  const goodreads = await resolveCanonicalMedia(admin, {
    externalSource: 'goodreads',
    externalId: '194802722',
    mediaType: 'book',
    title: 'Funny Story',
    creator: 'Emily Henry',
    year: 2024,
  });
  const google = await resolveCanonicalMedia(admin, {
    externalSource: 'googlebooks',
    externalId: 'wcHMEAAAQBAJ',
    mediaType: 'book',
    title: 'Funny Story',
    creator: 'Emily Henry',
    year: 2024,
  });

  assert.equal(google.canonicalMediaId, goodreads.canonicalMediaId);
  assert.equal(admin.tables.canonical_media.length, 1);
});

test('cold provider search creates and returns canonical identity without network enrichment', async () => {
  const admin = new FakeAdmin();
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error('cold search must not fetch'); };
  try {
    const result = await resolveCanonicalMedia(admin, {
      externalSource: 'googlebooks',
      externalId: 'first-search-id',
      mediaType: 'book',
      title: 'First Search Book',
      creator: 'Source Author',
      verifiedSourceMetadata: {
        title: 'First Search Book',
        creator: 'Source Author',
        release_year: 2026,
        isbn_identifiers: ['9781234567897'],
      },
    });
    assert.ok(result.canonicalMediaId);
    assert.equal(result.sourceVerified, true);
    assert.equal(result.metadata.release_year, 2026);
    assert.deepEqual(result.metadata.isbn_identifiers, ['9781234567897']);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('does not merge the same title when verified creators differ', async () => {
  const admin = new FakeAdmin();
  seedFingerprint(admin, 'provider_a', '1', fingerprint('The Gift', 'Author One'));
  seedFingerprint(admin, 'provider_b', '2', fingerprint('The Gift', 'Author Two'));

  const first = await resolveCanonicalMedia(admin, {
    externalSource: 'provider_a', externalId: '1', mediaType: 'book', title: 'The Gift', creator: 'Author One',
  });
  const second = await resolveCanonicalMedia(admin, {
    externalSource: 'provider_b', externalId: '2', mediaType: 'book', title: 'The Gift', creator: 'Author Two',
  });

  assert.notEqual(second.canonicalMediaId, first.canonicalMediaId);
});

test('does not merge conflicting release years without an authoritative key', async () => {
  const admin = new FakeAdmin();
  seedFingerprint(admin, 'provider_a', '1', fingerprint('Reboot', 'Same Creator', { releaseYear: 2001 }));
  seedFingerprint(admin, 'provider_b', '2', fingerprint('Reboot', 'Same Creator', { releaseYear: 2024 }));

  const first = await resolveCanonicalMedia(admin, {
    externalSource: 'provider_a', externalId: '1', mediaType: 'movie', title: 'Reboot', creator: 'Same Creator', year: 2001,
  });
  const second = await resolveCanonicalMedia(admin, {
    externalSource: 'provider_b', externalId: '2', mediaType: 'movie', title: 'Reboot', creator: 'Same Creator', year: 2024,
  });

  assert.notEqual(second.canonicalMediaId, first.canonicalMediaId);
});

test('unverified metadata remains isolated even when title and creator match', async () => {
  const admin = new FakeAdmin();
  seedFingerprint(admin, 'provider_a', '1', fingerprint('Unknown Work', 'Same Person', { source_verified: false }));
  seedFingerprint(admin, 'provider_b', '2', fingerprint('Unknown Work', 'Same Person', { source_verified: false }));

  const first = await resolveCanonicalMedia(admin, {
    externalSource: 'provider_a', externalId: '1', mediaType: 'book', title: 'Unknown Work', creator: 'Same Person',
  });
  const second = await resolveCanonicalMedia(admin, {
    externalSource: 'provider_b', externalId: '2', mediaType: 'book', title: 'Unknown Work', creator: 'Same Person',
  });

  assert.notEqual(second.canonicalMediaId, first.canonicalMediaId);
});

test('reuses the persisted fingerprint and exact alias during a provider outage', async () => {
  const admin = new FakeAdmin();
  seedFingerprint(admin, 'googlebooks', 'cached-id', fingerprint('Cached Book', 'Known Author', {
    openLibraryWorkId: 'OL123W',
  }));
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error('provider offline'); };
  try {
    const first = await resolveCanonicalMedia(admin, {
      externalSource: 'googlebooks', externalId: 'cached-id', mediaType: 'book', title: 'Cached Book',
    });
    const second = await resolveCanonicalMedia(admin, {
      externalSource: 'googlebooks', externalId: 'cached-id', mediaType: 'book', title: 'Cached Book',
    });
    assert.equal(second.canonicalMediaId, first.canonicalMediaId);
    assert.equal(second.sourceVerified, true);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('refreshes a pre-year fingerprint cache entry after the schema version bump', async () => {
  assert.equal(FINGERPRINT_VERSION, 7);
  const admin = new FakeAdmin();
  seedFingerprint(admin, 'itunes', '123', fingerprint('Old Cached Album', 'Artist'));
  admin.tables.media_fingerprints[0].fingerprint_version = 6;
  let fetches = 0;
  const originalFetch = globalThis.fetch;
  const originalDeno = (globalThis as any).Deno;
  (globalThis as any).Deno = { env: { get: () => null } };
  globalThis.fetch = async () => {
    fetches++;
    return new Response(JSON.stringify({
      results: [{
        collectionName: 'Refreshed Album',
        artistName: 'Artist',
        releaseDate: '2020-04-10T00:00:00Z',
      }],
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };
  try {
    const refreshed = await getOrResolveMediaFingerprint(admin, {
      externalSource: 'itunes',
      externalId: '123',
      mediaType: 'album',
      title: 'Old Cached Album',
    });
    assert.ok(fetches > 0);
    assert.equal(refreshed.source_metadata.release_year, 2020);
    assert.equal(admin.tables.media_fingerprints[0].fingerprint_version, 7);
  } finally {
    globalThis.fetch = originalFetch;
    (globalThis as any).Deno = originalDeno;
  }
});