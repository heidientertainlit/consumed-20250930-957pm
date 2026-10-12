import assert from "node:assert/strict";
import test from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { FeedConversationEntry } from "../components/feed-conversation-section";
import { readReviewVotes, voteFeedConversation } from "./feed-conversation-votes";

const entry = (overrides: Partial<FeedConversationEntry> = {}): FeedConversationEntry => ({
  id: "comment:42", userId: "author", name: "Alex T.", kind: "comment",
  likes: 9, isLiked: false, upVoteCount: 2, downVoteCount: 1, currentUserVote: null,
  ...overrides,
});
const base = {
  baseUrl: "https://example.test", accessToken: "test-token", viewerId: "viewer",
  client: {} as SupabaseClient,
};

test("comment thumbs use the vote endpoint and its authoritative counts, not legacy hearts", async () => {
  for (const direction of ["up", "down"] as const) {
    const calls: any[] = [];
    const request = (async (url: any, init: any) => {
      calls.push({ url, method: init.method, body: JSON.parse(init.body) });
      return Response.json({ success: true, upVoteCount: 8, downVoteCount: 3, userVote: direction });
    }) as typeof fetch;
    const result = await voteFeedConversation({ ...base, entry: entry(), direction, request });
    assert.deepEqual(result, { upVoteCount: 8, downVoteCount: 3, currentUserVote: direction });
    assert.deepEqual(calls, [{
      url: "https://example.test/functions/v1/comment-vote", method: "POST",
      body: { comment_id: "42", direction },
    }]);
  }
});

test("same-direction removal trusts the server's null vote instead of adding another vote", async () => {
  const result = await voteFeedConversation({
    ...base, entry: entry({ currentUserVote: "up" }), direction: "up",
    request: (async () => Response.json({
      success: true, upVoteCount: 1, downVoteCount: 1, userVote: null,
    })) as typeof fetch,
  });
  assert.equal(result.currentUserVote, null);
  assert.equal(result.upVoteCount, 1);
});

test("blocked, malformed and unauthenticated votes fail explicitly", async () => {
  const options = { ...base, entry: entry(), direction: "up" as const };
  await assert.rejects(voteFeedConversation({
    ...options, request: (async () => new Response("Blocked", { status: 403 })) as typeof fetch,
  }), /Couldn't update/);
  await assert.rejects(voteFeedConversation({
    ...options, request: (async () => Response.json({ success: true })) as typeof fetch,
  }), /incomplete/);
  await assert.rejects(voteFeedConversation({
    ...options, accessToken: "", request: (async () => { throw new Error("Must not send"); }) as typeof fetch,
  }), /Sign in/);
});

function reviewStore(initialVote: "up" | "down" | null = null) {
  const state = {
    liked: initialVote === "up", up: initialVote === "up" ? 3 : 2,
    reactions: [{ user_id: "other", reaction: "disagree" }] as any[],
    denyReaction: false, missingPost: false,
  };
  if (initialVote === "down") state.reactions.push({ user_id: "viewer", reaction: "disagree" });
  const client = {
    from(table: string) {
      let operation = "select";
      let payload: any;
      const filters: Record<string, any> = {};
      const query: any = {
        select() { return query; },
        eq(key: string, value: any) { filters[key] = value; return query; },
        single() { return query; },
        maybeSingle() { return query; },
        delete() { operation = "delete"; return query; },
        upsert(value: any, options: any) {
          assert.equal(options.onConflict, "social_post_id,user_id");
          operation = "upsert"; payload = value; return query;
        },
        then(resolve: any, reject: any) {
          let data: any;
          let error: any = null;
          if (table === "post_reactions") {
            if (state.denyReaction && operation !== "select") error = new Error("Denied");
            else if (operation === "delete") {
              assert.equal(filters.social_post_id, "review");
              assert.equal(filters.user_id, "viewer");
              state.reactions = state.reactions.filter(row => row.user_id !== "viewer");
            } else if (operation === "upsert") {
              assert.equal(payload.social_post_id, "review");
              state.reactions = [...state.reactions.filter(row => row.user_id !== "viewer"), payload];
            } else data = state.reactions;
          } else if (table === "social_posts") data = state.missingPost ? null : { likes_count: state.up };
          else if (table === "social_post_likes") data = state.liked ? { id: 1 } : null;
          else throw new Error(`Unexpected table ${table}`);
          return Promise.resolve({ data, error }).then(resolve, reject);
        },
      };
      return query;
    },
  } as unknown as SupabaseClient;
  const request = (async (url: any, init: any) => {
    assert.equal(url, "https://example.test/functions/v1/social-feed-like");
    assert.deepEqual(JSON.parse(init.body), { post_id: "review" });
    const liked = init.method === "POST";
    if (state.liked !== liked) state.up += liked ? 1 : -1;
    state.liked = liked;
    return Response.json({ success: true });
  }) as typeof fetch;
  return { state, client, request };
}

test("review thumbs switch and toggle without retaining both positive and negative votes", async () => {
  for (const initial of [null, "up", "down"] as const) {
    const store = reviewStore(initial);
    let current: FeedConversationEntry = entry({
      id: "rating:author", kind: "rating", postId: "review",
      isLiked: initial === "up", currentUserVote: initial,
    });
    for (const direction of ["up", "down", "down", "up", "up"] as const) {
      const previous = current.currentUserVote;
      const result = await voteFeedConversation({ ...base, ...store, entry: current, direction });
      assert.equal(result.currentUserVote, previous === direction ? null : direction);
      assert.equal(result.upVoteCount, 2 + (result.currentUserVote === "up" ? 1 : 0));
      assert.equal(result.downVoteCount, 1 + (result.currentUserVote === "down" ? 1 : 0));
      assert.ok(!(store.state.liked && store.state.reactions.some(row => row.user_id === "viewer")));
      current = { ...current, ...result, isLiked: result.currentUserVote === "up" };
    }
  }
});

test("failed review switching can be reconciled to its actual saved state", async () => {
  const store = reviewStore("up");
  store.state.denyReaction = true;
  await assert.rejects(voteFeedConversation({
    ...base, ...store, direction: "down",
    entry: entry({ kind: "rating", postId: "review", isLiked: true, currentUserVote: "up" }),
  }), /Couldn't update/);
  const saved = await readReviewVotes(store.client, "review", "viewer");
  assert.equal(saved.currentUserVote, null);
  assert.equal(saved.upVoteCount, 2);
  store.state.missingPost = true;
  await assert.rejects(readReviewVotes(store.client, "review", "viewer"), /could not be found/);
});

test("rating-only rows without a review cannot invent a vote target", async () => {
  await assert.rejects(voteFeedConversation({
    ...base, entry: entry({ kind: "rating" }), direction: "down",
  }), /no review/);
});
