import assert from "node:assert/strict";
import test, { after } from "node:test";
import { readFileSync } from "node:fs";
import React from "react";
import * as icons from "lucide-react";
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
const { FinishedMediaFollowUpContent, finishedMediaTypeLabel } = await vite.ssrLoadModule("/src/components/finished-media-follow-up.tsx");
const source = readFileSync("client/src/components/quick-add-list-sheet.tsx", "utf8");
const media = { title: "Fixture movie", mediaType: "movie", externalId: "fixture-id", externalSource: "tmdb" };
const defaultProps = {
  isOpen: true, media, rating: 0, reaction: "", busy: false, error: null,
  onRatingChange() {}, onReactionChange() {}, onSubmit() {}, onClose() {},
};

test("follow-up matches the original logging form with Finished marked and both fields optional", () => {
  const html = renderToStaticMarkup(React.createElement(FinishedMediaFollowUpContent, defaultProps));
  assert.match(html, /Already saved to Finished/);
  assert.match(html, /Fixture movie/);
  assert.match(html, /What would you rate it/);
  assert.ok(html.indexOf("What would you rate it") < html.indexOf('id="finished-reaction"'));
  assert.match(html, /Rating and reaction are optional/);
  assert.match(html, /public and may appear on the feed/);
  assert.match(html, /Not now/);
  assert.match(html, /Want To/);
  assert.match(html, /Did Not Finish/);
  assert.match(html, /Favorites/);
  assert.match(html, /Finished, already saved[^"]*" aria-pressed="true"/);
  assert.match(html, /aria-label="Close"/);
  assert.doesNotMatch(html, /What did you think\?|What stayed with you|Save rating|autofocus/);
  assert.match(html, />Save<\/button>/);
  assert.equal((html.match(/disabled=""/g) || []).length, 5);
});

test("reaction-only, rating-only, half-stars, clearing and failure drafts render correctly", () => {
  const reaction = renderToStaticMarkup(React.createElement(FinishedMediaFollowUpContent, {
    ...defaultProps, reaction: "A lasting impression.", error: "Please try again.",
  }));
  assert.match(reaction, /A lasting impression/);
  assert.match(reaction, /role="alert"/);
  assert.match(reaction, />Save<\/button>/);
  assert.equal((reaction.match(/disabled=""/g) || []).length, 5);
  const rated = renderToStaticMarkup(React.createElement(FinishedMediaFollowUpContent, { ...defaultProps, rating: 4.5 }));
  assert.match(rated, /width:50%/);
  assert.match(rated, /4\.5 out of 5/);
  assert.match(rated, />Clear<\/button>/);
  assert.equal((rated.match(/disabled=""/g) || []).length, 5);
});

test("busy dialog disables text entry, all ten half-star targets, submission and dismissal", () => {
  const html = renderToStaticMarkup(React.createElement(FinishedMediaFollowUpContent, {
    ...defaultProps, busy: true, reaction: "Do not lose this.",
  }));
  assert.match(html, /Do not lose this/);
  assert.match(html, /Saving/);
  assert.equal((html.match(/disabled=""/g) || []).length, 19);
});

test("TV labels stay uppercase for provider aliases; book series and YouTube retain their names", () => {
  for (const type of ["tv", "TV", "Tv", "TV show", "tv_show", "tv series", "television"]) {
    assert.equal(finishedMediaTypeLabel(type), "TV Series");
  }
  assert.equal(finishedMediaTypeLabel("book_series"), "Book Series");
  assert.equal(finishedMediaTypeLabel("youtube"), "YouTube");
});

test("the actual Save handler skips empty optional fields and respects the busy guard", () => {
  const uiSource = readFileSync("client/src/components/finished-media-follow-up.tsx", "utf8");
  const content = uiSource.slice(uiSource.indexOf("const LIST_CHOICES"), uiSource.indexOf("export function FinishedMediaFollowUp("));
  const code = transformSync(content.replaceAll("export function", "function"), {
    loader: "tsx", jsxFactory: "React.createElement",
  }).code;
  const bindings = {
    React, ...icons,
    useRef: () => ({ current: null }),
    useState: (initial: any) => [initial, () => {}],
  };
  const entries = Object.entries(bindings).filter(([name]) => name !== "default");
  const render = new Function(...entries.map(([name]) => name), `${code};return FinishedMediaFollowUpContent;`)(...entries.map(([, value]) => value));
  const findSave = (node: any): any => {
    if (!node || typeof node !== "object") return null;
    if (node.type === "button" && ["Save", "Saving…"].includes(node.props.children)) return node;
    for (const child of [node.props?.children].flat(Infinity)) {
      const found = findSave(child);
      if (found) return found;
    }
    return null;
  };
  let closes = 0, submits = 0;
  const props = { ...defaultProps, onClose: () => closes++, onSubmit: () => submits++ };
  findSave(render(props)).props.onClick();
  assert.equal(closes, 1);
  assert.equal(submits, 0);
  findSave(render({ ...props, reaction: "A real reaction." })).props.onClick();
  findSave(render({ ...props, rating: 4.5 })).props.onClick();
  assert.equal(submits, 2);
  findSave(render({ ...props, busy: true })).props.onClick();
  assert.equal(closes, 1);
  assert.equal(submits, 2);
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
