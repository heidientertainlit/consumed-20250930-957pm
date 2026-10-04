import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { build } from "esbuild";

test("approval carries verified media IDs into scheduling without changing content or making provider calls", async () => {
  const inserts: any[] = [];
  let handler: any;
  const draft = {
    id: "draft", persona_user_id: "persona", post_type: "review", content: "Still a favorite.",
    rating: 4, media_title: "Jurassic Park", media_type: "movie", media_creator: null,
    ai_notes: JSON.stringify({ generation: { version: 1, externalId: "329", externalSource: "tmdb" } }),
  };
  const db = {
    from(table: string) {
      const query: any = {
        select() { return query; }, eq() { return query; },
        single: async () => ({ data: draft, error: null }),
        insert: async (data: any) => { inserts.push({ table, data }); return { error: null }; },
        update() { return query; },
        then(resolve: any) { return Promise.resolve({ error: null }).then(resolve); },
      };
      return query;
    },
  };
  const compiled = await build({
    entryPoints: ["supabase/functions/admin-approve-draft/index.ts"],
    bundle: true, write: false, format: "cjs", platform: "node", logLevel: "silent",
    plugins: [{
      name: "isolated-approval-adapters",
      setup(builder) {
        builder.onResolve({ filter: /^https:\/\// }, args => ({ path: args.path, namespace: "adapter" }));
        builder.onResolve({ filter: /authorization\.ts$/ }, () => ({ path: "auth", namespace: "adapter" }));
        builder.onLoad({ filter: /.*/, namespace: "adapter" }, args => ({
          contents: args.path === "auth" ? "export async function authorizeAdminOrService() { return { authorized:true }; }"
            : args.path.includes("supabase-js") ? "export function createClient() { return globalThis.db; }"
            : "export function serve(handler) { globalThis.capture(handler); }",
        }));
      },
    }],
  });
  vm.runInNewContext(compiled.outputFiles[0].text, {
    db, capture: (value: any) => { handler = value; }, Request, Response, console, Date,
    Deno: { env: { get: () => "test-only" } },
    fetch: () => { throw new Error("Approval must not call providers or generate content"); },
  });
  const response = await handler(new Request("https://test.invalid/approval", {
    method: "POST", body: JSON.stringify({ draft_id: "draft", scheduled_for: "2026-10-04T12:00:00Z" }),
  }));
  assert.equal(response.status, 200);
  assert.equal(inserts.length, 1);
  assert.equal(inserts[0].table, "scheduled_persona_posts");
  assert.equal(inserts[0].data.media_external_id, "329");
  assert.equal(inserts[0].data.media_external_source, "tmdb");
  assert.equal(inserts[0].data.content, draft.content);
  assert.equal(inserts[0].data.rating, draft.rating);
  assert.equal(inserts[0].data.posted, false);
});