import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import { transformSync } from 'esbuild';

const source = readFileSync(new URL('../get-media-details/index.ts', import.meta.url), 'utf8')
  .replace(/import \{ createClient \} from 'https:\/\/esm\.sh\/@supabase\/supabase-js@2';/, '');
const dutchId = 'vGM1EQAAQBAJ';
const englishId = 'Vir4zgEACAAJ';
const original = {
  title: 'Bodyguard',
  authors: ['Katherine Center'],
  language: 'nl',
  description: '<p>Dutch fixture synopsis.</p>',
  imageLinks: { thumbnail: 'http://example.test/dutch-cover.jpg' },
  publishedDate: '2025-04-03',
  publisher: 'VBK Media',
  pageCount: 320,
  industryIdentifiers: [{ type: 'ISBN_13', identifier: '9789029738170' }],
};
const counterpart = {
  id: englishId,
  volumeInfo: {
    title: 'The Bodyguard',
    authors: ['Katherine Center'],
    language: 'en',
    description: '<p>English fixture synopsis with <b>verified identity</b>.</p>',
  },
};

async function run(options: {
  id?: string;
  original?: Record<string, unknown>;
  counterpart?: unknown;
  status?: number;
  throws?: boolean;
} = {}) {
  let handler: ((req: Request) => Promise<Response>) | undefined;
  const calls: string[] = [];
  const warnings: string[] = [];
  const unexpected: string[] = [];
  const context = {
    URL, Request, Response, AbortSignal,
    console: { log() {}, error() {}, warn: (message: string) => warnings.push(message) },
    Deno: {
      env: { get: () => undefined },
      serve: (callback: typeof handler) => { handler = callback; },
    },
    createClient: () => { throw new Error('No database access is allowed'); },
    fetch: async (input: string, init?: RequestInit) => {
      const url = new URL(input);
      calls.push(url.href);
      assert.ok(!init?.method || init.method === 'GET');
      if (url.origin === 'https://www.googleapis.com' &&
          url.pathname === `/books/v1/volumes/${options.id || dutchId}`) {
        return Response.json({ id: options.id || dutchId, volumeInfo: { ...original, ...options.original } });
      }
      if (url.origin === 'https://www.googleapis.com' &&
          url.pathname === `/books/v1/volumes/${englishId}`) {
        assert.ok(init?.signal, 'Counterpart fetch must have a bounded timeout');
        if (options.throws) throw new Error('Fixture provider unavailable');
        return Response.json(options.counterpart ?? counterpart, { status: options.status ?? 200 });
      }
      unexpected.push(url.href);
      throw new Error('Unexpected external request');
    },
  };
  vm.runInNewContext(transformSync(source, { loader: 'ts', format: 'cjs' }).code, context);
  assert.ok(handler);
  const response = await handler(new Request(
    `https://fixture.test/details?source=googlebooks&external_id=${options.id || dutchId}&media_type=book`,
  ));
  assert.deepEqual(unexpected, []);
  assert.equal(response.status, 200);
  return { body: await response.json(), calls, warnings };
}

test('only The Bodyguard synopsis changes; original edition metadata is preserved', async () => {
  const { body, calls, warnings } = await run();
  assert.equal(body.description, 'English fixture synopsis with verified identity .');
  assert.equal(body.title, original.title);
  assert.equal(body.creator, original.authors[0]);
  assert.equal(body.language, 'nl');
  assert.equal(body.publisher, original.publisher);
  assert.equal(body.releaseDate, original.publishedDate);
  assert.equal(body.isbn, original.industryIdentifiers[0].identifier);
  assert.equal(body.artwork, 'https://example.test/dutch-cover.jpg');
  assert.equal(body.pageCount, original.pageCount);
  assert.equal(calls.length, 2);
  assert.deepEqual(warnings, []);
});

test('unrelated books are unchanged and never request the correction', async () => {
  const { body, calls } = await run({ id: 'unrelated-volume' });
  assert.equal(body.description, 'Dutch fixture synopsis.');
  assert.equal(calls.length, 1);
});

test('even the targeted ID is untouched if its original identity or language changes', async () => {
  for (const metadata of [
    { title: 'A Different Book' },
    { authors: ['A Different Author'] },
    { language: 'en' },
  ]) {
    const { body, calls } = await run({ original: metadata });
    assert.equal(body.description, 'Dutch fixture synopsis.');
    assert.equal(calls.length, 1);
  }
});

test('reject wrong counterpart identity, language, or missing English synopsis', async () => {
  for (const value of [
    { ...counterpart, id: 'different-id' },
    { ...counterpart, volumeInfo: { ...counterpart.volumeInfo, title: 'A Different Book' } },
    { ...counterpart, volumeInfo: { ...counterpart.volumeInfo, authors: ['A Different Author'] } },
    { ...counterpart, volumeInfo: { ...counterpart.volumeInfo, language: 'de' } },
    { ...counterpart, volumeInfo: { ...counterpart.volumeInfo, description: '' } },
  ]) {
    const { body, warnings } = await run({ counterpart: value });
    assert.equal(body.description, 'Dutch fixture synopsis.');
    assert.equal(warnings.length, 1);
  }
});

test('upstream errors retain the existing book page and log an explicit warning', async () => {
  for (const options of [{ status: 429 }, { throws: true }]) {
    const { body, warnings } = await run(options);
    assert.equal(body.description, 'Dutch fixture synopsis.');
    assert.equal(warnings.length, 1);
  }
});
