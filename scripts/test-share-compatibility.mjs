import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { build } from "esbuild";
import WebSocket from "ws";

const root = resolve(new URL("..", import.meta.url).pathname);
const temp = await mkdtemp(join(tmpdir(), "share-compat-"));
const entry = join(temp, "entry.tsx");
const bundle = join(temp, "bundle.js");

const fixtures = {
  "public-guest": {
    auth: null,
    profile: [{ access: "preview", can_view_full_profile: false, id: "target", display_name: "Ada", username: "ada", avatar_url: null, dna_label: "Story Seeker", dna_tagline: "Curious" }],
  },
  "public-owner": {
    auth: { user: { id: "target" }, session: { access_token: "fixture-owner-token" } },
    profile: [{ access: "full", can_view_full_profile: true, id: "target", display_name: "Ada", username: "ada", avatar_url: null, total_points: 42, items_logged: 3, global_rank: 7, dna_label: null, dna_tagline: null }],
  },
  "public-friend": {
    auth: { user: { id: "friend" }, session: { access_token: "fixture-friend-token" } },
    profile: [{ access: "full", can_view_full_profile: true, id: "target", display_name: "Ada", username: "ada", avatar_url: null, total_points: 42, items_logged: 3, global_rank: 7, dna_label: null, dna_tagline: null }],
  },
  "public-stranger": {
    auth: { user: { id: "stranger" }, session: { access_token: "fixture-stranger-token" } },
    profile: [
      { access: "preview", can_view_full_profile: false, id: "target", display_name: "Ada", username: "ada", avatar_url: null, dna_label: null, dna_tagline: null },
      { status: 503 },
    ],
  },
  "public-blocked": {
    auth: { user: { id: "blocked" }, session: { access_token: "fixture-blocked-token" } },
    profile: [{ status: 404 }],
  },
  "public-legacy": {
    auth: { user: { id: "stranger" }, session: { access_token: "fixture-legacy-token" } },
    profile: [{ access: "full", id: "target", display_name: "Ada", username: "ada", avatar_url: null, total_points: 999, items_logged: 88, global_rank: 1, dna_label: null, dna_tagline: null }],
  },
  "public-logout": {
    auth: { user: { id: "stranger" }, session: { access_token: "fixture-before-logout-token" } },
    profile: [
      { access: "preview", can_view_full_profile: false, id: "target", display_name: "Ada", username: "ada", avatar_url: null, dna_label: null, dna_tagline: null },
      { access: "full", can_view_full_profile: true, id: "target", display_name: "Ada", username: "ada", avatar_url: null, total_points: 55, dna_label: null, dna_tagline: null },
    ],
  },
  "edna-member": {
    auth: { user: { id: "friend" }, session: { access_token: "fixture-edna-token" } },
    dna: [{ access: "full", dna_profile: { id: "dna", user_id: "target", label: "The Explorer", tagline: "Wide horizons", profile_text: "A complete, private entertainment portrait.", favorite_genres: ["Drama"], favorite_media_types: ["Book"], favorite_sports: [], flavor_notes: ["Curious"], users: { user_name: "ada", display_name: "Ada" } } }],
  },
  "edna-guest": {
    auth: null,
    dna: [{ access: "preview", dna_profile: { id: "dna", user_id: "target", label: "The Explorer", tagline: "Wide horizons", profile_text: "A complete, private entertainment portrait.", favorite_genres: ["Drama"], favorite_media_types: ["Book"], favorite_sports: [], flavor_notes: ["Curious"], users: { user_name: "ada", display_name: "Ada" } } }],
  },
};

await writeFile(entry, `
import React, { createContext, useContext, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Route, Switch } from "wouter";
import PublicProfilePage from ${JSON.stringify(join(root, "client/src/pages/public-profile.tsx"))};
import EdnaSharePage from ${JSON.stringify(join(root, "client/src/pages/edna-share.tsx"))};

const fixtures = ${JSON.stringify(fixtures)};
const scenario = new URLSearchParams(location.search).get("case");
const fixture = fixtures[scenario];
window.__requests = [];
const queues = { profile: [...(fixture.profile || [])], dna: [...(fixture.dna || [])] };
window.fetch = async (url, options = {}) => {
  const kind = String(url).includes("get-public-dna") ? "dna" : "profile";
  window.__requests.push({ url: String(url), authorization: options.headers?.Authorization });
  const value = queues[kind].length > 1 ? queues[kind].shift() : queues[kind][0];
  if (value?.status) return new Response("simulated failure", { status: value.status });
  return new Response(JSON.stringify(value), { status: 200, headers: { "Content-Type": "application/json" } });
};

const AuthContext = createContext({ user: null, session: null, loading: false });
export function useAuth() { return useContext(AuthContext); }
export function AuthProvider({ children }) {
  const [auth, setAuth] = useState(fixture.auth || { user: null, session: null });
  useEffect(() => { window.__setAuth = value => setAuth(value || { user: null, session: null }); }, []);
  return <AuthContext.Provider value={{ ...auth, loading: false }}>{children}</AuthContext.Provider>;
}
const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
window.__refetchProfile = () => client.invalidateQueries({ queryKey: ["public-profile"] });
function Canonical() { return <main data-testid="canonical-route">CANONICAL:{location.pathname}{location.search}</main>; }
function App() {
  return <AuthProvider><QueryClientProvider client={client}><Switch>
    <Route path="/u/:userId"><PublicProfilePage /></Route>
    <Route path="/edna/:id"><EdnaSharePage /></Route>
    <Route path="/user/:userId"><Canonical /></Route>
  </Switch></QueryClientProvider></AuthProvider>;
}
createRoot(document.getElementById("root")).render(<App />);
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
  alias: { "@": join(root, "client/src") },
  define: {
    "import.meta.env.VITE_SUPABASE_ANON_KEY": JSON.stringify("fixture-anon-key"),
    "import.meta.env.VITE_SUPABASE_URL": JSON.stringify("http://local.fixture.invalid"),
  },
  plugins: [{
    name: "controlled-share-dependencies",
    setup(buildApi) {
      buildApi.onResolve({ filter: /^@\/lib\/auth$/ }, () => ({ path: entry, namespace: "auth-stub" }));
      buildApi.onLoad({ filter: /.*/, namespace: "auth-stub" }, () => ({
        contents: `export { useAuth } from ${JSON.stringify(entry)};`,
        loader: "js",
        resolveDir: "/",
      }));
      buildApi.onResolve({ filter: /^@\/lib\/share$/ }, () => ({ path: "share", namespace: "share-stub" }));
      buildApi.onLoad({ filter: /.*/, namespace: "share-stub" }, () => ({ contents: `export const APP_BASE = "http://fixed.share.test";`, loader: "js" }));
    },
  }],
});

const html = `<!doctype html><html><head><title>controlled share fixture</title></head><body><div id="root"></div><script src="/bundle.js"></script></body></html>`;
const server = createServer(async (req, res) => {
  if (req.url === "/bundle.js") {
    res.setHeader("Content-Type", "text/javascript");
    res.end(await import("node:fs/promises").then(fs => fs.readFile(bundle)));
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
      const msg = JSON.parse(raw);
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve: done, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        msg.error ? reject(new Error(msg.error.message)) : done(msg.result);
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
const pageInfo = targets.find(item => item.id === target.targetId);
page = new CDP(pageInfo.webSocketDebuggerUrl);
await page.open();
await page.call("Page.enable");

async function evaluate(expression) {
  const result = await page.call("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
  return result.result.value;
}
async function load(path, scenario, readyText) {
  await page.call("Page.navigate", { url: `http://127.0.0.1:${port}${path}?case=${scenario}` });
  await evaluate(`new Promise((resolve, reject) => {
    const end = Date.now() + 4000;
    const tick = () => {
      if (document.body?.innerText?.includes(${JSON.stringify(readyText)})) return resolve(true);
      if (Date.now() > end) return reject(new Error("Timed out; body=" + (document.body?.innerText || "<no body>")));
      setTimeout(tick, 20);
    }; tick();
  })`);
  return evaluate(`({ text: document.body.innerText, path: location.pathname + location.search, requests: window.__requests })`);
}

const results = [];
function record(name, fn) {
  try { fn(); results.push(`PASS ${name}`); }
  catch (error) { results.push(`FAIL ${name}: ${error.message}`); process.exitCode = 1; }
}

let state = await load("/u/target", "public-guest", "Friends can see more");
record("public guest uses anon and hides all stat labels/fabricated zero", () => {
  assert.equal(state.requests[0].authorization, "Bearer fixture-anon-key");
  assert.doesNotMatch(state.text, /points|global rank|items logged/i);
  assert.doesNotMatch(state.text, /(^|\s)0(\s|$)/);
  assert.match(state.path, /^\/u\/target/);
});

for (const [scenario, token] of [["public-owner", "fixture-owner-token"], ["public-friend", "fixture-friend-token"]]) {
  state = await load("/u/target", scenario, "CANONICAL:");
  record(`${scenario} redirects only on server full-access flag`, () => {
    assert.equal(state.requests[0].authorization, `Bearer ${token}`);
    assert.match(state.text, /CANONICAL:\/user\/target\?ref=invite/);
    assert.match(state.path, /^\/user\/target\?ref=invite/);
  });
}

state = await load("/u/target", "public-stranger", "Friends can see more");
record("signed-in stranger remains on teaser", () => {
  assert.equal(state.requests[0].authorization, "Bearer fixture-stranger-token");
  assert.match(state.path, /^\/u\/target/);
  assert.doesNotMatch(state.text, /points|global rank|items logged/i);
});
await evaluate(`window.__refetchProfile(); new Promise(resolve => setTimeout(resolve, 150))`);
state = await evaluate(`({ text: document.body.innerText, path: location.pathname + location.search, requests: window.__requests })`);
record("profile refetch error never redirects", () => {
  assert.match(state.path, /^\/u\/target/);
  assert.equal(state.requests.length, 2);
});

state = await load("/u/target", "public-blocked", "You've been invited!");
record("blocked profile gets generic not-found state without redirect", () => {
  assert.match(state.path, /^\/u\/target/);
  assert.doesNotMatch(state.text, /Ada|points|global rank|items logged/i);
});

state = await load("/u/target", "public-legacy", "Ada");
record("missing additive flag fails closed to teaser", () => {
  assert.match(state.path, /^\/u\/target/);
  assert.match(state.text, /Friends can see more/);
  assert.doesNotMatch(state.text, /points|global rank|items logged/i);
});

state = await load("/u/target", "public-logout", "Friends can see more");
await evaluate(`window.__setAuth(null); new Promise(resolve => setTimeout(resolve, 150))`);
state = await evaluate(`({ text: document.body.innerText, path: location.pathname + location.search, requests: window.__requests })`);
record("logout changes cache identity, uses anon, and never redirects", () => {
  assert.match(state.path, /^\/u\/target/);
  assert.equal(state.requests.at(-1).authorization, "Bearer fixture-anon-key");
});

state = await load("/edna/target", "edna-member", "A complete, private entertainment portrait.");
record("EDNA signed-in fixture uses bearer and displays full paragraph", () => {
  assert.equal(state.requests[0].authorization, "Bearer fixture-edna-token");
  assert.match(state.text, /A complete, private entertainment portrait\./);
});

state = await load("/edna/target", "edna-guest", "A closer look is for friends");
record("EDNA guest uses anon and hides full paragraph", () => {
  assert.equal(state.requests[0].authorization, "Bearer fixture-anon-key");
  assert.doesNotMatch(state.text, /A complete, private entertainment portrait\./);
});

console.log("Controlled local simulated sessions (not real accounts)");
console.log(results.join("\n"));
console.log(`${results.filter(line => line.startsWith("PASS")).length}/${results.length} passed`);
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