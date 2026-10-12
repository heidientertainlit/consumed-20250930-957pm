import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { buildFeedConversation } from "./feed-conversation";
import { conversationReplyTarget, postConversationReply } from "./feed-conversation-replies";
import type { FeedConversationEntry } from "../components/feed-conversation-section";

const entry = (overrides: Partial<FeedConversationEntry> = {}): FeedConversationEntry => ({
  id: "comment:42", kind: "comment", userId: "friend", name: "Alex T.", likes: 0, isLiked: false,
  ...overrides,
});

test("primary comments, additional reviews and nested review replies target their actual owning thread", async () => {
  const cases = [
    { row: entry(), body: { post_id: "primary", content: "My reply", parent_comment_id: "42" } },
    { row: entry({ id: "rating:friend", kind: "rating", postId: "friend-review" }),
      body: { post_id: "friend-review", content: "My reply" } },
    { row: entry({ threadPostId: "friend-review" }),
      body: { post_id: "friend-review", content: "My reply", parent_comment_id: "42" } },
  ];
  for (const { row, body } of cases) {
    const calls: any[] = [];
    await postConversationReply({
      baseUrl: "https://example.test", accessToken: "test-token",
      entry: row, primaryPostId: "primary", content: " My reply ",
      request: (async (url: any, init: any) => {
        calls.push({ url, method: init.method, body: JSON.parse(init.body) });
        return Response.json({ comment: { id: 99, content: "My reply" } });
      }) as typeof fetch,
    });
    assert.deepEqual(calls, [{ url: "https://example.test/functions/v1/social-feed-comments", method: "POST", body }]);
  }
});

test("additional-review comments and nested replies retain their owning post without promoting blocked descendants", () => {
  const comment = (id: number, userId: string, replies: any[] = []) => ({
    id, user: { id: userId, displayName: "Alex Taylor" }, content: `Comment ${id}`, replies,
  });
  const rows = buildFeedConversation({
    ratings: [{ userId: "friend", userName: "friend", displayName: "Alex T.", rating: 4.5, postId: "friend-review" }],
    comments: [], viewerId: "viewer",
    reviewThreads: { "friend-review": [
      comment(1, "viewer", [comment(2, "friend", [comment(3, "blocked")])]),
      comment(4, "blocked", [comment(5, "viewer")]),
    ] },
    blockedUserIds: ["blocked"],
  });
  assert.equal(rows[0].children?.length, 1);
  const reply = rows[0].children![0];
  assert.equal(reply.threadPostId, "friend-review");
  assert.equal(reply.children![0].threadPostId, "friend-review");
  assert.equal(reply.children![0].children!.length, 0);
  assert.deepEqual(conversationReplyTarget(reply.children![0], "primary"), {
    postId: "friend-review", parentCommentId: "2",
  });
});

test("invalid, blank and failed replies cannot pretend to succeed", async () => {
  const options = {
    baseUrl: "https://example.test", accessToken: "test-token", entry: entry(),
    primaryPostId: "primary", content: "Keep this draft",
    request: (async () => new Response("Blocked", { status: 403 })) as typeof fetch,
  };
  await assert.rejects(postConversationReply(options), /draft is still here/);
  await assert.rejects(postConversationReply({ ...options, accessToken: "" }), /Sign in/);
  await assert.rejects(postConversationReply({ ...options, content: " " }), /Write a reply/);
  assert.throws(() => conversationReplyTarget(entry({ kind: "rating" }), "primary"), /no review/);
});

test("both review and comment arrows use the in-place composer, never a post route", () => {
  const feed = readFileSync(new URL("../pages/feed.tsx", import.meta.url), "utf8");
  const discussion = feed.slice(feed.indexOf('data-testid="feed-conversation"'), feed.indexOf("{/* YOUR TURN"));
  assert.doesNotMatch(discussion, /setLocation|\/post\//);
  assert.match(discussion, /setDiscussionReplyTarget\(\{ key: discussionScopeKey, entry \}\)/);
  assert.match(discussion, /discussionReplyTarget.entry.id === entry.id/);
  assert.match(discussion, /submitDiscussionReply\(entry\)/);
  assert.match(feed, /postConversationReply\(/);
  assert.match(feed, /activeDiscussionScope.current !== scope/);
  assert.match(feed, /reviewThreadRequests.current.get\(threadPostId\) !== requestNumber/);
});
