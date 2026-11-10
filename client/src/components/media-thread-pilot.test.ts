import assert from "node:assert/strict";
import test, { after } from "node:test";
import { existsSync, readFileSync } from "node:fs";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import * as icons from "lucide-react";
import { transformSync } from "esbuild";
import { createServer } from "vite";
import { isTerminalListConversationPilot } from "../lib/media-conversation-pilot";

const vite = await createServer({
  cacheDir: "node_modules/.vite-thread-pilot-test",
  server: { middlewareMode: true, hmr: false },
  appType: "custom",
  optimizeDeps: { noDiscovery: true },
});
after(() => vite.close());
const helpers = await vite.ssrLoadModule("/src/components/media-detail-conversation.tsx");
const presentation = existsSync("client/src/components/media-thread-presentation.tsx")
  ? await vite.ssrLoadModule("/src/components/media-thread-presentation.tsx") : {};
const source = readFileSync("client/src/pages/media-detail.tsx", "utf8");
const commentStart = source.indexOf("  const renderComment =");
const commentEnd = source.indexOf("\n  // Delete comment mutation", commentStart);
const takeStart = source.indexOf("  const renderTakeCard =");
const takeEnd = source.indexOf("\n  return (\n    <GuestGate", takeStart);
assert.ok(commentStart > 0 && commentEnd > commentStart && takeStart > commentEnd && takeEnd > takeStart);
const code = transformSync(`${source.slice(commentStart, commentEnd)}\n${source.slice(takeStart, takeEnd)}`, {
  loader: "tsx", jsxFactory: "React.createElement",
}).code;

const reply = (id: string, replies: any[] = []) => ({
  id, user_id: `user-${id}`, users: { id: `user-${id}`, display_name: "Jamie Chen", user_name: "jamie_handle" },
  content: `Reply text ${id}`, created_at: "2026-11-01T00:00:00Z",
  upVoteCount: 3, downVoteCount: 0, currentUserVote: "up", replies,
});
const tree = [reply("one", [reply("nested")]), reply("two"), reply("three")];
const post = {
  id: "post-one", user_id: "author-one",
  users: { display_name: "Alex Morgan", user_name: "alex_handle", avatar: "" },
  content: "This season surprised me. The pacing really worked for me.",
  created_at: "2026-11-01T00:00:00Z", rating: 4.5, likes_count: 7, comments_count: 4,
};

function fixture(pilot = true, overrides: Record<string, any> = {}) {
  const calls: any[] = [];
  const context: Record<string, any> = {
    React, ...icons, ...helpers, ...presentation,
    isThreadPilot: pilot,
    user: { id: "viewer" }, session: null,
    expandedTake: null, expandedComments: {},
    previewComments: { "post-one": tree },
    loadingComments: new Set(), failedComments: new Set(),
    loadingPreviews: new Set(), failedPreviews: new Set(),
    likedPosts: new Set(), disagreedTakes: new Set(),
    commentVotes: new Map(), pendingCommentVotes: new Set(),
    expandedReplyCounts: {}, replyingTo: null, replyContent: "",
    replyingToComment: null, commentReplyContent: "",
    replyMutation: { isPending: false },
    takeTimeAgo: () => "18h",
    dbTagToDisplay: () => null,
    ReportButton: ({ contentId, contentType }: any) => React.createElement("button", {
      "data-report-id": contentId, "data-report-type": contentType,
    }, "Report"),
    MentionInput: ({ value, testId, placeholder }: any) => React.createElement("input", {
      value, readOnly: true, "data-testid": testId, placeholder,
    }),
    setExpandedTake(value: any) { context.expandedTake = value; },
    setReplyingTo(value: any) { context.replyingTo = value; },
    setReplyContent(value: any) { context.replyContent = value; },
    setReplyingToComment(value: any) { context.replyingToComment = value; },
    setCommentReplyContent(value: any) { context.commentReplyContent = value; },
    setExpandedReplyCounts(update: any) { context.expandedReplyCounts = update(context.expandedReplyCounts); },
    fetchComments(id: any) { calls.push(["fetch", id]); },
    fetchPreviewComments(id: any) { calls.push(["preview", id]); },
    handleAgree(id: any) { calls.push(["agree", id]); },
    handleDisagree(id: any) { calls.push(["disagree", id]); },
    handleShare() { calls.push(["share"]); },
    handleReply(id: any) { calls.push(["reply", id]); },
    handleCommentReply(postId: any, id: any) { calls.push(["comment-reply", postId, id]); },
    handleCommentVote(comment: any, postId: any, direction: any) { calls.push(["vote", comment.id, postId, direction]); },
    setLocation(path: any) { calls.push(["navigate", path]); },
    document: { querySelector: () => null, getElementById: () => null },
    ...overrides,
  };
  function renderers() {
    const bindings = Object.entries(context).filter(([key]) => key !== "default" && /^[A-Za-z_$][\w$]*$/.test(key));
    return new Function(...bindings.map(([key]) => key), `${code}; return { renderTakeCard, renderComment };`)(
      ...bindings.map(([, value]) => value),
    );
  }
  return {
    context, calls,
    take: (item = post) => renderers().renderTakeCard(item, "trending"),
    comment: (item = tree[0]) => renderers().renderComment(item, "post-one"),
  };
}

function findElement(node: any, testId: string): any {
  if (!node || typeof node !== "object") return null;
  if (node.props?.["data-testid"] === testId) return node;
  const children = Array.isArray(node) ? node : node.props?.children;
  for (const child of [children].flat(Infinity)) {
    const found = findElement(child, testId);
    if (found) return found;
  }
  return null;
}

test("only Terminal List enables the new take layout; other title rendering stays legacy", () => {
  const pilot = renderToStaticMarkup(fixture().take());
  const legacy = renderToStaticMarkup(fixture(false).take());
  assert.notEqual(pilot, legacy);
  assert.match(legacy, /class="py-4\s*"/);
  assert.doesNotMatch(legacy, /data-thread-pilot="true"/);
  assert.match(source, /isThreadPilot = isTerminalListConversationPilot\(/);
  assert.equal(isTerminalListConversationPilot({ type: "movie", source: "tmdb", id: "120911" }), false);
});

test("pilot renders real abbreviated authors, ratings, counts, and actions before reply previews", () => {
  const html = renderToStaticMarkup(fixture().take());
  assert.match(html, /Alex M\./);
  assert.doesNotMatch(html, /Alex Morgan/);
  assert.match(html, /4\.5/);
  assert.match(html, /width:50%/);
  assert.ok(html.indexOf('data-testid="take-agree-post-one"') < html.indexOf('data-testid="take-previews-post-one"'));
  assert.match(html, /Reply text one/);
  assert.match(html, /Reply text two/);
  assert.doesNotMatch(html, /Reply text nested/);
  assert.match(html, /data-report-type="post"/);
  assert.match(html, /data-report-type="comment"/);
});

test("thumbs and sharing preserve post IDs and existing handlers", () => {
  const item = fixture();
  const node = item.take();
  findElement(node, "take-agree-post-one").props.onClick();
  findElement(node, "take-disagree-post-one").props.onClick();
  findElement(node, "take-share-post-one").props.onClick();
  assert.deepEqual(item.calls, [["agree", "post-one"], ["disagree", "post-one"], ["share"]]);
});

test("reply opens the actual owning thread and does not collapse an already-open thread", () => {
  const item = fixture();
  findElement(item.take(), "take-reply-post-one").props.onClick();
  assert.equal(item.context.expandedTake, "trending:post-one");
  assert.ok(item.calls.some((call) => call[0] === "fetch" && call[1] === "post-one"));
  findElement(item.take(), "take-reply-post-one").props.onClick();
  assert.equal(item.context.expandedTake, "trending:post-one");
});

test("expanded nested replies, voting, retry and pagination controls remain available", () => {
  const item = fixture(true, {
    expandedTake: "trending:post-one",
    expandedComments: { "post-one": tree },
  });
  const html = renderToStaticMarkup(item.take());
  assert.match(html, /Reply text nested/);
  assert.match(html, /comment-vote-up-nested/);
  assert.match(html, /take-input-post-one/);
  const failed = fixture(true, {
    expandedTake: "trending:post-one",
    failedComments: new Set(["post-one"]),
  });
  assert.match(renderToStaticMarkup(failed.take()), /Couldn’t load this thread/);
  const limited = fixture(true, {
    expandedTake: "trending:post-one",
    expandedComments: { "post-one": tree },
    expandedReplyCounts: { "root:post-one": 1 },
  });
  assert.match(renderToStaticMarkup(limited.take()), /thread-more-root-post-one/);
});

test("synthetic rating-only cards never gain fake text or social actions", () => {
  const html = renderToStaticMarkup(fixture().take({ ...post, content: "", _ratingOnly: true } as any));
  assert.match(html, /Alex M\./);
  assert.doesNotMatch(html, /take-agree|take-reply|take-share|take-input/);
  const unrated = renderToStaticMarkup(fixture().take({ ...post, rating: 0 }));
  assert.doesNotMatch(unrated, /Rated 0 out of 5/);
});
