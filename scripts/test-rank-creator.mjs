import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { existsSync } from "node:fs";
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
const temp = await mkdtemp(join(tmpdir(), "rank-creator-"));
const entry = join(temp, "entry.tsx");
const bundle = join(temp, "bundle.js");
const stylesheet = join(temp, "fixture.css");
const screenshot = "/tmp/rank-creator-mobile.png";
const dialogPath = join(root, "client/src/components/create-rank-dialog.tsx");

await writeFile(entry, `
import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import CreateRankDialog from ${JSON.stringify(dialogPath)};

const media = {
  alpha: { title: "Alpha Film", type: "movie", creator: "A. Director", image_url: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='80' height='80'%3E%3Crect width='80' height='80' fill='%237c3aed'/%3E%3C/svg%3E", external_id: "tmdb-101", external_source: "tmdb" },
  beta: { title: "Beta Book", type: "book", creator: "B. Writer", poster_url: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='80' height='80'%3E%3Crect width='80' height='80' fill='%23db2777'/%3E%3C/svg%3E", external_id: "ol-202", external_source: "openlibrary" },
};
const mock = {
  requests: [], navigations: [], invalidations: [], refetches: [], toasts: [], mode: "success",
  addCount: 0, createCount: 0, pending: [],
  session: { access_token: "fixture-token", user: { id: "fixture-user" } },
};
window.__rankMock = mock;
const pendingResponse = (init, body) => new Promise(resolve => {
  mock.pending.push(() => resolve(new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } })));
});
window.fetch = (url, init = {}) => {
  const request = { url: String(url), method: init.method || "GET", authorization: init.headers?.Authorization, contentType: init.headers?.["Content-Type"], body: init.body ? JSON.parse(init.body) : null };
  mock.requests.push(request);
  if (request.url.includes("/media-search")) {
    const result = media[request.body.query] || {
      title: "Title " + request.body.query, type: "movie", creator: "Fixture Creator",
      image: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='80' height='80'%3E%3Crect width='80' height='80' fill='%236d28d9'/%3E%3C/svg%3E",
      external_id: "fixture-" + request.body.query, external_source: "fixture"
    };
    return Promise.resolve(new Response(JSON.stringify({ results: [result] }), { status: 200, headers: { "Content-Type": "application/json" } }));
  }
  if (request.url.includes("/create-rank")) {
    mock.createCount++;
    if (mock.mode === "create-pending") return pendingResponse(init, { success: true, data: { id: "rank-pending" } });
    if (mock.mode === "create-network-once" && mock.createCount === 1) return Promise.reject(new TypeError("network down"));
    if (mock.mode === "create-malformed-once" && mock.createCount === 1) return Promise.resolve(new Response("{", { status: 200 }));
    if (mock.mode === "create-http") return Promise.resolve(new Response(JSON.stringify({ error: "Create service unavailable" }), { status: 503 }));
    if (mock.mode === "create-false") return Promise.resolve(new Response(JSON.stringify({ success: false, error: "Creation rejected" }), { status: 200 }));
    if (mock.mode === "create-missing-id" && mock.createCount === 1) return Promise.resolve(new Response(JSON.stringify({ success: true, data: {} }), { status: 200 }));
    return Promise.resolve(new Response(JSON.stringify({ success: true, data: { id: "rank-77" } }), { status: 200 }));
  }
  if (request.url.includes("/add-rank-item")) {
    mock.addCount++;
    if (mock.mode === "item-pending") return pendingResponse(init, { success: true, data: { id: "pending-item" } });
    if (mock.mode === "lost-first-item-response" && mock.addCount === 1) return Promise.reject(new TypeError("response lost"));
    if (mock.mode === "second-fails" && mock.addCount === 2) {
      return Promise.resolve(new Response(JSON.stringify({ error: "Second item failed" }), { status: 500 }));
    }
    if (mock.mode === "add-false") {
      return Promise.resolve(new Response(JSON.stringify({ success: false }), { status: 200 }));
    }
    return Promise.resolve(new Response(JSON.stringify({ success: true, data: { id: "item-" + mock.addCount } }), { status: 200 }));
  }
  return Promise.reject(new Error("External network blocked by rank fixture: " + request.url));
};

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
queryClient.invalidateQueries = options => { mock.invalidations.push(options.queryKey); return Promise.resolve(); };
queryClient.refetchQueries = options => { mock.refetches.push(options.queryKey); return Promise.resolve(); };

let api;
function Fixture() {
  const [open, setOpen] = useState(false);
  const [key, setKey] = useState(0);
  const [mounted, setMounted] = useState(true);
  const [toastVersion, setToastVersion] = useState(0);
  useEffect(() => {
    const refreshToasts = () => setToastVersion(value => value + 1);
    window.addEventListener("fixture-toast", refreshToasts);
    return () => window.removeEventListener("fixture-toast", refreshToasts);
  }, []);
  api = {
    open: () => setOpen(true),
    reset: (mode = "success") => {
      mock.requests = []; mock.navigations = []; mock.invalidations = []; mock.refetches = []; mock.toasts = [];
      mock.mode = mode; mock.addCount = 0; mock.createCount = 0; mock.pending = [];
      mock.session = { access_token: "fixture-token", user: { id: "fixture-user" } };
      window.dispatchEvent(new Event("fixture-auth"));
      setMounted(true); setOpen(false); setKey(value => value + 1);
    },
    switchAuth: (id, token = "token-" + id) => {
      mock.session = { access_token: token, user: { id } };
      window.dispatchEvent(new Event("fixture-auth"));
    },
    unmountDialog: () => setMounted(false),
    remountDialog: () => { setOpen(false); setMounted(true); setKey(value => value + 1); },
    state: () => ({ open, ...mock }),
  };
  return <main className="fixture-page">
    <section className="fixture-card">
      <h1>Play</h1>
      <div role="tablist" aria-label="Play modes"><button role="tab" aria-selected="true">Ranks</button></div>
      <button data-testid="button-open-create-rank" onClick={() => setOpen(true)}>Create a ranked list</button>
    </section>
    {mounted && <CreateRankDialog key={key} open={open} onOpenChange={setOpen} />}
    <div id="fixture-toasts" aria-live="polite" data-version={toastVersion}>{mock.toasts.map((toast, i) => <div role="status" key={i}>{toast.title}: {toast.description}</div>)}</div>
  </main>;
}
createRoot(document.getElementById("root")).render(<QueryClientProvider client={queryClient}><Fixture /></QueryClientProvider>);
window.__fixture = {
  open: () => api.open(), reset: mode => api.reset(mode), state: () => api.state(),
  resolvePending: () => mock.pending.shift()?.(), switchAuth: (id, token) => api.switchAuth(id, token),
  unmountDialog: () => api.unmountDialog(), remountDialog: () => api.remountDialog(),
};
`);

const sourceCss = await readFile(join(root, "client/src/index.css"), "utf8");
const processedCss = await postcss([
  tailwindcss({ config: join(root, "tailwind.config.ts") }),
  autoprefixer,
]).process(sourceCss, { from: join(root, "client/src/index.css"), to: stylesheet });
await writeFile(stylesheet, `${processedCss.css}
* { box-sizing: border-box; }
html, body, #root { margin: 0; width: 100%; min-height: 100%; }
.fixture-page { min-height: 100vh; padding: 24px 12px; background: #fbf8f5; color: #111827; }
.fixture-card { width: min(680px, 100%); margin: auto; padding: 18px; border-radius: 18px; background: white; }
.fixture-card h1 { margin: 0 0 12px; font-size: 22px; }
.fixture-card [role="tab"] { padding: 8px 18px; color: #7139a0; border-bottom: 2px solid #7139a0; }
.fixture-card [data-testid="button-open-create-rank"] { display: block; width: 100%; margin-top: 16px; padding: 12px; border-radius: 12px; background: #6d35a3; color: white; font-weight: 600; }
#fixture-toasts { position: fixed; right: 12px; bottom: 12px; z-index: 100; color: #991b1b; }
`);

const aliasPlugin = {
  name: "rank-fixture-aliases",
  setup(buildApi) {
    buildApi.onResolve({ filter: /^@\/lib\/auth$/ }, () => ({ path: "auth", namespace: "fixture" }));
    buildApi.onResolve({ filter: /^@\/hooks\/use-toast$/ }, () => ({ path: "toast", namespace: "fixture" }));
    buildApi.onResolve({ filter: /^wouter$/ }, () => ({ path: "wouter", namespace: "fixture" }));
    buildApi.onResolve({ filter: /^@\// }, args => {
      const base = join(root, "client/src", args.path.slice(2));
      return { path: existsSync(`${base}.tsx`) ? `${base}.tsx` : `${base}.ts` };
    });
    buildApi.onLoad({ filter: /.*/, namespace: "fixture" }, args => {
      if (args.path === "auth") return { contents: 'import { useSyncExternalStore } from "react"; const subscribe = callback => { window.addEventListener("fixture-auth", callback); return () => window.removeEventListener("fixture-auth", callback); }; export const useAuth = () => { useSyncExternalStore(subscribe, () => window.__rankMock.session, () => window.__rankMock.session); return { session: window.__rankMock.session }; };', loader: "js", resolveDir: root };
      if (args.path === "toast") return { contents: 'export const useToast = () => ({ toast: value => { window.__rankMock.toasts.push(value); window.dispatchEvent(new Event("fixture-toast")); } });', loader: "js" };
      return { contents: 'export const useLocation = () => [location.pathname, value => window.__rankMock.navigations.push(value)];', loader: "js" };
    });
  },
};
await build({
  entryPoints: [entry], outfile: bundle, bundle: true, format: "iife", platform: "browser",
  jsx: "automatic", absWorkingDir: root, nodePaths: [join(root, "node_modules")],
  plugins: [aliasPlugin], define: { "import.meta.env.VITE_SUPABASE_URL": JSON.stringify("https://fixture.invalid"), "import.meta.env.VITE_SUPABASE_ANON_KEY": JSON.stringify("fixture-anon") },
});

const html = '<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/fixture.css"></head><body><div id="root"></div><script src="/bundle.js"></script></body></html>';
const server = createServer(async (req, res) => {
  if (req.url === "/bundle.js") { res.setHeader("Content-Type", "text/javascript"); res.end(await readFile(bundle)); }
  else if (req.url === "/fixture.css") { res.setHeader("Content-Type", "text/css"); res.end(await readFile(stylesheet)); }
  else { res.setHeader("Content-Type", "text/html"); res.end(html); }
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
  try { await fn(); results.push(`PASS ${name}`); }
  catch (error) { results.push(`FAIL ${name}: ${error.message}`); process.exitCode = 1; }
}

try {
  let stderr = "";
  const browserWs = await new Promise((resolveWs, reject) => {
    const timeout = setTimeout(() => reject(new Error(`Chromium CDP timeout: ${stderr}`)), 10000);
    chrome.stderr.on("data", chunk => {
      stderr += chunk;
      const match = stderr.match(/DevTools listening on (ws:\/\/[^\s]+)/);
      if (match) { clearTimeout(timeout); resolveWs(match[1]); }
    });
  });
  class CDP {
    constructor(url) { this.next = 1; this.pending = new Map(); this.ws = new WebSocket(url); }
    async open() {
      await new Promise((resolveOpen, reject) => { this.ws.once("open", resolveOpen); this.ws.once("error", reject); });
      this.ws.on("message", raw => {
        const message = JSON.parse(raw);
        if (message.id && this.pending.has(message.id)) {
          const pending = this.pending.get(message.id); this.pending.delete(message.id);
          message.error ? pending.reject(new Error(message.error.message)) : pending.resolve(message.result);
        }
      });
    }
    call(method, params = {}) {
      const id = this.next++;
      return new Promise((resolveCall, reject) => { this.pending.set(id, { resolve: resolveCall, reject }); this.ws.send(JSON.stringify({ id, method, params })); });
    }
  }
  browser = new CDP(browserWs); await browser.open();
  const target = await browser.call("Target.createTarget", { url: "about:blank" });
  const listUrl = browserWs.replace("ws://", "http://").replace(/\/devtools\/browser\/.*$/, "/json/list");
  const targets = await (await fetch(listUrl)).json();
  page = new CDP(targets.find(item => item.id === target.targetId).webSocketDebuggerUrl); await page.open();
  await page.call("Page.enable"); await page.call("Runtime.enable");

  async function evaluate(expression) {
    const result = await page.call("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
    return result.result.value;
  }
  async function waitFor(expression, message = expression) {
    return evaluate(`new Promise((resolve, reject) => { const end = Date.now() + 4000; const poll = () => { try { if (${expression}) return resolve(true); if (Date.now() > end) return reject(new Error(${JSON.stringify("Timed out: " + message)})); setTimeout(poll, 15); } catch (error) { reject(error); } }; poll(); })`);
  }
  const click = selector => evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`);
  const text = selector => evaluate(`document.querySelector(${JSON.stringify(selector)})?.textContent || ""`);
  async function reset(mode = "success") {
    await evaluate(`window.__fixture.reset(${JSON.stringify(mode)})`);
    await waitFor(`!document.querySelector('[data-testid="dialog-create-rank"]')`);
    await click('[data-testid="button-open-create-rank"]');
    await waitFor(`!!document.querySelector('[data-testid="dialog-create-rank"]')`);
  }
  async function setInput(testId, value) {
    await evaluate(`(() => { const input = document.querySelector('[data-testid="${testId}"]'); const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set; setter.call(input, ${JSON.stringify(value)}); input.dispatchEvent(new Event("input", { bubbles: true })); })()`);
  }
  async function add(query) {
    await setInput("input-rank-media-search", query);
    const expectedTitle = query === "alpha" ? "Alpha Film" : query === "beta" ? "Beta Book" : `Title ${query}`;
    await waitFor(`(() => { const input = document.querySelector('[data-testid="input-rank-media-search"]'); return input.value === ${JSON.stringify(query)} && input.parentElement.nextElementSibling?.textContent.includes(${JSON.stringify(expectedTitle)}); })()`, `search result ${query}`);
    await evaluate(`document.querySelector('[data-testid="input-rank-media-search"]').parentElement.nextElementSibling.firstElementChild.click()`);
    await waitFor(`document.querySelector('[data-testid="input-rank-media-search"]').value === ""`);
  }
  const submit = () => click('[data-testid="button-create-rank"]');
  const requests = () => evaluate(`window.__fixture.state().requests`);
  async function key(key, code, keyCode) {
    await page.call("Input.dispatchKeyEvent", { type: "keyDown", key, code, windowsVirtualKeyCode: keyCode, nativeVirtualKeyCode: keyCode });
    await page.call("Input.dispatchKeyEvent", { type: "keyUp", key, code, windowsVirtualKeyCode: keyCode, nativeVirtualKeyCode: keyCode });
  }

  await page.call("Emulation.setDeviceMetricsOverride", { width: 390, height: 700, deviceScaleFactor: 1, mobile: false });
  await page.call("Page.navigate", { url: `http://127.0.0.1:${port}/` });
  await waitFor(`window.__fixture && !!document.querySelector('[data-testid="button-open-create-rank"]')`, "fixture mount");
  await record("authenticated Play ranks gate reaches the actual creator dialog", async () => {
    assert.equal(await text('[role="tab"]'), "Ranks");
    assert.equal(await evaluate(`document.querySelectorAll('[data-testid="button-open-create-rank"]').length`), 1);
    await click('[data-testid="button-open-create-rank"]');
    await waitFor(`!!document.querySelector('[data-testid="dialog-create-rank"]')`);
    assert.match(await text('[data-testid="dialog-create-rank"]'), /Create New Rank/);
  });

  await reset();
  await record("2-item minimum disables creation and remove preserves selected UI", async () => {
    await setInput("input-rank-title", "Favorites");
    await add("alpha");
    assert.equal(await evaluate(`document.querySelector('[data-testid="button-create-rank"]').disabled`), true);
    await add("beta");
    assert.equal(await evaluate(`document.querySelector('[data-testid="button-create-rank"]').disabled`), false);
    await click('[aria-label="Remove Alpha Film"]');
    assert.equal(await evaluate(`document.querySelector('[data-testid="button-create-rank"]').disabled`), true);
    assert.doesNotMatch(await text('[data-testid="dialog-create-rank"]'), /Alpha Film/);
  });

  await reset();
  await setInput("input-rank-title", "Public Pair");
  await add("alpha"); await add("beta");
  await submit();
  await waitFor(`window.__fixture.state().navigations.length === 1`, "public success navigation");
  await record("public success posts exact searched identities, covers, order, auth, then invalidates and navigates", async () => {
    const sent = await requests();
    const createBody = sent.find(x => x.url.includes("/create-rank")).body;
    assert.deepEqual({ title: createBody.title, visibility: createBody.visibility }, { title: "Public Pair", visibility: "public" });
    assert.match(createBody.requestId, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    const adds = sent.filter(x => x.url.includes("/add-rank-item"));
    assert.deepEqual(adds.map(x => ({ ...x.body, requestId: undefined })), [
      { requestId: undefined, rankId: "rank-77", position: 1, media: { title: "Alpha Film", mediaType: "movie", creator: "A. Director", imageUrl: mediaCover("7c3aed"), externalId: "tmdb-101", externalSource: "tmdb" } },
      { requestId: undefined, rankId: "rank-77", position: 2, media: { title: "Beta Book", mediaType: "book", creator: "B. Writer", imageUrl: mediaCover("db2777"), externalId: "ol-202", externalSource: "openlibrary" } },
    ]);
    assert.match(adds[0].body.requestId, /^[0-9a-f-]{36}$/i);
    assert.match(adds[1].body.requestId, /^[0-9a-f-]{36}$/i);
    assert.notEqual(adds[0].body.requestId, adds[1].body.requestId);
    assert.ok(sent.every(x => x.authorization === "Bearer fixture-token" && x.contentType === "application/json"));
    const state = await evaluate(`window.__fixture.state()`);
    assert.deepEqual(state.invalidations, [["consumed-ranks-carousel"], ["user-ranks"]]);
    assert.deepEqual(state.refetches, [["consumed-ranks-carousel"], ["user-ranks"]]);
    assert.deepEqual(state.navigations, ["/rank/rank-77"]);
  });

  await reset();
  await setInput("input-rank-title", "Private Pair");
  await click('[data-testid="switch-rank-visibility"]');
  await add("alpha"); await add("beta"); await submit();
  await waitFor(`window.__fixture.state().navigations.length === 1`);
  await record("private visibility reaches the actual create payload", async () => {
    const sent = await requests();
    assert.equal(sent.find(x => x.url.includes("/create-rank")).body.visibility, "private");
  });

  for (const mode of ["create-http", "create-false", "create-missing-id"]) {
    await reset(mode); await setInput("input-rank-title", "Failure Pair"); await add("alpha"); await add("beta"); await submit();
    await waitFor(`!!document.querySelector('[data-testid="dialog-create-rank"] [role="alert"]')`, `${mode} visible error`);
    await record(`${mode} keeps dialog visible, reports error, and never navigates or adds`, async () => {
      const state = await evaluate(`window.__fixture.state()`);
      assert.equal(state.navigations.length, 0);
      assert.equal(state.requests.filter(x => x.url.includes("/add-rank-item")).length, 0);
      assert.match(await text('[data-testid="dialog-create-rank"] [role="alert"]'), mode === "create-missing-id" ? /did not return.*ID/i : /create|Creation/i);
      if (mode === "create-missing-id") assert.equal(await text('[data-testid="button-create-rank"]'), "Retry saving");
    });
  }

  const missingBefore = await requests();
  const missingRequestId = missingBefore.find(x => x.url.includes("/create-rank")).body.requestId;
  await submit(); await waitFor(`window.__fixture.state().navigations.length === 1`, "missing ID retry");
  await record("missing create ID safely retries the same idempotency request and completes", async () => {
    const creates = (await requests()).filter(x => x.url.includes("/create-rank"));
    assert.equal(creates.length, 2);
    assert.equal(creates[0].body.requestId, missingRequestId);
    assert.equal(creates[1].body.requestId, missingRequestId);
    assert.deepEqual((await evaluate(`window.__fixture.state().navigations`)), ["/rank/rank-77"]);
  });

  for (const mode of ["create-network-once", "create-malformed-once"]) {
    await reset(mode); await setInput("input-rank-title", "Stable Create"); await add("alpha"); await add("beta"); await submit();
    await waitFor(`!!document.querySelector('[data-testid="dialog-create-rank"] [role="alert"]')`, `${mode} first error`);
    const firstId = (await requests()).find(x => x.url.includes("/create-rank")).body.requestId;
    await submit(); await waitFor(`window.__fixture.state().navigations.length === 1`, `${mode} retry success`);
    await record(`${mode} retry reuses one stable create request ID`, async () => {
      const creates = (await requests()).filter(x => x.url.includes("/create-rank"));
      assert.equal(creates.length, 2);
      assert.equal(creates[0].body.requestId, firstId);
      assert.equal(creates[1].body.requestId, firstId);
      assert.deepEqual((await evaluate(`window.__fixture.state().navigations`)), ["/rank/rank-77"]);
    });
  }

  await reset("create-pending"); await setInput("input-rank-title", "No Duplicates"); await add("alpha"); await add("beta");
  await evaluate(`document.querySelector('[data-testid="button-create-rank"]').click(); document.querySelector('[data-testid="button-create-rank"]').click()`);
  await waitFor(`window.__fixture.state().pending.length === 1`);
  await record("same-tick duplicate create clicks send one pending request and disable controls", async () => {
    const state = await evaluate(`window.__fixture.state()`);
    assert.equal(state.requests.filter(x => x.url.includes("/create-rank")).length, 1);
    assert.equal(await evaluate(`document.querySelector('[data-testid="button-create-rank"]').disabled`), true);
    assert.match(await text('[data-testid="button-create-rank"]'), /Creating/);
  });
  await evaluate(`window.__fixture.resolvePending()`);
  await waitFor(`window.__fixture.state().navigations.length === 1`);

  await reset("second-fails"); await setInput("input-rank-title", "Retry Pair"); await add("alpha"); await add("beta"); await submit();
  await waitFor(`!!document.querySelector('[data-testid="dialog-create-rank"] [role="alert"]')`, "partial error");
  await record("second-item failure preserves rank and first item with visible retry guidance", async () => {
    assert.match(await text('[data-testid="dialog-create-rank"] [role="alert"]'), /1 of 2 items saved.*Second item failed.*item 2/is);
    assert.match(await text('[data-testid="dialog-create-rank"]'), /Alpha Film/);
    assert.match(await text('[data-testid="dialog-create-rank"]'), /Beta Book/);
    assert.equal(await evaluate(`document.querySelector('[data-testid="input-rank-title"]').disabled`), true);
    assert.equal((await evaluate(`window.__fixture.state().navigations.length`)), 0);
  });
  await evaluate(`window.__rankMock.mode = "success"`);
  await submit(); await waitFor(`window.__fixture.state().navigations.length === 1`, "partial retry success");
  await record("partial retry requests only the unsaved second item and navigates after confirmation", async () => {
    const sent = await requests();
    assert.equal(sent.filter(x => x.url.includes("/create-rank")).length, 1);
    const adds = sent.filter(x => x.url.includes("/add-rank-item"));
    assert.equal(adds.length, 3);
    assert.deepEqual(adds.map(x => x.body.position), [1, 2, 2]);
    assert.equal(adds[2].body.media.externalId, "ol-202");
    assert.equal(adds[1].body.requestId, adds[2].body.requestId);
    assert.notEqual(adds[0].body.requestId, adds[1].body.requestId);
    assert.deepEqual((await evaluate(`window.__fixture.state().navigations`)), ["/rank/rank-77"]);
  });

  await reset("lost-first-item-response"); await setInput("input-rank-title", "Lost Response"); await add("alpha"); await add("beta"); await submit();
  await waitFor(`!!document.querySelector('[data-testid="dialog-create-rank"] [role="alert"]')`, "lost item response");
  const lostFirst = (await requests()).find(x => x.url.includes("/add-rank-item")).body.requestId;
  await submit(); await waitFor(`window.__fixture.state().navigations.length === 1`, "lost response retry");
  await record("lost item response retries stable per-item ID while the other item stays distinct", async () => {
    const adds = (await requests()).filter(x => x.url.includes("/add-rank-item"));
    assert.deepEqual(adds.map(x => x.body.position), [1, 1, 2]);
    assert.equal(adds[0].body.requestId, lostFirst);
    assert.equal(adds[1].body.requestId, lostFirst);
    assert.notEqual(adds[1].body.requestId, adds[2].body.requestId);
  });

  await reset(); await setInput("input-rank-title", "Keyboard Order"); await add("alpha"); await add("beta");
  await evaluate(`document.querySelector('[data-rfd-drag-handle-draggable-id]').focus()`);
  await key(" ", "Space", 32); await key("ArrowDown", "ArrowDown", 40); await key(" ", "Space", 32);
  await waitFor(`document.querySelector('[aria-label="Remove Beta Book"]').parentElement.textContent.includes("#1")`, "keyboard drag reorder");
  await record("actual keyboard DnD moves the first draggable below the second", async () => {
    const rows = await evaluate(`[...document.querySelectorAll('[aria-label^="Remove "]')].map(x => x.getAttribute("aria-label"))`);
    assert.deepEqual(rows, ["Remove Beta Book", "Remove Alpha Film"]);
  });

  await reset("create-pending"); await setInput("input-rank-title", "Unmount Pending"); await add("alpha"); await add("beta"); await submit();
  await waitFor(`window.__fixture.state().pending.length === 1`, "unmount pending create");
  await evaluate(`window.__fixture.unmountDialog(); window.__fixture.resolvePending()`);
  await evaluate(`new Promise(resolve => setTimeout(resolve, 50))`);
  await record("unmount while create is pending ignores late success and sends no items or navigation", async () => {
    const state = await evaluate(`window.__fixture.state()`);
    assert.equal(state.navigations.length, 0);
    assert.equal(state.requests.filter(x => x.url.includes("/add-rank-item")).length, 0);
  });
  await evaluate(`window.__fixture.switchAuth("after-unmount", "token-after"); window.__fixture.remountDialog()`);
  await waitFor(`!!document.querySelector('[data-testid="button-open-create-rank"]')`);
  await click('[data-testid="button-open-create-rank"]'); await waitFor(`!!document.querySelector('[data-testid="dialog-create-rank"]')`);
  await record("new auth after unmount receives a blank new draft", async () => {
    assert.equal(await evaluate(`document.querySelector('[data-testid="input-rank-title"]').value`), "");
    assert.doesNotMatch(await text('[data-testid="dialog-create-rank"]'), /Alpha Film|Beta Book|saved/i);
  });

  await reset("create-pending"); await setInput("input-rank-title", "Switch Pending"); await add("alpha"); await add("beta"); await submit();
  await waitFor(`window.__fixture.state().pending.length === 1`, "account switch pending create");
  await evaluate(`window.__fixture.switchAuth("second-user", "token-second")`);
  await waitFor(`!document.querySelector('[data-testid="dialog-create-rank"]')`, "dialog closes on account switch");
  await evaluate(`window.__fixture.resolvePending(); new Promise(resolve => setTimeout(resolve, 50))`);
  await record("account switch while pending ignores stale success, next item, saved UI, and navigation", async () => {
    const state = await evaluate(`window.__fixture.state()`);
    assert.equal(state.navigations.length, 0);
    assert.equal(state.requests.filter(x => x.url.includes("/add-rank-item")).length, 0);
    await click('[data-testid="button-open-create-rank"]');
    await waitFor(`!!document.querySelector('[data-testid="dialog-create-rank"]')`);
    assert.equal(await evaluate(`document.querySelector('[data-testid="input-rank-title"]').value`), "");
    assert.doesNotMatch(await text('[data-testid="dialog-create-rank"]'), /Alpha Film|Beta Book|saved/i);
  });

  await reset();
  await setInput("input-rank-title", "Ten Picks");
  for (let i = 0; i < 10; i++) await add(`pick-${i}`);
  await setInput("input-rank-media-search", "pick-10");
  await waitFor(`document.querySelectorAll('[data-testid="dialog-create-rank"] img').length > 10`, "eleventh search result");
  await evaluate(`document.querySelector('[data-testid="input-rank-media-search"]').parentElement.nextElementSibling.firstElementChild.click()`);
  await waitFor(`document.querySelector('#fixture-toasts').textContent.includes("Limit Reached")`, "limit toast");
  await record("10-item maximum rejects an eleventh item with visible feedback", async () => {
    assert.match(await text('[data-testid="dialog-create-rank"]'), /10\/10 items/);
    assert.match(await text('#fixture-toasts'), /Limit Reached.*10 items/);
  });

  const dialogSource = await readFile(dialogPath, "utf8");
  const playSource = await readFile(join(root, "client/src/pages/play.tsx"), "utf8");
  await record("actual drag-end helper and Play ranks gate remain statically wired", async () => {
    assert.match(dialogSource, /items\.splice\(result\.source\.index, 1\)[\s\S]*items\.splice\(result\.destination\.index, 0, reorderedItem\)[\s\S]*setSelectedMedia\(items\)/);
    assert.match(playSource, /activeMode === "ranks"[\s\S]*data-testid="button-open-create-rank"/);
    assert.match(playSource, /<CreateRankDialog open=\{createRankOpen\}/);
  });

  await page.call("Emulation.setDeviceMetricsOverride", { width: 390, height: 700, deviceScaleFactor: 1, mobile: false });
  const image = await page.call("Page.captureScreenshot", { format: "png", fromSurface: true });
  await writeFile(screenshot, Buffer.from(image.data, "base64"));
  await record("mobile 390 screenshot captures actual dialog with processed CSS", async () => {
    assert.ok((await readFile(screenshot)).byteLength > 1000);
    const rect = await evaluate(`(() => { const r = document.querySelector('[data-testid="dialog-create-rank"]').getBoundingClientRect(); return { left:r.left, right:r.right, height:r.height }; })()`);
    assert.ok(rect.left >= 0 && rect.right <= 390 && rect.height <= 630, JSON.stringify(rect));
  });
  await page.call("Emulation.setDeviceMetricsOverride", { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false });
  await record("desktop dialog remains centered and max-width constrained", async () => {
    const rect = await evaluate(`(() => { const r = document.querySelector('[data-testid="dialog-create-rank"]').getBoundingClientRect(); return { left:r.left, right:r.right, width:r.width }; })()`);
    assert.ok(rect.width <= 448 && rect.left > 300 && rect.right < 980, JSON.stringify(rect));
  });

  console.log("Rank creator actual component + DnD imports + Tailwind Chromium fixture");
  console.log(results.join("\n"));
  console.log(`${results.filter(line => line.startsWith("PASS")).length}/${results.length} passed`);
  console.log(`Screenshot: ${screenshot}`);
} finally {
  page?.ws.close(); browser?.ws.close();
  if (chrome.exitCode === null) {
    const exited = new Promise(resolveExit => chrome.once("exit", resolveExit));
    chrome.kill("SIGTERM"); await exited;
  }
  await new Promise(resolveClose => server.close(resolveClose));
  await rm(temp, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 });
}

function mediaCover(color) {
  return `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='80' height='80'%3E%3Crect width='80' height='80' fill='%23${color}'/%3E%3C/svg%3E`;
}