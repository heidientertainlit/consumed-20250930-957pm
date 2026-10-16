// A disposable PostgreSQL cluster under /tmp. Never connects to a configured DB,
// Supabase, DATABASE_URL, or the project's unused Replit PostgreSQL instance.
import assert from "node:assert/strict";
import { execFile, execFileSync } from "node:child_process";
import { promisify } from "node:util";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
const root = mkdtempSync(path.join(os.tmpdir(), "similarity-pg-"));
const data = path.join(root, "data"), port = "55439";
let running = false;
const run = (bin, args, input) => execFileSync(bin, args, { encoding: "utf8", input, stdio: ["pipe", "pipe", "pipe"] });
const sql = text => run("psql", ["-h", root, "-p", port, "-d", "postgres", "-At", "-v", "ON_ERROR_STOP=1"], text).trim();
const exec = promisify(execFile);
const rpcAsync = async (action, payload) => {
  const query = `select public.media_similarity_store('${action}', '${JSON.stringify(payload).replaceAll("'", "''")}'::jsonb);`;
  const { stdout } = await exec("psql", ["-h", root, "-p", port, "-d", "postgres", "-At", "-v", "ON_ERROR_STOP=1", "-c", query]);
  return JSON.parse(stdout.trim());
};
const rpc = (action, payload = {}) => JSON.parse(sql(`select public.media_similarity_store('${action}', '${JSON.stringify(payload).replaceAll("'", "''")}'::jsonb);`));
const actor = "11111111-1111-1111-1111-111111111111";
const id = { source: "tmdb", externalId: "777", type: "movie" };
const key = JSON.stringify([1, id.type, id.source, id.externalId]);
const cards = [1, 2].map(n => ({ title: `Book ${n}`, type: "book", external_source: "openlibrary", external_id: `OL${n}W`, poster_url: "" }));
try {
  run("initdb", ["-D", data, "-U", "postgres", "-A", "trust", "--no-locale"]);
  run("pg_ctl", ["-D", data, "-l", path.join(root, "postgres.log"), "-o", `-k ${root} -p ${port} -h ''`, "-w", "start"]);
  running = true;
  sql("create role anon; create role authenticated; create role service_role;");
  sql(readFileSync("supabase/migrations/20261016060000_consumer_media_similarity.sql", "utf8"));
  assert.equal(rpc("read", { key }).fresh, false);
  const claim = rpc("claim", { key, identity: id, actor });
  assert.ok(claim.token);
  assert.equal(rpc("claim", { key, identity: id, actor }).preparing, true);
  assert.equal(sql("select reserved from public.media_similarity_daily_spend"), "0.250000");
  assert.equal(rpc("finish", { key, token: claim.token, items: cards, cost: 0.001 }).published, true);
  assert.equal(rpc("read", { key }).items.length, 2);
  assert.equal(rpc("read", { key }).fresh, true);
  assert.equal(sql("select spent || ':' || reserved from public.media_similarity_daily_spend"), "0.001000:0.000000");
  assert.deepEqual(rpc("claim", { key, identity: id, actor }), {});
  sql("update public.media_similarity_entries set refresh_after=now()-interval '1 day' where kind='result';");
  const refresh = rpc("claim", { key, identity: id, actor });
  assert.ok(refresh.token);
  assert.equal(rpc("read", { key }).items.length, 2, "Stale cards must remain readable during refresh");
  assert.equal(rpc("finish", { key, token: claim.token, items: [], cost: 0 }).superseded, true);
  assert.equal(rpc("finish", { key, token: refresh.token, items: [cards[0]], cost: 0.002 }).published, false);
  assert.equal(rpc("read", { key }).items.length, 2, "A depleted refresh must not erase useful results");
  assert.deepEqual(rpc("claim", { key, identity: id, actor }), {}, "Failure cooldown");
  assert.throws(() => sql("set role authenticated; select public.media_similarity_store('pool','{}');"), /./);
  assert.throws(() => sql("set role anon; select * from public.media_similarity_entries;"), /./);
  assert.throws(() => rpc("save_profile", { key: "bad", identity: id, work: { status: "embedded" } }), /./);
  rpc("save_profile", { key: "profile", identity: id, work: { source_verified: true, status: "embedded", title: "Verified" } });
  assert.equal(rpc("pool").length, 1);
  // Exhaustion is enforced globally, not once for each account.
  sql("update public.media_similarity_daily_spend set spent=1;");
  assert.deepEqual(rpc("claim", { key: "different", identity: id, actor }), {});
  assert.equal(sql("select reserved from public.media_similarity_daily_spend"), "0.000000");
  sql("update public.media_similarity_daily_spend set spent=0;");
  const abandoned = rpc("claim", { key: "abandoned", identity: id, actor });
  sql("update public.media_similarity_entries set lease_until=now()-interval '1 minute' where cache_key='abandoned';");
  const replacement = rpc("claim", { key: "abandoned", identity: id, actor });
  assert.notEqual(replacement.token, abandoned.token);
  assert.equal(sql("select spent || ':' || reserved from public.media_similarity_daily_spend"), "0.250000:0.250000");
  assert.equal(rpc("finish", { key: "abandoned", token: abandoned.token, items: cards, cost: 0 }).superseded, true);
  rpc("finish", { key: "abandoned", token: replacement.token, items: cards, cost: 0 });
  sql("update public.media_similarity_daily_spend set spent=0;");
  // Actual independent DB sessions race for one lease, not a mocked lock.
  const races = await Promise.all(Array.from({ length: 4 }, () => rpcAsync("claim", { key: "concurrent", identity: id, actor })));
  assert.equal(races.filter(r => r.token).length, 1);
  assert.equal(races.filter(r => r.preparing).length, 3);
  rpc("finish", { key: "concurrent", token: races.find(r => r.token).token, items: cards, cost: 0 });
  // Different titles/accounts must still share one atomic daily ceiling.
  const requests = await Promise.all(Array.from({ length: 8 }, (_, n) => rpcAsync("claim",
    { key: `global-${n}`, identity: id, actor: `22222222-2222-2222-2222-${String(n).padStart(12, "0")}` })));
  assert.equal(requests.filter(r => r.token).length, 4);
  assert.equal(sql("select reserved from public.media_similarity_daily_spend"), "1.000000");
  sql("set role service_role; select public.media_similarity_store('pool','{}');");
  console.log("PASS isolated PostgreSQL: grants, concurrent shared leases/global cap, stale reads, settlement, cooldown, expired workers, profile verification.");
} finally {
  if (running) run("pg_ctl", ["-D", data, "-m", "immediate", "-w", "stop"]);
  rmSync(root, { recursive: true, force: true });
}
