import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { buildFeedConversation, type RelatedFeedRating } from "./feed-conversation";
import { FeedConversationSection, type FeedConversationEntry } from "../components/feed-conversation-section";
import { FeedSpoilerDiscussion } from "../components/feed-spoiler-discussion";

const rating = (userId: string, overrides: Partial<RelatedFeedRating> = {}): RelatedFeedRating => ({
  userId, userName: userId, displayName: "Alex T.", rating: 4, ...overrides,
});
const comment = (id: number, userId: string, content = "A real comment", replies: any[] = []) => ({
  id, user: { id: userId, displayName: "Alex Taylor", avatar: "/avatar.png" },
  content, likesCount: 3, likedByCurrentUser: true, upVoteCount: 2, downVoteCount: 1, currentUserVote: "up", replies,
});
const render = (entries: FeedConversationEntry[], expanded = false, canInteract = true, markedDiscussion?: boolean, ratingsExpanded = true) => {
  const section = React.createElement(FeedConversationSection, {
    entries, expanded, canInteract, currentUserId: "viewer", ratingsExpanded,
    onExpand() {}, onVote() {}, onReply() {}, onDelete() {}, onReport() {},
  });
  return renderToStaticMarkup(markedDiscussion === undefined ? section :
    React.createElement(FeedSpoilerDiscussion, {
      discussionId: "primary-post", containsSpoilers: markedDiscussion, children: section,
    }));
};

test("viewer rating is first in the same section as friends' ratings and real comments", () => {
  const entries = buildFeedConversation({
    ratings: [rating("friend"), rating("viewer", { rating: 2, avatar: "/own.png" })],
    comments: [comment(1, "other")], viewerId: "viewer", ownRating: 4.5,
  });
  assert.equal(entries[0].name, "You");
  assert.equal(entries[0].rating, 4.5);
  assert.equal(entries[0].avatar, "/own.png");
  assert.deepEqual(new Set(entries.map(e => e.kind)), new Set(["rating", "comment"]));
  assert.equal(entries.filter(e => e.isOwnRating).length, 1);
  assert.match(render(entries), /4.5 out of 5 stars/);
});

test("the main post author is not repeated as a synthetic review or fallback rating", () => {
  for (const ratings of [[], [rating("viewer", { content: "My main post", postId: "main-post" })]]) {
    const entries = buildFeedConversation({
      ratings, comments: [], primaryAuthorId: "viewer", viewerId: "viewer", ownRating: 5,
    });
    assert.deepEqual(entries, []);
    assert.doesNotMatch(render(entries), /My main post|out of 5 stars/);
  }
});

test("the owner's saved stars stay on the primary post instead of the removed duplicate", () => {
  const feed = readFileSync(new URL("../pages/feed.tsx", import.meta.url), "utf8");
  const expression = feed.match(/const primaryRating = ([\s\S]*?);/);
  assert.ok(expression);
  const value = new Function("post", "session", "loadedViewerRatingKey", "viewerRatingKey", "ratingSubmitted", "ratingValue", `return ${expression[1]}`);
  const session = { user: { id: "viewer" } };
  assert.equal(value({ user: { id: "viewer" } }, session, "current", "current", true, 4.5), 4.5);
  assert.equal(value({ user: { id: "friend" }, rating: 3 }, session, "current", "current", true, 5), 3);
  assert.equal(value({ user: { id: "viewer" }, rating: 4 }, session, "old", "current", true, 5), 4);
  assert.equal(value({ user: { id: "viewer" }, rating: 4 }, session, "current", "current", false, 0), 0);
  assert.match(feed, /const r = primaryRating;/);
});

test("primary reviews are excluded for other viewers without hiding their own rating", () => {
  const entries = buildFeedConversation({
    ratings: [rating("author", { content: "The primary review", postId: "main-post" }), rating("viewer")],
    comments: [comment(1, "friend")], primaryAuthorId: "author", viewerId: "viewer", ownRating: 4.5,
  });
  assert.ok(!entries.some(entry => entry.kind === "rating" && entry.userId === "author"));
  assert.equal(entries[0].userId, "viewer");
  assert.equal(entries[0].rating, 4.5);
  assert.equal(entries[1].id, "comment:1");
});

test("real comments and nested replies by the primary author retain identity and actions", () => {
  const entries = buildFeedConversation({
    ratings: [rating("viewer", { content: "My main post", postId: "main-post" })],
    comments: [comment(1, "viewer", "A real follow-up", [comment(2, "friend", "Reply to the follow-up")])],
    primaryAuthorId: "viewer", viewerId: "viewer", ownRating: 5,
  });
  assert.equal(entries.length, 1);
  assert.equal(entries[0].id, "comment:1");
  assert.equal(entries[0].children?.[0].id, "comment:2");
  const html = render(entries, true);
  assert.match(html, /A real follow-up/);
  assert.match(html, /Reply to the follow-up/);
  assert.match(html, /Options for your comment/);
  assert.doesNotMatch(html, /My main post/);
});

test("a just-saved rating appears first even before related reviews finish loading", () => {
  const entries = buildFeedConversation({
    ratings: [], comments: [comment(1, "friend")], viewerId: "viewer", ownRating: 5, ownAvatar: "/me.png",
  });
  assert.equal(entries[0].rating, 5);
  assert.equal(entries[0].avatar, "/me.png");
  assert.equal(entries[0].postId, undefined);
  assert.doesNotMatch(render(entries), /thumbs up on your review|Delete/);
});

test("viewer rating joins their existing comment instead of creating a separate You row", () => {
  const own = comment(2, "viewer", "Obsessssssed. Love love love", [comment(3, "friend", "Agreed")]);
  const entries = buildFeedConversation({
    ratings: [rating("viewer", { rating: 2 }), rating("friend")],
    comments: [comment(1, "other"), own], viewerId: "viewer", ownRating: 4.5,
  });
  assert.equal(entries[0].id, "comment:2");
  assert.equal(entries[0].kind, "comment");
  assert.equal(entries[0].name, "You");
  assert.equal(entries[0].rating, 4.5);
  assert.equal(entries[0].content, own.content);
  assert.equal(entries[0].likes, 3);
  assert.equal(entries[0].isLiked, true);
  assert.equal(entries[0].children?.[0].id, "comment:3");
  assert.equal(entries.filter(entry => entry.userId === "viewer").length, 1);
  const html = render(entries, true);
  assert.match(html, /4.5 out of 5 stars/);
  assert.match(html, /Obsessssssed\. Love love love/);
  assert.match(html, /Remove thumbs up on your comment/);
  assert.match(html, /Agreed/);
  assert.match(html, /aria-label="Options for your comment"/);
});

test("viewer comment gets their current rating before related reviews have loaded", () => {
  const entries = buildFeedConversation({
    ratings: [], comments: [comment(1, "friend"), comment(2, "viewer", "Love it")],
    viewerId: "viewer", ownRating: 5,
  });
  assert.equal(entries[0].id, "comment:2");
  assert.equal(entries[0].rating, 5);
  assert.equal(entries.filter(entry => entry.isOwnRating).length, 1);
  assert.ok(!entries.some(entry => entry.id === "rating:viewer"));
});

test("a distinct viewer review is preserved as text without duplicating their attached stars", () => {
  const entries = buildFeedConversation({
    ratings: [rating("viewer", { content: "My separate review", postId: "own-review" })],
    comments: [comment(1, "viewer", "My comment here")], viewerId: "viewer", ownRating: 5,
  });
  assert.equal(entries[0].content, "My comment here");
  assert.equal(entries[0].rating, 5);
  assert.equal(entries[1].content, "My separate review");
  assert.equal(entries[1].rating, undefined);
  assert.equal(entries[1].postId, "own-review");
  assert.equal(entries.filter(entry => entry.isOwnRating).length, 1);
  assert.equal((render(entries).match(/out of 5 stars/g) || []).length, 1);
});

test("multiple viewer comments stay intact and removing the rating removes the attached stars", () => {
  const comments = [comment(1, "viewer", "Earlier comment"), comment(2, "viewer", "My review")];
  const ratings = [rating("viewer", { content: "My review" })];
  const entries = buildFeedConversation({ ratings, comments, viewerId: "viewer", ownRating: 5 });
  assert.equal(entries.length, 2);
  assert.equal(entries[0].id, "comment:2");
  assert.equal(entries[0].rating, 5);
  assert.equal(entries[1].content, "Earlier comment");
  for (const ownRating of [0, undefined]) {
    const cleared = buildFeedConversation({ ratings, comments, viewerId: "viewer", ownRating });
    assert.equal(cleared.length, 2);
    assert.ok(cleared.every(entry => !entry.isOwnRating && entry.rating === undefined));
  }
});

test("no viewer rating is invented, and a removed rating cannot return from stale related data", () => {
  for (const ownRating of [undefined, 0]) {
    const entries = buildFeedConversation({
      ratings: [rating("viewer")], comments: [], viewerId: "viewer", ownRating,
    });
    assert.equal(entries.length, 0);
  }
});

test("identical review/comment merges once with real comment reactions, and remains pinned when yours", () => {
  const entries = buildFeedConversation({
    ratings: [rating("viewer", { content: "A real comment", postId: "separate-review" })],
    comments: [comment(1, "viewer")], viewerId: "viewer", ownRating: 5,
  });
  assert.equal(entries.length, 1);
  assert.equal(entries[0].kind, "comment");
  assert.equal(entries[0].id, "comment:1");
  assert.equal(entries[0].rating, 5);
  assert.equal(entries[0].isLiked, true);
  assert.match(render(entries), /Remove thumbs up on your comment/);
});

test("unrelated comments from the same reviewer are not swallowed by their rating", () => {
  const entries = buildFeedConversation({
    ratings: [rating("friend", { content: "The review" })],
    comments: [comment(1, "friend", "A different reply")],
  });
  assert.equal(entries.length, 2);
  assert.deepEqual(entries.map(e => e.content), ["A different reply", "The review"]);
});

test("spoiler-marked related reviews stay blurred, including when merged with a matching comment", () => {
  const review = rating("friend", { content: "The surprise ending", containsSpoilers: true, postId: "spoiler-review" });
  for (const comments of [[], [comment(1, "friend", "The surprise ending")]]) {
    const entries = buildFeedConversation({ ratings: [review], comments });
    assert.equal(entries.length, 1);
    assert.equal(entries[0].containsSpoilers, true);
    const html = render(entries, true);
    assert.match(html, /Show Spoiler/);
    assert.match(html, /blur-sm/);
    assert.match(html, /lucide-eye-off/);
    assert.match(html, />Spoiler<\/span>/);
    assert.match(html, /aria-hidden="true"/);
  }
});

test("a marked primary discussion blurs unflagged comments and every nested reply, not their identity or actions", () => {
  const entries = buildFeedConversation({
    ratings: [],
    comments: [comment(1, "friend", "Root spoiler reply", [
      comment(2, "viewer", "Nested spoiler reply", [comment(3, "friend", "Deep spoiler reply")]),
    ])],
  });
  const hidden = render(entries, true, true, true);
  assert.equal((hidden.match(/<p[^>]*aria-hidden="true"/g) || []).length, 3);
  assert.equal((hidden.match(/aria-label="Show Spoiler"/g) || []).length, 3);
  assert.match(hidden, /Alex T\./);
  assert.match(hidden, /aria-label="Options for your comment"/);
  assert.match(hidden, /aria-label="Reply to your comment"/);
  assert.match(hidden, /thumbs down/);
  assert.doesNotMatch(render(entries, true, true, false), /aria-label="Show Spoiler"/);
});

test("independent reviews keep their own spoiler protection, which their actual descendants inherit", () => {
  const entries = buildFeedConversation({
    ratings: [
      rating("friend", { content: "Independent safe review", postId: "safe-review" }),
      rating("other", { content: "Independent spoiler review", postId: "marked-review", containsSpoilers: true }),
    ],
    comments: [comment(1, "viewer", "Primary thread reply")],
    reviewThreads: {
      "safe-review": [comment(2, "friend", "Safe separate reply")],
      "marked-review": [comment(3, "other", "Separate spoiler reply", [comment(4, "friend", "Separate nested spoiler")])],
    },
  });
  const html = render(entries, true, true, true);
  assert.equal((html.match(/<p[^>]*aria-hidden="true"/g) || []).length, 4);
  assert.match(html, /<p[^>]*>“Independent safe review”<\/p>/);
  assert.match(html, /<p[^>]*>Safe separate reply<\/p>/);
  assert.equal((render(entries, true, true, false).match(/<p[^>]*aria-hidden="true"/g) || []).length, 3);
});

test("nested replies remain nested; blocked roots and descendants never become visible", () => {
  const entries = buildFeedConversation({
    ratings: [rating("blocked")],
    comments: [
      comment(1, "friend", "Root", [comment(2, "friend-2", "Nested", [comment(3, "blocked")])]),
      comment(4, "blocked", "Hidden root", [comment(5, "friend-3", "Hidden descendant")]),
    ],
    blockedUserIds: ["blocked"],
  });
  assert.equal(entries.length, 1);
  assert.equal(entries[0].children?.length, 1);
  assert.equal(entries[0].children?.[0].children?.length, 0);
  assert.doesNotMatch(render(entries), /Nested/);
  assert.match(render(entries), /View 1 more reply/);
  assert.match(render(entries, true), /Nested/);
  assert.doesNotMatch(render(entries, true), /Hidden descendant/);
});

test("expanded ratings keep the viewer first and show every peer rating", () => {
  const entries = buildFeedConversation({
    ratings: [rating("viewer"), rating("friend-1"), rating("friend-2"), rating("friend-3"), rating("friend-4")],
    comments: [], viewerId: "viewer", ownRating: 5,
  });
  const html = render(entries);
  assert.equal((html.match(/out of 5 stars/g) || []).length, 5);
  assert.ok(html.indexOf(">You<") < html.indexOf(">Alex T.<"));
  assert.equal((render(entries, true).match(/out of 5 stars/g) || []).length, 5);
});

test("ratings start collapsed while real post comments stay visible", () => {
  const entries = buildFeedConversation({
    ratings: [rating("lindsie", { rating: 5 }), rating("maddie", { rating: 5 }), rating("ashley", { rating: 4.5, content: "My favorite of the trilogy.", postId: "ashley-review" })],
    comments: [comment(1, "friend", "A real reply to the original post")],
  });
  const html = renderToStaticMarkup(React.createElement(FeedConversationSection, {
    entries, expanded: false, canInteract: true, onExpand() {}, onVote() {}, onReply() {}, onDelete() {}, onReport() {},
  }));
  assert.match(html, /aria-expanded="false"/);
  assert.match(html, /4\.8 out of 5 from 3 ratings/);
  assert.doesNotMatch(html, /My favorite of the trilogy/);
  assert.match(html, /A real reply to the original post/);
  assert.match(html, /conversation-comments-label/);
  const opened = render(entries, true);
  assert.match(opened, /Ratings &amp; reviews for this title/);
  assert.match(opened, /My favorite of the trilogy/);
  assert.ok(opened.indexOf("My favorite of the trilogy") < opened.indexOf('data-testid="conversation-comments-label"'));
});

test("rating summary uses unique valid additional ratings, never comment stars or invalid values", () => {
  const base: FeedConversationEntry = { id: "r1", userId: "one", name: "One", kind: "rating", rating: 5, likes: 0, isLiked: false };
  const html = render([
    base, { ...base, id: "duplicate", rating: 1 },
    { ...base, id: "r2", userId: "two", rating: 4 },
    ...[0, -1, NaN, Infinity, 6].map((value, i) => ({ ...base, id: `invalid:${i}`, userId: `invalid:${i}`, rating: value })),
    { ...base, id: "actual-comment", userId: "commenter", kind: "comment", rating: 1, content: "Actual comment with its own rating" },
  ], false, true, undefined, false);
  assert.match(html, /4\.5 out of 5 from 2 ratings/);
  assert.match(html, /Actual comment with its own rating/);
  assert.doesNotMatch(html, /NaN|Infinity/);
});

test("rating-only cards have an accurate remainder and no false Comments label", () => {
  const entries = buildFeedConversation({
    ratings: Array.from({ length: 15 }, (_, i) => rating(`person:${i}`, { rating: 4 })),
    comments: [],
  });
  const html = render(entries, false, false, undefined, false);
  assert.match(html, /\+12/);
  assert.match(html, /4\.0 out of 5 from 15 ratings/);
  assert.match(html, /data-guest-allowed="true"/);
  assert.doesNotMatch(html, /conversation-comments-label/);
  assert.doesNotMatch(render([], false), /related-ratings-toggle/);
});

test("text-only review companions remain accessible without fabricating a summary rating", () => {
  const entries: FeedConversationEntry[] = [{
    id: "rating:viewer", userId: "viewer", name: "You", kind: "rating", content: "My distinct review text", likes: 0, isLiked: false,
  }];
  const closed = render(entries, false, true, undefined, false);
  assert.match(closed, /Ratings &amp; reviews/);
  assert.doesNotMatch(closed, /out of 5 from/);
  assert.match(render(entries), /My distinct review text/);
});

test("comments without ratings show their avatar, short name, content and real thumb votes", () => {
  const entries = buildFeedConversation({ ratings: [], comments: [comment(1, "friend")] });
  const html = render(entries);
  assert.match(html, /Alex T\./);
  assert.match(html, /A real comment/);
  assert.match(html, /Remove thumbs up on Alex T\.&#x27;s comment/);
  assert.match(html, /thumbs down on Alex T\.&#x27;s comment/);
  assert.equal(entries[0].upVoteCount, 2);
  assert.equal(entries[0].downVoteCount, 1);
  assert.doesNotMatch(html, /lucide-heart/);
  assert.match(html, /aria-pressed="true"/);
  assert.doesNotMatch(html, /out of 5 stars/);
});

test("comment controls use text Reply and show only positive thumb counts", () => {
  const base: FeedConversationEntry = {
    id: "comment:1", userId: "friend", name: "Alex T.", content: "A real comment",
    kind: "comment", likes: 0, isLiked: false,
  };
  for (const [up, down] of [[undefined, undefined], [0, 0], [2, 0], [0, 3], [2, 3]]) {
    const html = render([{ ...base, upVoteCount: up, downVoteCount: down }]);
    assert.match(html, /lucide-thumbs-up/);
    assert.match(html, /lucide-thumbs-down/);
    assert.match(html, />Reply<\/button>/);
    assert.doesNotMatch(html, /lucide-corner-up-left|<span>0<\/span>/);
    if (up && up > 0) assert.match(html, new RegExp(`<span>${up}</span>`));
    if (down && down > 0) assert.match(html, new RegExp(`<span>${down}</span>`));
  }
  const nested = render([{ ...base, children: [{ ...base, id: "comment:2", upVoteCount: 0, downVoteCount: 0 }] }], true);
  assert.equal((nested.match(/>Reply<\/button>/g) || []).length, 2);
  assert.doesNotMatch(nested, /<span>0<\/span>/);
});

test("guest expansion is allowed, write reactions are disabled, and moderation is not shown", () => {
  const entries = buildFeedConversation({ ratings: [], comments: [1, 2, 3, 4].map(id => comment(id, "friend")) });
  const html = render(entries, false, false);
  assert.match(html, /disabled=""/);
  assert.match(html, /data-guest-allowed="true"/);
  assert.doesNotMatch(html, /aria-label="Options for|aria-label="Delete your|aria-label="Flag /);
});

test("half stars use an actual clipped half-filled icon instead of rounding up", () => {
  const entries = buildFeedConversation({ ratings: [rating("friend", { rating: 3.5 })], comments: [] });
  const html = render(entries);
  assert.match(html, /3.5 out of 5 stars/);
  assert.match(html, /width:50%/);
});

test("feed mounts one shared discussion after the main actions, not separate ratings or comment previews", () => {
  const feed = readFileSync(new URL("../pages/feed.tsx", import.meta.url), "utf8");
  const rated = feed.slice(feed.indexOf("  if (isRatingPost) {"), feed.indexOf("        {/* ── Inline Comments section"));
  assert.equal((rated.match(/<FeedConversationSection/g) || []).length, 1);
  assert.ok(rated.indexOf("<FeedConversationSection") > rated.indexOf('data-testid="rating-card-actions"'));
  assert.doesNotMatch(rated, /relatedRatings\.map|latestReply|You rated this/);
  assert.match(rated, /loadedViewerRatingKey === viewerRatingKey/);
  assert.match(rated, /primaryAuthorId: post\.user\?\.id/);
  assert.match(rated, /<FeedSpoilerText[\s\S]*?containsSpoilers=\{post\.containsSpoilers\}/);
  assert.match(rated, /<FeedSpoilerDiscussion discussionId=\{post\.id\} content=\{post\.content\} containsSpoilers=\{post\.containsSpoilers\}>/);
  assert.match(rated, /onVote=\{voteDiscussionEntry\}/);
  assert.match(rated, /voteScore: votes.upVoteCount - votes.downVoteCount/);
  assert.match(feed, /discussionReadsAllowed = !blockedViewerId \|\| blockedUsers\.isSuccess/);
  assert.match(rated, /lastCommentsViewerId\.current === blockedViewerId/);
});
