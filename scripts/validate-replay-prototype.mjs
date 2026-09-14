/**
 * Disposable local-browser validation for the replay prototype.
 *
 * This starts no application workflow and never contacts PostHog, Supabase, or
 * a published Consumed origin. It deliberately requires an already-installed
 * Playwright package; do not use npx/package installation to make it run.
 *
 * Run only in an approved test environment:
 *   ./node_modules/.bin/tsx scripts/validate-replay-prototype.mjs
 *
 * The script exits non-zero with an explicit prerequisite message when
 * Playwright is not an existing dependency. That is preferable to silently
 * downgrading this required real-browser/rrweb check to a mocked SDK test.
 */
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { access, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { gunzipSync } from "node:zlib";
import { createHash } from "node:crypto";
import { execFile as execFileCallback } from "node:child_process";
import { promisify } from "node:util";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const execFile = promisify(execFileCallback);
const LEASE_PROPERTY = "__consumed_upload_lease";
const PREFIX = "/api/replay-prototype";
const PLACEHOLDER = "consumed_replay_prototype";
const SENTINEL = "synthetic-browser-credential-not-secret";

const sdkVersions = [
  {
    version: "1.352.0",
    source: resolve(root, "node_modules/posthog-js/dist/array.full.js"),
  },
  {
    version: "1.430.3",
    // Regenerated on demand from the exact public npm archive, without adding
    // it as a production dependency. See scripts/README-replay-prototype-validation.md.
    source: "/tmp/posthog-replay-sdk-1.430.3/package/dist/array.full.js",
  },
];

function fail(message) {
  throw new Error(`replay prototype validation: ${message}`);
}

async function loadPlaywright() {
  try {
    return await import("playwright");
  } catch {
    try {
      return await import("@playwright/test");
    } catch {
      fail(
        "Playwright is not installed. No browser run was performed and no package " +
          "was installed. Provision Playwright through the approved package/test " +
          "workflow, then rerun this isolated harness.",
      );
    }
  }
}

async function ensureMarketingSdk(sdk) {
  try {
    await access(sdk.source);
    return sdk.source;
  } catch {
    // The archive URL and SRI digest come from npm's version-specific metadata,
    // then the bytes are verified before local extraction. No package manager,
    // project dependency, provider, or application endpoint is involved.
    const metadataResponse = await fetch(`https://registry.npmjs.org/posthog-js/${sdk.version}`);
    if (!metadataResponse.ok) fail(`npm metadata for SDK ${sdk.version} returned ${metadataResponse.status}`);
    const metadata = await metadataResponse.json();
    if (metadata.version !== sdk.version || !metadata.dist?.tarball || !metadata.dist?.integrity) {
      fail(`npm metadata for SDK ${sdk.version} lacked exact archive integrity`);
    }
    const archiveResponse = await fetch(metadata.dist.tarball);
    if (!archiveResponse.ok) fail(`npm archive for SDK ${sdk.version} returned ${archiveResponse.status}`);
    const archive = Buffer.from(await archiveResponse.arrayBuffer());
    const [algorithm, expected] = String(metadata.dist.integrity).split("-", 2);
    const actual = createHash(algorithm).update(archive).digest("base64");
    if (actual !== expected) fail(`npm archive integrity mismatch for SDK ${sdk.version}`);
    const base = resolve("/tmp", `posthog-replay-sdk-${sdk.version}`);
    const archivePath = `${base}.tgz`;
    await rm(base, { recursive: true, force: true });
    await writeFile(archivePath, archive, { mode: 0o600 });
    await mkdir(base, { recursive: true });
    await execFile("tar", ["-xzf", archivePath, "-C", base]);
    await rm(archivePath, { force: true });
    await access(sdk.source);
    return sdk.source;
  }
}

function decodeCaptureBody(request) {
  let bytes = Buffer.concat(request.body);
  if (request.headers["content-encoding"] === "gzip") bytes = gunzipSync(bytes);
  const text = bytes.toString("utf8");
  const decodeData = (data) => {
    try {
      return JSON.parse(data);
    } catch {
      try {
        let decoded = Buffer.from(data, "base64");
        if (decoded[0] === 0x1f && decoded[1] === 0x8b) decoded = gunzipSync(decoded);
        return JSON.parse(decoded.toString("utf8"));
      } catch {
        return {};
      }
    }
  };
  const contentType = String(request.headers["content-type"] || "");
  if (contentType.includes("application/x-www-form-urlencoded")) {
    const data = new URLSearchParams(text).get("data");
    return data ? decodeData(data) : {};
  }
  const parsed = text ? JSON.parse(text) : {};
  return typeof parsed?.data === "string" && parsed.event === undefined && parsed.batch === undefined
    ? decodeData(parsed.data)
    : parsed;
}

function captureItems(body) {
  if (Array.isArray(body)) return body;
  if (Array.isArray(body?.batch)) return body.batch;
  if (Array.isArray(body?.data)) return body.data;
  return [body];
}

function eventName(item) {
  return item?.event || item?.event_name || item?.properties?.event;
}

function snapshotData(item) {
  return item?.properties?.$snapshot_data ??
    item?.properties?.$snapshot ??
    item?.$snapshot_data ??
    item?.data?.$snapshot_data;
}

function normalized(item) {
  const properties = item?.properties && typeof item.properties === "object"
    ? item.properties
    : {};
  return {
    event: eventName(item),
    hasLease: typeof properties[LEASE_PROPERTY] === "string",
    hasSession: typeof properties.$session_id === "string",
    hasWindow: typeof properties.$window_id === "string",
    hasSnapshot: snapshotData(item) !== undefined,
    attribution: properties.$initial_utm_source ??
      properties.$utm_source ??
      item?.$set_once?.$initial_utm_source ??
      item?.$set?.$utm_source ??
      null,
    currentUrl: typeof properties.$current_url === "string"
      ? new URL(properties.$current_url).pathname + new URL(properties.$current_url).search
      : null,
    elements: Array.isArray(properties.$elements)
      ? properties.$elements.map((element) => ({
        tag: element?.tag_name ?? null,
        id: element?.attr__id ?? null,
        text: element?.$el_text ?? null,
      }))
      : null,
  };
}

function withoutOuterLease(item) {
  const copy = structuredClone(item);
  if (copy?.properties && typeof copy.properties === "object") {
    delete copy.properties[LEASE_PROPERTY];
  }
  return copy;
}

function rrwebEntries(snapshotItems) {
  const decodeEntryPayload = (entry) => {
    if (!entry || typeof entry !== "object" || typeof entry.data !== "string") return entry;
    try {
      return { ...entry, data: JSON.parse(entry.data) };
    } catch {
      try {
        return {
          ...entry,
          data: JSON.parse(gunzipSync(Buffer.from(entry.data, "latin1")).toString("utf8")),
        };
      } catch {
        return entry;
      }
    }
  };
  return snapshotItems.flatMap((item) => {
    const data = snapshotData(item);
    if (Array.isArray(data)) return data.map(decodeEntryPayload);
    if (data && typeof data === "object") return [decodeEntryPayload(data)];
    if (typeof data !== "string") return [];
    try {
      const parsed = JSON.parse(data);
      return (Array.isArray(parsed) ? parsed : [parsed]).map(decodeEntryPayload);
    } catch {
      // PostHog compresses full-snapshot rrweb data as a binary gzip string.
      // Decode only in this local fixture, never by sending it elsewhere.
      try {
        const parsed = JSON.parse(gunzipSync(Buffer.from(data, "latin1")).toString("utf8"));
        return (Array.isArray(parsed) ? parsed : [parsed]).map(decodeEntryPayload);
      } catch {
        return [];
      }
    }
  });
}

function localRrwebProof(snapshotItems) {
  // This is intentionally a local structural reconstruction proof, not a
  // claim that the recording is playable in the real PostHog UI. rrweb full
  // snapshots have event type 2 and include a document node; incremental
  // mutations have event type 3. It catches a transport that emits a
  // "$snapshot" label while dropping the actual rrweb stream.
  const entries = rrwebEntries(snapshotItems);
  const fullSnapshot = entries.find((entry) =>
    entry?.type === 2 && entry?.data && typeof entry.data === "object"
  );
  assert.ok(fullSnapshot, `rrweb full snapshot was not emitted; ${JSON.stringify(snapshotItems.map((item) => {
    const value = snapshotData(item);
    return {
      event: eventName(item),
      dataType: Array.isArray(value) ? "array" : typeof value,
      dataKeys: value && typeof value === "object" ? Object.keys(value) : [],
      dataLength: typeof value === "string" ? value.length : undefined,
      entryTypes: rrwebEntries([item]).map((entry) =>
        entry?.type === 2
          ? { type: entry.type, payloadType: typeof entry.data, payloadKeys: entry.data && typeof entry.data === "object" ? Object.keys(entry.data) : [] }
          : entry?.type),
    };
  }))}`);
  assert.ok(
    JSON.stringify(fullSnapshot).includes("html") ||
      JSON.stringify(fullSnapshot).includes("document"),
    "rrweb full snapshot does not contain a reconstructable document",
  );
  assert.ok(entries.some((entry) => entry?.type === 3), "rrweb incremental mutation was not emitted");
  return { entries: entries.length, fullSnapshotType: fullSnapshot.type };
}

async function buildActualAdapter() {
  const esbuild = await import("esbuild");
  const output = await esbuild.build({
    entryPoints: [resolve(root, "client/src/lib/posthog-replay-prototype.ts")],
    bundle: true,
    format: "iife",
    globalName: "ReplayPrototypeAdapter",
    platform: "browser",
    target: "es2020",
    write: false,
  });
  return output.outputFiles[0].text;
}

async function loadActualGateway() {
  // This is intentionally loaded only by tsx. It is the actual injectable
  // handler and TEST_ONLY ledger, not an HTTP imitation of the protocol.
  const handler = await import("../supabase/functions/_shared/replay-prototype-handler.ts");
  const ledger = await import("../supabase/functions/_shared/replay-prototype-ledger.ts");
  return { ...handler, ...ledger };
}

function fixtureHtml() {
  // No custom click/change/submit tracking is used. The click below is
  // deliberately captured by stock SDK autocapture.
  return `<!doctype html>
<html><head><title>Replay prototype fixture</title></head>
<body>
  <main><button id="stock-autocapture">Stock SDK click</button>
  <label>Secret <input id="secret" value="very-private-fixture-value"></label>
  <p data-mask id="masked">masked fixture sentence</p></main>
  <script src="/assets/sdk.js"></script><script src="/assets/adapter.js"></script>
  <script>
    (async () => {
      window.__fixture = { ready: false, errors: [] };
      const controlled = new URL(location.href).searchParams.get("mode") === "controlled";
      if (!controlled) {
        posthog.init(${JSON.stringify(PLACEHOLDER)}, {
          api_host: "/legacy-sdk-baseline", autocapture: true,
          capture_pageview: true, capture_pageleave: true,
          session_recording: { maskAllInputs: true, maskTextSelector: "[data-mask]" },
        });
        posthog.opt_in_capturing({ captureEventName: false });
        posthog.startSessionRecording();
        posthog.capture("$pageview", { page: "prototype-fixture" });
        await new Promise((resolve) => setTimeout(resolve, 250));
        posthog.startSessionRecording();
      } else {
        const observedContexts = [];
        posthog.onSessionId((sessionId, windowId) => observedContexts.push({ sessionId, windowId }));
        const adapter = ReplayPrototypeAdapter.createReplayPrototypeAdapter(posthog, {
          issueLease: async (context) => {
            observedContexts.push({ issuedFor: context });
            const response = await fetch(${JSON.stringify(`${PREFIX}/lease`)}, {
              method: "POST", credentials: "include",
              // Test-only first-party proof. It is not a real credential and
              // is carried only on the local lease request, which the adapter
              // excludes from replay network capture.
              headers: { "content-type": "application/json", "x-test-first-party": "synthetic" },
              body: JSON.stringify({ audiences: ["event", "replay"], contexts: [context] }),
            });
            if (!response.ok) {
              observedContexts.push({ leaseStatus: response.status });
              return null;
            }
            const body = await response.json();
            return {
              value: body.upload_lease,
              recorderEpoch: "synthetic-browser-epoch-a",
              expiresAt: Date.parse(body.expires_at),
              context,
            };
          },
        });
        adapter.initialize();
        posthog.opt_in_capturing({ captureEventName: false });
        if (!(await adapter.startRecorderEpoch())) {
          throw new Error("gateway lease was rejected by actual adapter: " + JSON.stringify(observedContexts));
        }
        // Initial automatic pageview occurs before an authorization epoch and
        // is correctly blocked. This post-admission pageview uses the stock
        // SDK capture API, matching the application's explicit page tracking.
        posthog.capture("$pageview", { page: "prototype-fixture" });
        await new Promise((resolve) => setTimeout(resolve, 250));
        posthog.startSessionRecording();
        window.__fixture.adapter = adapter;
      }
      window.__fixture.captureLogger = () => {
        window.__fixture.captureResult = posthog.capture("test_logger", { fixture: true });
        return fetch("/test-logger", {
          method: "POST",
          headers: { Authorization: "Bearer ${SENTINEL}", "Content-Type": "application/json" },
          body: JSON.stringify({ credential: "${SENTINEL}" }),
        });
      };
      window.__fixture.ready = true;
    })().catch((error) => window.__fixture.errors.push(String(error)));
  </script>
</body></html>`;
}

async function startFixtureServer(sdkText, recorderText, adapterText, gateway) {
  const inbound = [];
  const forwarded = [];
  const blockedGatewayRequests = [];
  const ledger = new gateway.InMemoryReplayPrototypeLedger({ environment: "test" });
  const identity = {
    kind: "account",
    subject: "11111111-1111-4111-8111-111111111111",
    epoch: "synthetic-browser-epoch-a",
  };
  const dependencies = {
    enabled: true,
    ledger,
    providerToken: "server-only-synthetic-provider-token",
    authenticateFirstPartyRequest: async (request) =>
      request.headers.get("x-test-first-party") === "synthetic" ||
        request.headers.get("origin")?.endsWith(".test:1") ? identity : null,
    checkLiveIdentity: async () => "live",
    publicConfiguration: async () => ({
      sessionRecording: {
        sampleRate: 1,
        masking: { maskAllInputs: true, maskTextSelector: "[data-mask]" },
      },
    }),
    publicFlags: async () => ({}),
    loadRecorderAsset: async () => new Response(recorderText, {
      headers: { "content-type": "application/javascript; charset=utf-8" },
    }),
    forward: async (route, payload) => {
      forwarded.push({ route, payload: structuredClone(payload) });
      return { ok: true };
    },
  };
  const server = createServer((request, response) => {
    const chunks = [];
    request.on("data", (part) => chunks.push(part));
    request.on("end", async () => {
      if (request.url === "/assets/sdk.js" || request.url === "/assets/adapter.js") {
        response.writeHead(200, { "content-type": "application/javascript" });
        response.end(request.url.endsWith("sdk.js") ? sdkText : adapterText);
        return;
      }
      if (request.url === "/test-logger") {
        response.writeHead(204);
        response.end();
        return;
      }
      if (request.url?.startsWith(PREFIX)) {
        const body = chunks.length ? Buffer.concat(chunks) : undefined;
        const gatewayRequest = new Request(`http://fixture.test${request.url}`, {
          method: request.method,
          headers: request.headers,
          ...(body ? { body } : {}),
        });
        inbound.push({ path: new URL(gatewayRequest.url).pathname, headers: request.headers });
        const gatewayResponse = await gateway.handleReplayPrototypeRequest(gatewayRequest, dependencies);
        if (gatewayResponse.status >= 400) {
          blockedGatewayRequests.push({
            path: new URL(gatewayRequest.url).pathname,
            status: gatewayResponse.status,
          });
        }
        response.writeHead(
          gatewayResponse.status,
          Object.fromEntries(gatewayResponse.headers.entries()),
        );
        response.end(Buffer.from(await gatewayResponse.arrayBuffer()));
        return;
      }
      if (request.url?.startsWith("/legacy-sdk-baseline/")) {
        if (request.url.startsWith("/legacy-sdk-baseline/static/lazy-recorder.js")) {
          response.writeHead(200, { "content-type": "application/javascript; charset=utf-8" });
          response.end(recorderText);
          return;
        }
        try {
          const decoded = decodeCaptureBody({ body: chunks, headers: request.headers });
          inbound.push({
            path: new URL(request.url, "http://fixture.test").pathname,
            body: decoded,
            transport: {
              contentType: String(request.headers["content-type"] || ""),
              bytes: chunks.reduce((total, chunk) => total + chunk.length, 0),
              queryKeys: [...new URL(request.url, "http://fixture.test").searchParams.keys()],
              decodedKeys: decoded && typeof decoded === "object" ? Object.keys(decoded) : [],
            },
          });
          response.writeHead(200, { "content-type": "application/json" });
          response.end(JSON.stringify(request.url.includes("/flags/")
            ? {
              flags: {},
              featureFlags: {},
              featureFlagPayloads: {},
              sessionRecording: {
                sampleRate: 1,
                masking: { maskAllInputs: true, maskTextSelector: "[data-mask]" },
              },
            }
            : request.url.includes("/config")
            ? {
              sessionRecording: {
                sampleRate: 1,
                maskAllInputs: true,
                maskTextSelector: "[data-mask]",
              },
            }
            : {}));
        } catch {
          response.writeHead(400);
          response.end();
        }
        return;
      }
      response.writeHead(200, {
        "content-type": "text/html",
      });
      response.end(fixtureHtml());
    });
  });
  await new Promise((done) => server.listen(0, "127.0.0.1", done));
  const { port } = server.address();
  return {
    origin: `http://127.0.0.1:${port}`,
    inbound,
    forwarded,
    blockedGatewayRequests,
    close: () => new Promise((done) => server.close(done)),
  };
}

function semanticSignature(items) {
  return ["$pageview", "$pageleave", "$autocapture", "test_logger", "$snapshot", "optin_recovered"].map((event) => {
    const match = items.find((item) => item.event === event || (event === "$snapshot" && item.hasSnapshot));
    return match && {
      event,
      hasSession: match.hasSession,
      hasWindow: match.hasWindow,
      hasSnapshot: match.hasSnapshot,
      attribution: match.attribution,
      currentUrl: match.currentUrl,
      elements: match.elements,
    };
  });
}

async function validateVersion(playwright, sdk, adapterText, gateway) {
  const sourcePath = sdk.version === "1.430.3"
    ? await ensureMarketingSdk(sdk)
    : sdk.source;
  const source = await readFile(sourcePath, "utf8").catch(() => {
    fail(`required full SDK ${sdk.version} asset is unavailable at ${sourcePath}`);
  });
  const recorderText = await readFile(resolve(dirname(sourcePath), "lazy-recorder.js"), "utf8")
    .catch(() => fail(`required lazy recorder for SDK ${sdk.version} is unavailable`));
  assert.ok(source.length > 100_000, `full SDK ${sdk.version} asset is unexpectedly small`);
  const fixture = await startFixtureServer(source, recorderText, adapterText, gateway);
  const browser = await playwright.chromium.launch({
    headless: true,
    executablePath: "/repl/tools/bin/chromium",
    args: ["--no-sandbox"],
  });
  try {
    // These are deliberately local hostnames, not verification of either
    // published origin. Both surfaces exercise the same controlled fixture.
    for (const [mode, hostname] of [
      ["legacy", "consumedapp.test"],
      ["controlled", "consumedapp.test"],
      ["legacy", "www.consumedapp.test"],
      ["controlled", "www.consumedapp.test"],
    ]) {
      // Use a normal Chromium UA so the SDK's stock bot filter does not
      // intentionally suppress all events from Playwright's HeadlessChrome UA.
      const context = await browser.newContext({
        userAgent: "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
      });
      await context.addInitScript(() => {
        Object.defineProperty(navigator, "webdriver", { get: () => undefined });
      });
      const page = await context.newPage();
      const pageErrors = [];
      const browserRequests = [];
      page.on("pageerror", (error) => pageErrors.push(error.message));
      page.on("request", (request) => {
        browserRequests.push(new URL(request.url()).pathname);
      });
      await page.route(`http://${hostname}:*/**`, async (route) => {
        const target = new URL(route.request().url());
        const headers = route.request().headers();
        if (target.pathname.startsWith(PREFIX)) headers["x-test-first-party"] = "synthetic";
        await route.continue({
          url: `${fixture.origin}${target.pathname}${target.search}`,
          headers,
        });
      });
      await page.goto(`http://${hostname}:1/?mode=${mode}&utm_source=replay-fixture`);
      await page.waitForFunction(() => window.__fixture?.ready === true, undefined, {
        timeout: 10_000,
      }).catch(async () => {
        const fixtureErrors = await page.evaluate(() => window.__fixture?.errors || []);
        fail(`${sdk.version}/${mode}/${hostname}: fixture did not become ready; ${[
          ...pageErrors,
          ...fixtureErrors,
        ].join(" | ") || "no page error was exposed"}`);
      });
      // Exercise the stock consent APIs: no event during opt-out, followed by
      // explicit opt-in and a fresh authorized recording epoch where required.
      await page.evaluate(async () => {
        posthog.opt_out_capturing();
        posthog.capture("optout_blocked", { fixture: true });
        posthog.opt_in_capturing({ captureEventName: false });
        if (window.__fixture.adapter) {
          if (!(await window.__fixture.adapter.startRecorderEpoch())) {
            throw new Error("fresh lease failed after consent recovery");
          }
          await new Promise((resolve) => setTimeout(resolve, 250));
          posthog.startSessionRecording();
        } else {
          posthog.startSessionRecording();
        }
        posthog.capture("optin_recovered", { fixture: true });
      });
      await page.click("#stock-autocapture");
      await page.evaluate(() => window.__fixture.captureLogger());
      const sdkState = await page.evaluate(() => ({
        optedOut: posthog.has_opted_out_capturing(),
        capturing: posthog.is_capturing(),
        sessionPresent: Boolean(posthog.get_session_id()),
        loggerCaptureType: typeof window.__fixture.captureResult,
        queued: posthog._requestQueue?._queue?.length,
      }));
      assert.equal(sdkState.optedOut, false, `${sdk.version}/${mode}: SDK unexpectedly opted out`);
      assert.equal(sdkState.capturing, true, `${sdk.version}/${mode}: SDK is not capturing`);
      assert.equal(sdkState.sessionPresent, true, `${sdk.version}/${mode}: SDK did not create a session`);
      // Recording buffers on a timer; force a DOM mutation and wait long
      // enough for the stock recorder's documented 2-second buffer.
      await page.evaluate(() => document.querySelector("#masked").textContent = "changed masked fixture");
      // Keep the page alive past the SDK's default request batching flush
      // interval as well as the recorder's two-second rrweb buffer.
      await page.waitForTimeout(5_000);
      sdkState.recordingStarted = await page.evaluate(() => posthog.sessionRecordingStarted());
      const cdp = await context.newCDPSession(page);
      await cdp.send("Page.setWebLifecycleState", { state: "frozen" });
      await page.waitForTimeout(150);
      await cdp.send("Page.setWebLifecycleState", { state: "active" });
      // Exercise the SDK's registered stock pagehide handler before reload.
      // Chromium automation does not reliably surface a real navigation
      // pagehide to in-process listeners, whereas this dispatch invokes the
      // same browser lifecycle event and allows its beacon to leave.
      await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent("pagehide")));
      await page.waitForTimeout(500);
      await page.reload();
      await page.waitForTimeout(750);
      await context.close();
      fixture.browserRequests ??= [];
      fixture.browserRequests.push(...browserRequests);
      fixture.sdkStates ??= [];
      fixture.sdkStates.push(sdkState);
    }
  } finally {
    await browser.close();
    await fixture.close();
  }

  const legacyItems = fixture.inbound
    .filter((item) => item.path.startsWith("/legacy-sdk-baseline/") &&
      (item.path.endsWith("/e/") || item.path.endsWith("/s/")))
    .flatMap((item) => captureItems(item.body))
    .map(normalized);
  const forwardedItems = fixture.forwarded.flatMap((entry) => entry.payload.batch).map(normalized);
  for (const [name, items] of [["legacy", legacyItems], ["controlled", forwardedItems]]) {
    const observed = JSON.stringify({
      items,
      transport: fixture.inbound
        .filter((entry) => name === "legacy" && entry.path.startsWith("/legacy-sdk-baseline/"))
        .map((entry) => ({ path: entry.path, ...entry.transport })),
      browserRequests: fixture.browserRequests,
      sdkStates: fixture.sdkStates,
    });
    assert.ok(items.some((item) => item.event === "$pageview"), `${sdk.version}/${name}: no pageview; ${observed}`);
    assert.ok(items.some((item) => item.event === "$pageleave"), `${sdk.version}/${name}: no pageleave/unload; ${observed}`);
    assert.ok(items.some((item) => item.event === "$autocapture"), `${sdk.version}/${name}: no stock SDK autocapture; ${observed}`);
    assert.ok(items.some((item) => item.event === "test_logger"), `${sdk.version}/${name}: no SDK logger capture; ${observed}`);
    assert.ok(items.some((item) => item.event === "optin_recovered"), `${sdk.version}/${name}: capture did not recover after opt-in; ${observed}`);
    assert.equal(items.some((item) => item.event === "optout_blocked"), false, `${sdk.version}/${name}: capture escaped opt-out; ${observed}`);
    assert.ok(
      items.some((item) => item.currentUrl?.includes("utm_source=replay-fixture")),
      `${sdk.version}/${name}: UTM value was not preserved in actual event URL metadata; ${observed}`,
    );
    assert.ok(items.some((item) => item.hasSnapshot), `${sdk.version}/${name}: no actual SDK $snapshot; ${observed}`);
  }
  assert.deepEqual(
    semanticSignature(forwardedItems),
    semanticSignature(legacyItems),
    `${sdk.version}: normalized controlled behavior differs from local legacy baseline`,
  );
  const snapshots = fixture.forwarded
    .flatMap((entry) => entry.payload.batch)
    .filter((item) => eventName(item) === "$snapshot" || snapshotData(item) !== undefined);
  assert.ok(snapshots.length > 0, `${sdk.version}: no actual SDK $snapshot payload`);
  assert.ok(
    fixture.forwarded.every((entry) => JSON.stringify(entry.payload).includes(LEASE_PROPERTY) === false),
    `${sdk.version}: gateway forwarded the lease`,
  );
  assert.ok(
    fixture.forwarded.every((entry) => JSON.stringify(entry.payload).includes(SENTINEL) === false),
    `${sdk.version}: gateway/replay forwarded the network credential`,
  );
  assert.deepEqual(
    fixture.blockedGatewayRequests,
    [],
    `${sdk.version}: browser attempted an unapproved or rejected gateway route`,
  );
  const snapshotWithoutLease = JSON.stringify(snapshots.map(withoutOuterLease));
  assert.equal(snapshotWithoutLease.includes(LEASE_PROPERTY), false, `${sdk.version}: lease entered rrweb data`);
  assert.equal(snapshotWithoutLease.includes(SENTINEL), false, `${sdk.version}: network credential entered rrweb data`);
  const reconstructedData = JSON.stringify(rrwebEntries(snapshots));
  assert.equal(
    reconstructedData.includes("very-private-fixture-value"),
    false,
    `${sdk.version}: input masking did not redact fixture text`,
  );
  assert.equal(
    reconstructedData.includes("masked fixture sentence") || reconstructedData.includes("changed masked fixture"),
    false,
    `${sdk.version}: configured text masking did not redact fixture text`,
  );
  const proof = localRrwebProof(snapshots);
  return {
    version: sdk.version,
    legacyItems: legacyItems.length,
    forwardedItems: forwardedItems.length,
    snapshots: snapshots.length,
    proof,
  };
}

const playwright = await loadPlaywright();
const adapterText = await buildActualAdapter();
const gateway = await loadActualGateway();
const results = [];
for (const sdk of sdkVersions) results.push(await validateVersion(playwright, sdk, adapterText, gateway));
console.log(JSON.stringify({
  status: "pass",
  mode: "local isolated synthetic browser fixture only",
  publishedOriginVerification: false,
  iosCoverage: false,
  results,
}, null, 2));