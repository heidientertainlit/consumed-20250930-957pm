// Real delivery handler + real PostgreSQL RPCs, on the disposable test socket.
// No provider/network calls, production credentials, or production database.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { build } from "esbuild";

const socket = process.env.PERSONA_LOCAL_PG_SOCKET || "";
const port = process.env.PERSONA_LOCAL_PG_PORT || "";
if (!/^\/tmp\/persona-conversation-sock\.[A-Za-z0-9]+$/.test(socket) || port !== "55449") {
  throw new Error("Integration requires the disposable persona test socket/port");
}
const sql = (query: string) => execFileSync("psql", [
  "-X", "-qAt", "-w", "-v", "ON_ERROR_STOP=1", "-h", socket, "-p", port,
  "-U", "runner", "-d", "postgres", "-c", query,
], { encoding: "utf8" }).trim();
const readJSON = (query: string) => JSON.parse(sql(query) || "null");
const run = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const admin = "11111111-1111-4111-8111-111111111111";
const due = new Date(Date.now() - 86_400_000).toISOString();
const fakeCredential = "fixture-only-not-a-real-key";
const g = globalThis as any;
g.Deno = { env: { get: (key: string) => ({
  SUPABASE_URL: "https://fixture.invalid", SUPABASE_SERVICE_ROLE_KEY: fakeCredential,
} as Record<string, string>)[key] } };
g.localConversationDB = {
  from: (table: string) => {
    assert.equal(table, "persona_conversation_runs");
    const filters: string[] = [];
    let limit = 0;
    const q: any = {
      select: (columns: string) => { assert.equal(columns, "id"); return q; },
      eq: (column: string, value: string) => {
        assert.equal(column, "status"); assert.equal(value, "scheduled");
        filters.push("status='scheduled'"); return q;
      },
      lte: (column: string, value: string) => {
        assert.equal(column, "start_at"); assert(Number.isFinite(Date.parse(value)));
        filters.push(`start_at<='${new Date(value).toISOString()}'::timestamptz`); return q;
      },
      or: (value: string) => {
        const match = /^next_attempt_at\.is\.null,next_attempt_at\.lte\.(.+)$/.exec(value);
        assert(match && Number.isFinite(Date.parse(match[1])));
        filters.push(`(next_attempt_at is null or next_attempt_at<='${new Date(match[1]).toISOString()}'::timestamptz)`);
        return q;
      },
      order: (column: string) => { assert.equal(column, "start_at"); return q; },
      limit: (value: number) => { assert.equal(value, 20); limit = value; return q; },
      then: (resolve: any, reject: any) => {
        assert.equal(filters.length, 3); assert.equal(limit, 20);
        const data = readJSON(`select coalesce(json_agg(r),'[]'::json) from (
          select id from persona_conversation_runs where ${filters.join(" and ")}
          order by start_at limit ${limit}) r`);
        return Promise.resolve({ data, error: null }).then(resolve, reject);
      },
    };
    return q;
  },
  rpc: async (name: string, args: { p_run: string }) => {
    assert.equal(name, "deliver_persona_conversation");
    assert(/^[0-9a-f-]{36}$/.test(args.p_run));
    return { data: readJSON(`select deliver_persona_conversation('${args.p_run}'::uuid)`), error: null };
  },
};
const bundled = await build({
  entryPoints: ["supabase/functions/deliver-persona-conversations/index.ts"],
  bundle: true, write: false, format: "esm", platform: "node",
  plugins: [{
    name: "local-only-transports",
    setup(builder) {
      builder.onResolve({ filter: /^https:\/\// }, args => ({ path: args.path, namespace: "fixture" }));
      builder.onLoad({ filter: /.*/, namespace: "fixture" }, args => ({
        contents: args.path.includes("/http/server")
          ? "export const serve=fn=>{globalThis.localConversationWorker=fn;};"
          : "export const createClient=()=>globalThis.localConversationDB;",
        loader: "js",
      }));
    },
  }],
});
await import(`data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString("base64")}`);
const tick = async () => {
  const response = await g.localConversationWorker(new Request("https://fixture.invalid", {
    method: "POST", headers: { Authorization: `Bearer ${fakeCredential}` }, body: "{}",
  }));
  assert.equal(response.status, 200);
  return response.json();
};
const count = () => Number(sql(`select count(*) from social_posts where persona_conversation_id='${run}'`));
sql(`insert into persona_conversation_runs(id,created_by,topic,participant_ids,opening_author_id,messages)
  values('${run}','${admin}','End-to-end scheduled conversation',roster(),(roster())[1],messages())`);
assert.equal((await tick()).results.length, 0);
assert.equal(count(), 0);
sql(`select manage_persona_conversation('${admin}','approve','${run}',1)`);
assert.equal((await tick()).results.length, 0, "Approval alone must not publish");
sql(`select manage_persona_conversation('${admin}','schedule','${run}',2,
  jsonb_build_object('startAt',now()+interval '1 hour'))`);
assert.equal((await tick()).results.length, 0, "Scheduling must not publish early");
sql(`update persona_conversation_runs set start_at='${due}' where id='${run}'`);
assert.equal(readJSON("select dispatch_due_persona_conversations()").status, "enqueued");
assert.equal((await tick()).results[0].status, "delivered");
assert.equal(count(), 1);
assert.equal(sql(`select rating is null from social_posts where persona_conversation_id='${run}'`), "t");
await tick();
assert.equal(count(), 1, "Repeated ticks must not duplicate the opening");
sql(`select manage_persona_conversation('${admin}','pause','${run}',3)`);
assert.equal((await tick()).results.length, 0);
sql(`select manage_persona_conversation('${admin}','schedule','${run}',4,
  jsonb_build_object('startAt',now()+interval '1 hour'))`);
sql(`update persona_conversation_runs set start_at='${due}',last_delivered_at=now()-interval '2 minutes',
  next_attempt_at=now()-interval '1 minute' where id='${run}'`);
assert.equal((await tick()).results[0].status, "delivered");
sql(`update persona_conversation_runs set last_delivered_at=now()-interval '2 minutes',
  next_attempt_at=now()-interval '1 minute' where id='${run}'`);
assert.equal((await tick()).results[0].status, "delivered");
assert.equal(sql(`select status from persona_conversation_runs where id='${run}'`), "completed");
assert.equal(sql(`select comments_count from social_posts where persona_conversation_id='${run}'`), "2");
await tick();
assert.equal(count(), 1);
console.log("PASS: real worker + real RPCs: private draft, approval, future scheduling, timer, opening, pause/resume, replies, completion and no duplicates");
