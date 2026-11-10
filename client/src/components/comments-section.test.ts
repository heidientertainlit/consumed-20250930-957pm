import assert from "node:assert/strict";
import test, { after } from "node:test";
import { readFileSync } from "node:fs";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Router } from "wouter";
import { createServer } from "vite";

const vite = await createServer({
  cacheDir: "node_modules/.vite-comments-section-test",
  plugins: [{
    name: "comments-test-media-search-boundary",
    enforce: "pre",
    // Media search is not rendered in these comment-byline tests. Its
    // native auth/push dependencies cannot run in a server-rendered test.
    transform(_source, id) {
      if (id.split("?")[0].endsWith("/components/media-rec-input.tsx")) {
        return "export default function MediaRecInput() { return null; }";
      }
    },
  }],
  server: { middlewareMode: true },
  appType: "custom",
  optimizeDeps: { noDiscovery: true },
});
after(() => vite.close());
const { default: CommentsSection } = await vite.ssrLoadModule("/src/components/comments-section.tsx");

const comment = (id: string, userId: string, displayName: string, username: string, replies: any[] = []) => ({
  id,
  content: "I agree with @morgan_handle",
  createdAt: "2026-01-01T00:00:00Z",
  user: { id: userId, displayName, username, avatar: "" },
  upVoteCount: 2,
  downVoteCount: 1,
  currentUserVote: "up",
  replies,
});

function renderComments(comments: any[]) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
  client.setQueryData(["blocked-user-ids", "viewer"], []);
  client.setQueryData(["post-comments", "post-1", "viewer", ""], comments);
  try {
    return renderToStaticMarkup(
      React.createElement(QueryClientProvider, { client },
        React.createElement(Router, { ssrPath: "/" },
          React.createElement(CommentsSection, {
            postId: "post-1",
            fetchComments: async () => { throw new Error("Rendering must not fetch or change comments"); },
            session: { user: { id: "viewer" } },
            currentUserId: "viewer",
            commentInput: "",
            onCommentInputChange() {},
            onSubmitComment() {},
            onDeleteComment() {},
            onReportComment() {},
            onVoteComment() {},
            isSubmitting: false,
          }),
        ),
      ),
    );
  } finally {
    client.clear();
  }
}

test("comment and nested reply bylines abbreviate names without changing stored identities", () => {
  const comments = [
    comment("root", "viewer", "Alex Morgan", "alex_handle", [
      comment("reply", "reply-user", "Jamie Lee Chen", "jamie_handle", [
        comment("nested", "nested-user", "Élodie García", "elodie_handle"),
      ]),
    ]),
  ];
  const original = structuredClone(comments);
  const html = renderComments(comments);
  for (const name of ["Alex M.", "Jamie C.", "Élodie G."]) {
    assert.ok(html.includes(name), `Missing abbreviated byline: ${name}`);
  }
  for (const name of ["Alex Morgan", "Jamie Lee Chen", "Élodie García"]) {
    assert.ok(!html.includes(name), `Full name leaked in a comment byline: ${name}`);
  }
  assert.deepEqual(comments, original, "Formatting must not mutate raw names, usernames, or IDs");
});

test("single names and missing-name fallbacks keep comments renderable", () => {
  const html = renderComments([
    comment("single", "single-user", "Cher", "cher_handle"),
    comment("fallback", "fallback-user", "", "screen_handle"),
    comment("missing", "missing-user", "", ""),
  ]);
  assert.match(html, /— Cher ·/);
  assert.match(html, /— screen_handle ·/);
  assert.match(html, /— User ·/);
});

test("profile links, raw mentions, and existing comment controls are preserved", () => {
  const html = renderComments([
    comment("root", "viewer", "Alex Morgan", "alex_handle", [
      comment("reply", "reply-user", "Jamie Chen", "jamie_handle"),
    ]),
  ]);
  assert.match(html, /href="\/user\/viewer"/);
  assert.match(html, /href="\/user\/reply-user"/);
  assert.match(html, /href="\/user\/morgan_handle"/);
  assert.match(html, /@morgan_handle/);
  assert.match(html, /data-testid="button-delete-comment-root"/);
  assert.match(html, /data-testid="button-like-comment-reply"/);
  assert.match(html, /title="Report comment"/);
  const source = readFileSync(new URL("./comments-section.tsx", import.meta.url), "utf8");
  assert.match(source, /onReportComment\(comment\.id, comment\.user\.id, comment\.user\.username\)/);
  assert.match(source, /onDeleteComment\(comment\.id, postId\)/);
  assert.match(source, /onSubmitReply\(comment\.id, replyContent\)/);
});
