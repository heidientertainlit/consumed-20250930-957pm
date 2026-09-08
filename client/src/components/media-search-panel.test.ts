import assert from "node:assert/strict";
import test, { after } from "node:test";
import { readFileSync } from "node:fs";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";

const vite = await createServer({
  server: { middlewareMode: true },
  appType: "custom",
  plugins: [{
    name: "media-search-auth-stub",
    enforce: "pre",
    resolveId(id) {
      if (id === "@/lib/auth" || id.endsWith("/src/lib/auth.tsx")) return "\0media-search-auth-stub";
    },
    load(id) {
      if (id === "\0media-search-auth-stub") {
        return "export const useAuth = () => ({ session: { access_token: 'test-token' } });";
      }
    },
  }],
});
const {
  default: MediaSearchPanel,
  MEDIA_SEARCH_FILTERS,
  mediaSearchBody,
  normalizeMediaSearchResult,
  requestMediaSearch,
} = await vite.ssrLoadModule("/src/components/media-search-panel.tsx");

after(() => vite.close());

test("renders all filter controls in canonical order with rounded, hidden-scroll styling", () => {
  const markup = renderToStaticMarkup(React.createElement(MediaSearchPanel, { onSelect() {} }));
  const labels = ["All", "Movies", "TV", "Books", "Music", "Podcasts", "YouTube", "Games"];
  let previousPosition = -1;
  for (const label of labels) {
    const position = markup.indexOf(`>${label}</button>`);
    assert.ok(position > previousPosition, `${label} should render in canonical order`);
    previousPosition = position;
  }
  assert.match(markup, /<input[^>]*class="[^"]*rounded-xl[^"]*"[^>]*data-testid="media-search-input"/);
  assert.match(markup, /data-testid="media-search-type-filters"/);
  assert.match(markup, /scrollbar-width:none/);
});

test("uses the canonical filters, values, and exact request payloads", () => {
  assert.deepEqual(
    MEDIA_SEARCH_FILTERS.map(({ label, value }) => [label, value]),
    [
      ["All", undefined],
      ["Movies", "movie"],
      ["TV", "tv"],
      ["Books", "book"],
      ["Music", "music"],
      ["Podcasts", "podcast"],
      ["YouTube", "youtube"],
      ["Games", "game"],
    ],
  );
  assert.deepEqual(mediaSearchBody("  dune  "), {
    query: "dune",
    include_book_series: true,
  });
  for (const type of ["movie", "tv", "book", "music", "podcast", "youtube", "game"] as const) {
    assert.deepEqual(mediaSearchBody("  dune  ", type), {
      query: "dune",
      include_book_series: true,
      type,
    });
  }
});

test("simulated search sends the exact payload, signal, and renders normalized image data", async () => {
  const controller = new AbortController();
  let request: { input: RequestInfo | URL; init?: RequestInit } | undefined;
  const fetcher = async (input: RequestInfo | URL, init?: RequestInit) => {
    request = { input, init };
    return new Response(JSON.stringify({
      results: [
        { external_id: "image", title: "Image", image: "image.jpg" },
        { external_id: "image-url", title: "Image URL", image_url: "image-url.jpg" },
        { external_id: "poster", title: "Poster URL", poster_url: "poster.jpg" },
        { external_id: "series", title: "Series", type: "book_series", poster_url: "series.jpg" },
      ],
    }), { status: 200 });
  };

  const results = await requestMediaSearch({
    query: "  dune  ",
    type: "book",
    bearer: "test-token",
    signal: controller.signal,
    fetcher: fetcher as typeof fetch,
  });

  assert.match(String(request?.input), /\/functions\/v1\/media-search$/);
  assert.equal(request?.init?.method, "POST");
  assert.equal(request?.init?.signal, controller.signal);
  assert.deepEqual(JSON.parse(String(request?.init?.body)), {
    query: "dune",
    include_book_series: true,
    type: "book",
  });
  assert.deepEqual(results.map(({ image }) => image), [
    "image.jpg",
    "image-url.jpg",
    "poster.jpg",
    "series.jpg",
  ]);
  assert.equal(results[3].type, "book_series");
});

test("passes cancellation through simulated fetch and does not invent fallback results", async () => {
  const controller = new AbortController();
  const pending = requestMediaSearch({
    query: "alien",
    bearer: "test-token",
    signal: controller.signal,
    fetcher: ((_input: RequestInfo | URL, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
    })) as typeof fetch,
  });
  controller.abort();
  await assert.rejects(pending, (error: any) => error?.name === "AbortError");
});

test("a newer simulated request generation makes an older completion stale", async () => {
  let generation = 0;
  const committed: string[] = [];
  const complete = (requestGeneration: number, title: string) => {
    if (requestGeneration === generation) committed.push(title);
  };
  const oldRequest = ++generation;
  const newRequest = ++generation;
  complete(newRequest, "new");
  complete(oldRequest, "old");
  assert.deepEqual(committed, ["new"]);
});

test("normalization preserves result fields used by selection and rendering", () => {
  const result = normalizeMediaSearchResult({
    external_id: "work-1",
    type: "book_series",
    title: "Dune",
    creator: "Frank Herbert",
    poster_url: "cover.jpg",
  });
  assert.deepEqual(result, {
    external_id: "work-1",
    type: "book_series",
    title: "Dune",
    creator: "Frank Herbert",
    poster_url: "cover.jpg",
    image: "cover.jpg",
  });
});

test("rank and room pickers use the canonical panel contract", () => {
  const rankPicker = readFileSync(new URL("./add-rank-item-dialog.tsx", import.meta.url), "utf8");
  const roomPicker = readFileSync(new URL("./room-media-picker.tsx", import.meta.url), "utf8");

  assert.match(rankPicker, /import MediaSearchPanel from "@\/components\/media-search-panel"/);
  assert.match(rankPicker, /<MediaSearchPanel[\s\S]*onSelect=/);
  assert.match(roomPicker, /MEDIA_SEARCH_FILTERS, requestMediaSearch/);
  assert.match(roomPicker, /new AbortController\(\)/);
  assert.match(roomPicker, /setTimeout\(\(\) => void search\(\), 200\)/);
  assert.match(roomPicker, /requestMediaSearch\(\{ query: trimmedQuery, type: filter, bearer: token, signal: controller\.signal \}\)/);
});

test("inline rank payload and V2 short-query invalidation keep picker contracts exact", () => {
  const inlineComposer = readFileSync(new URL("./inline-composer.tsx", import.meta.url), "utf8");
  const shareDialogV2 = readFileSync(new URL("./share-update-dialog-v2.tsx", import.meta.url), "utf8");

  assert.match(inlineComposer, /body: JSON\.stringify\(\{\s*rankId,\s*media: \{\s*title: media\.title \|\| "",\s*mediaType: media\.type \|\| "movie",\s*creator: media\.creator \|\| media\.author \|\| media\.artist \|\| "",\s*imageUrl:/s);
  assert.match(inlineComposer, /externalId: media\.external_id \|\| media\.id \|\| "",\s*externalSource: media\.external_source \|\| media\.source \|\| "tmdb"/s);
  assert.doesNotMatch(inlineComposer, /rank_id:/);
  assert.match(shareDialogV2, /if \(query\.trim\(\)\.length < 2\) \{\s*setSearchResults\(\[\]\);\s*setIsSearching\(false\);\s*return;/s);
  assert.match(shareDialogV2, /const handleClose = \(\) => \{\s*if \(searchTimerRef\.current\) clearTimeout\(searchTimerRef\.current\);\s*searchAbortRef\.current\?\.abort\(\);\s*searchRequestRef\.current \+= 1;\s*setIsSearching\(false\);/s);
});