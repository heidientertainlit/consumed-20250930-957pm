#!/usr/bin/env node
/**
 * Isolated regression harness for the report and block paths.
 *
 * It starts a disposable PostgreSQL cluster and never reads project env files,
 * Supabase configuration, or network credentials.  Deno edge handlers are
 * transpiled from their checked-in sources and registered against the fake
 * Supabase clients below; mutations are executed against the disposable
 * database.  The report sheet is also bundled from its real TSX source and
 * exercised in a local headless browser.
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { createServer } from "node:http";
import { existsSync, readFileSync } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { build, transformSync } from "esbuild";
import { chromium } from "playwright";
import { QueryClient } from "@tanstack/react-query";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const cliArguments = process.argv.slice(2);
const requestedMode = process.env.REPORT_BLOCK_TEST_MODE ||
  (cliArguments[0] === "--mode" ? cliArguments[1] : cliArguments.find((argument) => argument.startsWith("--mode="))?.slice("--mode=".length)) ||
  cliArguments.find((argument) => argument === "baseline" || argument === "postrepair") ||
  "baseline";
const testMode = requestedMode.toLowerCase();
assert.ok(testMode === "baseline" || testMode === "postrepair", `unsupported report/block test mode: ${requestedMode}`);
const reporterId = "00000000-0000-4000-8000-000000000001";
const blockedId = "00000000-0000-4000-8000-000000000002";
const otherId = "00000000-0000-4000-8000-000000000003";
const port = Number(process.env.REPORT_BLOCK_TEST_PG_PORT || 55500 + (process.pid % 1000));
const dataDir = await mkdtemp(join(tmpdir(), "consumed-report-block-pg-"));
const socketDir = await mkdtemp(join(tmpdir(), "consumed-report-block-socket-"));
const tempDir = await mkdtemp(join(tmpdir(), "consumed-report-block-ui-"));
const postgresLog = join(tempDir, "postgres.log");
const psqlBase = ["-X", "-v", "ON_ERROR_STOP=1", "-h", socketDir, "-p", String(port), "-U", "runner", "-d", "postgres"];

let postgresStarted = false;
let lastDatabaseError = "";

function psql(sql, { allowFailure = false } = {}) {
  const result = spawnSync("psql", [...psqlBase, "-Atq", "-c", sql], { encoding: "utf8" });
  if (result.status === 0) return result.stdout.trim();
  lastDatabaseError = `${result.stdout}${result.stderr}`;
  if (allowFailure) return null;
  throw new Error(`local PostgreSQL command failed:\n${lastDatabaseError}`);
}

function psqlFile(filePath) {
  const result = spawnSync("psql", [...psqlBase, "-f", filePath], { encoding: "utf8" });
  if (result.status === 0) return result.stdout.trim();
  lastDatabaseError = `${result.stdout}${result.stderr}`;
  throw new Error(`local PostgreSQL migration failed:\n${lastDatabaseError}`);
}

function sqlString(value) {
  if (value === null || value === undefined) return "null";
  return `'${String(value).replaceAll("'", "''")}'`;
}

function reportRows() {
  const output = psql("select reporter_id || '|' || content_type || '|' || content_id || '|' || reason || '|' || coalesce(reported_user_id::text, '') || '|' || status from public.content_reports order by created_at, id");
  return output ? output.split("\n") : [];
}

function blockRows() {
  const output = psql("select blocker_id || '|' || blocked_id from public.user_blocks order by blocker_id, blocked_id");
  return output ? output.split("\n") : [];
}

function loadDenoHandler(relativePath, extraArguments = {}) {
  let handler;
  const source = transformSync(
    // Imports are deliberately injected below, which lets this execute the
    // actual checked-in Deno callback without resolving remote specifiers.
    readFileSync(join(root, relativePath), "utf8").replace(/^import .*;\r?$/gm, ""),
    { loader: "ts", format: "cjs", target: "es2022" },
  ).code;
  const names = ["serve", "createClient", "Deno", ...Object.keys(extraArguments)];
  const values = [
    (callback) => { handler = callback; },
    (...args) => fakeCreateClient(...args),
    { env: { get: (key) => key === "SUPABASE_SERVICE_ROLE_KEY" ? "local-service-role" : "local-anon-key" } },
    ...Object.values(extraArguments),
  ];
  new Function(...names, source)(...values);
  assert.equal(typeof handler, "function", `${relativePath} must register a serve handler`);
  return handler;
}

function fakeCreateClient(_url, key) {
  const service = key === "local-service-role";
  return service ? serviceClient() : authenticatedClient();
}

function authenticatedClient() {
  return {
    auth: {
      getUser: async () => ({ data: { user: { id: reporterId, email: "reporter@example.test", user_metadata: {} } }, error: null }),
    },
    rpc: async (name) => {
      assert.equal(name, "get_my_account_profile");
      return { data: { id: reporterId, user_name: "reporter" }, error: null };
    },
    from(table) {
      // The social-feed GET fixture checks the viewer's prediction votes and
      // post likes even when this minimal fixture has neither.
      if (table === "user_predictions" || table === "social_post_likes") return chainResult([]);
      throw new Error(`unexpected authenticated table in report/block baseline: ${table}`);
    },
  };
}

function chainResult(data, error = null) {
  const builder = {
    select() { return builder; },
    eq() { return builder; },
    in() { return builder; },
    order() { return builder; },
    range() { return builder; },
    not() { return builder; },
    neq() { return builder; },
    is() { return builder; },
    maybeSingle: async () => ({ data: Array.isArray(data) ? data[0] || null : data, error }),
    single: async () => ({ data: Array.isArray(data) ? data[0] || null : data, error }),
    then(resolve, reject) { return Promise.resolve({ data, error }).then(resolve, reject); },
  };
  return builder;
}

function serviceClient() {
  return {
    from(table) {
      if (table === "content_reports") return contentReportsBuilder();
      if (table === "user_blocks") return userBlocksBuilder();
      if (table === "social_posts") return socialPostsBuilder();
      if (table === "users") return usersBuilder();
      throw new Error(`unexpected service table in report/block baseline: ${table}`);
    },
  };
}

function contentReportsBuilder() {
  let filters = {};
  let pendingInsert = null;
  const builder = {
    select() { return builder; },
    eq(column, value) { filters[column] = value; return builder; },
    insert(value) { pendingInsert = value; return builder; },
    async maybeSingle() {
      const where = [
        `reporter_id = ${sqlString(filters.reporter_id)}`,
        `content_type = ${sqlString(filters.content_type)}`,
        `content_id = ${sqlString(filters.content_id)}`,
      ].join(" and ");
      const id = psql(`select id from public.content_reports where ${where} limit 1`);
      return { data: id ? { id } : null, error: null };
    },
    async single() {
      assert.ok(pendingInsert, "report handler must insert before selecting");
      const columns = ["reporter_id", "content_type", "content_id", "reason", "description", "reported_user_id", "status"];
      const values = columns.map((column) => sqlString(pendingInsert[column])).join(", ");
      const id = psql(
        `insert into public.content_reports (${columns.join(", ")}) values (${values}) returning id`,
        { allowFailure: true },
      );
      if (id === null) return { data: null, error: { message: lastDatabaseError.trim() } };
      return { data: { id }, error: null };
    },
  };
  return builder;
}

function userBlocksBuilder() {
  let filters = {};
  let pendingInsert = null;
  let deleting = false;
  let selectedColumns = "";
  const builder = {
    select(columns) { selectedColumns = columns; return builder; },
    eq(column, value) { filters[column] = value; return builder; },
    insert(value) { pendingInsert = value; return builder; },
    delete() { deleting = true; return builder; },
    async maybeSingle() {
      const id = psql(
        `select id from public.user_blocks where blocker_id = ${sqlString(filters.blocker_id)} and blocked_id = ${sqlString(filters.blocked_id)} limit 1`,
      );
      return { data: id ? { id } : null, error: null };
    },
    then(resolve, reject) {
      let error = null;
      if (pendingInsert) {
        const inserted = psql(
          `insert into public.user_blocks (blocker_id, blocked_id) values (${sqlString(pendingInsert.blocker_id)}, ${sqlString(pendingInsert.blocked_id)})`,
          { allowFailure: true },
        );
        if (inserted === null) error = { message: lastDatabaseError.trim() };
      } else if (deleting) {
        const deleted = psql(
          `delete from public.user_blocks where blocker_id = ${sqlString(filters.blocker_id)} and blocked_id = ${sqlString(filters.blocked_id)}`,
          { allowFailure: true },
        );
        if (deleted === null) error = { message: lastDatabaseError.trim() };
      }
      if (!pendingInsert && !deleting) {
        const selectedColumn = selectedColumns === "blocked_id" ? "blocked_id" : "blocker_id";
        const whereColumn = filters.blocker_id ? "blocker_id" : "blocked_id";
        const rows = psql(
          `select ${selectedColumn} from public.user_blocks where ${whereColumn} = ${sqlString(filters[whereColumn])} order by ${selectedColumn}`,
        );
        const data = rows ? rows.split("\n").map((value) => ({ [selectedColumn]: value })) : [];
        return Promise.resolve({ data, error: null }).then(resolve, reject);
      }
      return Promise.resolve({ data: null, error }).then(resolve, reject);
    },
  };
  return builder;
}

function socialPostsBuilder() {
  const excludedUserIds = new Set();
  const builder = {
    select() { return builder; },
    eq() { return builder; },
    order() { return builder; },
    range() { return builder; },
    neq() { return builder; },
    is() { return builder; },
    not(column, operator, value) {
      if (column === "user_id" && operator === "in") {
        for (const id of String(value).replace(/[()]/g, "").split(",")) if (id) excludedUserIds.add(id);
      }
      return builder;
    },
    then(resolve, reject) {
      const rows = psql("select id || '|' || user_id || '|' || content || '|' || post_type || '|' || created_at from public.social_posts order by created_at desc")
        .split("\n")
        .filter(Boolean)
        .map((line) => {
          const [id, user_id, content, post_type, created_at] = line.split("|");
          return {
            id, user_id, content, post_type, created_at,
            rating: null, progress: null, likes_count: 0, comments_count: 0,
            media_title: null, media_type: null, media_creator: null, image_url: null,
            media_external_id: null, media_external_source: null, canonical_media_id: null,
            media_season_number: null, media_episode_number: null, media_episode_title: null,
            media_description: null, contains_spoilers: false, fire_votes: 0, ice_votes: 0,
            prediction_pool_id: null, list_id: null, rank_id: null, rec_category: null, room_id: null,
          };
        })
        .filter((row) => !excludedUserIds.has(row.user_id));
      return Promise.resolve({ data: rows, error: null }).then(resolve, reject);
    },
  };
  return builder;
}

function usersBuilder() {
  const builder = {
    select() { return builder; },
    in(_column, ids) {
      return Promise.resolve({
        data: ids.map((id) => ({ id, user_name: id === otherId ? "other" : "blocked", display_name: id === otherId ? "Other" : "Blocked", first_name: "", last_name: "", avatar: "", is_persona: false })),
        error: null,
      });
    },
  };
  return builder;
}

async function responseJson(handler, path, body, { authorization = "Bearer local-test-token", method = "POST" } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (authorization) headers.Authorization = authorization;
  const response = await handler(new Request(`http://fixture.invalid/${path}`, { method, headers, body: JSON.stringify(body) }));
  return { response, body: await response.json() };
}

function loadClientBlockCache() {
  const source = readFileSync(join(root, "client/src/lib/block-user.ts"), "utf8").replace(/^import type .*;\r?$/gm, "");
  const module = { exports: {} };
  new Function("exports", "module", transformSync(source, { loader: "ts", format: "cjs", target: "es2022" }).code)(module.exports, module);
  return module.exports;
}

async function buildAndExerciseReportSheet(reportHandler) {
  const entry = join(tempDir, "report-sheet-entry.tsx");
  const bundle = join(tempDir, "report-sheet-bundle.js");
  await writeFile(entry, `
    import React from "react";
    import { createRoot } from "react-dom/client";
    import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
    import { ReportSheet } from ${JSON.stringify(join(root, "client/src/components/report-sheet.tsx"))};
    createRoot(document.getElementById("root")).render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { mutations: { retry: false } } })}>
        <ReportSheet isOpen={true} onClose={() => {}} contentType="post" contentId="ui-post-1" reportedUserId=${JSON.stringify(blockedId)} reportedUserName="blocked" />
      </QueryClientProvider>
    );
  `);

  const serverRequests = [];
  const server = createServer(async (request, response) => {
    if (request.url === "/report-sheet-bundle.js") {
      response.setHeader("Content-Type", "text/javascript");
      response.end(await readFile(bundle));
      return;
    }
    if (request.url === "/") {
      response.setHeader("Content-Type", "text/html");
      response.end('<!doctype html><html><body><div id="root"></div><script src="/report-sheet-bundle.js"></script></body></html>');
      return;
    }
    if (request.url === "/functions/v1/report-content" && request.method === "POST") {
      let raw = "";
      for await (const chunk of request) raw += chunk;
      serverRequests.push({ headers: request.headers, body: JSON.parse(raw) });
      const edgeResponse = await reportHandler(new Request("http://fixture.invalid/report-content", {
        method: "POST",
        // Do not forward Node's hop-by-hop/content-length headers into the
        // Fetch Request used to invoke the handler.
        headers: {
          Authorization: request.headers.authorization || "",
          "Content-Type": request.headers["content-type"] || "application/json",
          apikey: request.headers.apikey || "",
        },
        body: raw,
      }));
      response.writeHead(edgeResponse.status, Object.fromEntries(edgeResponse.headers));
      response.end(await edgeResponse.text());
      return;
    }
    response.writeHead(404).end();
  });
  await new Promise((resolveListen) => server.listen(0, "127.0.0.1", resolveListen));
  const serverPort = server.address().port;

  const aliases = {
    name: "report-sheet-fixture-aliases",
    setup(buildApi) {
      buildApi.onResolve({ filter: /^@\/lib\/auth$/ }, () => ({ path: "auth", namespace: "fixture" }));
      buildApi.onResolve({ filter: /^@\/hooks\/use-toast$/ }, () => ({ path: "toast", namespace: "fixture" }));
      buildApi.onResolve({ filter: /^@\/lib\/supabase$/ }, () => ({ path: "supabase", namespace: "fixture" }));
      buildApi.onResolve({ filter: /^@\// }, (args) => {
        const base = join(root, "client/src", args.path.slice(2));
        for (const extension of [".tsx", ".ts"]) if (existsSync(`${base}${extension}`)) return { path: `${base}${extension}` };
        return { errors: [{ text: `unresolved fixture alias ${args.path}` }] };
      });
      buildApi.onLoad({ filter: /.*/, namespace: "fixture" }, (args) => {
        if (args.path === "auth") return { contents: "export const useAuth = () => ({ user: { id: '00000000-0000-4000-8000-000000000001' }, session: { access_token: 'local-test-token', user: { id: '00000000-0000-4000-8000-000000000001' } } });", loader: "js" };
        if (args.path === "toast") return { contents: "export const useToast = () => ({ toast: () => {} });", loader: "js" };
        return { contents: "export const supabase = { auth: { getSession: async () => ({ data: { session: { access_token: 'local-test-token' } } }) } };", loader: "js" };
      });
    },
  };
  await build({
    entryPoints: [entry], outfile: bundle, bundle: true, format: "iife", platform: "browser", jsx: "automatic",
    absWorkingDir: root, nodePaths: [join(root, "node_modules")], plugins: [aliases],
    define: {
      "import.meta.env.VITE_SUPABASE_URL": JSON.stringify(`http://127.0.0.1:${serverPort}`),
      "import.meta.env.VITE_SUPABASE_ANON_KEY": JSON.stringify("local-anon-key"),
    },
  });

  const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || "/repl/tools/bin/chromium" });
  try {
    const page = await browser.newPage();
    await page.goto(`http://127.0.0.1:${serverPort}/`);
    await page.getByText("Spam", { exact: true }).click();
    await page.getByRole("button", { name: "Submit report" }).click();
    await page.getByText("Report submitted", { exact: true }).waitFor();
  } finally {
    await browser.close();
    await new Promise((resolveClose) => server.close(resolveClose));
  }
  assert.equal(serverRequests.length, 1, "the actual ReportSheet submits exactly one request");
  assert.deepEqual(serverRequests[0].body, {
    content_type: "post",
    content_id: "ui-post-1",
    reason: "spam",
    reported_user_id: blockedId,
  });
  assert.equal(serverRequests[0].headers.authorization, "Bearer local-test-token");
}

async function main() {
  try {
    execFileSync("initdb", ["-D", dataDir, "--no-locale", "--encoding=UTF8"], { stdio: "pipe" });
    // pg_ctl's child inherits stdout/stderr unless a server log is supplied.
    // Redirecting it prevents the synchronous parent from waiting forever on
    // pipes held open by the daemon after a harness timeout.
    execFileSync("pg_ctl", ["-D", dataDir, "-l", postgresLog, "-o", `-k '${socketDir}' -p ${port} -c listen_addresses='' -c fsync=off`, "start"], { stdio: "ignore" });
    postgresStarted = true;
    psql(`
      create extension pgcrypto;
      create table public.content_reports (
        id uuid primary key default gen_random_uuid(),
        reporter_id uuid not null,
        content_type text not null check (content_type in ('post', 'comment', 'hot_take', 'list', 'review')),
        content_id text not null,
        reason text not null,
        description text,
        reported_user_id uuid,
        status text not null,
        created_at timestamptz not null default now()
      );
      create unique index content_reports_reporter_content on public.content_reports (reporter_id, content_type, content_id);
      create table public.user_blocks (
        id uuid primary key default gen_random_uuid(),
        blocker_id uuid not null,
        blocked_id uuid not null,
        created_at timestamptz not null default now(),
        unique (blocker_id, blocked_id)
      );
      create table public.social_posts (
        id uuid primary key,
        user_id uuid not null,
        content text not null,
        post_type text not null,
        created_at timestamptz not null
      );
      insert into public.social_posts values
        ('00000000-0000-4000-8000-000000000011', '${blockedId}', 'must disappear', 'update', '2026-01-01T00:00:00Z'),
        ('00000000-0000-4000-8000-000000000012', '${otherId}', 'must remain', 'update', '2026-01-02T00:00:00Z');
    `);
    if (testMode === "postrepair") {
      psqlFile(join(root, "supabase/migrations/20260916010000_allow_user_content_reports.sql"));
    }

    const reportHandler = loadDenoHandler("supabase/functions/report-content/index.ts");
    const blockHandler = loadDenoHandler("supabase/functions/block-user/index.ts", {
      isValidFriendshipUuid: (value) => typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value),
    });
    const feedHandler = loadDenoHandler("supabase/functions/social-feed/index.ts", {
      loadBlockedPeerIds: async (client, viewerId) => {
        const [{ data: blockedByViewer }, { data: blockedViewer }] = await Promise.all([
          client.from("user_blocks").select("blocked_id").eq("blocker_id", viewerId),
          client.from("user_blocks").select("blocker_id").eq("blocked_id", viewerId),
        ]);
        return new Set([
          ...(blockedByViewer || []).map((row) => row.blocked_id),
          ...(blockedViewer || []).map((row) => row.blocker_id),
        ]);
      },
    });

    const unauthenticatedReport = await responseJson(reportHandler, "report-content", { content_type: "post", content_id: "forbidden", reason: "spam" }, { authorization: "" });
    assert.equal(unauthenticatedReport.response.status, 401);
    assert.deepEqual(reportRows(), [], "invalid report auth must not mutate storage");

    const unauthenticatedBlock = await responseJson(blockHandler, "block-user", { blocked_user_id: blockedId }, { authorization: "" });
    assert.equal(unauthenticatedBlock.response.status, 401);
    assert.deepEqual(blockRows(), [], "invalid block auth must not mutate storage");

    await buildAndExerciseReportSheet(reportHandler);
    assert.deepEqual(reportRows(), [`${reporterId}|post|ui-post-1|spam|${blockedId}|pending`], "ReportSheet payload reaches the actual handler and local PostgreSQL");

    const duplicate = await responseJson(reportHandler, "report-content", { content_type: "post", content_id: "ui-post-1", reason: "spam", reported_user_id: blockedId });
    assert.equal(duplicate.response.status, 400);
    assert.equal(duplicate.body.error, "You have already reported this content");
    assert.equal(reportRows().length, 1, "duplicate reports must not create another row");

    if (testMode === "baseline") {
      const userReport = await responseJson(reportHandler, "report-content", { content_type: "user", content_id: blockedId, reason: "harassment", reported_user_id: blockedId });
      assert.equal(userReport.response.status, 500, "current schema rejects the handler's valid user report type");
      assert.match(lastDatabaseError, /content_reports_content_type_check/i, "the pre-migration five-type CHECK is the reproduced failure");
      assert.equal(reportRows().filter((row) => row.includes("|user|")).length, 0);
    } else {
      const commentReport = await responseJson(reportHandler, "report-content", { content_type: "comment", content_id: "comment-1", reason: "harassment", reported_user_id: blockedId });
      assert.equal(commentReport.response.status, 200);
      assert.ok(reportRows().some((row) => row.includes("|comment|comment-1|harassment|")), "comment reports reach local PostgreSQL");

      const userReport = await responseJson(reportHandler, "report-content", { content_type: "user", content_id: blockedId, reason: "harassment", reported_user_id: blockedId });
      assert.equal(userReport.response.status, 200);
      assert.ok(reportRows().some((row) => row.includes(`|user|${blockedId}|harassment|${blockedId}|pending`)), "user reports reach local PostgreSQL after the migration");

      for (const contentType of ["hot_take", "list", "review"]) {
        const legacyReport = await responseJson(reportHandler, "report-content", {
          content_type: contentType,
          content_id: `legacy-${contentType}`,
          reason: "other",
          reported_user_id: blockedId,
        });
        assert.equal(legacyReport.response.status, 200, `${contentType} remains accepted`);
        assert.ok(reportRows().some((row) => row.includes(`|${contentType}|legacy-${contentType}|other|`)), `${contentType} reports reach local PostgreSQL`);
      }
    }

    const reportCountBeforeInvalidValues = reportRows().length;
    const invalidContentType = await responseJson(reportHandler, "report-content", { content_type: "profile", content_id: "invalid-content-type", reason: "spam", reported_user_id: blockedId });
    assert.equal(invalidContentType.response.status, 400);
    assert.equal(invalidContentType.body.error, "Invalid content type");
    const invalidReason = await responseJson(reportHandler, "report-content", { content_type: "comment", content_id: "invalid-reason", reason: "invalid_reason", reported_user_id: blockedId });
    assert.equal(invalidReason.response.status, 400);
    assert.equal(invalidReason.body.error, "Invalid reason");
    assert.equal(reportRows().length, reportCountBeforeInvalidValues, "invalid report values do not mutate storage");

    const firstBlock = await responseJson(blockHandler, "block-user", { blocked_user_id: blockedId });
    assert.equal(firstBlock.response.status, 200);
    assert.deepEqual(firstBlock.body, { success: true, action: "blocked" });
    assert.deepEqual(blockRows(), [`${reporterId}|${blockedId}`], "actual block handler stores one local row");
    const repeatedBlock = await responseJson(blockHandler, "block-user", { blocked_user_id: blockedId });
    assert.deepEqual(repeatedBlock.body, { success: true, action: "already_blocked" });
    assert.equal(blockRows().length, 1, "block idempotency preserves one row");

    const blockCache = loadClientBlockCache();
    const queryClient = new QueryClient();
    queryClient.setQueryData(["social-feed", reporterId], {
      pages: [[{ id: "blocked-post", user: { id: blockedId } }, { id: "other-post", user: { id: otherId } }]],
      pageParams: [0],
    });
    blockCache.removeBlockedUserFromCaches(queryClient, blockedId, reporterId);
    assert.deepEqual(queryClient.getQueryData(["social-feed", reporterId]), {
      pages: [[{ id: "other-post", user: { id: otherId } }]],
      pageParams: [0],
    }, "successful block immediately excludes the author from the client feed cache");

    const feedResponse = await feedHandler(new Request("http://fixture.invalid/social-feed?limit=15&offset=0", {
      method: "GET", headers: { Authorization: "Bearer local-test-token" },
    }));
    assert.equal(feedResponse.status, 200);
    const feed = await feedResponse.json();
    assert.deepEqual(feed.posts.map((post) => post.user.id), [otherId], "actual social-feed handler excludes the newly blocked server author");

    console.log("PASS: invalid auth has no report/block mutation");
    console.log("PASS: actual ReportSheet payload -> report-content handler -> local PostgreSQL");
    console.log("PASS: report and block idempotency preserve one row");
    if (testMode === "baseline") {
      console.log("PASS: user reports reproduce the pre-migration five-type CHECK failure");
    } else {
      console.log("PASS: migrated content_reports stores post/comment/user and all five legacy types");
      console.log("PASS: invalid report values are rejected without storage");
    }
    console.log("PASS: successful block immediately filters client cache and actual social-feed output");
  } finally {
    if (postgresStarted) spawnSync("pg_ctl", ["-D", dataDir, "-m", "immediate", "stop"], { stdio: "ignore" });
    await Promise.all([rm(dataDir, { recursive: true, force: true }), rm(socketDir, { recursive: true, force: true }), rm(tempDir, { recursive: true, force: true })]);
  }
}

await main();