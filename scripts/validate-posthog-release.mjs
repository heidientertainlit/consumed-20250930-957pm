/**
 * Local-only release regression for the PostHog wrapper and provider recovery.
 *
 * This is deliberately an isolated fixture rather than an app build. It
 * bundles the checked-in posthog.ts source with fake Vite values and local
 * module shims, loads the installed full PostHog SDK in Chromium, and
 * rewrites the SDK's published-host requests to the fixture server before
 * they can leave the machine. Any other external request is aborted.
 *
 * Run:
 *   node scripts/validate-posthog-release.mjs
 *
 * No application workflow, provider, credential, package installation, or
 * published endpoint is used by this test.
 */
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { gunzipSync } from "node:zlib";
import {
  assertRichLifecycle,
  richWrapperControlScript,
} from "./posthog-release-rich-fixture.mjs";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const posthogPath = resolve(root, "client/src/lib/posthog.ts");
const authPath = resolve(root, "client/src/lib/auth.tsx");
const sdkPaths = {
  array: resolve(root, "node_modules/posthog-js/dist/array.js"),
  module: resolve(root, "node_modules/posthog-js/dist/module.js"),
};
const sdkPackagePath = resolve(root, "node_modules/posthog-js/package.json");
const recorderPath = resolve(root, "node_modules/posthog-js/dist/lazy-recorder.js");
const fakeKey = "phc_local_release_regression_only";
const publishedHost = "https://us.i.posthog.com";
const publishedAssetHost = "https://us-assets.i.posthog.com";
const fakeUserId = "11111111-1111-4111-8111-111111111111";
const fixtureUserAgent =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

let lastEvidence = {};

function fail(message, evidence = {}) {
  const suffix = Object.keys(evidence).length ? ` ${JSON.stringify(evidence)}` : "";
  throw new Error(`PostHog release regression: ${message}${suffix}`);
}

async function loadPlaywright() {
  try {
    return await import("playwright");
  } catch {
    fail("Playwright is not installed; no package was installed");
  }
}

async function loadLocalAsset(path, description) {
  return readFile(path, "utf8").catch(() =>
    fail(`${description} is unavailable at ${path}`),
  );
}

async function loadSdkAssets() {
  const esbuild = await import("esbuild").catch(() =>
    fail("esbuild is not installed; no package was installed"),
  );
  const entries = await Promise.all(Object.entries(sdkPaths).map(async ([variant, path]) => {
    const source = await loadLocalAsset(path, `installed posthog-js ${variant} SDK`);
    if (variant === "array") return [variant, source];
    const output = await esbuild.transform(source, {
      loader: "js",
      format: "iife",
      globalName: "PosthogModule",
      target: "es2020",
      legalComments: "none",
    });
    return [variant, `${output.code}\nwindow.posthog = PosthogModule.default;`];
  }));
  return Object.fromEntries(entries);
}

function decodeData(value) {
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    try {
      let bytes = Buffer.from(value, "base64");
      if (bytes[0] === 0x1f && bytes[1] === 0x8b) bytes = gunzipSync(bytes);
      return JSON.parse(bytes.toString("utf8"));
    } catch {
      try {
        return JSON.parse(gunzipSync(Buffer.from(value, "latin1")).toString("utf8"));
      } catch {
        return {};
      }
    }
  }
}

function decodeRequest(request, body) {
  let bytes = Buffer.concat(body);
  if (String(request.headers["content-encoding"] || "").toLowerCase() === "gzip") {
    bytes = gunzipSync(bytes);
  }
  const text = bytes.toString("utf8");
  if (!text) return {};

  if (String(request.headers["content-type"] || "").includes("application/x-www-form-urlencoded")) {
    const data = new URLSearchParams(text).get("data");
    return data ? decodeData(data) : {};
  }

  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    return decodeData(text);
  }
  return parsed && typeof parsed.data === "string" &&
    parsed.event === undefined && parsed.batch === undefined
    ? decodeData(parsed.data)
    : parsed;
}

function captureItems(body) {
  if (Array.isArray(body)) return body;
  if (Array.isArray(body?.batch)) return body.batch;
  if (Array.isArray(body?.data)) return body.data;
  return body && typeof body === "object" ? [body] : [];
}

function eventName(item) {
  return item?.event || item?.event_name || item?.properties?.event;
}

function itemProperties(item) {
  return item?.properties && typeof item.properties === "object" ? item.properties : {};
}

function snapshotValue(item) {
  return item?.properties?.$snapshot_data ??
    item?.properties?.$snapshot ??
    item?.$snapshot_data ??
    item?.data?.$snapshot_data;
}

function decodeSnapshotEntries(items) {
  return items.flatMap((item) => {
    const value = snapshotValue(item);
    if (Array.isArray(value)) return value;
    if (value && typeof value === "object") return [value];
    if (typeof value !== "string") return [];
    const decoded = decodeData(value);
    return Array.isArray(decoded) ? decoded : decoded && typeof decoded === "object" ? [decoded] : [];
  });
}

function extractBalancedBlock(source, start) {
  const open = source.indexOf("{", start);
  if (open < 0) fail("could not find prepareProviderIdentity body");
  let depth = 0;
  let quote = null;
  let escaped = false;
  let lineComment = false;
  let blockComment = false;

  for (let index = open; index < source.length; index += 1) {
    const char = source[index];
    const next = source[index + 1];

    if (lineComment) {
      if (char === "\n") lineComment = false;
      continue;
    }
    if (blockComment) {
      if (char === "*" && next === "/") {
        blockComment = false;
        index += 1;
      }
      continue;
    }
    if (quote) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === quote) {
        quote = null;
      }
      continue;
    }
    if (char === "/" && next === "/") {
      lineComment = true;
      index += 1;
      continue;
    }
    if (char === "/" && next === "*") {
      blockComment = true;
      index += 1;
      continue;
    }
    if (char === "'" || char === '"' || char === "`") {
      quote = char;
      continue;
    }
    if (char === "{") depth += 1;
    if (char === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(start, index + 1);
    }
  }
  fail("unterminated prepareProviderIdentity body");
}

async function buildActualWrapper() {
  const esbuild = await import("esbuild").catch(() =>
    fail("esbuild is not installed; no package was installed"),
  );
  const output = await esbuild.build({
    entryPoints: [posthogPath],
    bundle: true,
    format: "iife",
    globalName: "PosthogReleaseWrapper",
    platform: "browser",
    target: "es2020",
    write: false,
    logLevel: "silent",
    define: {
      "import.meta.env.VITE_POSTHOG_KEY": JSON.stringify(fakeKey),
      "import.meta.env.VITE_POSTHOG_CONTROLLED_INGESTION": JSON.stringify("false"),
      "import.meta.env.VITE_SUPABASE_URL": JSON.stringify("http://fixture.invalid"),
    },
    plugins: [{
      name: "posthog-release-local-shims",
      setup(build) {
        build.onResolve({ filter: /^posthog-js$/ }, () => ({
          path: "posthog-js-fixture-shim",
          namespace: "posthog-release-fixture",
        }));
        build.onLoad({
          filter: /^posthog-js-fixture-shim$/,
          namespace: "posthog-release-fixture",
        }, () => ({
          contents: "export default window.posthog;",
          loader: "js",
        }));

        build.onResolve({ filter: /^@capacitor\/app$/ }, () => ({
          path: "capacitor-app-fixture-shim",
          namespace: "posthog-release-fixture",
        }));
        build.onResolve({ filter: /^@capacitor\/core$/ }, () => ({
          path: "capacitor-core-fixture-shim",
          namespace: "posthog-release-fixture",
        }));
        build.onLoad({
          filter: /^capacitor-app-fixture-shim$/,
          namespace: "posthog-release-fixture",
        }, () => ({
          contents: `
            export const App = {
              addListener: () => Promise.resolve({ remove() {} }),
            };
          `,
          loader: "js",
        }));
        build.onLoad({
          filter: /^capacitor-core-fixture-shim$/,
          namespace: "posthog-release-fixture",
        }, () => ({
          contents: `
            export const Capacitor = {
              isNativePlatform: () => window.__posthogReleaseFixture.native,
              getPlatform: () => window.__posthogReleaseFixture.platform,
            };
          `,
          loader: "js",
        }));

        build.onResolve({ filter: /^\.\/supabase$/ }, (args) => ({
          path: `${args.importer}:supabase-fixture`,
          namespace: "posthog-release-fixture",
        }));
        build.onLoad({
          filter: /:supabase-fixture$/,
          namespace: "posthog-release-fixture",
        }, () => ({
          contents: "export const supabase = window.__posthogReleaseFixture.supabase;",
          loader: "js",
        }));
      },
    }],
  });
  return output.outputFiles?.[0]?.text || fail("actual wrapper bundle was empty");
}

async function buildActualProviderHarness() {
  const source = await loadLocalAsset(authPath, "auth source");
  const marker = "  const prepareProviderIdentity = async";
  const start = source.indexOf(marker);
  if (start < 0) fail("auth.tsx no longer contains prepareProviderIdentity");
  const functionSource = extractBalancedBlock(source, start)
    .replace(/\bauthUser:\s*User\b/, "authUser: { id: string; email?: string }");
  if (!functionSource.includes("providerSetupUserId = null")) {
    fail("prepareProviderIdentity fixture did not include the non-live reset");
  }

  const harness = `
    const calls = [];
    let providerSetupUserId = null;
    let providerSetupGeneration = 0;
    let accountStates = [];
    let profileResolvers = [];
    let profilePending = false;

    const currentAccountState = async () => {
      if (!accountStates.length) return "live";
      const next = accountStates.shift();
      return typeof next === "function" ? next() : await next;
    };

    const supabase = {
      rpc: () => ({
        select: () => ({
          maybeSingle: async () => {
            if (profilePending) {
              return await new Promise((resolve) => profileResolvers.push(resolve));
            }
            return { data: { user_name: "fixture_name", display_name: "Fixture Name" } };
          },
        }),
      }),
    };
    const setPostHogCaptureAllowed = (...args) => calls.push(["capture", ...args]);
    const identifyUser = (...args) => calls.push(["identify", ...args]);
    const rememberLastLoginMethodFromUser = (...args) => calls.push(["remember", ...args]);
    const sessionTracker = {
      startSession: (...args) => calls.push(["session-start", ...args]),
    };
    const requestPushPermissionIfNative = async () => calls.push(["push"]);
    const oneSignalIdentity = {
      logout: async () => calls.push(["logout"]),
      login: async (...args) => {
        calls.push(["login", ...args]);
        return true;
      },
    };

    ${functionSource}

    globalThis.__providerHarness = {
      calls,
      prepareProviderIdentity,
      setAccountStates: (next) => { accountStates = [...next]; },
      bumpGeneration: () => { providerSetupGeneration += 1; providerSetupUserId = null; },
      resolveProfile: (value = { data: { user_name: "fixture_name", display_name: "Fixture Name" } }) => {
        const resolve = profileResolvers.shift();
        if (resolve) resolve(value);
      },
      holdProfile: () => { profilePending = true; },
      reset: () => {
        calls.length = 0;
        providerSetupUserId = null;
        providerSetupGeneration = 0;
        accountStates = [];
        profileResolvers = [];
        profilePending = false;
      },
    };
  `;
  const esbuild = await import("esbuild").catch(() =>
    fail("esbuild is not installed; no package was installed"),
  );
  const output = await esbuild.transform(harness, {
    loader: "ts",
    format: "iife",
    target: "es2020",
    legalComments: "none",
  });
  return output.code;
}

function fixtureHtml({ origin, wrapper, sdk, recorder, scenario }) {
  const fixture = JSON.stringify({
    native: scenario.native,
    platform: scenario.platform,
    scenario: scenario.name,
    sdkVariant: scenario.sdkVariant,
    ready: false,
    errors: [],
    initCalls: [],
    captures: [],
    resetCount: 0,
    manualRecordingStarts: 0,
    expiredPolicyScenario: Boolean(scenario.expiredPolicy),
  });
  const supabase = `
    const authListeners = [];
    window.__posthogReleaseFixture.supabase = {
      auth: {
        getSession: async () => ({ data: { session: null }, error: null }),
        onAuthStateChange: (_event, session) => {
          authListeners.push(session);
          return { data: { subscription: { unsubscribe() {} } } };
        },
      },
    };
  `;
  const controlScript = scenario.control ? `
  <script>
    (async () => {
      const fixture = window.__posthogReleaseFixture;
      const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
      const remoteConfig = () => window.posthog.persistence?.props?.$session_recording_remote_config || null;
      try {
        window.posthog.init(${JSON.stringify(fakeKey)}, {
          api_host: ${JSON.stringify(publishedHost)},
          api_transport: "fetch",
          request_batching: true,
          disable_compression: false,
          capture_pageview: false,
          capture_pageleave: true,
          autocapture: true,
          persistence: "localStorage",
          person_profiles: "identified_only",
          opt_out_capturing_by_default: true,
          before_send: (event) => event,
        });
        await sleep(700);
        fixture.remoteConfigBeforeOptIn = remoteConfig();
        window.posthog.opt_in_capturing({ captureEventName: false });
        window.posthog.capture("$pageview", { page: "plain-sdk-control" });
        await sleep(1_200);
        fixture.controlRecording = window.posthog.sessionRecordingStarted?.() || false;
        fixture.controlMutation = "plain SDK mutation";
        document.querySelector("#fixture-main").textContent = fixture.controlMutation;
        document.querySelector("#fixture-button").click();
        await sleep(7_000);
        fixture.sdkState = {
          optedOut: window.posthog.has_opted_out_capturing(),
          capturing: window.posthog.is_capturing(),
          sessionPresent: Boolean(window.posthog.get_session_id?.()),
        };
        fixture.ready = true;
      } catch (error) {
        fixture.errors.push(String(error));
      }
    })();
  </script>` : scenario.richLifecycle ? richWrapperControlScript(scenario) : `
  <script src="/assets/posthog-wrapper.js"></script>
  <script>
    (async () => {
      const fixture = window.__posthogReleaseFixture;
      const wrapper = window.PosthogReleaseWrapper;
      const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
      const remoteConfig = () => window.posthog.persistence?.props?.$session_recording_remote_config || null;
      try {
        wrapper.initPostHog();
        await sleep(700);
        fixture.remoteConfigBeforeWrapperOptIn = remoteConfig();

        wrapper.setPostHogCaptureAllowed(true, "${fakeUserId}");
        await sleep(250);
        fixture.remoteConfigAfterWrapperOptIn = remoteConfig();
        wrapper.identifyUser("${fakeUserId}", {
          email: "fixture@example.test",
          display_name: "Fixture User",
        });
        wrapper.trackEvent("release_initial", { phase: "initial" });
        document.querySelector("#fixture-button").click();
        await sleep(250);

        wrapper.setPostHogCaptureAllowed(false);
        wrapper.trackEvent("release_optout_blocked", { phase: "optout" });
        window.posthog.capture("sdk_optout_blocked", { phase: "optout" });
        await sleep(150);

        wrapper.setPostHogCaptureAllowed(true, "${fakeUserId}");
        await sleep(250);
        wrapper.trackEvent("release_recovered", { phase: "recovered" });
        wrapper.identifyUser("${fakeUserId}", { email: "fixture@example.test" });

        await sleep(700);
        fixture.beforeRecoveryRecording = window.posthog.sessionRecordingStarted?.() || false;
        fixture.beforeRecoveryMutation = "before recovery mutation";
        document.querySelector("#fixture-main").textContent = fixture.beforeRecoveryMutation;
        await sleep(2_300);

        wrapper.resetUser();
        await sleep(200);
        fixture.remoteConfigAfterReset = remoteConfig();
        wrapper.setPostHogCaptureAllowed(true, "${fakeUserId}");
        await sleep(700);
        fixture.afterRecoveryRecording = window.posthog.sessionRecordingStarted?.() || false;
        fixture.afterRecoveryMutation = "after recovery mutation";
        document.querySelector("#fixture-main").textContent = fixture.afterRecoveryMutation;
        wrapper.trackEvent("release_after_reset", { phase: "after-reset" });
        await sleep(2_500);

        document.querySelector("#fixture-button").click();
        fixture.directCaptureResult = window.posthog.capture("sdk_final_probe", { phase: "final" });
        window.posthog.flush?.();
        await sleep(2_200);
        fixture.sdkState = {
          optedOut: window.posthog.has_opted_out_capturing(),
          capturing: window.posthog.is_capturing(),
          sessionPresent: Boolean(window.posthog.get_session_id?.()),
          consent: window.posthog.get_explicit_consent_status?.(),
          sessionRecordingStatus: window.posthog.sessionRecording?.status,
          sessionRecordingConfig: window.posthog.get_property?.("$session_recording_remote_config"),
          persistenceRecordingConfig: window.posthog.persistence?.props?.$session_recording_remote_config,
          persistenceKeys: Object.keys(window.posthog.persistence?.props || {}).filter((key) => key.includes("record")),
          requestQueue: window.posthog._requestQueue?._queue?.length,
        };
        fixture.ready = true;
      } catch (error) {
        fixture.errors.push(String(error));
      }
    })();
  </script>`;
  return `<!doctype html>
<html><head><title>PostHog release fixture</title></head>
<body>
  <button id="fixture-button">release fixture button</button>
  <input id="fixture-input" value="fixture-input-value">
  <main id="fixture-main">initial fixture text</main>
  <script>
    window.__posthogReleaseFixture = ${fixture};
    ${supabase}
  </script>
  <script src="/assets/posthog-sdk.js"></script>
  <script>
    (() => {
      const fixture = window.__posthogReleaseFixture;
      const originalInit = window.posthog.init.bind(window.posthog);
      const originalReset = window.posthog.reset.bind(window.posthog);
      window.posthog.init = (key, config, ...rest) => {
        fixture.initCalls.push({ key, config: { ...config } });
        return originalInit(key, config, ...rest);
      };
      window.posthog.reset = (...args) => {
        fixture.resetCount += 1;
        return originalReset(...args);
      };
      if (typeof window.posthog.startSessionRecording === "function") {
        const originalStartSessionRecording = window.posthog.startSessionRecording.bind(window.posthog);
        window.posthog.startSessionRecording = (...args) => {
          fixture.manualRecordingStarts += 1;
          return originalStartSessionRecording(...args);
        };
      }
    })();
  </script>
  ${controlScript}
</body></html>`;
}

async function startFixtureServer({ sdk, recorder, wrapper, scenario }) {
  const requests = [];
  const captures = [];
  let capturePhase = "bootstrap";
  let configRequestCount = 0;
  const server = createServer((request, response) => {
    void (async () => {
      const chunks = [];
      request.on("data", (chunk) => chunks.push(chunk));
      await new Promise((resolveRequest, rejectRequest) => {
        request.on("end", resolveRequest);
        request.on("error", rejectRequest);
      });
      const url = new URL(request.url || "/", "http://fixture.invalid");
      const path = url.pathname;
      const body = chunks.length ? Buffer.concat(chunks) : Buffer.alloc(0);
      requests.push({
        path,
        method: request.method,
        bodyBytes: body.length,
      });

      const headers = {
        "access-control-allow-origin": "*",
        "access-control-allow-headers": "*",
        "access-control-allow-methods": "GET,POST,OPTIONS",
        "cache-control": "no-store",
      };
      if (request.method === "OPTIONS") {
        response.writeHead(204, headers).end();
        return;
      }
      if (path === "/fixture-phase") {
        capturePhase = url.searchParams.get("phase") || "unknown";
        requests[requests.length - 1].kind = "fixture-phase";
        requests[requests.length - 1].phase = capturePhase;
        response.writeHead(204, headers).end();
        return;
      }
      if (path === "/assets/posthog-sdk.js") {
        response.writeHead(200, { ...headers, "content-type": "application/javascript" }).end(sdk);
        return;
      }
      if (path === "/assets/posthog-wrapper.js") {
        response.writeHead(200, { ...headers, "content-type": "application/javascript" }).end(wrapper);
        return;
      }
      if (path === "/") {
        response.writeHead(200, { ...headers, "content-type": "text/html" })
          .end(fixtureHtml({ origin: fixture.origin, wrapper, sdk, recorder, scenario }));
        return;
      }
      if (path.endsWith("/config.js")) {
        // Force the actual SDK JSON configuration path, while keeping both
        // remote-config requests local and observable.
        requests[requests.length - 1].kind = "remote-config-script-fallback";
        requests[requests.length - 1].responseStatus = 404;
        response.writeHead(404, { ...headers, "content-type": "text/plain" }).end("fixture uses local JSON config");
        return;
      }
      if (path.endsWith("/config")) {
        configRequestCount += 1;
        requests[requests.length - 1].kind = "remote-config";
        requests[requests.length - 1].phaseAtRequest = capturePhase;
        requests[requests.length - 1].startedAt = Date.now();
        const delay = Number(scenario.configDelayMs?.[configRequestCount - 1] || 0);
        requests[requests.length - 1].delayMs = delay;
        if (delay > 0) await new Promise((done) => setTimeout(done, delay));
        const config = {
          sessionRecording: scenario.recordingDisabled ? false : {
            sampleRate: 1,
            minimumDurationMilliseconds: 0,
            maskAllInputs: true,
          },
        };
        requests[requests.length - 1].response = config;
        requests[requests.length - 1].responseStatus = 200;
        requests[requests.length - 1].phaseAtResponse = capturePhase;
        requests[requests.length - 1].completedAt = Date.now();
        response.writeHead(200, { ...headers, "content-type": "application/json" }).end(JSON.stringify(config));
        return;
      }
      if (path.endsWith("/static/lazy-recorder.js")) {
        requests[requests.length - 1].kind = "rrweb-recorder";
        response.writeHead(200, { ...headers, "content-type": "application/javascript" }).end(recorder);
        return;
      }
      if (path.endsWith("/e/") || path.endsWith("/batch/") || path.endsWith("/s/")) {
        const decoded = decodeRequest(request, chunks);
        const entries = captureItems(decoded);
        requests[requests.length - 1].decoded = decoded;
        requests[requests.length - 1].itemCount = entries.length;
        requests[requests.length - 1].phase = capturePhase;
        captures.push(...entries.map((item) => ({ path, item, phase: capturePhase })));
        response.writeHead(200, { ...headers, "content-type": "application/json" })
          .end(JSON.stringify({ status: 1 }));
        return;
      }
      response.writeHead(200, { ...headers, "content-type": "application/json" }).end("{}");
    })().catch((error) => {
      response.writeHead(500, { "content-type": "text/plain" }).end(String(error));
    });
  });
  await new Promise((done) => server.listen(0, "127.0.0.1", done));
  const address = server.address();
  if (!address || typeof address === "string") fail("fixture server did not expose a port");
  const fixture = {
    origin: `http://127.0.0.1:${address.port}`,
    requests,
    captures,
    close: () => new Promise((done) => server.close(done)),
  };
  return fixture;
}

async function runBrowserScenario(playwright, assets, scenario) {
  const fixture = await startFixtureServer({ ...assets, scenario });
  const browser = await playwright.chromium.launch({
    headless: true,
    executablePath: "/repl/tools/bin/chromium",
    args: ["--no-sandbox"],
  });
  const context = await browser.newContext({ userAgent: scenario.userAgent });
  await context.addInitScript(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => undefined });
  });
  const page = await context.newPage();
  const externalAborted = [];
  const posthogRerouted = [];
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error" && message.text().includes("Error loading remote config")) {
      console.error(`SDK configuration diagnostic (${scenario.name}): ${message.text()}`);
    }
  });
  await page.route("**/*", async (route) => {
    const requestUrl = new URL(route.request().url());
    if (requestUrl.origin === fixture.origin) {
      await route.continue();
      return;
    }
    if (requestUrl.origin === publishedHost || requestUrl.origin === publishedAssetHost) {
      posthogRerouted.push(`${requestUrl.pathname}${requestUrl.search}`);
      const request = route.request();
      const localResponse = await fetch(
        `${fixture.origin}${requestUrl.pathname}${requestUrl.search}`,
        {
          method: request.method(),
          headers: request.headers(),
          body: request.method() === "GET" || request.method() === "HEAD"
            ? undefined
            : request.postDataBuffer() || undefined,
        },
      );
      const responseHeaders = {};
      localResponse.headers.forEach((value, key) => {
        responseHeaders[key] = value;
      });
      await route.fulfill({
        status: localResponse.status,
        headers: responseHeaders,
        body: Buffer.from(await localResponse.arrayBuffer()),
      });
      return;
    }
    externalAborted.push(requestUrl.href);
    await route.abort();
  });

  try {
    await page.goto(`${fixture.origin}/`);
    await page.waitForFunction(() => window.__posthogReleaseFixture?.ready === true, undefined, {
      timeout: 45_000,
    }).catch(async () => {
      const state = await page.evaluate(() => window.__posthogReleaseFixture || null);
      fail(`${scenario.name} fixture did not become ready`, {
        state,
        pageErrors,
        externalAborted,
        posthogRerouted,
        requestPaths: fixture.requests.map((request) => request.path),
      });
    });
    const state = await page.evaluate(() => ({
      ...window.__posthogReleaseFixture,
      initCalls: window.__posthogReleaseFixture.initCalls,
    }));
    const captureRecords = fixture.captures;
    const events = fixture.captures.map(({ item }) => item);
    const namedEvents = events.map(eventName).filter(Boolean);
    if (scenario.richLifecycle) {
      const richResult = assertRichLifecycle({
        scenario,
        state,
        fixture,
        events,
        namedEvents,
        captureRecords,
        externalAborted,
        posthogRerouted,
      });
      lastEvidence = richResult;
      return richResult;
    }
    if (scenario.control) {
      const expectedRemoteConfig = {
        sessionRecording: {
          sampleRate: 1,
          minimumDurationMilliseconds: 0,
          maskAllInputs: true,
        },
      };
      const configScriptRequest = fixture.requests.find(
        (request) => request.kind === "remote-config-script-fallback",
      );
      const configRequest = fixture.requests.find(
        (request) => request.kind === "remote-config",
      );
      const snapshotItems = events.filter((item) => snapshotValue(item) !== undefined);
      const snapshotEntries = decodeSnapshotEntries(snapshotItems);
      const replayEvidence = {
        configScriptStatus: configScriptRequest?.responseStatus,
        configStatus: configRequest?.responseStatus,
        configResponse: configRequest?.response,
        persistedConfigBeforeOptIn: state.remoteConfigBeforeOptIn,
        recorderResourceLoaded: fixture.requests.some((request) => request.kind === "rrweb-recorder"),
        recordingStartedWithoutManualStart: state.controlRecording,
        snapshotItems: snapshotItems.length,
        rrwebEntries: snapshotEntries.length,
        fullSnapshots: snapshotEntries.filter((entry) => entry?.type === 2).length,
        incrementalSnapshots: snapshotEntries.filter((entry) => entry?.type === 3).length,
        requestPaths: fixture.requests.map((request) => request.path),
        reroutedPosthogPaths: posthogRerouted,
      };
      assert.equal(externalAborted.length, 0,
        `${scenario.name}: unexpected external requests ${externalAborted.join(", ")}`);
      assert.ok(state.initCalls?.length, `${scenario.name}: plain SDK did not initialize`);
      const init = state.initCalls[0];
      assert.equal(init.key, fakeKey, `${scenario.name}: plain SDK fake key was not used`);
      assert.equal(init.config.api_host, publishedHost, `${scenario.name}: plain SDK host changed`);
      assert.equal(init.config.api_transport, "fetch", `${scenario.name}: plain SDK transport changed`);
      assert.equal(init.config.request_batching, true, `${scenario.name}: plain SDK batching changed`);
      assert.equal(init.config.autocapture, true, `${scenario.name}: plain SDK autocapture changed`);
      assert.equal(init.config.capture_pageleave, true, `${scenario.name}: plain SDK pageleave changed`);
      assert.equal(configScriptRequest?.responseStatus, 404,
        `${scenario.name}: config.js fallback was not exercised`);
      assert.equal(configRequest?.responseStatus, 200,
        `${scenario.name}: JSON remote config did not load`);
      assert.deepEqual(configRequest?.response, expectedRemoteConfig,
        `${scenario.name}: local remote config schema changed`);
      assert.equal(state.remoteConfigBeforeOptIn?.enabled, true,
        `${scenario.name}: SDK did not mark remote recording config enabled`);
      assert.equal(state.remoteConfigBeforeOptIn?.sampleRate, 1,
        `${scenario.name}: SDK normalized sample rate incorrectly`);
      assert.equal(state.remoteConfigBeforeOptIn?.minimumDurationMilliseconds, 0,
        `${scenario.name}: SDK normalized minimum duration incorrectly`);
      assert.equal(state.remoteConfigBeforeOptIn?.maskAllInputs, true,
        `${scenario.name}: SDK normalized masking config incorrectly`);
      assert.equal(state.sdkState?.optedOut, false,
        `${scenario.name}: plain SDK remained opted out`);
      assert.equal(state.sdkState?.capturing, true,
        `${scenario.name}: plain SDK did not capture after opt-in`);
      assert.equal(replayEvidence.recorderResourceLoaded, true,
        `${scenario.name}: plain SDK did not request local rrweb recorder ${JSON.stringify(replayEvidence)}`);
      assert.equal(replayEvidence.recordingStartedWithoutManualStart, true,
        `${scenario.name}: plain SDK did not start rrweb after opt-in ${JSON.stringify(replayEvidence)}`);
      assert.ok(replayEvidence.fullSnapshots > 0,
        `${scenario.name}: plain SDK emitted no rrweb full snapshot ${JSON.stringify(replayEvidence)}`);
      assert.ok(replayEvidence.incrementalSnapshots > 0,
        `${scenario.name}: plain SDK emitted no rrweb incremental snapshot ${JSON.stringify(replayEvidence)}`);
      const result = {
        scenario: scenario.name,
        mode: "plain-sdk-control-no-wrapper-reset",
        requestPaths: fixture.requests.map((request) => request.path),
        events: namedEvents,
        replayRecovered: true,
        replayEvidence,
      };
      lastEvidence = result;
      return result;
    }
    const expectedLabels = scenario.native
      ? { surface: "ios_app", platform: "ios" }
      : { surface: "web_app", platform: "web" };
    const eventCandidates = events.filter((item) => [
      "release_initial",
      "release_recovered",
      "release_after_reset",
      "$identify",
      "$autocapture",
    ].includes(eventName(item)));

    assert.equal(externalAborted.length, 0, `${scenario.name}: unexpected external requests ${externalAborted.join(", ")}`);
    assert.ok(state.initCalls?.length, `${scenario.name}: initPostHog did not call the SDK`);
    const init = state.initCalls[0];
    assert.equal(init.key, fakeKey, `${scenario.name}: fake Vite key was not used`);
    assert.equal(init.config.api_host, publishedHost, `${scenario.name}: legacy host changed`);
    assert.equal(init.config.api_transport, "fetch", `${scenario.name}: transport changed`);
    assert.equal(init.config.request_batching, true, `${scenario.name}: batching changed`);
    assert.equal(init.config.autocapture, true, `${scenario.name}: autocapture changed`);
    assert.equal(init.config.capture_pageleave, true, `${scenario.name}: pageleave changed`);
    assert.equal(init.config.capture_pageview, false, `${scenario.name}: explicit pageview changed`);
    for (const key of [
      "advanced_disable_flags",
      "advanced_disable_decide",
      "advanced_disable_feature_flags",
    ]) {
      assert.equal(Object.prototype.hasOwnProperty.call(init.config, key), false,
        `${scenario.name}: removed ${key} was reintroduced`);
    }
    assert.ok(
      fixture.requests.some((request) => request.kind === "remote-config"),
      `${scenario.name}: SDK remote configuration request did not load`,
    );
    const configScriptRequest = fixture.requests.find(
      (request) => request.kind === "remote-config-script-fallback",
    );
    const configRequest = fixture.requests.find(
      (request) => request.kind === "remote-config",
    );
    assert.equal(configScriptRequest?.responseStatus, 404,
      `${scenario.name}: SDK did not exercise config.js -> config fallback`);
    assert.equal(configRequest?.responseStatus, 200,
      `${scenario.name}: SDK config response was not successful`);
    assert.deepEqual(configRequest?.response, {
      sessionRecording: {
        sampleRate: 1,
        minimumDurationMilliseconds: 0,
        maskAllInputs: true,
      },
    }, `${scenario.name}: local remote config response schema changed`);
    assert.equal(state.sdkState?.optedOut, false,
      `${scenario.name}: SDK unexpectedly remained opted out`);
    assert.equal(state.sdkState?.capturing, true,
      `${scenario.name}: SDK did not recover capture state`);
    assert.equal(state.sdkState?.sessionPresent, true,
      `${scenario.name}: SDK did not restore a session`);
    assert.ok(namedEvents.includes("release_initial"), `${scenario.name}: initial wrapper track was not emitted`);
    assert.ok(namedEvents.includes("release_recovered"), `${scenario.name}: opt-in recovery track was not emitted`);
    assert.ok(namedEvents.includes("release_after_reset"), `${scenario.name}: reset recovery track was not emitted`);
    assert.equal(namedEvents.includes("release_optout_blocked"), false,
      `${scenario.name}: wrapper opt-out event escaped`);
    assert.equal(namedEvents.includes("sdk_optout_blocked"), false,
      `${scenario.name}: direct SDK opt-out event escaped`);
    assert.ok(namedEvents.includes("$autocapture"),
      `${scenario.name}: stock autocapture was not emitted; observed ${namedEvents.join(", ")}`);
    assert.ok(
      eventCandidates.every((item) => {
        const properties = itemProperties(item);
        return properties.surface === expectedLabels.surface &&
          properties.platform === expectedLabels.platform;
      }),
      `${scenario.name}: event labels were not applied consistently`,
    );

    const snapshotItems = events.filter((item) => snapshotValue(item) !== undefined);
    const snapshotEntries = decodeSnapshotEntries(snapshotItems);
    const replayEvidence = {
      configScriptStatus: configScriptRequest?.responseStatus,
      configStatus: configRequest?.responseStatus,
      configResponse: configRequest?.response,
      persistedConfigBeforeWrapperOptIn: state.remoteConfigBeforeWrapperOptIn,
      persistedConfigAfterWrapperOptIn: state.remoteConfigAfterWrapperOptIn,
      persistedConfigAfterReset: state.remoteConfigAfterReset,
      resetClearedCachedRemoteConfig:
        !!state.remoteConfigBeforeWrapperOptIn &&
        !state.remoteConfigAfterWrapperOptIn &&
        !state.remoteConfigAfterReset,
      recorderResourceLoaded: fixture.requests.some((request) => request.kind === "rrweb-recorder"),
      beforeRecoveryRecording: state.beforeRecoveryRecording,
      afterRecoveryRecording: state.afterRecoveryRecording,
      snapshotItems: snapshotItems.length,
      rrwebEntries: snapshotEntries.length,
      fullSnapshots: snapshotEntries.filter((entry) => entry?.type === 2).length,
      incrementalSnapshots: snapshotEntries.filter((entry) => entry?.type === 3).length,
      requestPaths: fixture.requests.map((request) => request.path),
    };
    const replayRecovered =
      replayEvidence.recorderResourceLoaded &&
      replayEvidence.beforeRecoveryRecording &&
      replayEvidence.afterRecoveryRecording &&
      replayEvidence.fullSnapshots > 0 &&
      replayEvidence.incrementalSnapshots > 0;

    lastEvidence = {
      scenario: scenario.name,
      requests: fixture.requests.map((request) => request.path),
      reroutedPosthogRequests: posthogRerouted.length,
      events: namedEvents,
      snapshots: snapshotItems.length,
      rrwebEntries: snapshotEntries.length,
      resetCount: state.resetCount,
      beforeRecoveryRecording: state.beforeRecoveryRecording,
      afterRecoveryRecording: state.afterRecoveryRecording,
      replayRecovered,
      replayEvidence,
    };
    return lastEvidence;
  } finally {
    await context.close();
    await browser.close();
    await fixture.close();
  }
}

async function runProviderHarness(providerCode) {
  const module = { exports: {} };
  const exports = module.exports;
  // The extracted function contains only the AuthProvider's local dependencies;
  // no React, Supabase, Capacitor, OneSignal, or application module is loaded.
  new Function("module", "exports", providerCode)(module, exports);
  const harness = globalThis.__providerHarness;
  if (!harness) fail("provider harness did not initialize");
  const user = { id: fakeUserId, email: "fixture@example.test" };

  harness.reset();
  harness.setAccountStates(["live", "missing", "live"]);
  assert.equal(await harness.prepareProviderIdentity(user), true);
  assert.equal(await harness.prepareProviderIdentity(user), false);
  assert.equal(await harness.prepareProviderIdentity(user), true);
  const recoveryCalls = harness.calls.map((call) => call[0]);
  assert.deepEqual(
    recoveryCalls.filter((name) => name === "capture"),
    ["capture", "capture", "capture"],
    "live -> non-live -> same live did not reauthorize each phase",
  );
  assert.equal(recoveryCalls.filter((name) => name === "identify").length, 2,
    "live recovery did not reidentify the same user");
  assert.equal(recoveryCalls.filter((name) => name === "logout").length, 1,
    "missing account did not log out the provider");

  harness.reset();
  harness.setAccountStates(["live", "live"]);
  assert.equal(await harness.prepareProviderIdentity(user), true);
  assert.equal(await harness.prepareProviderIdentity(user), true);
  assert.equal(harness.calls.filter((call) => call[0] === "capture").length, 1,
    "duplicate live check reset capture state");
  assert.equal(harness.calls.filter((call) => call[0] === "identify").length, 1,
    "duplicate live check reidentified unnecessarily");

  harness.reset();
  let resolveStale;
  harness.setAccountStates([() => new Promise((resolve) => { resolveStale = resolve; })]);
  const pending = harness.prepareProviderIdentity(user);
  harness.bumpGeneration();
  resolveStale("live");
  assert.equal(await pending, false, "stale pending account check was accepted");
  assert.equal(harness.calls.length, 0, "stale pending account check touched providers");

  harness.reset();
  let resolveProfile;
  // The profile promise is resolved only after a generation change. The
  // source's second generation check must reject before identify/push/provider.
  harness.setAccountStates(["live"]);
  harness.holdProfile();
  const profilePending = harness.prepareProviderIdentity(user);
  await Promise.resolve();
  harness.bumpGeneration();
  harness.resolveProfile();
  resolveProfile?.();
  assert.equal(await profilePending, false, "stale pending profile check was accepted");
  assert.equal(harness.calls.some((call) => call[0] === "identify"), false,
    "stale profile check identified a user");

  return {
    liveFailureLive: true,
    duplicateLiveNoop: true,
    staleAccountPendingRejected: true,
    staleProfilePendingRejected: true,
  };
}

async function main() {
  const [sdkAssets, sdkPackage, recorder, wrapper, providerCode] = await Promise.all([
    loadSdkAssets(),
    loadLocalAsset(sdkPackagePath, "installed posthog-js package metadata"),
    loadLocalAsset(recorderPath, "installed posthog-js rrweb recorder"),
    buildActualWrapper(),
    buildActualProviderHarness(),
  ]);
  const packageJSON = JSON.parse(sdkPackage);
  assert.equal(packageJSON.name, "posthog-js");
  assert.equal(packageJSON.version, "1.352.0",
    `unexpected installed SDK version ${packageJSON.version || "unknown"}`);
    assert.ok(sdkAssets.array.length > 100_000, "installed array SDK asset is unexpectedly small");
    assert.ok(sdkAssets.module.length > 100_000, "installed module SDK asset is unexpectedly small");
  assert.ok(recorder.length > 50_000, "installed rrweb asset is unexpectedly small");

  const playwright = await loadPlaywright();
  const scenarios = [
    {
      name: "web",
      native: false,
      platform: "web",
      userAgent: fixtureUserAgent,
      richLifecycle: true,
      configDelayMs: [0, 0, 1_300, 0, 0, 1_300, 0],
    },
    {
      name: "iphone-web",
      native: false,
      platform: "ios",
      userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) " +
        "AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
    },
    {
      name: "native-ios",
      native: true,
      platform: "ios",
      userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) " +
        "AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
    },
  ];
  const browserResults = [];
  const browserScenarios = [
    {
      name: "plain-sdk-control",
      control: true,
      native: false,
      platform: "web",
      userAgent: fixtureUserAgent,
    },
    ...scenarios,
    {
      name: "web-server-recording-disabled",
      native: false,
      platform: "web",
      userAgent: fixtureUserAgent,
      richLifecycle: true,
      recordingDisabled: true,
      configDelayMs: [0, 0, 1_300, 0, 0, 1_300, 0],
    },
    {
      name: "web-expired-policy",
      native: false,
      platform: "web",
      userAgent: fixtureUserAgent,
      richLifecycle: true,
      expiredPolicy: true,
      configDelayMs: [0, 5_200, 5_200, 0],
    },
  ];
  for (const scenario of browserScenarios) {
    for (const sdkVariant of ["array", "module"]) {
      const selected = process.argv.find((arg) => arg.startsWith("--scenario="))?.slice(11);
      if (selected && selected !== `${sdkVariant}:${scenario.name}`) continue;
      browserResults.push(await runBrowserScenario(
        playwright,
        { sdk: sdkAssets[sdkVariant], recorder, wrapper },
        { ...scenario, name: `${sdkVariant}:${scenario.name}`, sdkVariant },
      ));
    }
  }
  const providerResult = await runProviderHarness(providerCode);
  assert.ok(browserResults.length, "No browser scenario matched the requested selection");
  const replayFailures = browserResults
    .filter((result) => !result.replayRecovered)
    .map(({ scenario, replayEvidence }) => ({
      scenario,
      replayEvidence: {
        configScriptStatus: replayEvidence.configScriptStatus,
        configStatus: replayEvidence.configStatus,
        remoteConfigLoadedBeforeReset: !!replayEvidence.persistedConfigBeforeWrapperOptIn,
        remoteConfigPresentAfterWrapperOptIn: !!replayEvidence.persistedConfigAfterWrapperOptIn,
        remoteConfigPresentAfterReset: !!replayEvidence.persistedConfigAfterReset,
        resetClearedCachedRemoteConfig: replayEvidence.resetClearedCachedRemoteConfig,
        recorderResourceLoaded: replayEvidence.recorderResourceLoaded,
        beforeRecoveryRecording: replayEvidence.beforeRecoveryRecording,
        afterRecoveryRecording: replayEvidence.afterRecoveryRecording,
        initialRecording: replayEvidence.initialRecording,
        recoveryRecording: replayEvidence.recoveryRecording,
        guestRecording: replayEvidence.guestRecording,
        accountBRecording: replayEvidence.accountBRecording,
        configRequests: replayEvidence.configRequests,
        configDelays: replayEvidence.configDelays,
         configPhases: replayEvidence.configPhases,
         originalPolicy: replayEvidence.originalPolicy,
         expiredPolicy: replayEvidence.expiredPolicy,
         freshPolicyUnchangedAfterOptIn: replayEvidence.freshPolicyUnchangedAfterOptIn,
         freshPolicyUnchangedAfterReset: replayEvidence.freshPolicyUnchangedAfterReset,
         disabledPolicyNotManufactured: replayEvidence.disabledPolicyNotManufactured,
        staleOptoutState: replayEvidence.staleOptoutState,
        staleAccountSwitchState: replayEvidence.staleAccountSwitchState,
        forbiddenOptoutRecords: replayEvidence.forbiddenOptoutRecords,
        manualRecordingStarts: replayEvidence.manualRecordingStarts,
        reroutedPosthogRequests: replayEvidence.reroutedPosthogPaths?.length,
        sessionIds: [
          replayEvidence.initialSessionId,
          replayEvidence.recoverySessionId,
          replayEvidence.guestSessionId,
          replayEvidence.accountBSessionId,
        ],
        distinctIds: [
          replayEvidence.initialDistinctId,
          replayEvidence.guestDistinctId,
          replayEvidence.accountBDistinctId,
        ],
        maskedAndPrivateDom: {
          initial: replayEvidence.initialSnapshotMasksInput &&
            replayEvidence.initialSnapshotOmitsPrivateHook,
          accountB: replayEvidence.accountBSnapshotMasksInput &&
            replayEvidence.accountBSnapshotOmitsPrivateHook,
          accountBHasNoPreviousDom: replayEvidence.accountBSnapshotOmitsPreviousDom,
        },
        snapshotItems: replayEvidence.snapshotItems,
        rrwebEntries: replayEvidence.rrwebEntries,
        fullSnapshots: replayEvidence.fullSnapshots,
        incrementalSnapshots: replayEvidence.incrementalSnapshots,
        requestPaths: replayEvidence.requestPaths,
      },
    }));
  const conciseBrowserResults = browserResults.map((result) => ({
    scenario: result.scenario,
    mode: result.mode,
    events: result.events,
    replayRecovered: result.replayRecovered,
    replayEvidence: result.replayEvidence && {
      configScriptStatus: result.replayEvidence.configScriptStatus,
      configStatus: result.replayEvidence.configStatus,
      persistedConfigBeforeOptIn: result.replayEvidence.persistedConfigBeforeOptIn
        ? { enabled: result.replayEvidence.persistedConfigBeforeOptIn.enabled,
          sampleRate: result.replayEvidence.persistedConfigBeforeOptIn.sampleRate }
        : undefined,
      remoteConfigLoadedBeforeReset: result.replayEvidence.persistedConfigBeforeWrapperOptIn
        ? { enabled: result.replayEvidence.persistedConfigBeforeWrapperOptIn.enabled,
          sampleRate: result.replayEvidence.persistedConfigBeforeWrapperOptIn.sampleRate }
        : undefined,
      remoteConfigPresentAfterWrapperOptIn: !!result.replayEvidence.persistedConfigAfterWrapperOptIn,
      remoteConfigPresentAfterReset: !!result.replayEvidence.persistedConfigAfterReset,
      resetClearedCachedRemoteConfig: result.replayEvidence.resetClearedCachedRemoteConfig,
      recorderResourceLoaded: result.replayEvidence.recorderResourceLoaded,
      recordingStartedWithoutManualStart: result.replayEvidence.recordingStartedWithoutManualStart,
      beforeRecoveryRecording: result.replayEvidence.beforeRecoveryRecording,
      afterRecoveryRecording: result.replayEvidence.afterRecoveryRecording,
      initialRecording: result.replayEvidence.initialRecording,
      recoveryRecording: result.replayEvidence.recoveryRecording,
      guestRecording: result.replayEvidence.guestRecording,
      accountBRecording: result.replayEvidence.accountBRecording,
      configRequests: result.replayEvidence.configRequests,
      configDelays: result.replayEvidence.configDelays,
       configPhases: result.replayEvidence.configPhases,
       originalPolicy: result.replayEvidence.originalPolicy,
       expiredPolicy: result.replayEvidence.expiredPolicy,
       freshPolicyUnchangedAfterOptIn: result.replayEvidence.freshPolicyUnchangedAfterOptIn,
       freshPolicyUnchangedAfterReset: result.replayEvidence.freshPolicyUnchangedAfterReset,
       disabledPolicyNotManufactured: result.replayEvidence.disabledPolicyNotManufactured,
      staleOptoutState: result.replayEvidence.staleOptoutState,
      staleAccountSwitchState: result.replayEvidence.staleAccountSwitchState,
      forbiddenOptoutRecords: result.replayEvidence.forbiddenOptoutRecords,
      manualRecordingStarts: result.replayEvidence.manualRecordingStarts,
      reroutedPosthogRequests: result.replayEvidence.reroutedPosthogPaths?.length,
      sessionIds: [
        result.replayEvidence.initialSessionId,
        result.replayEvidence.recoverySessionId,
        result.replayEvidence.guestSessionId,
        result.replayEvidence.accountBSessionId,
      ],
      distinctIds: [
        result.replayEvidence.initialDistinctId,
        result.replayEvidence.guestDistinctId,
        result.replayEvidence.accountBDistinctId,
      ],
      maskedAndPrivateDom: {
        initial: result.replayEvidence.initialSnapshotMasksInput &&
          result.replayEvidence.initialSnapshotOmitsPrivateHook,
        accountB: result.replayEvidence.accountBSnapshotMasksInput &&
          result.replayEvidence.accountBSnapshotOmitsPrivateHook,
        accountBHasNoPreviousDom: result.replayEvidence.accountBSnapshotOmitsPreviousDom,
      },
      snapshotItems: result.replayEvidence.snapshotItems,
      rrwebEntries: result.replayEvidence.rrwebEntries,
      fullSnapshots: result.replayEvidence.fullSnapshots,
      incrementalSnapshots: result.replayEvidence.incrementalSnapshots,
      requestPaths: result.replayEvidence.requestPaths,
    },
  }));
  const result = {
    status: replayFailures.length ? "fail" : "pass",
    command: "node scripts/validate-posthog-release.mjs",
    mode: "local isolated Playwright fixture only",
    installedSdk: packageJSON.version,
    installedSdkVariants: ["array.js", "module.js (IIFE fixture import)"],
    externalNetworkBlocked: true,
    appBuild: false,
    providerNetwork: false,
    assertions: [
      "actual initPostHog/setPostHogCaptureAllowed/identifyUser/trackEvent/resetUser",
      "legacy fetch host, transport, batching, autocapture, and pageleave unchanged",
      "local remote configuration and rrweb recorder loading",
      "initial replay before recovery, opt-out -> reset -> opt-in replay, and delayed stale-config rejection",
      "logout -> guest -> different-account identity/session separation and previous-DOM exclusion",
      "normal events, surface labels, opt-out event/snapshot suppression, server-disabled replay, masked inputs, and ph-no-capture hooks",
      "web/native iOS/iPhone web surface labels",
      "actual prepareProviderIdentity live -> failure -> same-live recovery",
      "duplicate live no-op and stale pending account/profile rejection",
    ],
    browserResults: conciseBrowserResults,
    providerResult,
    ...(replayFailures.length ? {
      replayRecoveryFailure: "Actual SDK replay or lifecycle assertions failed; this report does not infer absence of previously queued events from suppression of newly attempted events.",
      smallestCandidateRemedy: "Confirm the authorized opt-in invokes the installed SDK remote configuration loader and that delayed responses remain consent-gated.",
      replayFailures,
    } : {}),
    limitations: [
      "All browser provider and PostHog requests are intercepted by the local fixture; no provider, credential, published endpoint, build, prepare, deploy, or package installation is used.",
      "Opt-out suppression assertions inspect captured request items and phase markers; they do not claim that an event queued before the boundary could never be flushed later.",
      "Replay identity/session assertions use SDK-emitted distinct/session properties and rrweb payload text; they do not inspect a provider-side recording.",
    ],
  };
  console.log(JSON.stringify(result, null, 2));
  if (replayFailures.length) process.exitCode = 1;
}

try {
  await main();
} catch (error) {
  console.error(JSON.stringify({
    status: "fail",
    command: "node scripts/validate-posthog-release.mjs",
    mode: "local isolated Playwright fixture only",
    externalNetworkBlocked: true,
    evidence: lastEvidence,
    error: String(error?.stack || error),
  }, null, 2));
  process.exitCode = 1;
}