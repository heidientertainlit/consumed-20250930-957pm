import assert from "node:assert/strict";
import test, { after } from "node:test";
import { readFileSync } from "node:fs";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";

const vite = await createServer({ server: { middlewareMode: true }, appType: "custom" });
const {
  applyCommentVoteToTree,
  CommentVoteActions,
  commentIndentStep,
  ConversationStarterPrompts,
  normalizeCommentTree,
  normalizeCommentVote,
  remainingReplyCount,
  requestCommentVote,
  visibleReplySlice,
} =
  await vite.ssrLoadModule("/src/components/media-detail-conversation.tsx");
after(() => vite.close());

test("media detail places providers, actions, description, and recommendations in the hero before white tabs", () => {
  const source = readFileSync("client/src/pages/media-detail.tsx", "utf8");
  const hero = source.indexOf('data-testid="media-detail-hero"');
  const providers = source.indexOf('data-testid="media-providers"');
  const actions = source.indexOf('data-testid="media-hero-actions"');
  const description = source.indexOf('data-testid="media-detail-description"');
  const recommendations = source.indexOf("<MoreLikeThis");
  const tabs = source.indexOf("data-testid={`tab-${t}`}");
  assert.ok(hero >= 0 && hero < providers && providers < actions && actions < description && description < recommendations && recommendations < tabs);
  assert.match(source.slice(actions, description), /button-hero-rate/);
  assert.match(source.slice(actions, description), /button-hero-add-to-list/);
  assert.match(source.slice(hero, tabs), /appearance="inverse"/);
});

test("starter prompts are actionable prompt chips, and replies expose both thumb actions", () => {
  const prompts = ["A detail I loved", "I am not convinced"];
  const promptMarkup = renderToStaticMarkup(
    React.createElement(ConversationStarterPrompts, { prompts, onSelect() {} }),
  );
  assert.match(promptMarkup, /A detail I loved/);
  assert.match(promptMarkup, /I am not convinced/);
  assert.equal((promptMarkup.match(/<button/g) || []).length, 2);

  const voteMarkup = renderToStaticMarkup(
    React.createElement(CommentVoteActions, { comment: { id: 12 }, vote: null, onVote() {} }),
  );
  assert.match(voteMarkup, /data-testid="comment-vote-up-12"/);
  assert.match(voteMarkup, /data-testid="comment-vote-down-12"/);
  assert.doesNotMatch(voteMarkup, /heart/i);
});

test("comment thumbs invoke the existing vote endpoint and toggle with POST or DELETE", async () => {
  const calls: Array<{ url: string; method?: string; body?: string }> = [];
  const responses = [
    { success: true, action: "removed", upVoteCount: 2, downVoteCount: 0, voteScore: 2, userVote: null },
    { success: true, action: "updated", upVoteCount: 1, downVoteCount: 1, voteScore: 0, userVote: "down" },
  ];
  const fakeFetch = async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), method: init?.method, body: String(init?.body) });
    return new Response(JSON.stringify(responses.shift()), { status: 200, headers: { "Content-Type": "application/json" } });
  };
  const cleared = await requestCommentVote("fixture-token", "comment-7", "up", "up", fakeFetch as typeof fetch);
  const switched = await requestCommentVote("fixture-token", "comment-7", "down", "up", fakeFetch as typeof fetch);
  assert.equal(calls[0].url.endsWith("/functions/v1/comment-vote"), true);
  assert.equal(calls[0].method, "DELETE");
  assert.deepEqual(JSON.parse(calls[0].body!), { comment_id: "comment-7", direction: "up" });
  assert.equal(calls[1].method, "POST");
  assert.equal(cleared.userVote, null);
  assert.equal(cleared.upVoteCount, 2);
  assert.equal(switched.userVote, "down");
  assert.equal(switched.downVoteCount, 1);
});

test("all fetched replies remain in state and can be paged at root, child, and deep levels", () => {
  const deepReplies = Array.from({ length: 12 }, (_, i) => ({ id: `deep-${i}`, replies: [] }));
  const deepParent = { id: "deep-parent", replies: [] as any[] };
  let deepCursor = deepParent;
  for (let index = 1; index <= 7; index += 1) {
    const next = { id: `chain-${index}`, replies: [] as any[] };
    deepCursor.replies = [next];
    deepCursor = next;
  }
  deepCursor.replies = deepReplies;
  const childReplies = Array.from({ length: 12 }, (_, i) => ({
    id: `child-${i}`,
    replies: i === 0 ? [deepParent] : [],
  }));
  const roots = Array.from({ length: 24 }, (_, i) => ({
    id: `root-${i}`,
    replies: i === 0 ? childReplies : [],
  }));
  const normalized = normalizeCommentTree(roots);
  assert.equal(normalized.length, 24);
  assert.equal(normalized[0].replies.length, 12);
  let deepNode = normalized[0].replies[0];
  for (let index = 0; index <= 7; index += 1) deepNode = deepNode.replies[0];
  assert.equal(deepNode.replies.length, 12);

  let rootCount = 20;
  while (remainingReplyCount(normalized, rootCount)) rootCount += 20;
  assert.equal(visibleReplySlice(normalized, rootCount).at(-1)?.id, "root-23");
  let childCount = 10;
  while (remainingReplyCount(normalized[0].replies, childCount)) childCount += 10;
  assert.equal(visibleReplySlice(normalized[0].replies, childCount).at(-1)?.id, "child-11");
  let deepCount = 10;
  while (remainingReplyCount(deepNode.replies, deepCount)) deepCount += 10;
  assert.equal(visibleReplySlice(deepNode.replies, deepCount).at(-1)?.id, "deep-11");
  assert.equal(Array.from({ length: 12 }, (_, depth) => commentIndentStep(depth)).reduce((sum, step) => sum + step, 0), 12);
});

test("comment vote controls expose pressed state and authoritative counts", () => {
  const markup = renderToStaticMarkup(React.createElement(CommentVoteActions, {
    comment: { id: 12, upVoteCount: 8, downVoteCount: 3 },
    vote: "up",
    onVote() {},
  }));
  assert.match(markup, /aria-pressed="true"[^>]*data-testid="comment-vote-up-12"/);
  assert.match(markup, /aria-pressed="false"[^>]*data-testid="comment-vote-down-12"/);
  assert.match(markup, /<span[^>]*>8<\/span>/);
  assert.match(markup, /<span[^>]*>3<\/span>/);
  assert.equal(normalizeCommentVote(1), "up");
  assert.equal(normalizeCommentVote(-1), "down");
  assert.equal(normalizeCommentVote(null), null);

  const updated = applyCommentVoteToTree([{ id: 1, replies: [{ id: 12, replies: [] }] }], "12", {
    userVote: null, upVoteCount: 0, downVoteCount: 4, voteScore: -4,
  });
  assert.deepEqual(updated[0].replies[0], {
    id: 12, replies: [], currentUserVote: null, upVoteCount: 0, downVoteCount: 4, voteScore: -4,
  });
});
