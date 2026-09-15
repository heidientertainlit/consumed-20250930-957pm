import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { transformSync } from "esbuild";
import * as blocks from "./block-relationships.ts";

type Scenario = {
  authenticated?: boolean;
  blocked?: "outbound" | "inbound";
  blockLookupFails?: boolean;
  parentMismatch?: boolean;
  parentBlocked?: boolean;
  resourceBlocked?: boolean;
  own?: boolean;
  commentRows?: any[];
  existingVote?: boolean;
};

function rowsFor(s: Scenario, table: string, filters: Record<string, unknown>) {
  if (table === "user_blocks") {
    if (s.blockLookupFails) return { data: null, error: { message: "block lookup unavailable" } };
    if (filters.blocker_id === "actor" && filters.blocked_id === undefined && s.commentRows) {
      return {
        data: s.commentRows.filter((comment) => s.blocked === "outbound" && comment.blocked)
          .map((comment) => ({ blocker_id: "actor", blocked_id: comment.user_id })),
        error: null,
      };
    }
    if (filters.blocked_id === "actor" && filters.blocker_id === undefined && s.blocked === "inbound" && s.commentRows) {
      return { data: [{ blocker_id: "target", blocked_id: "actor" }], error: null };
    }
    const outbound = filters.blocker_id === "actor" && (
      (s.blocked === "outbound" && filters.blocked_id === "target") ||
      (s.parentBlocked && filters.blocked_id === "parent") ||
      (s.resourceBlocked && filters.blocked_id === "owner") ||
      (s.blocked === "outbound" && !!s.commentRows?.some((comment) => comment.user_id === filters.blocked_id && comment.blocked))
    );
    const inbound = filters.blocked_id === "actor" && s.blocked === "inbound" && filters.blocker_id === "target";
    return { data: outbound || inbound ? [{ blocker_id: filters.blocker_id, blocked_id: filters.blocked_id }] : [], error: null };
  }
  if (table === "social_posts") return { data: [{ user_id: s.own ? "actor" : s.resourceBlocked ? "owner" : "target", likes_count: 0 }], error: null };
  if (table === "social_post_comments") {
    if (s.commentRows) return { data: s.commentRows, error: null };
    return {
      data: [{
        user_id: s.parentBlocked ? "parent" : "target",
        social_post_id: s.parentMismatch ? "other-post" : "post",
        likes_count: 0,
      }],
      error: null,
    };
  }
  if (table === "prediction_comments") {
    if (s.commentRows) return { data: s.commentRows, error: null };
    return { data: [{ user_id: s.parentBlocked ? "parent" : "target", pool_id: s.parentMismatch ? "other-pool" : "pool" }], error: null };
  }
  if (table === "prediction_pools") {
    return { data: [{ origin_user_id: s.own ? "actor" : s.resourceBlocked ? "owner" : "target", comments_count: 0 }], error: null };
  }
  if ((table === "social_comment_votes" || table === "hot_take_votes") && s.existingVote) {
    return { data: [{ id: "existing-vote", vote_type: table === "hot_take_votes" ? "fire" : 1 }], error: null };
  }
  if (table === "prediction_likes" && s.own) return { data: [{ id: "own-like" }], error: null };
  if (table === "users") return { data: [{ user_name: "Actor", email: "actor@example.test" }], error: null };
  return { data: [], error: null };
}

test("comment-list fixtures isolate inbound and outbound block queries", () => {
  for (const direction of ["inbound", "outbound"] as const) {
    const scenario: Scenario = {
      blocked: direction,
      commentRows: [{ user_id: "target", blocked: true }],
    };
    const outbound = rowsFor(scenario, "user_blocks", { blocker_id: "actor" });
    const inbound = rowsFor(scenario, "user_blocks", { blocked_id: "actor" });
    assert.equal(outbound.data?.length, direction === "outbound" ? 1 : 0);
    assert.equal(inbound.data?.length, direction === "inbound" ? 1 : 0);
  }
});

function handlerFor(slug: "social-feed-like" | "social-feed-comments" | "prediction-comments" | "social-comment-like" | "prediction-like" | "comment-vote" | "prediction-comment-vote" | "hot-take-vote", scenario: Scenario) {
  const mutations: string[] = [];
  const client = {
    auth: {
      getUser: async () => scenario.authenticated === false
        ? { data: { user: null }, error: new Error("expired") }
        : { data: { user: { id: "actor", email: "actor@example.test" } }, error: null },
    },
    rpc: async () => ({ data: null, error: null }),
    from(table: string) {
      const filters: Record<string, unknown> = {};
      const chain: any = {
        select: () => chain,
        eq: (column: string, value: unknown) => { filters[column] = value; return chain; },
        in: () => chain,
        order: () => chain,
        insert: () => { mutations.push(`${table}:insert`); return chain; },
        update: () => { mutations.push(`${table}:update`); return chain; },
        delete: () => { mutations.push(`${table}:delete`); return chain; },
        single: async () => {
          const result = rowsFor(scenario, table, filters);
          return { data: result.data?.[0] ?? null, error: result.error };
        },
        maybeSingle: async () => {
          const result = rowsFor(scenario, table, filters);
          return { data: result.data?.[0] ?? null, error: result.error };
        },
        then: (resolve: (value: unknown) => unknown) => resolve(rowsFor(scenario, table, filters)),
      };
      return chain;
    },
  };
  const source = readFileSync(new URL(`../${slug}/index.ts`, import.meta.url), "utf8")
    .replace(/^import .*;\r?$/gm, "");
  const compiled = transformSync(source, { loader: "ts", format: "cjs" }).code;
  let handler: (request: Request) => Promise<Response>;
  const serve = (callback: typeof handler) => { handler = callback; };
  const Deno = { serve, env: { get: () => "test" } };
  new Function(
    "createClient", "serve", "Deno", "fetch", ...Object.keys(blocks),
    compiled,
  )(
    () => client, serve, Deno, async () => new Response("", { status: 200 }), ...Object.values(blocks),
  );
  return {
    mutations,
    request: (method: string, body: object | undefined, authenticated = true) => handler!(new Request(
      `https://example.test/${
        method === "GET"
          ? slug === "prediction-comments" ? "?pool_id=pool" : "?post_id=post"
          : method === "DELETE" && slug === "prediction-comment-vote" ? "?comment_id=comment" : ""
      }`, {
      method,
      headers: authenticated ? { Authorization: "Bearer test", "Content-Type": "application/json" } : { "Content-Type": "application/json" },
      ...(method === "GET" ? {} : { body: JSON.stringify(body) }),
    })),
  };
}

test("social likes execute real handler: denied paths have exact status and no mutation", async () => {
  for (const [scenario, expected] of [
    [{ authenticated: false }, 401],
    [{ blocked: "outbound" as const }, 403],
    [{ blocked: "inbound" as const }, 403],
    [{ blockLookupFails: true }, 500],
  ]) {
    const endpoint = handlerFor("social-feed-like", scenario as Scenario);
    const response = await endpoint.request("POST", { post_id: "post" }, (scenario as Scenario).authenticated !== false);
    assert.equal(response.status, expected);
    assert.deepEqual(endpoint.mutations, []);
  }
});

test("social likes retain unblocked and own interactions", async () => {
  for (const scenario of [{}, { own: true }]) {
    const endpoint = handlerFor("social-feed-like", scenario);
    assert.equal((await endpoint.request("POST", { post_id: "post" })).status, 200);
    assert.ok(endpoint.mutations.includes("social_post_likes:insert"));
  }
});

test("social comment replies execute real handler and reject blocked parents or cross-post parents before insert", async () => {
  for (const [scenario, expected] of [[{ parentBlocked: true }, 403], [{ resourceBlocked: true }, 403], [{ parentMismatch: true }, 400]]) {
    const endpoint = handlerFor("social-feed-comments", scenario);
    const response = await endpoint.request("POST", {
      post_id: "post",
      content: "reply",
      parent_comment_id: "parent-comment",
    });
    assert.equal(response.status, expected);
    assert.deepEqual(endpoint.mutations, []);
  }
});

test("social comment GET removes a blocked parent and every nested descendant", async () => {
  const endpoint = handlerFor("social-feed-comments", {
    blocked: "outbound",
    commentRows: [
      { id: 1, user_id: "target", content: "hidden", created_at: "2026-01-01", parent_comment_id: null, users: {}, blocked: true },
      { id: 2, user_id: "visible", content: "child", created_at: "2026-01-02", parent_comment_id: 1, users: {} },
      { id: 3, user_id: "visible", content: "grandchild", created_at: "2026-01-03", parent_comment_id: 2, users: {} },
      { id: 4, user_id: "visible", content: "kept", created_at: "2026-01-04", parent_comment_id: null, users: {} },
    ],
  });
  const response = await endpoint.request("GET", undefined);
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.deepEqual(body.comments.map((comment: any) => comment.id), [4]);
});

test("prediction comment GET removes a blocked parent and every nested descendant", async () => {
  const endpoint = handlerFor("prediction-comments", {
    blocked: "outbound",
    commentRows: [
      { id: 1, user_id: "target", content: "hidden", created_at: "2026-01-01", parent_comment_id: null, blocked: true },
      { id: 2, user_id: "visible", content: "child", created_at: "2026-01-02", parent_comment_id: 1 },
      { id: 3, user_id: "visible", content: "kept", created_at: "2026-01-03", parent_comment_id: null },
    ],
  });
  const response = await endpoint.request("GET", undefined);
  assert.equal(response.status, 200);
  assert.deepEqual((await response.json()).comments.map((comment: any) => comment.id), [3]);
});

for (const blocked of ["outbound", "inbound"] as const) {
  test(`social comment GET removes blocked ${blocked} parent descendants`, async () => {
    const endpoint = handlerFor("social-feed-comments", {
      blocked,
      commentRows: [
        { id: 1, user_id: "target", content: "hidden", created_at: "2026-01-01", parent_comment_id: null, users: {}, blocked: true },
        { id: 2, user_id: "visible", content: "child", created_at: "2026-01-02", parent_comment_id: 1, users: {} },
      ],
    });
    const response = await endpoint.request("GET", undefined);
    assert.equal(response.status, 200);
    assert.deepEqual((await response.json()).comments, []);
  });
}

test("prediction comment GET removes an inbound-blocked parent and descendants", async () => {
  const endpoint = handlerFor("prediction-comments", {
    blocked: "inbound",
    commentRows: [
      { id: 1, user_id: "target", content: "hidden", created_at: "2026-01-01", parent_comment_id: null, blocked: true },
      { id: 2, user_id: "visible", content: "child", created_at: "2026-01-02", parent_comment_id: 1 },
    ],
  });
  const response = await endpoint.request("GET", undefined);
  assert.equal(response.status, 200);
  assert.deepEqual((await response.json()).comments, []);
});

test("social-feed-comments permits an unblocked post and denies an inbound block before insert", async () => {
  const allowed = handlerFor("social-feed-comments", {});
  assert.equal((await allowed.request("POST", { post_id: "post", content: "comment" })).status, 201);
  assert.ok(allowed.mutations.includes("social_post_comments:insert"));
  const denied = handlerFor("social-feed-comments", { blocked: "inbound" });
  assert.equal((await denied.request("POST", { post_id: "post", content: "comment" })).status, 403);
  assert.deepEqual(denied.mutations, []);
});

test("prediction-comments permits an unblocked post and denies both block directions before insert", async () => {
  for (const scenario of [{}, { blocked: "outbound" as const }, { blocked: "inbound" as const }]) {
    const endpoint = handlerFor("prediction-comments", scenario);
    const response = await endpoint.request("POST", { pool_id: "pool", content: "comment" });
    assert.equal(response.status, scenario.blocked ? 403 : 201);
    if (scenario.blocked) assert.deepEqual(endpoint.mutations, []);
    else assert.ok(endpoint.mutations.includes("prediction_comments:insert"));
  }
});

test("active blocks do not prevent own comment-vote and hot-take toggle-off retractions", async () => {
  const commentVote = handlerFor("comment-vote", { blocked: "outbound", existingVote: true });
  assert.equal((await commentVote.request("POST", { comment_id: 1, direction: "up" })).status, 200);
  assert.ok(commentVote.mutations.includes("social_comment_votes:delete"));
  const hotTake = handlerFor("hot-take-vote", { blocked: "outbound", existingVote: true });
  assert.equal((await hotTake.request("POST", { postId: "post", voteType: "fire" })).status, 200);
  assert.ok(hotTake.mutations.includes("hot_take_votes:delete"));
  assert.ok(hotTake.mutations.includes("social_posts:update"));
});

test("every protected interaction handler permits an unblocked create and denies both block directions before mutation", async () => {
  const cases: Array<[Parameters<typeof handlerFor>[0], object]> = [
    ["social-comment-like", { comment_id: "comment" }],
    ["prediction-like", { pool_id: "pool" }],
    ["comment-vote", { comment_id: 1, direction: "up" }],
    ["prediction-comment-vote", { comment_id: "comment", vote_type: 1 }],
    ["hot-take-vote", { postId: "post", voteType: "fire" }],
  ];
  for (const [slug, body] of cases) {
    const allowed = handlerFor(slug, {});
    assert.equal((await allowed.request("POST", body)).status, 200, `${slug} unblocked create`);
    assert.ok(allowed.mutations.some((mutation) => mutation.endsWith(":insert")), `${slug} inserts when allowed`);
    for (const blocked of ["outbound", "inbound"] as const) {
      const denied = handlerFor(slug, { blocked });
      assert.equal((await denied.request("POST", body)).status, 403, `${slug} ${blocked} block`);
      assert.deepEqual(denied.mutations, [], `${slug} ${blocked} has no mutation`);
    }
  }
});

test("every protected interaction handler rejects unauthenticated and failed block lookups before mutation", async () => {
  const cases: Array<[Parameters<typeof handlerFor>[0], object]> = [
    ["social-feed-like", { post_id: "post" }],
    ["social-comment-like", { comment_id: "comment" }],
    ["prediction-like", { pool_id: "pool" }],
    ["comment-vote", { comment_id: 1, direction: "up" }],
    ["prediction-comment-vote", { comment_id: "comment", vote_type: 1 }],
    ["hot-take-vote", { postId: "post", voteType: "fire" }],
    ["social-feed-comments", { post_id: "post", content: "comment" }],
    ["prediction-comments", { pool_id: "pool", content: "comment" }],
  ];
  for (const [slug, body] of cases) {
    const unauthenticated = handlerFor(slug, { authenticated: false });
    assert.equal((await unauthenticated.request("POST", body, false)).status, 401, `${slug} unauthenticated`);
    assert.deepEqual(unauthenticated.mutations, [], `${slug} unauthenticated has no mutation`);
    const failedLookup = handlerFor(slug, { blockLookupFails: true });
    assert.equal((await failedLookup.request("POST", body)).status, 500, `${slug} lookup failure`);
    assert.deepEqual(failedLookup.mutations, [], `${slug} lookup failure has no mutation`);
  }
});

test("own unlike and explicit unvote DELETE paths remain available", async () => {
  const cases: Array<[Parameters<typeof handlerFor>[0], object]> = [
    ["social-feed-like", { post_id: "post" }],
    ["social-comment-like", { comment_id: "comment" }],
    ["prediction-like", { pool_id: "pool" }],
    ["prediction-comment-vote", {}],
  ];
  for (const [slug, body] of cases) {
    const endpoint = handlerFor(slug, { blocked: "outbound", own: true });
    assert.equal((await endpoint.request("DELETE", body)).status, 200, `${slug} own retract`);
    assert.ok(endpoint.mutations.some((mutation) => mutation.endsWith(":delete")), `${slug} deletes own state`);
  }
});