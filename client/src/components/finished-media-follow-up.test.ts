import assert from "node:assert/strict";
import test, { after } from "node:test";
import { readFileSync } from "node:fs";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { transformSync } from "esbuild";
import { createServer } from "vite";
import { isFinishedList } from "../lib/finished-media-follow-up";

const vite = await createServer({
  cacheDir: "node_modules/.vite-finished-follow-up-test",
  server: { middlewareMode: true, hmr: false },
  appType: "custom",
  optimizeDeps: { noDiscovery: true },
});
after(() => vite.close());
const { FinishedMediaFollowUpContent } = await vite.ssrLoadModule("/src/components/finished-media-follow-up.tsx");
const source = readFileSync("client/src/components/quick-add-list-sheet.tsx", "utf8");
const media = { title: "Fixture movie", mediaType: "movie", externalId: "fixture-id", externalSource: "tmdb" };
const defaultProps = {
  isOpen: true, media, rating: 0, reaction: "", busy: false, error: null,
  onRatingChange() {}, onReactionChange() {}, onSubmit() {}, onClose() {},
};

test("Finished confirmation replaces list selection and puts optional reaction before optional stars", () => {
  const html = renderToStaticMarkup(React.createElement(FinishedMediaFollowUpContent, defaultProps));
  assert.match(html, /Added to Finished/);
  assert.match(html, /Fixture movie/);
  assert.match(html, /What did you think/);
  assert.ok(html.indexOf("finished-reaction") < html.indexOf("Choose a rating"));
  assert.match(html, /optional/);
  assert.match(html, /public and will appear on the feed/);
  assert.match(html, /Not now/);
  assert.doesNotMatch(html, /Want To|Did Not Finish|Favorites|autofocus/);
  assert.match(html, /disabled=""[^>]*>Save rating/);
});

test("reaction-only, rating-only, half-stars, clearing and failure drafts render correctly", () => {
  const reaction = renderToStaticMarkup(React.createElement(FinishedMediaFollowUpContent, {
    ...defaultProps, reaction: "A lasting impression.", error: "Please try again.",
  }));
  assert.match(reaction, /A lasting impression/);
  assert.match(reaction, /role="alert"/);
  assert.match(reaction, /Post reaction/);
  assert.doesNotMatch(reaction, /disabled=""/);
  const rated = renderToStaticMarkup(React.createElement(FinishedMediaFollowUpContent, { ...defaultProps, rating: 4.5 }));
  assert.match(rated, /width:50%/);
  assert.match(rated, /4\.5 out of 5/);
  assert.match(rated, /Clear rating/);
  assert.doesNotMatch(rated, /disabled=""/);
});

test("busy dialog disables text entry, all ten half-star targets, submission and dismissal", () => {
  const html = renderToStaticMarkup(React.createElement(FinishedMediaFollowUpContent, {
    ...defaultProps, busy: true, reaction: "Do not lose this.",
  }));
  assert.match(html, /Do not lose this/);
  assert.match(html, /Saving/);
  assert.equal((html.match(/disabled=""/g) || []).length, 13);
});

function extract(name: string, next: string) {
  const start = source.indexOf(`  const ${name} =`);
  const end = source.indexOf(next, start);
  assert.ok(start > 0 && end > start);
  return transformSync(source.slice(start, end).replaceAll("import.meta.env.VITE_SUPABASE_URL", "'https://example.test'"), { loader: "tsx" }).code;
}
const addCode = extract("handleAddToList", "\n  const handleSubmitRating");
const submitCode = extract("handleSubmitFinishedReaction", "\n  const handleShare");
function bind(code: string, name: string, context: any) {
  return new Function(...Object.keys(context), `${code}; return ${name};`)(...Object.values(context));
}

function addFixture(ok = true) {
  const steps: string[] = [], requests: any[] = [];
  let existingRatingChecks = 0;
  let finishedSnapshot: any;
  const context = {
    session: { access_token: "fixture-token" }, effectiveMedia: media, recommendationToAdd: null,
    isFinishedList, isWantToList: (name: string) => name === "Want To",
    shouldShowFollowUp: (name: string) => name === "Finished" || name === "Favorites",
    hasExistingRating: async () => { existingRatingChecks++; return true; },
    fetchSimilarRecs: async () => false,
    supabase: { auth: { getUser: async () => ({ data: { user: null } }) } },
    queryClient: { invalidateQueries() {} },
    setIsAdding() {}, setAddedItemId() {}, setAddedListName() {}, setAddedListId() {},
    setFinishedMedia(value: any) { finishedSnapshot = value; },
    setFinishedReaction() {}, setFinishedError() {}, setSelectedRating() {}, setAddedRecIds() {},
    setStep(value: string) { steps.push(value); },
    toast() {}, inlineSearchRef: { current: null },
    fetch: async (url: string, init: any) => {
      requests.push({ url, body: JSON.parse(init.body) });
      return Response.json(ok ? { data: { id: "fixture-item" } } : { error: "Save failed" }, { status: ok ? 200 : 500 });
    },
  };
  return { steps, requests, context, get checks() { return existingRatingChecks; }, get snapshot() { return finishedSnapshot; },
    add: bind(addCode, "handleAddToList", context) };
}

test("successful Finished addition opens follow-up exactly once even for an already-rated title", async () => {
  const fixture = addFixture();
  await fixture.add("fixture-list", "Finished");
  assert.deepEqual(fixture.steps, ["finished"]);
  assert.equal(fixture.requests.length, 1);
  assert.match(fixture.requests[0].url, /add-media-to-list$/);
  assert.equal(fixture.checks, 0);
  assert.deepEqual(fixture.snapshot, media);
});

test("other lists retain their old routing and a failed addition never claims Finished", async () => {
  for (const name of ["Currently", "Want To", "Favorites", "Did Not Finish"]) {
    const fixture = addFixture();
    await fixture.add("fixture-list", name);
    assert.deepEqual(fixture.steps, ["just-tracked"]);
    assert.equal(fixture.requests.length, 1);
    assert.equal(fixture.snapshot, undefined);
  }
  const failed = addFixture(false);
  await failed.add("fixture-list", "Finished");
  assert.deepEqual(failed.steps, []);
  assert.equal(failed.snapshot, undefined);
});

test("actual follow-up handler blocks double submits, closes only after success and retains failures", async () => {
  let release!: () => void;
  let calls = 0, closes = 0;
  const errors: any[] = [];
  const guard = { current: false };
  const context = {
    finishedSubmissionRef: guard, finishedMedia: media, selectedRating: 0, finishedReaction: "My draft.",
    session: { access_token: "fixture-token" },
    setIsSubmittingRating() {}, setFinishedError: (error: any) => errors.push(error),
    saveFinishedReaction: async () => { calls++; await new Promise<void>(resolve => { release = resolve; }); },
    queryClient: { invalidateQueries() {} }, handleClose: () => { closes++; },
  };
  const submit = bind(submitCode, "handleSubmitFinishedReaction", context);
  const pending = submit();
  await submit();
  assert.equal(calls, 1);
  assert.equal(closes, 0);
  release();
  await pending;
  assert.equal(closes, 1);
  assert.equal(guard.current, false);
  const failed = bind(submitCode, "handleSubmitFinishedReaction", {
    ...context, saveFinishedReaction: async () => { throw new Error("Please retry."); },
  });
  await failed();
  assert.equal(closes, 1);
  assert.equal(errors.at(-1), "Please retry.");
  assert.equal(context.finishedReaction, "My draft.");
});
