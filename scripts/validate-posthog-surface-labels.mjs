/**
 * Local-only browser validation for PostHog surface labels.
 *
 * Run: node scripts/validate-posthog-surface-labels.mjs
 * App SDK only (no separately downloaded marketing fixture): add --app-only.
 * Uses only installed Playwright/esbuild, local fixture requests, and dummy
 * credentials. It never loads the app, auth, a provider, or a published host.
 */
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { gunzipSync } from "node:zlib";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const helperPath = resolve(root, "client/src/lib/posthog-surface.ts");
const capturePrefix = "/fake-posthog-capture/";
const dummyKey = "phc_surface_labels_local_validation_only";
const allSdkFixtures = [
  {
    version: "1.352.0",
    source: resolve(root, "node_modules/posthog-js/dist/array.full.js"),
    package: resolve(root, "node_modules/posthog-js/package.json"),
  },
  {
    version: "1.430.3",
    source: "/tmp/posthog-replay-sdk-1.430.3/package/dist/array.full.js",
    package: "/tmp/posthog-replay-sdk-1.430.3/package/package.json",
  },
];
const sdkFixtures = process.argv.includes("--app-only")
  ? allSdkFixtures.slice(0, 1)
  : allSdkFixtures;

function fail(message) {
  throw new Error(`PostHog surface-label validation: ${message}`);
}

async function loadPlaywright() {
  try {
    return await import("playwright");
  } catch {
    fail("Playwright is not installed; no package was installed");
  }
}

async function bundleHelper() {
  let esbuild;
  try {
    esbuild = await import("esbuild");
  } catch {
    fail("esbuild is not installed; no package was installed");
  }
  const output = await esbuild.build({
    entryPoints: [helperPath],
    bundle: true,
    format: "iife",
    globalName: "SurfaceLabelExports",
    platform: "browser",
    target: "es2020",
    external: ["posthog-js"],
    write: false,
  });
  return output.outputFiles?.[0]?.text || fail("helper bundle was empty");
}

async function loadSdk(fixture) {
  const packageText = await readFile(fixture.package, "utf8").catch(() =>
    fail(`SDK ${fixture.version} metadata is unavailable at ${fixture.package}`),
  );
  const packageJSON = JSON.parse(packageText);
  if (packageJSON.version !== fixture.version) {
    fail(`SDK fixture expected ${fixture.version}, found ${packageJSON.version || "unknown"}`);
  }
  const source = await readFile(fixture.source, "utf8").catch(() =>
    fail(`SDK ${fixture.version} asset is unavailable at ${fixture.source}`),
  );
  if (source.length < 100_000) fail(`SDK ${fixture.version} asset is unexpectedly small`);
  return source;
}

function decodeValue(value) {
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    try {
      let bytes = Buffer.from(value, "base64");
      if (bytes[0] === 0x1f && bytes[1] === 0x8b) bytes = gunzipSync(bytes);
      return JSON.parse(bytes.toString("utf8"));
    } catch {
      return {};
    }
  }
}

function decodeRequest(body, headers) {
  let bytes = Buffer.concat(body);
  if (String(headers["content-encoding"] || "").toLowerCase() === "gzip") {
    bytes = gunzipSync(bytes);
  }
  const text = bytes.toString("utf8");
  if (!text) return {};
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    return decodeValue(text);
  }
  return parsed && typeof parsed.data === "string" &&
    parsed.event === undefined && parsed.batch === undefined
    ? decodeValue(parsed.data)
    : parsed;
}

function items(body) {
  if (Array.isArray(body)) return body;
  if (Array.isArray(body?.batch)) return body.batch;
  if (Array.isArray(body?.data)) return body.data;
  return body && typeof body === "object" ? [body] : [];
}

function eventName(item) {
  return item?.event || item?.event_name || item?.properties?.event;
}

function properties(item) {
  return item?.properties && typeof item.properties === "object" ? item.properties : {};
}

function fixtureHTML(origin, scenario, sdk) {
  const config = JSON.stringify({
    name: scenario.name,
    marketing: scenario.marketing,
  });
  return `<!doctype html><button id="surface-label-autocapture">Autocapture</button>
<script src="/assets/posthog-sdk.js?sdk=${encodeURIComponent(sdk)}"></script>
<script src="/assets/posthog-surface.js"></script>
<script>
(() => {
  const c = ${config};
  const x = window.SurfaceLabelExports;
  window.__surfaceFixture = { ready: false, errors: [], captureAllowed: false, scenario: c.name };
  try {
    const labels = c.marketing ? x.marketingSurfaceLabels :
      x.getAppSurfaceLabels(window.Capacitor);
    window.__surfaceFixture.labels = labels;
    window.__surfaceFixture.marketingLabels = x.marketingSurfaceLabels;
    const previous = event => window.__surfaceFixture.captureAllowed ? event : null;
    window.posthog.init(${JSON.stringify(dummyKey)}, {
      api_host: ${JSON.stringify(`${origin}/fake-posthog-capture`)},
      api_transport: "fetch", request_batching: false, disable_compression: true,
      capture_pageview: false, capture_pageleave: false, autocapture: true,
      persistence: "localStorage", opt_out_capturing_by_default: true,
      advanced_disable_flags: true, advanced_disable_decide: true,
      advanced_disable_feature_flags: true,
      before_send: x.createSurfaceLabelHook(labels, previous),
    });
    const input = {
      event: "helper_probe", uuid: "surface-label-probe", timestamp: new Date(0),
      properties: { distinct_id: "surface-label-fixture", keep: true,
        private_value: "must-be-removed", surface: "conflicting", platform: "conflicting" },
    };
    const cloned = x.withSurfaceLabels(input, labels);
    const privacyFirst = x.createSurfaceLabelHook(labels, event => {
      const { private_value: _, ...rest } = event.properties;
      return { ...event, properties: rest };
    });
    const sanitized = privacyFirst(input);
    const rejected = x.createSurfaceLabelHook(labels, () => null)(input);
    const malformed = x.withSurfaceLabels({ event: "malformed", properties: null }, labels);
    window.__surfaceFixture.probes = {
      clonedEvent: cloned !== input, propertiesCloned: cloned?.properties !== input.properties,
      inputSurface: input.properties.surface, inputPlatform: input.properties.platform,
      clonedProperties: cloned?.properties, sanitizedProperties: sanitized?.properties,
      rejectedIsNull: rejected === null, nullInputIsNull: x.withSurfaceLabels(null, labels) === null,
      malformedProperties: malformed?.properties, noLabelsSameEvent: x.withSurfaceLabels(input, null) === input,
      unsupportedNative: x.getAppSurfaceLabels({
        isNativePlatform: () => true, getPlatform: () => "android",
      }),
    };
    window.__surfaceFixture.ready = true;
  } catch (error) {
    window.__surfaceFixture.errors.push(String(error));
  }
})();
</script>`;
}

function readBody(request) {
  return new Promise((resolveBody, reject) => {
    const chunks = [];
    request.on("data", chunk => chunks.push(chunk));
    request.on("end", () => resolveBody(chunks));
    request.on("error", reject);
  });
}

async function startServer(sdkTexts, helperText, scenarios) {
  const captures = [];
  const conventional = createServer((request, response) => {
    void (async () => {
      const body = await readBody(request);
      const url = new URL(request.url || "/", "http://fixture.invalid");
      if (url.pathname === "/assets/posthog-sdk.js") {
        const source = sdkTexts.get(url.searchParams.get("sdk"));
        if (!source) return response.writeHead(404).end();
        response.writeHead(200, { "content-type": "application/javascript" }).end(source);
        return;
      }
      if (url.pathname === "/assets/posthog-surface.js") {
        response.writeHead(200, { "content-type": "application/javascript" }).end(helperText);
        return;
      }
      if (url.pathname.startsWith(capturePrefix)) {
        captures.push(items(decodeRequest(body, request.headers)));
        response.writeHead(200, { "content-type": "application/json" })
          .end(JSON.stringify({ status: 1 }));
        return;
      }
      const scenario = scenarios.find(entry => entry.name === url.searchParams.get("scenario"));
      const sdk = url.searchParams.get("sdk");
      if (scenario && sdkTexts.has(sdk)) {
        response.writeHead(200, { "content-type": "text/html" }).end(fixtureHTML(
          `http://127.0.0.1:${conventional.address().port}`, scenario, sdk,
        ));
        return;
      }
      response.writeHead(204).end();
    })().catch(error => response.writeHead(500).end(String(error)));
  });
  await new Promise(done => conventional.listen(0, "127.0.0.1", done));
  const address = conventional.address();
  if (!address || typeof address === "string") fail("fixture server did not expose a port");
  return {
    origin: `http://127.0.0.1:${address.port}`,
    captures,
    close: () => new Promise(done => conventional.close(done)),
  };
}

function assertProbes(state, scenario) {
  const expected = scenario.expectedLabels;
  assert.deepEqual(state.labels, expected, `${scenario.name}: wrong platform labels`);
  assert.deepEqual(state.marketingLabels, { surface: "marketing_site", platform: "web" });
  const p = state.probes;
  assert.ok(p, `${scenario.name}: helper probes did not run`);
  assert.equal(p.clonedEvent, true);
  assert.equal(p.propertiesCloned, true);
  assert.equal(p.inputSurface, "conflicting");
  assert.equal(p.inputPlatform, "conflicting");
  assert.deepEqual(p.clonedProperties, {
    distinct_id: "surface-label-fixture", keep: true, private_value: "must-be-removed",
    surface: expected.surface, platform: expected.platform,
  });
  assert.equal(p.sanitizedProperties.private_value, undefined);
  assert.equal(p.sanitizedProperties.surface, expected.surface);
  assert.equal(p.rejectedIsNull, true);
  assert.equal(p.nullInputIsNull, true);
  assert.deepEqual(p.malformedProperties, expected);
  assert.equal(p.noLabelsSameEvent, true);
  assert.equal(p.unsupportedNative, null);
}

async function runScenario(playwright, fixture, scenario, sdk) {
  const browser = await playwright.chromium.launch({
    headless: true, executablePath: "/repl/tools/bin/chromium", args: ["--no-sandbox"],
  });
  const context = await browser.newContext({ userAgent: scenario.userAgent });
  const external = [];
  const page = await context.newPage();
  await context.addInitScript(({ native, platform }) => {
    Object.defineProperty(navigator, "webdriver", { get: () => undefined });
    window.Capacitor = { isNativePlatform: () => native, getPlatform: () => platform };
  }, { native: scenario.native, platform: scenario.platform });
  page.on("request", request => {
    const url = new URL(request.url());
    if (url.origin !== fixture.origin) external.push(url.href);
  });
  await page.route("**/*", async route => {
    const url = new URL(route.request().url());
    if (url.origin === fixture.origin) return route.continue();
    external.push(url.href);
    return route.abort();
  });
  const start = fixture.captures.length;
  try {
    await page.goto(`${fixture.origin}/?scenario=${scenario.name}&sdk=${sdk}`);
    await page.waitForFunction(() => window.__surfaceFixture?.ready === true, undefined, {
      timeout: 10_000,
    }).catch(async () => {
      const state = await page.evaluate(() => window.__surfaceFixture || null);
      fail(`${scenario.name}/${sdk}: fixture failed ${JSON.stringify(state?.errors || [])}`);
    });
    const state = await page.evaluate(() => ({
      labels: window.__surfaceFixture.labels,
      marketingLabels: window.__surfaceFixture.marketingLabels,
      probes: window.__surfaceFixture.probes,
    }));
    assertProbes(state, scenario);
    await page.evaluate(() => {
      const f = window.__surfaceFixture;
      window.posthog.opt_out_capturing();
      window.posthog.capture("optout_blocked", { surface: "conflicting", platform: "conflicting" });
      f.captureAllowed = true;
      window.posthog.opt_in_capturing({ captureEventName: false });
      window.posthog.capture("$pageview", { surface: "conflicting", platform: "conflicting" });
      window.posthog.capture("surface_label_custom", {
        surface: "conflicting", platform: "conflicting", fixture: f.scenario,
      });
      document.querySelector("#surface-label-autocapture").click();
      window.posthog.reset();
      window.posthog.opt_in_capturing({ captureEventName: false });
      window.posthog.capture("surface_label_after_reset", {
        surface: "conflicting", platform: "conflicting", fixture: f.scenario,
      });
    });
    await page.waitForTimeout(750);
  } finally {
    await context.close();
    await browser.close();
  }
  const events = fixture.captures.slice(start).flat().filter(item => item && typeof item === "object");
  const expectedEvents = ["$pageview", "$autocapture", "surface_label_custom", "surface_label_after_reset"];
  assert.equal(events.some(item => eventName(item) === "optout_blocked"), false,
    `${scenario.name}/${sdk}: opt-out event escaped`);
  for (const name of expectedEvents) {
    assert.ok(events.some(item => eventName(item) === name),
      `${scenario.name}/${sdk}: SDK did not emit ${name}; observed ${events.map(eventName).join(", ") || "none"}`);
  }
  for (const item of events.filter(item => expectedEvents.includes(eventName(item)))) {
    assert.equal(properties(item).surface, scenario.expectedLabels.surface,
      `${scenario.name}/${sdk}/${eventName(item)}: wrong surface`);
    assert.equal(properties(item).platform, scenario.expectedLabels.platform,
      `${scenario.name}/${sdk}/${eventName(item)}: wrong platform`);
  }
  assert.equal(external.length, 0, `${scenario.name}/${sdk}: external requests: ${external.join(", ")}`);
  return { sdk, scenario: scenario.name, labels: scenario.expectedLabels, events: events.map(eventName), requests: fixture.captures.length - start };
}

const playwright = await loadPlaywright();
const [sdkEntries, helperText] = await Promise.all([
  Promise.all(sdkFixtures.map(async fixture => [fixture.version, await loadSdk(fixture)])),
  bundleHelper(),
]);
const sdkTexts = new Map(sdkEntries);
const scenarios = [
  {
    name: "browser-web", native: false, platform: "web", marketing: false,
    expectedLabels: { surface: "web_app", platform: "web" },
    userAgent: "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  },
  {
    name: "mobile-safari-web", native: false, platform: "ios", marketing: false,
    expectedLabels: { surface: "web_app", platform: "web" },
    userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
  },
  {
    name: "native-ios-capacitor", native: true, platform: "ios", marketing: false,
    expectedLabels: { surface: "ios_app", platform: "ios" },
    userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
  },
  {
    name: "marketing-static-labels", native: false, platform: "web", marketing: true,
    expectedLabels: { surface: "marketing_site", platform: "web" },
    userAgent: "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  },
];

const fixture = await startServer(sdkTexts, helperText, scenarios);
const results = [];
try {
  for (const { version } of sdkFixtures) {
    for (const scenario of scenarios) results.push(await runScenario(playwright, fixture, scenario, version));
  }
} finally {
  await fixture.close();
}
console.log(JSON.stringify({
  status: "pass",
  command: "node scripts/validate-posthog-surface-labels.mjs",
  mode: "local isolated synthetic browser fixture only",
  sdk: sdkFixtures.map(({ version }) => version),
  externalRequestsBlocked: true,
  preparedHelperVerified: true,
  appWiringVerified: false,
  marketingSiteWiringVerified: false,
  assertions: [
    "browser/iOS Capacitor detection", "mobile Safari remains web",
    "pageview/custom/autocapture labels", "opt-out and prior-hook null rejection",
    "privacy sanitization/conflicting override", "reset preserves labels", "marketing labels",
  ],
  results,
}, null, 2));