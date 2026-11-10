import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { transformSync } from "esbuild";
import { MediaDetailTabs, MediaTakeInput, MediaTakesHeading } from "./media-detail-social-header";

test("rounded Takes/Play tabs reflect selection and connect to the real panels", () => {
  for (const value of ["takes", "play"] as const) {
    const html = renderToStaticMarkup(React.createElement(MediaDetailTabs, { value, onChange() {} }));
    assert.match(html, /role="tablist"/);
    assert.equal((html.match(/role="tab"/g) || []).length, 2);
    assert.equal((html.match(/aria-selected="true"/g) || []).length, 1);
    assert.match(html, new RegExp(`id="media-tab-${value}" aria-selected="true"`));
    assert.match(html, /aria-controls="media-panel-takes"/);
    assert.match(html, /aria-controls="media-panel-play"/);
    assert.match(html, /rounded-full/);
    assert.match(html, /lucide-message-circle/);
    assert.match(html, /lucide-gamepad2/);
  }
});

test("What people are saying uses the supplied real count, including zero and singular", () => {
  for (const [count, expected] of [[0, "0 takes"], [1, "1 take"], [42, "42 takes"], [1200, "1.2K takes"]] as const) {
    const html = renderToStaticMarkup(React.createElement(MediaTakesHeading, { count }));
    assert.match(html, /What people are saying/);
    assert.ok(html.includes(expected), `Expected real count ${expected}`);
  }
});

const inputProps = {
  value: "",
  onChange() {},
  onSubmit() {},
  posting: false,
  canPost: true,
  onRequireSignIn() {},
  avatarUrl: "/avatar.png",
  avatarLabel: "Alex",
};

test("compact composer uses a send icon, real textarea, and disables empty or pending submissions", () => {
  for (const [value, posting, disabled] of [["", false, true], ["  ", false, true], ["My take", false, false], ["My take", true, true]] as const) {
    const html = renderToStaticMarkup(React.createElement(MediaTakeInput, { ...inputProps, value, posting }));
    assert.match(html, /<form/);
    assert.match(html, /<textarea/);
    assert.match(html, /placeholder="Add your take…"/);
    assert.match(html, /src="\/avatar.png"/);
    assert.match(html, /lucide-send/);
    assert.doesNotMatch(html, /lucide-plus/);
    const send = html.match(/<button[^>]*data-testid="button-send-take"[^>]*>/)?.[0];
    assert.ok(send);
    assert.equal(send.includes('disabled=""'), disabled);
    assert.match(send, /aria-label="Post your take"/);
  }
});

test("guest composer keeps the same appearance but requires sign-in instead of accepting text", () => {
  const html = renderToStaticMarkup(React.createElement(MediaTakeInput, { ...inputProps, canPost: false }));
  assert.match(html, /Sign in to add your take/);
  assert.match(html, /Add your take…/);
  assert.match(html, /lucide-send/);
  assert.doesNotMatch(html, /<textarea|<form/);
});

// Execute the page's actual submit handler against in-memory dependencies.
// This exercises success, failure, and in-flight behavior without publishing
// test content or modifying production auth, data, or the handler itself.
function makePostingFixture(options: { fail?: boolean; rating?: number; hold?: boolean } = {}) {
  const source = readFileSync("client/src/pages/media-detail.tsx", "utf8");
  const start = source.indexOf("const handleComposePost = async");
  const end = source.indexOf("const handleAddMediaToList", start);
  assert.ok(start >= 0 && end > start);
  const code = transformSync(source.slice(start, end), {
    loader: "ts",
    format: "cjs",
    define: { "import.meta.env": JSON.stringify({ VITE_SUPABASE_URL: "https://example.invalid" }) },
  }).code;
  const posts: any[] = [];
  const ratings: any[] = [];
  const drafts: string[] = [];
  const notifications: any[] = [];
  const invalidations: any[] = [];
  let release: (() => void) | undefined;
  const pending = options.hold ? new Promise<void>((resolve) => { release = resolve; }) : Promise.resolve();
  const context = {
    session: { access_token: "test-only-token" },
    mediaItem: { title: "Test title", type: "tv" },
    composePostingRef: { current: false },
    composeRating: options.rating || 0,
    composeSelectedList: null,
    composePredictionOptions: ["", ""],
    params: { id: "120911", source: "tmdb", type: "tv" },
    canonicalMediaId: "test-canonical-media",
    resolvedImageUrl: "/poster.png",
    supabase: {
      auth: { getUser: async () => ({ data: { user: { id: "test-author" } } }) },
      from(table: string) {
        return {
          async insert(data: any) {
            assert.equal(table, "social_posts");
            posts.push(data);
            await pending;
            return { error: options.fail ? new Error("Write rejected") : null };
          },
          async upsert(data: any) {
            assert.equal(table, "media_ratings");
            ratings.push(data);
            return { error: null };
          },
        };
      },
    },
    queryClient: { invalidateQueries: (key: any) => invalidations.push(key) },
    toast: (notification: any) => notifications.push(notification),
    setCommentPrompt: (value: string) => drafts.push(value),
    setIsComposePosting() {},
    setComposeRating() {},
    setComposeHoverRating() {},
    setComposeSelectedList() {},
    setComposePredictionOptions() {},
    setComposerOpen() {},
    console: { error() {} },
  };
  const submit = new Function(...Object.keys(context), `${code}; return handleComposePost;`)(...Object.values(context));
  return { submit, posts, ratings, drafts, notifications, invalidations, context, release };
}

test("a plain take posts without a star rating and refreshes the media's real takes", async () => {
  const fixture = makePostingFixture();
  assert.equal(await fixture.submit({ title: "", body: "  My take  ", tag: "rate" }), true);
  assert.equal(fixture.posts.length, 1);
  assert.equal(fixture.posts[0].content, "My take");
  assert.equal(fixture.posts[0].rating, null);
  assert.equal(fixture.posts[0].post_type, "thought");
  assert.equal(fixture.posts[0].canonical_media_id, "test-canonical-media");
  assert.equal(fixture.posts[0].media_external_id, "120911");
  assert.equal(fixture.ratings.length, 0);
  assert.deepEqual(fixture.drafts, [""]);
  assert.ok(fixture.invalidations.some(({ queryKey }) => queryKey[0] === "media-social-activity"));
});

test("a rejected post keeps the draft, shows failure, and releases the posting lock", async () => {
  const fixture = makePostingFixture({ fail: true });
  assert.equal(await fixture.submit({ title: "", body: "Keep this draft", tag: "rate" }), false);
  assert.deepEqual(fixture.drafts, []);
  assert.equal(fixture.invalidations.length, 0);
  assert.equal(fixture.notifications[0].title, "Couldn't post");
  assert.equal(fixture.context.composePostingRef.current, false);
});

test("in-flight duplicate submissions are rejected and existing rating-only posts still work", async () => {
  const fixture = makePostingFixture({ hold: true });
  const first = fixture.submit({ title: "", body: "Only once", tag: "rate" });
  assert.equal(await fixture.submit({ title: "", body: "Only once", tag: "rate" }), false);
  fixture.release!();
  assert.equal(await first, true);
  assert.equal(fixture.posts.length, 1);
  const rated = makePostingFixture({ rating: 4.5 });
  assert.equal(await rated.submit({ title: "", body: "", tag: "rate" }), true);
  assert.equal(rated.posts[0].rating, 4.5);
  assert.equal(rated.ratings[0].rating, 4.5);
});

test("the real media page wires the compact composer, real counts, and both tab panels", () => {
  const source = readFileSync("client/src/pages/media-detail.tsx", "utf8");
  assert.match(source, /<MediaDetailTabs value=\{mediaTab\} onChange=\{setMediaTab\}/);
  assert.match(source, /<MediaTakesHeading count=\{mergedTakes\.length\}/);
  assert.match(source, /onSubmit=\{\(\) => handleComposePost\(\{ title: "", body: commentPrompt, tag: "rate" \}\)\}/);
  assert.match(source, /id="media-panel-play"/);
  assert.match(source, /id="media-panel-takes"/);
  assert.match(source, /onBodyChange=\{setCommentPrompt\}/);
  assert.doesNotMatch(source, /Start a conversation<\/h2>/);
});
