import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import { transformSync } from 'esbuild';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Route, Router, Switch, useLocation, useRoute } from 'wouter';

const appSource = readFileSync(new URL('../App.tsx', import.meta.url), 'utf8');
const detailSource = readFileSync(new URL('../pages/media-detail.tsx', import.meta.url), 'utf8');

// Exercise actual App route declarations and the actual detail-page parameter
// logic without loading auth, querying providers, or creating real user activity.
const mediaRoutes = [...appSource.matchAll(
  /<Route path=(?:"(\/media\/[^"]+)"|\{(\/\^\\\/media\\\/[^\n]+\/i)\})>([\s\S]*?)<\/Route>/g,
)].map(([, path, regex, body]) => ({
  path: path || new RegExp(regex.slice(1, -2), 'i'),
  body,
}));
assert.equal(mediaRoutes.length, 4, 'Review the fixture if media route declarations change');
const start = 'export default function MediaDetail() {';
const end = '  const { session, user } = useAuth();';
assert.ok(detailSource.includes(start) && detailSource.includes(end));
const parameterLogic = detailSource.split(start)[1].split(end)[0];
const resolveParams = vm.runInNewContext(
  transformSync(`(function resolveParams() {${parameterLogic}\nreturn params;})`, {
    loader: 'tsx', format: 'cjs', target: 'es2022',
  }).code,
  {
    // Wouter uses instanceof RegExp; VM regex literals need the host realm.
    useRoute: (pattern: string | RegExp) => useRoute(
      typeof pattern === 'string' ? pattern : new RegExp(pattern.source, pattern.flags),
    ),
    useLocation,
  },
) as () => { type: string; source: string; id: string } | null;

function renderRoute(path: string) {
  let params: ReturnType<typeof resolveParams> = null;
  let passedGate = false;
  function IdentityGateFixture() {
    passedGate = true;
    return createElement(DetailFixture);
  }
  function DetailFixture() {
    params = resolveParams();
    return createElement('div', null, 'media details');
  }
  const markup = renderToStaticMarkup(createElement(
    Router,
    { hook: () => [path, () => {}] },
    createElement(Switch, null,
      ...mediaRoutes.map(({ path: route, body }) => {
        assert.match(body, /^\s*<IdentityAwareRoute>\s*<MediaDetail\s*\/>\s*<\/IdentityAwareRoute>\s*$/,
          'Every media route must retain the existing identity gate');
        return createElement(Route, { key: String(route), path: route },
          createElement(IdentityGateFixture));
      }),
      createElement(Route, null, createElement('div', null, 'not found')),
    ),
  ));
  // Compare only the application identity, not Wouter's numeric capture keys.
  const identity = params as ReturnType<typeof resolveParams>;
  return { markup, passedGate, params: identity ? {
    type: identity.type, source: identity.source, id: identity.id,
  } : null };
}

test('leading-slash Open Library work links reach details and preserve the exact saved ID', () => {
  for (const source of ['openlibrary', 'open_library']) {
    const result = renderRoute(`/media/book/${source}//works/OL28724425W`);
    assert.equal(result.markup, '<div>media details</div>');
    assert.equal(result.passedGate, true);
    assert.deepEqual(result.params, { type: 'book', source, id: '/works/OL28724425W' });
  }
});

test('both existing Open Library work forms keep their exact route parameters', () => {
  for (const source of ['openlibrary', 'open_library']) {
    for (const id of ['OL28724425W', 'works/OL28724425W']) {
      const result = renderRoute(`/media/book/${source}/${id}`);
      assert.equal(result.passedGate, true);
      assert.deepEqual(result.params, { type: 'book', source, id });
    }
  }
});

test('movie, TV, Google Books and ISBN route parameters are unchanged', () => {
  for (const [type, source, id] of [
    ['movie', 'tmdb', '1083381'],
    ['tv', 'tmdb', '60554'],
    ['book', 'googlebooks', 'a5RBDwAAQBAJ'],
    ['book', 'openlibrary', '9780804139021'],
  ]) {
    const result = renderRoute(`/media/${type}/${source}/${id}`);
    assert.equal(result.passedGate, true);
    assert.deepEqual(result.params, { type, source, id });
  }
});

test('compatibility does not accept double slashes for unrelated providers, types or prefixes', () => {
  for (const path of [
    '/media/movie/tmdb//works/1083381',
    '/media/book/googlebooks//works/a5RBDwAAQBAJ',
    '/media/movie/openlibrary//works/OL28724425W',
    '/media/book/openlibrary//authors/OL123A',
    '/media/book/openlibrary///works/OL28724425W',
    '/media/book/openlibrary//works/OL28724425W/extra',
  ]) {
    const result = renderRoute(path);
    assert.equal(result.markup, '<div>not found</div>', path);
    assert.equal(result.passedGate, false, path);
    assert.equal(result.params, null, path);
  }
});

test('the existing details request delivers the preserved work ID to the lookup unchanged', () => {
  const requestTemplate = detailSource.match(
    /`(https:\/\/mahpgcogwpawvviapqza\.supabase\.co\/functions\/v1\/get-media-details\?[^`]+)`/,
  )?.[1];
  assert.ok(requestTemplate, 'Expected the actual details request URL template');
  for (const source of ['openlibrary', 'open_library']) {
    for (const id of ['OL28724425W', 'works/OL28724425W', '/works/OL28724425W']) {
      const { params } = renderRoute(`/media/book/${source}/${id}`);
      assert.ok(params);
      const requestUrl = new URL(requestTemplate.replace(
        /\$\{params\?\.(source|id|type)\}/g, (_, key) => params[key],
      ));
      assert.equal(requestUrl.searchParams.get('external_id'), id);
      assert.equal(requestUrl.searchParams.get('source'), source);
      assert.equal(requestUrl.searchParams.get('media_type'), 'book');
    }
  }
});
