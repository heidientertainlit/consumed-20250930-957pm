import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import { transformSync } from 'esbuild';

const handlerSource = readFileSync(new URL('../get-media-details/index.ts', import.meta.url), 'utf8');
const fixedExpression = "externalId.replace(/^\\/?works\\//, '')";
const oldExpression = "externalId.replace(/^works\\//, '')";
const workId = 'OL28724425W';
const isbn = '9780804139021';
const fixtureWork = {
  title: 'Backrooms',
  authors: [{ author: { key: '/authors/OL123A' } }],
  description: 'Fixture book description',
  covers: [123],
  subjects: ['Horror'],
  first_publish_date: '2022',
};
const fixtureVolume = {
  volumeInfo: {
    title: 'Fixture Google Book',
    authors: ['Fixture Author'],
    imageLinks: { thumbnail: 'https://example.test/cover.jpg' },
    description: 'Fixture description',
    publishedDate: '2020',
  },
};

type Handler = (request: Request) => Promise<Response>;

/**
 * Execute the real handler, not a reimplementation of its ID parsing.
 * The unused remote SDK import is removed only in this isolated VM. Every
 * provider request is intercepted; unexpected calls fail the test. No real
 * environment values, network calls, Supabase clients, or writes are available.
 */
function fixture(options: { legacy?: boolean; missingWork?: boolean; isbnFallback?: boolean } = {}) {
  assert.ok(handlerSource.includes(fixedExpression), 'Expected the approved prefix-only change');
  let source = options.legacy
    ? handlerSource.replace(fixedExpression, oldExpression)
    : handlerSource;
  const sdkImport = /import \{ createClient \} from 'https:\/\/esm\.sh\/@supabase\/supabase-js@2';/;
  assert.match(source, sdkImport);
  source = source.replace(sdkImport, '');
  let handler: Handler | undefined;
  const calls: string[] = [];
  const failures: string[] = [];
  const json = (body: unknown, status = 200) => Response.json(body, { status });
  const context = {
    URL, Request, Response,
    console: { log() {}, error() {} },
    Deno: {
      env: { get: (key: string) => key === 'TMDB_API_KEY' ? 'fixture-key-not-a-secret' : undefined },
      serve: (callback: Handler) => { handler = callback; },
    },
    createClient: () => { throw new Error('Database access is forbidden in lookup tests'); },
    fetch: async (input: string | URL | Request, init?: RequestInit) => {
      const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
      calls.push(url.href);
      if (init?.method && init.method !== 'GET') {
        failures.push(`Unexpected method: ${init.method}`);
        throw new Error(failures.at(-1));
      }
      if (url.origin === 'https://openlibrary.org') {
        if (url.pathname === `/works/${workId}.json`) return options.missingWork
          ? json({ error: 'notfound' }, 404) : json(fixtureWork);
        // Reproduce the provider's rejection of the old malformed address.
        if (url.pathname === `/works//works/${workId}.json`) return json({ error: 'notfound' }, 404);
        if (url.pathname === '/authors/OL123A.json') return json({ name: 'Michael Schuerman' });
        if (url.pathname === `/isbn/${isbn}.json`) return json({ works: [{ key: `/works/${workId}` }] });
        if (url.pathname === '/works/OL000W.json' || url.pathname === '/works/series-harry-potter.json') {
          return json({ error: 'notfound' }, 404);
        }
      }
      if (url.origin === 'https://www.googleapis.com') {
        if (url.pathname === '/books/v1/volumes/fixture-volume') return json(fixtureVolume);
        if (url.pathname === '/books/v1/volumes') {
          if (url.searchParams.get('q') === `isbn:${isbn}` && !options.isbnFallback) {
            return json({ items: [fixtureVolume] });
          }
          // Existing optional community-rating lookup; no title rescue fixture.
          if (url.searchParams.get('q')?.startsWith('intitle:') || options.isbnFallback) {
            return json({ items: [] });
          }
        }
      }
      if (url.origin === 'https://api.themoviedb.org' &&
        ['/3/movie/1083381', '/3/tv/123'].includes(url.pathname)) {
        return json({
          ...(url.pathname.includes('/movie/') ? { title: 'Fixture Movie' } : { name: 'Fixture TV' }),
          overview: 'Fixture overview', genres: [], credits: { crew: [], cast: [] },
        });
      }
      failures.push(`Unexpected provider request: ${url.href}`);
      throw new Error(failures.at(-1));
    },
  };
  vm.runInNewContext(transformSync(source, { loader: 'ts', format: 'iife', target: 'es2022' }).code, context);
  assert.ok(handler, 'The actual Deno handler must register');
  return {
    calls,
    async request(id: string, provider = 'openlibrary', type = 'book') {
      const url = new URL('https://fixture.test/get-media-details');
      url.searchParams.set('source', provider);
      url.searchParams.set('external_id', id);
      url.searchParams.set('media_type', type);
      const response = await handler!(new Request(url));
      assert.deepEqual(failures, [], 'No unapproved provider calls or writes');
      return { status: response.status, body: await response.json() };
    },
  };
}

test('leading-slash work key reproduces the old 404 and succeeds after the prefix-only change', async () => {
  const old = fixture({ legacy: true });
  assert.equal((await old.request(`/works/${workId}`)).status, 404);
  assert.deepEqual(old.calls, [`https://openlibrary.org/works//works/${workId}.json`]);
  const fixed = fixture();
  const result = await fixed.request(`/works/${workId}`);
  assert.equal(result.status, 200);
  assert.equal(result.body.title, 'Backrooms');
  assert.equal(fixed.calls[0], `https://openlibrary.org/works/${workId}.json`);
});

test('all three work forms and both Open Library provider names fetch the same book', async () => {
  for (const provider of ['openlibrary', 'open_library']) {
    for (const id of [workId, `works/${workId}`, `/works/${workId}`]) {
      const app = fixture();
      const result = await app.request(id, provider);
      assert.equal(result.status, 200);
      assert.equal(result.body.title, 'Backrooms');
      assert.equal(result.body.creator, 'Michael Schuerman');
      assert.equal(app.calls[0], `https://openlibrary.org/works/${workId}.json`);
      // Incoming ID is not globally rewritten. Existing output links stay as-is;
      // link compatibility is a separate, unapproved step.
      assert.equal(result.body.platforms.find((p: any) => p.name === 'Open Library').url,
        `https://openlibrary.org/works/${id}`);
    }
  }
});

test('previously working forms, ISBN, Google Books, movie and TV behavior remain unchanged', async () => {
  for (const [id, provider, type] of [
    [workId, 'openlibrary', 'book'],
    [`works/${workId}`, 'openlibrary', 'book'],
    [isbn, 'openlibrary', 'book'],
    ['fixture-volume', 'googlebooks', 'book'],
    ['1083381', 'tmdb', 'movie'],
    ['123', 'tmdb', 'tv'],
  ]) {
    const old = fixture({ legacy: true });
    const fixed = fixture();
    const before = await old.request(id, provider, type);
    const after = await fixed.request(id, provider, type);
    assert.equal(after.status, 200, `${provider}/${id} fixture must succeed`);
    assert.deepEqual(after, before, `${provider}/${id} response changed`);
    assert.deepEqual(fixed.calls, old.calls, `${provider}/${id} provider requests changed`);
  }
});

test('ISBN fallback to an Open Library work retains its existing requests and response', async () => {
  const old = fixture({ legacy: true, isbnFallback: true });
  const fixed = fixture({ isbnFallback: true });
  const before = await old.request(isbn);
  const after = await fixed.request(isbn);
  assert.equal(after.status, 200);
  assert.deepEqual(after, before);
  assert.deepEqual(fixed.calls, old.calls);
  assert.ok(fixed.calls.includes(`https://openlibrary.org/isbn/${isbn}.json`));
});

test('a missing work stays 404 without title-based substitution', async () => {
  const app = fixture({ missingWork: true });
  const result = await app.request(`/works/${workId}`);
  assert.equal(result.status, 404);
  assert.equal(result.body.error, 'Media not found');
  assert.deepEqual(app.calls, [`https://openlibrary.org/works/${workId}.json`]);
});

test('invalid series placeholders are not reinterpreted as another work', async () => {
  const app = fixture();
  assert.equal((await app.request('series-harry-potter')).status, 404);
  assert.deepEqual(app.calls, ['https://openlibrary.org/works/series-harry-potter.json']);
});

test('missing ID is still rejected before any provider request', async () => {
  const app = fixture();
  assert.equal((await app.request('')).status, 400);
  assert.deepEqual(app.calls, []);
});
