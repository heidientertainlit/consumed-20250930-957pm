import assert from "node:assert/strict";
import { createServer } from "node:http";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import { chromium } from "playwright";

// Actual early listener source, mounted React handler, coordinator and Wouter.
// Only native transport/auth state are doubles. No real login or service writes.
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const temp = await mkdtemp(join(tmpdir(), "native-share-delivery-"));
const animals = "https://app.consumedapp.com/media/movie/tmdb/1236045";
const animalPath = "/media/movie/tmdb/1236045";
let browser, server;
try {
  const main = await readFile(join(root, "client/src/main.tsx"), "utf8");
  const start = main.indexOf("if (Capacitor.isNativePlatform()) {");
  const end = main.indexOf("// Register service worker", start);
  assert.ok(start >= 0 && end > start, "Early native registration not found");
  const earlyListener = main.slice(start, end);
  const entry = join(temp, "entry.tsx");
  await writeFile(entry, `
    import React, { useState, useEffect } from "react";
    import { createRoot } from "react-dom/client";
    import { useLocation } from "wouter";
    import { Capacitor } from "@capacitor/core";
    import { App as CapApp } from "@capacitor/app";
    import { NativeSharedLinkHandler } from ${JSON.stringify(join(root, "client/src/components/native-shared-link-handler.tsx"))};
    import { nativeShareDelivery } from ${JSON.stringify(join(root, "client/src/lib/native-share-delivery.ts"))};
    import { sharedRouteFromPath } from ${JSON.stringify(join(root, "client/src/lib/share-deep-link.ts"))};
    import { parseNativeAuthCallback } from ${JSON.stringify(join(root, "client/src/lib/native-oauth.ts"))};
    localStorage.clear(); sessionStorage.clear();
    const f = window.__fixture = { loading: true, user: null, startupReady: false,
      mounted: true, listeners: [], visits: [], launchCalls: 0, browserCloses: 0 };
    f.launch = new Promise(resolve => f.resolveLaunch = resolve);
    f.emit = url => f.listeners.forEach(listener => listener({url}));
    const Browser = { close: async () => { f.browserCloses++; } };
    const hasMatchingOAuthTermsConsentAttempt = id => id === "fixture-attempt";
    const clearMatchingOAuthTermsConsentAttempt = () => {};
    const notifyNativeOAuthBrowserOutcome = () => {};
    const noteNativeOAuthCallbackReceived = () => {};
    const markRecoveryAuthFlow = () => { f.recoveryMarked = true; };
    ${earlyListener}
    if (new URLSearchParams(location.search).has("early")) f.emit(${JSON.stringify(animals)});
    function Fixture() {
      const [, refresh] = useState(0);
      const [path, navigate] = useLocation();
      f.update = values => { Object.assign(f, values); refresh(x => x + 1); };
      f.navigate = navigate;
      useEffect(() => { f.visits.push(path); }, [path]);
      return <><output data-testid="path">{path}</output>
        {f.mounted && <NativeSharedLinkHandler startupReady={f.startupReady} />}</>;
    }
    createRoot(document.getElementById("root")).render(<Fixture />);
  `);
  const doubles = {
    "@capacitor/core": `export const Capacitor={isNativePlatform:()=>true};`,
    "@capacitor/app": `export const App={
      addListener:async(name,listener)=>{window.__fixture.listeners.push(listener);return {remove:async()=>{}}},
      getLaunchUrl:()=>{window.__fixture.launchCalls++;return window.__fixture.launch}
    };`,
    "@/lib/auth": `export const useAuth=()=>({loading:window.__fixture.loading,user:window.__fixture.user});`,
  };
  await build({
    entryPoints: [entry], outfile: join(temp, "bundle.js"), bundle: true,
    platform: "browser", format: "iife", jsx: "automatic", absWorkingDir: root,
    nodePaths: [join(root, "node_modules")],
    define: { "import.meta.env.VITE_APP_URL": JSON.stringify("https://app.consumedapp.com") },
    plugins: [{ name: "native-service-doubles", setup(api) {
      api.onResolve({ filter: /.*/ }, args => args.path in doubles
        ? { path: args.path, namespace: "double" } : undefined);
      api.onLoad({ filter: /.*/, namespace: "double" }, args => ({ contents: doubles[args.path], loader: "js" }));
      api.onResolve({ filter: /^@\// }, args => {
        const base = join(root, "client/src", args.path.slice(2));
        return { path: existsSync(`${base}.tsx`) ? `${base}.tsx` : `${base}.ts` };
      });
    } }],
  });
  server = createServer(async (req, res) => {
    if (req.url === "/bundle.js") {
      res.setHeader("Content-Type", "text/javascript");
      res.end(await readFile(join(temp, "bundle.js")));
    } else res.end('<div id="root"></div><script src="/bundle.js"></script>');
  });
  await new Promise(done => server.listen(0, "127.0.0.1", done));
  const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
    || (existsSync("/repl/tools/bin/chromium") ? "/repl/tools/bin/chromium" : undefined);
  browser = await chromium.launch({ executablePath, args: ["--no-sandbox"] });
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  const open = async (query = "") => {
    await page.goto(`http://127.0.0.1:${server.address().port}/${query}`);
    await page.waitForFunction(() => !!window.__fixture?.update && window.__fixture.launchCalls === 1);
  };
  const update = values => page.evaluate(values => window.__fixture.update(values), values);
  const emit = url => page.evaluate(url => window.__fixture.emit(url), url);
  const expectPath = path => page.waitForFunction(path => document.querySelector("output")?.textContent === path, path);
  const ready = () => update({ loading: false, startupReady: true });
  await open("?early");
  await expectPath("/");
  await ready();
  await expectPath(animalPath);
  await page.evaluate(() => window.__fixture.resolveLaunch({url: "https://app.consumedapp.com/media/movie/tmdb/999"}));
  await page.waitForTimeout(30);
  assert.equal(await page.locator("output").textContent(), animalPath);
  await emit("https://app.consumedapp.com/media/book/googlebooks/Hq9PEAAAQBAJ");
  await expectPath("/media/book/googlebooks/Hq9PEAAAQBAJ");
  await emit("https://evil.example/media/movie/tmdb/999");
  assert.equal(await page.evaluate(() => window.__fixture.browserCloses), 0);
  assert.equal(await page.evaluate(() => window.__fixture.launchCalls), 1);
  console.log("PASS early capture, auth/startup readiness, successive warm links, stale launch suppression, no Browser detour");

  await open();
  await ready();
  await page.evaluate(url => window.__fixture.resolveLaunch({url}), animals);
  await expectPath(animalPath);
  await page.evaluate(() => window.__fixture.navigate("/activity"));
  await update({ mounted: false });
  await update({ mounted: true });
  await page.waitForTimeout(30);
  assert.equal(await page.locator("output").textContent(), "/activity");
  assert.equal(await page.evaluate(() => window.__fixture.launchCalls), 1);
  console.log("PASS actual cold-launch fallback and remount without old URL replay");

  await open();
  await ready();
  await emit("https://app.consumedapp.com/reset-password#type=recovery&access_token=fixture&refresh_token=fixture");
  await emit(animals);
  await expectPath("/");
  assert.equal(await page.evaluate(() => window.__fixture.recoveryMarked), true);
  await page.evaluate(() => {
    window.__fixture.navigate("/reset-password");
    localStorage.removeItem("pendingRecovery"); localStorage.removeItem("pendingRoute");
  });
  await expectPath("/reset-password");
  await page.evaluate(() => window.__fixture.navigate("/activity"));
  await expectPath(animalPath);
  console.log("PASS early real recovery callback retains priority; media resumes after recovery exit");

  await open();
  await ready();
  await emit("com.entertainlit.consumed://auth/callback?oauth_attempt=fixture-attempt#access_token=fixture&refresh_token=fixture");
  await emit(animals);
  await expectPath("/");
  await update({ user: { id: "fixture-user" } });
  await page.evaluate(() => {
    localStorage.removeItem("pendingOAuthSession"); localStorage.removeItem("pendingRoute");
    window.__fixture.navigate("/login");
  });
  await expectPath("/login");
  await page.evaluate(() => window.__fixture.navigate("/onboarding"));
  await expectPath("/onboarding");
  await page.evaluate(() => window.__fixture.navigate("/activity"));
  await expectPath(animalPath);
  console.log("PASS verified OAuth handoff and onboarding defer instead of losing media destination");

  await open();
  await ready();
  await page.evaluate(() => window.__fixture.navigate("/login"));
  await expectPath("/login");
  await emit(animals);
  await expectPath(animalPath);
  assert.equal(await page.evaluate(() => window.__fixture.browserCloses), 0);
  assert.deepEqual(errors, []);
  console.log("PASS signed-out public media routing without login requirement; no runtime errors");
  console.log("Simulated native transport; not physical iPhone/Universal Link verification.");
} finally {
  await browser?.close();
  if (server?.listening) await new Promise(done => server.close(done));
  await rm(temp, { recursive: true, force: true });
}
