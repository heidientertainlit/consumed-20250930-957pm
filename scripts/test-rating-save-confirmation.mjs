import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import autoprefixer from "autoprefixer";
import postcss from "postcss";
import tailwindcss from "tailwindcss";
import WebSocket from "ws";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const temp = await mkdtemp(join(tmpdir(), "rating-save-confirmation-"));
const entry = join(temp, "entry.tsx");
const bundle = join(temp, "bundle.js");
const stylesheet = join(temp, "fixture.css");
const screenshot = "/tmp/rating-save-confirmation.png";

await writeFile(entry, `
import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { useConfirmedRatingSave } from ${JSON.stringify(join(root, "client/src/hooks/use-confirmed-rating-save.ts"))};
import { saveFeedRating } from ${JSON.stringify(join(root, "client/src/lib/save-feed-rating.ts"))};
import { RatingSaveFeedback } from ${JSON.stringify(join(root, "client/src/components/rating-save-feedback.tsx"))};
import { InlineFeedStarRater } from ${JSON.stringify(join(root, "client/src/components/inline-feed-star-rater.tsx"))};

const nativeSetTimeout = window.setTimeout.bind(window);
window.setTimeout = (callback, delay, ...args) =>
  nativeSetTimeout(callback, delay === 20000 ? 120 : delay, ...args);

const mock = {
  mode: "manual",
  externalId: "existing-7",
  title: "Fixture Film",
  requests: [],
  pending: [],
  searchResult: { externalId: "resolved-42", externalSource: "tmdb", canonical_media_id: "canon-42" },
};

window.fetch = (url, init = {}) => {
  const request = {
    url: String(url),
    method: init.method || "GET",
    authorization: init.headers?.Authorization,
    contentType: init.headers?.["Content-Type"],
    body: init.body ? JSON.parse(init.body) : null,
    abortedAtStart: !!init.signal?.aborted,
  };
  mock.requests.push(request);
  if (request.url.includes("/media-search")) {
    if (mock.mode === "search-network") return Promise.reject(new TypeError("offline"));
    if (mock.mode === "search-400") return Promise.resolve(new Response("bad search", { status: 400 }));
    const results = mock.mode === "search-empty" ? [] : [mock.searchResult];
    return Promise.resolve(new Response(JSON.stringify({ results }), {
      status: 200, headers: { "Content-Type": "application/json" },
    }));
  }
  if (!request.url.includes("/rate-media")) {
    return Promise.reject(new Error("Unexpected fixture URL: " + request.url));
  }
  if (mock.mode === "network") return Promise.reject(new TypeError("network down"));
  if (mock.mode.startsWith("http-")) {
    return Promise.resolve(new Response(JSON.stringify({ success: false }), {
      status: Number(mock.mode.slice(5)), headers: { "Content-Type": "application/json" },
    }));
  }
  if (mock.mode === "false-success") {
    return Promise.resolve(new Response(JSON.stringify({ success: false }), { status: 200 }));
  }
  if (mock.mode === "malformed") {
    return Promise.resolve(new Response("{", { status: 200, headers: { "Content-Type": "application/json" } }));
  }
  if (mock.mode === "immediate-success" || mock.mode === "fallback-success") {
    return Promise.resolve(new Response(JSON.stringify({ success: true }), { status: 200 }));
  }
  return new Promise((resolve, reject) => {
    const item = {
      resolveSuccess: () => resolve(new Response(JSON.stringify({ success: true }), { status: 200 })),
      rejectNetwork: () => reject(new TypeError("network down")),
    };
    mock.pending.push(item);
    if (mock.mode === "timeout") {
      init.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), { once: true });
    }
  });
};

let fixtureApi;
function Fixture() {
  const [identity, setIdentity] = useState({ postId: "post-a", accountId: "account-a" });
  const [confirmed, setConfirmed] = useState(2);
  const [submitted, setSubmitted] = useState(false);
  const [resolved, setResolved] = useState({ externalId: "", externalSource: "", canonicalMediaId: "" });
  const ratingSave = useConfirmedRatingSave({
    resetKey: identity.postId + ":" + identity.accountId,
    save: (rating, signal) => saveFeedRating({
      supabaseUrl: "https://fixture.invalid",
      accessToken: "token-unchanged",
      externalId: mock.externalId,
      externalSource: "legacy-source",
      mediaTitle: mock.title,
      mediaType: "Movie",
      mediaImage: "https://fixture.invalid/poster.jpg",
      rating,
      signal,
    }),
    onSuccess: (rating, media) => {
      setConfirmed(rating);
      setResolved(media);
      setSubmitted(true);
    },
  });
  useEffect(() => {
    setConfirmed(2);
    setSubmitted(false);
    setResolved({ externalId: "", externalSource: "", canonicalMediaId: "" });
  }, [identity.postId, identity.accountId]);
  fixtureApi = {
    ratingSave,
    setIdentity,
    state: () => ({ identity, confirmed, submitted, resolved }),
  };
  return (
    <main className="fixture-page">
      <section className="fixture-card">
        <h1>Confirmed rating save</h1>
        <div data-testid="confirmed">Confirmed: {confirmed}/5</div>
        <div data-testid="resolved">{JSON.stringify(resolved)}</div>
        {!submitted && (
          <InlineFeedStarRater
            onRate={ratingSave.submit}
            disabled={ratingSave.saving}
            value={ratingSave.pendingRating || 0}
          />
        )}
        <RatingSaveFeedback {...ratingSave} onRetry={ratingSave.retry} />
      </section>
    </main>
  );
}

let rootHandle;
function mount() {
  rootHandle = createRoot(document.getElementById("root"));
  rootHandle.render(<Fixture />);
}
mount();
window.__fixture = {
  mock,
  state: () => fixtureApi.state(),
  saveState: () => ({
    saving: fixtureApi.ratingSave.saving,
    pendingRating: fixtureApi.ratingSave.pendingRating,
    error: fixtureApi.ratingSave.error,
    justSaved: fixtureApi.ratingSave.justSaved,
  }),
  configure: values => Object.assign(mock, values),
  resetMock: values => Object.assign(mock, {
    mode: "manual", externalId: "existing-7", title: "Fixture Film",
    requests: [], pending: [],
    searchResult: { externalId: "resolved-42", externalSource: "tmdb", canonical_media_id: "canon-42" },
  }, values || {}),
  resolve: index => mock.pending[index].resolveSuccess(),
  reject: index => mock.pending[index].rejectNetwork(),
  submitTwice: rating => { fixtureApi.ratingSave.submit(rating); fixtureApi.ratingSave.submit(rating); },
  identity: (postId, accountId) => fixtureApi.setIdentity({ postId, accountId }),
  unmount: () => { rootHandle.unmount(); rootHandle = null; },
  remount: () => { if (!rootHandle) mount(); },
};
`);

const sourceCss = await readFile(join(root, "client/src/index.css"), "utf8");
const processedCss = await postcss([
  tailwindcss({ config: join(root, "tailwind.config.ts") }),
  autoprefixer,
]).process(sourceCss, {
  from: join(root, "client/src/index.css"),
  to: stylesheet,
});
await writeFile(stylesheet, `${processedCss.css}
* { box-sizing: border-box; }
html, body, #root { margin: 0; width: 100%; min-height: 100%; }
.fixture-page { min-height: 100vh; padding: 24px 10px; background: #f5f3ff; }
.fixture-card { width: min(390px, 100%); margin: auto; padding: 18px 8px; background: white; border: 1px solid #ddd6fe; border-radius: 16px; }
.fixture-card h1 { margin: 0 12px 12px; color: #4c1d95; font-size: 18px; }
[data-testid="confirmed"], [data-testid="resolved"] { margin: 6px 12px; font-size: 13px; overflow-wrap: anywhere; }
`);

await build({
  entryPoints: [entry],
  outfile: bundle,
  bundle: true,
  format: "iife",
  platform: "browser",
  jsx: "automatic",
  absWorkingDir: root,
  nodePaths: [join(root, "node_modules")],
});

const html = `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/fixture.css"></head><body><div id="root"></div><script src="/bundle.js"></script></body></html>`;
const server = createServer(async (req, res) => {
  if (req.url === "/bundle.js") {
    res.setHeader("Content-Type", "text/javascript");
    res.end(await readFile(bundle));
  } else if (req.url === "/fixture.css") {
    res.setHeader("Content-Type", "text/css");
    res.end(await readFile(stylesheet));
  } else {
    res.setHeader("Content-Type", "text/html");
    res.end(html);
  }
});
await new Promise(resolveListen => server.listen(0, "127.0.0.1", resolveListen));
const port = server.address().port;

const chrome = spawn("/repl/tools/bin/chromium", [
  "--headless", "--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage",
  "--remote-debugging-port=0", `--user-data-dir=${join(temp, "chrome")}`, "about:blank",
], { stdio: ["ignore", "ignore", "pipe"] });

let browser;
let page;
const results = [];
async function record(name, fn) {
  try {
    await fn();
    results.push(`PASS ${name}`);
  } catch (error) {
    results.push(`FAIL ${name}: ${error.message}`);
    process.exitCode = 1;
  }
}

try {
  let stderr = "";
  const browserWs = await new Promise((resolveWs, reject) => {
    const timeout = setTimeout(() => reject(new Error(`Chromium CDP timeout: ${stderr}`)), 10000);
    chrome.stderr.on("data", chunk => {
      stderr += chunk;
      const match = stderr.match(/DevTools listening on (ws:\/\/[^\s]+)/);
      if (match) {
        clearTimeout(timeout);
        resolveWs(match[1]);
      }
    });
  });

  class CDP {
    constructor(url) {
      this.next = 1;
      this.pending = new Map();
      this.ws = new WebSocket(url);
    }
    async open() {
      await new Promise((resolveOpen, reject) => {
        this.ws.once("open", resolveOpen);
        this.ws.once("error", reject);
      });
      this.ws.on("message", raw => {
        const message = JSON.parse(raw);
        if (message.id && this.pending.has(message.id)) {
          const pending = this.pending.get(message.id);
          this.pending.delete(message.id);
          message.error ? pending.reject(new Error(message.error.message)) : pending.resolve(message.result);
        }
      });
    }
    call(method, params = {}) {
      const id = this.next++;
      return new Promise((resolveCall, reject) => {
        this.pending.set(id, { resolve: resolveCall, reject });
        this.ws.send(JSON.stringify({ id, method, params }));
      });
    }
  }

  browser = new CDP(browserWs);
  await browser.open();
  const target = await browser.call("Target.createTarget", { url: "about:blank" });
  const listUrl = browserWs.replace("ws://", "http://").replace(/\/devtools\/browser\/.*$/, "/json/list");
  const targets = await (await fetch(listUrl)).json();
  page = new CDP(targets.find(item => item.id === target.targetId).webSocketDebuggerUrl);
  await page.open();
  await page.call("Page.enable");
  await page.call("Runtime.enable");
  await page.call("Emulation.setDeviceMetricsOverride", {
    width: 390, height: 700, deviceScaleFactor: 1, mobile: false,
  });

  async function evaluate(expression) {
    const result = await page.call("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
    return result.result.value;
  }
  async function waitFor(expression, message = expression) {
    return evaluate(`new Promise((resolve, reject) => {
      const end = Date.now() + 3000;
      const poll = () => {
        try {
          if (${expression}) return resolve(true);
          if (Date.now() > end) return reject(new Error(${JSON.stringify("Timed out: " + message)}));
          setTimeout(poll, 10);
        } catch (error) { reject(error); }
      };
      poll();
    })`);
  }
  const clickRating = rating => evaluate(`document.querySelector('button[aria-label="Rate ${rating}"]').click()`);
  const text = selector => evaluate(`document.querySelector(${JSON.stringify(selector)})?.textContent || ""`);
  const state = () => evaluate(`({ fixture: window.__fixture.state(), save: window.__fixture.saveState(), requests: window.__fixture.mock.requests, disabled: [...document.querySelectorAll('button[aria-label^="Rate "]')].map(x => x.disabled), status: document.querySelector('[role="status"]')?.textContent || "", alert: document.querySelector('[role="alert"]')?.textContent || "" })`);
  async function reset(options = {}) {
    await evaluate(`window.__fixture.resetMock(${JSON.stringify(options)}); window.__fixture.identity("post-" + Math.random(), "account-a")`);
    await waitFor(`document.querySelectorAll('button[aria-label^="Rate "]').length === 10 && !window.__fixture.saveState().saving`, "fixture reset");
  }

  await page.call("Page.navigate", { url: `http://127.0.0.1:${port}/` });
  await waitFor(`window.__fixture && document.querySelectorAll('button[aria-label^="Rate "]').length === 10`, "fixture mount");

  await reset();
  await clickRating(3.5);
  await waitFor(`window.__fixture.saveState().saving`, "pending state");
  await record("pending edit shows Saving, never Saved, preserves confirmed value, and disables all stars", async () => {
    const current = await state();
    assert.match(current.status, /Saving 3\.5\/5/);
    assert.doesNotMatch(current.status, /Saved/);
    assert.equal(current.fixture.confirmed, 2);
    assert.equal(current.fixture.submitted, false);
    assert.equal(current.save.pendingRating, 3.5);
    assert.ok(current.disabled.length === 10 && current.disabled.every(Boolean));
  });
  await evaluate(`window.__fixture.resolve(0)`);
  await waitFor(`window.__fixture.state().confirmed === 3.5`, "confirmed success");
  await record("success confirms and hides picker only after resolved success:true", async () => {
    const current = await state();
    assert.equal(current.fixture.confirmed, 3.5);
    assert.equal(current.fixture.submitted, true);
    assert.match(current.status, /Saved 3\.5\/5/);
    assert.equal(current.disabled.length, 0);
  });

  for (const mode of ["http-400", "http-401", "http-403", "http-500", "false-success", "malformed", "network"]) {
    await reset({ mode });
    await clickRating(4);
    await waitFor(`!!window.__fixture.saveState().error`, `${mode} error`);
    await record(`${mode} does not confirm and presents an actionable retry error`, async () => {
      const current = await state();
      assert.equal(current.fixture.confirmed, 2);
      assert.equal(current.fixture.submitted, false);
      assert.equal(current.save.pendingRating, 4);
      assert.ok(current.alert.includes(mode === "http-401" ? "sign in again" : "try again"), current.alert);
      assert.match(current.alert, /Retry/);
      assert.equal(await evaluate(`document.querySelector('[role="alert"] button').disabled`), false);
    });
  }

  await reset({ externalId: "", title: "" });
  await clickRating(2.5);
  await waitFor(`!!window.__fixture.saveState().error`, "missing title error");
  await record("missing external ID and title never sends rate-media", async () => {
    const current = await state();
    assert.equal(current.requests.filter(request => request.url.includes("/rate-media")).length, 0);
    assert.match(current.alert, /identify this title/i);
  });
  for (const mode of ["search-empty", "search-400", "search-network"]) {
    await reset({ mode, externalId: "", title: "Find Me" });
    await clickRating(2.5);
    await waitFor(`!!window.__fixture.saveState().error`, `${mode} lookup error`);
    await record(`${mode} lookup failure never sends rate-media`, async () => {
      const current = await state();
      assert.equal(current.requests.filter(request => request.url.includes("/media-search")).length, 1);
      assert.equal(current.requests.filter(request => request.url.includes("/rate-media")).length, 0);
      assert.match(current.alert, /try again/i);
      assert.match(current.alert, /Retry/);
      assert.equal(current.fixture.confirmed, 2);
    });
  }

  await reset({ mode: "fallback-success", externalId: "", title: "Resolved Film" });
  await clickRating(4.5);
  await waitFor(`window.__fixture.state().confirmed === 4.5`, "fallback confirmation");
  await record("fallback resolution posts exact resolved identity, canonical ID, half-star, bearer, and social flag", async () => {
    const current = await state();
    const request = current.requests.find(item => item.url.includes("/rate-media"));
    assert.ok(request);
    assert.equal(request.authorization, "Bearer token-unchanged");
    assert.equal(request.contentType, "application/json");
    assert.deepEqual(request.body, {
      media_external_id: "resolved-42",
      media_external_source: "tmdb",
      canonical_media_id: "canon-42",
      media_title: "Resolved Film",
      media_type: "Movie",
      media_image_url: "https://fixture.invalid/poster.jpg",
      rating: 4.5,
      skip_social_post: false,
    });
    assert.deepEqual(current.fixture.resolved, {
      externalId: "resolved-42", externalSource: "tmdb", canonicalMediaId: "canon-42",
    });
  });

  await reset({ mode: "http-500" });
  await clickRating(1.5);
  await waitFor(`!!window.__fixture.saveState().error`, "retry initial failure");
  await evaluate(`window.__fixture.mock.mode = "immediate-success"; document.querySelector('[role="alert"] button').click()`);
  await waitFor(`window.__fixture.state().confirmed === 1.5`, "retry success");
  await record("failure Retry resubmits the pending rating and succeeds", async () => {
    const current = await state();
    assert.equal(current.requests.filter(request => request.url.includes("/rate-media")).length, 2);
    assert.equal(current.requests[1].body.rating, 1.5);
    assert.equal(current.fixture.confirmed, 1.5);
  });

  await reset();
  await evaluate(`window.__fixture.submitTwice(3)`);
  await waitFor(`window.__fixture.saveState().saving`, "same-tick save");
  await record("repeated same-tick submit sends exactly one request", async () => {
    const current = await state();
    assert.equal(current.requests.filter(request => request.url.includes("/rate-media")).length, 1);
  });
  await evaluate(`window.__fixture.resolve(0)`);
  await waitFor(`!window.__fixture.saveState().saving`);

  await reset();
  await clickRating(5);
  await waitFor(`window.__fixture.saveState().saving`);
  await evaluate(`window.__fixture.identity("post-reset", "account-reset")`);
  await waitFor(`!window.__fixture.saveState().saving && window.__fixture.state().identity.postId === "post-reset"`, "identity reset");
  await evaluate(`window.__fixture.resolve(0)`);
  await evaluate(`new Promise(resolve => setTimeout(resolve, 30))`);
  await record("account/post reset ignores a late save resolution", async () => {
    const current = await state();
    assert.equal(current.fixture.confirmed, 2);
    assert.equal(current.fixture.submitted, false);
    assert.equal(current.save.justSaved, false);
  });

  await reset();
  await clickRating(5);
  await waitFor(`window.__fixture.saveState().saving`);
  await evaluate(`window.__fixture.unmount(); window.__fixture.resolve(0); new Promise(resolve => setTimeout(resolve, 30))`);
  await record("unmount ignores late save resolution", async () => {
    assert.equal(await evaluate(`document.getElementById("root").children.length`), 0);
  });
  await evaluate(`window.__fixture.remount()`);
  await waitFor(`document.querySelectorAll('button[aria-label^="Rate "]').length === 10`, "remount");

  await reset({ mode: "timeout" });
  await clickRating(2.5);
  await waitFor(`!!window.__fixture.saveState().error && !window.__fixture.saveState().saving`, "accelerated timeout");
  await record("20-second pending timeout aborts and eventually permits retry", async () => {
    const before = await state();
    assert.match(before.alert, /try again/i);
    assert.equal(before.fixture.confirmed, 2);
    await evaluate(`window.__fixture.mock.mode = "immediate-success"; document.querySelector('[role="alert"] button').click()`);
    await waitFor(`window.__fixture.state().confirmed === 2.5`, "post-timeout retry");
    const after = await state();
    assert.equal(after.fixture.confirmed, 2.5);
    assert.equal(after.requests.filter(request => request.url.includes("/rate-media")).length, 2);
  });

  await reset({ mode: "http-500" });
  await clickRating(4);
  await waitFor(`!!window.__fixture.saveState().error`, "screenshot error state");
  const image = await page.call("Page.captureScreenshot", { format: "png", fromSurface: true });
  await writeFile(screenshot, Buffer.from(image.data, "base64"));
  await record("error UI screenshot was captured with real processed CSS", async () => {
    assert.ok((await readFile(screenshot)).byteLength > 1000);
    assert.match(await text('[role="alert"]'), /Retry/);
  });

  const feedSource = await readFile(join(root, "client/src/pages/feed.tsx"), "utf8");
  await record("first UGCGroupCard statically wires helper, hook, pending value, disabled picker, and success-only confirmation", async () => {
    const start = feedSource.indexOf("function UGCGroupCard(");
    const end = feedSource.indexOf("\nfunction ", start + 1);
    const card = feedSource.slice(start, end < 0 ? feedSource.length : end);
    assert.ok(start >= 0);
    assert.match(card, /useConfirmedRatingSave\s*\(/);
    assert.match(card, /save:\s*\(rating, signal\)\s*=>\s*saveFeedRating\s*\(/);
    assert.match(card, /disabled=\{ratingSave\.saving\}/);
    assert.match(card, /value=\{ratingSave\.pendingRating \|\| 0\}/);
    assert.match(card, /<RatingSaveFeedback[\s\S]*onRetry=\{ratingSave\.retry\}/);
    const successBody = card.match(/onSuccess:\s*\([^)]*\)\s*=>\s*\{([\s\S]*?)\n\s*\},\n\s*\}\);/)?.[1] || "";
    assert.match(successBody, /setRatingValue\(rating\)/);
    assert.match(successBody, /setRatingSubmitted\(true\)/);
    const hookStart = card.indexOf("const ratingSave = useConfirmedRatingSave");
    const beforeSuccess = card.slice(hookStart, card.indexOf("onSuccess:", hookStart));
    assert.doesNotMatch(beforeSuccess, /setRatingSubmitted\(true\)|setRatingValue\(rating\)|setShowInlineRater\(false\)|setShowStarPicker\(false\)/);
    assert.match(card, /const handleSubmitRating = ratingSave\.submit;/);
  });

  console.log("Confirmed rating save real hook/helper/components + Tailwind Chromium fixture");
  console.log(results.join("\n"));
  console.log(`${results.filter(line => line.startsWith("PASS")).length}/${results.length} passed`);
  console.log(`Screenshot: ${screenshot}`);
} finally {
  page?.ws.close();
  browser?.ws.close();
  if (chrome.exitCode === null) {
    const chromeExited = new Promise(resolveExit => chrome.once("exit", resolveExit));
    chrome.kill("SIGTERM");
    await chromeExited;
  }
  await new Promise(resolveClose => server.close(resolveClose));
  await rm(temp, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 });
}