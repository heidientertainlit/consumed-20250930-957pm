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
const temp = await mkdtemp(join(tmpdir(), "unified-media-search-"));
const entry = join(temp, "entry.tsx"), bundle = join(temp, "bundle.js"), css = join(temp, "fixture.css");
const screenshot = "/tmp/unified-media-search-mobile.png";
const panelPath = join(root, "client/src/components/media-search-panel.tsx");
const source = await readFile(panelPath, "utf8");

await writeFile(entry, `
import React, { useSyncExternalStore } from "react";
import { createRoot } from "react-dom/client";
import MediaSearchPanel from ${JSON.stringify(panelPath)};
const state = { session: { access_token: "fixture-token" }, requests: [], selected: [], pending: [] };
window.__mediaFixture = state;
window.fetch = (url, init = {}) => {
 const body = JSON.parse(init.body); const request = { url: String(url), body, aborted: false };
 init.signal?.addEventListener("abort", () => request.aborted = true); state.requests.push(request);
 const result = { title: body.query === "slow" && !body.type ? "Slow stale title" : "Result " + body.query, type: body.type || "movie", image_url: "fixture-image", external_id: "id-" + body.query, external_source: "fixture", creator: "Fixture" };
 if (body.query === "slow") return new Promise(resolve => state.pending.push(() => resolve(new Response(JSON.stringify({ results: [result] }), { headers: {"Content-Type":"application/json"} }))));
 return Promise.resolve(new Response(JSON.stringify({ results: [result] }), { headers: {"Content-Type":"application/json"} }));
};
function Fixture() { return <main className="fixture"><section className="card"><h1>Add media</h1><MediaSearchPanel autoFocus={false} onSelect={item => state.selected.push(item)} /></section></main> }
createRoot(document.getElementById("root")).render(<Fixture />);
`);
const originalCss = await readFile(join(root, "client/src/index.css"), "utf8");
const processed = await postcss([tailwindcss({ config: join(root, "tailwind.config.ts") }), autoprefixer]).process(originalCss, { from: join(root, "client/src/index.css") });
await writeFile(css, `${processed.css}\n*{box-sizing:border-box}html,body,#root{margin:0;width:100%;min-height:100%}.fixture{min-height:100vh;padding:16px 0;background:#faf7ff}.card{max-width:520px;margin:auto;background:white;border-radius:24px;padding:16px;min-height:510px}.card h1{margin:0 0 14px;font-size:20px}`);
const aliases = { name: "fixture-auth", setup(api) {
  api.onResolve({ filter: /^@\/lib\/auth$/ }, () => ({ path: "auth", namespace: "fixture" }));
  api.onResolve({ filter: /^@\// }, a => { const base = join(root, "client/src", a.path.slice(2)); return { path: existsSync(`${base}.tsx`) ? `${base}.tsx` : `${base}.ts` }; });
  api.onLoad({ filter: /.*/, namespace: "fixture" }, () => ({ contents: `export const useAuth=()=>({session:window.__mediaFixture.session})`, loader: "js" }));
}};
await build({ entryPoints: [entry], outfile: bundle, bundle: true, format: "iife", platform: "browser", jsx: "automatic", tsconfigRaw: { compilerOptions: { jsx: "react-jsx" } }, absWorkingDir: root, nodePaths: [join(root, "node_modules")], plugins: [aliases], define: { "import.meta.env.VITE_SUPABASE_URL": JSON.stringify("https://fixture.invalid"), "import.meta.env.VITE_SUPABASE_ANON_KEY": JSON.stringify("fixture-anon") } });
const server = createServer(async (req, res) => { if (req.url === "/bundle.js") { res.setHeader("Content-Type", "text/javascript"); res.end(await readFile(bundle)); } else if (req.url === "/fixture.css") { res.setHeader("Content-Type", "text/css"); res.end(await readFile(css)); } else { res.setHeader("Content-Type", "text/html"); res.end('<meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/fixture.css"><div id="root"></div><script>addEventListener("error",e=>window.__fixtureError=e.error?.stack||e.message);addEventListener("unhandledrejection",e=>window.__fixtureError=e.reason?.stack||String(e.reason))</script><script src="/bundle.js"></script>'); } });
await new Promise(resolveListen => server.listen(0, "127.0.0.1", resolveListen));
const chrome = spawn("/repl/tools/bin/chromium", ["--headless", "--no-sandbox", "--disable-gpu", "--remote-debugging-port=0", `--user-data-dir=${join(temp, "chrome")}`, "about:blank"], { stdio: ["ignore", "ignore", "pipe"] });
let browser, page;
const results = [];
const record = async (name, fn) => { try { await fn(); results.push(`PASS ${name}`); } catch (e) { results.push(`FAIL ${name}: ${e.message}`); process.exitCode = 1; } };
try {
  let stderr = "";
  const wsUrl = await new Promise((resolveWs, reject) => { const timeout = setTimeout(() => reject(Error(stderr)), 10000); chrome.stderr.on("data", c => { stderr += c; const hit = stderr.match(/DevTools listening on (ws:\/\/[^\s]+)/); if (hit) { clearTimeout(timeout); resolveWs(hit[1]); } }); });
  class CDP { constructor(url) { this.id=0; this.pending=new Map(); this.ws=new WebSocket(url); } async open(){ await new Promise((ok,no)=>{this.ws.once("open",ok);this.ws.once("error",no)});this.ws.on("message",raw=>{const m=JSON.parse(raw);if(m.id&&this.pending.has(m.id)){const p=this.pending.get(m.id);this.pending.delete(m.id);m.error?p.reject(Error(m.error.message)):p.resolve(m.result)}})} call(method,params={}){const id=++this.id;return new Promise((resolveCall,reject)=>{this.pending.set(id,{resolve:resolveCall,reject});this.ws.send(JSON.stringify({id,method,params}))})} }
  browser = new CDP(wsUrl); await browser.open();
  const target = await browser.call("Target.createTarget", { url: "about:blank" });
  const targets = await (await fetch(wsUrl.replace("ws://", "http://").replace(/\/devtools\/browser\/.*$/, "/json/list"))).json();
  page = new CDP(targets.find(x => x.id === target.targetId).webSocketDebuggerUrl); await page.open(); await page.call("Page.enable"); await page.call("Runtime.enable");
  const evaluate = async expression => { const r=await page.call("Runtime.evaluate",{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);return r.result?.value; };
  const wait = (condition, message=condition) => evaluate(`new Promise((yes,no)=>{const end=Date.now()+4000;const tick=()=>{if(${condition})yes();else if(Date.now()>end)no(Error(${JSON.stringify(message)}));else setTimeout(tick,15)};tick()})`);
  const input = async value => { await evaluate(`document.querySelector('[data-testid="media-search-input"]').focus()`); await page.call("Input.dispatchKeyEvent", { type:"keyDown", key:"a", code:"KeyA", modifiers:2, windowsVirtualKeyCode:65 }); await page.call("Input.dispatchKeyEvent", { type:"keyUp", key:"a", code:"KeyA", modifiers:2, windowsVirtualKeyCode:65 }); await page.call("Input.dispatchKeyEvent", { type:"keyDown", key:"Backspace", code:"Backspace", windowsVirtualKeyCode:8 }); await page.call("Input.dispatchKeyEvent", { type:"keyUp", key:"Backspace", code:"Backspace", windowsVirtualKeyCode:8 }); await page.call("Input.insertText", { text:value }); };
  const click = selector => evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`);
  await page.call("Emulation.setDeviceMetricsOverride", { width:390,height:700,deviceScaleFactor:1,mobile:false });
  await page.call("Page.navigate", { url:`http://127.0.0.1:${server.address().port}/` }); await wait("window.__mediaFixture || window.__fixtureError", "fixture mount"); if (!await evaluate("window.__mediaFixture")) throw Error(await evaluate("window.__fixtureError")); await wait(`!!document.querySelector('[data-testid="media-search-input"]') || window.__fixtureError`, "panel render"); if (!await evaluate(`!!document.querySelector('[data-testid="media-search-input"]')`)) throw Error(await evaluate("window.__fixtureError"));
  await record("390 mobile panel has rounded surfaces, canonical labels, and horizontally scrolling filters", async () => {
    assert.deepEqual(await evaluate("[...document.querySelectorAll('[data-testid^=\"filter-media-\"]')].map(x=>x.textContent)"), ["All","Movies","TV","Books","Music","Podcasts","YouTube","Games"]);
    const x=await evaluate(`(()=>{const n=document.querySelector('[data-testid="media-search-type-filters"]'),s=getComputedStyle(n);return {overflow:s.overflowX,client:n.clientWidth,scroll:n.scrollWidth,radii:[document.querySelector('[data-testid="media-search-input"]'),...n.children].map(n=>parseFloat(getComputedStyle(n).borderTopLeftRadius))}})()`);
    assert.equal(x.overflow,"auto"); assert.ok(x.scroll>x.client,JSON.stringify(x)); assert.ok(x.radii.every(n=>n>=12),JSON.stringify(x));
  });
  await input("x"); await evaluate("new Promise(r=>setTimeout(r,250))");
  await record("one-character queries make no request after the 200ms debounce", async()=>assert.equal(await evaluate("window.__mediaFixture.requests.length"),0));
  await input("ab"); await evaluate("new Promise(r=>setTimeout(r,120))");
  await record("two-character query waits the full 200ms debounce", async()=>assert.equal(await evaluate("window.__mediaFixture.requests.length"),0));
  await wait("window.__mediaFixture.requests.length===1");
  await click('[data-testid="filter-media-movie"]'); await wait("window.__mediaFixture.requests.length===2");
  await click('[data-testid="filter-media-all"]'); await wait("window.__mediaFixture.requests.length===3");
  await record("Movies sends exact type and All omits type", async()=>{const r=await evaluate("window.__mediaFixture.requests.map(x=>x.body)");assert.equal(r[1].type,"movie");assert.equal("type" in r[2],false);assert.ok(r.every(x=>x.include_book_series===true));});
  await wait(`document.querySelector('[data-testid="media-search-results"]')?.textContent.includes("Result ab")`, "rendered two-character results");
  await input("x"); await evaluate("new Promise(r=>setTimeout(r,250))");
  await record("shortening a rendered query below two characters clears results, stops spinner, and makes no request", async()=>{assert.equal(await evaluate(`!!document.querySelector('[data-testid="media-search-results"]')`),false);assert.equal(await evaluate(`!!document.querySelector('[data-testid="media-search-input"]').parentElement.querySelector('.animate-spin')`),false);assert.equal(await evaluate("window.__mediaFixture.requests.length"),3);});
  await input("ab"); await wait("window.__mediaFixture.requests.length===4");
  await input("slow"); await wait("window.__mediaFixture.requests.some(x=>x.body.query==='slow')");
  await click('[data-testid="filter-media-tv"]'); await wait("window.__mediaFixture.requests.some(x=>x.body.query==='slow'&&x.aborted)&&window.__mediaFixture.requests.some(x=>x.body.query==='slow'&&x.body.type==='tv')");
  await evaluate("window.__mediaFixture.pending.forEach(resolve=>resolve())"); await wait("document.querySelector('[data-testid=\"media-search-results\"]')?.textContent.includes('Result slow')");
  await record("filter switch aborts pending request and stale response cannot win", async()=>{const r=await evaluate("window.__mediaFixture.requests.filter(x=>x.body.query==='slow')");assert.equal(r[0].aborted,true);assert.equal(await evaluate("document.querySelector('[data-testid=\"media-search-results\"]').textContent.includes('Slow stale title')"),false);});
  await click('[data-testid="media-search-result-id-slow"]');
  await record("selection callback receives exact normalized result", async()=>assert.deepEqual(await evaluate("window.__mediaFixture.selected[0]"),{title:"Result slow",type:"tv",image_url:"fixture-image",external_id:"id-slow",external_source:"fixture",creator:"Fixture",image:"fixture-image"}));
  await record("changed user-facing consumers import the canonical panel or filter/request pair (legacy share-update and admin enrichment excluded)", async()=>{const consumers=["client/src/components/consumption-tracker.tsx","client/src/components/media-search-bar.tsx","client/src/components/direct-search-dialog.tsx","client/src/components/quick-react-card.tsx","client/src/pages/add.tsx"];for(const file of consumers){const s=await readFile(join(root,file),"utf8");assert.match(s,/from\s+["'][^"']*media-search-panel["']/);assert.ok(/MediaSearchPanel/.test(s)||(/MEDIA_SEARCH_FILTERS/.test(s)&&/requestMediaSearch/.test(s)),file)}assert.match(source,/export default function MediaSearchPanel/);});
  const image=await page.call("Page.captureScreenshot",{format:"png",fromSurface:true});await writeFile(screenshot,Buffer.from(image.data,"base64"));
  await record("mobile screenshot captured from actual Tailwind/PostCSS Chromium fixture",async()=>assert.ok((await readFile(screenshot)).byteLength>1000));
  console.log("Unified MediaSearchPanel actual component + Tailwind Chromium fixture"); console.log(results.join("\n"));console.log(`${results.filter(x=>x.startsWith("PASS")).length}/${results.length} passed`);console.log(`Screenshot: ${screenshot}`);
} finally { page?.ws.close();browser?.ws.close();if(chrome.exitCode===null){const done=new Promise(r=>chrome.once("exit",r));chrome.kill("SIGTERM");await done}await new Promise(r=>server.close(r));await rm(temp,{recursive:true,force:true}); }