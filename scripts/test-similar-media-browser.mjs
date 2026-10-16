// Real MediaDetail + hook + poster row; only auth/database/network are synthetic.
// No production data or services are reachable from this isolated fixture.
import assert from "node:assert/strict";
import { build } from "esbuild";
import { chromium } from "playwright";
import { createServer } from "node:http";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";

const root = process.cwd();
const temp = await mkdtemp(path.join(tmpdir(), "similar-media-browser-"));
const outfile = path.join(temp, "fixture.js");
const image = "data:image/svg+xml," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="160" height="240"><rect width="160" height="240" fill="#ddd6fe"/></svg>');
const recommendations = [
  { title: "Cross Book", type: "book", year: 2021, creator: "Book Author" },
  { title: "Cross Album", type: "album", year: 2022, creator: "Music Artist" },
  { title: "Cross Movie", type: "movie", year: 2023, creator: "Movie Director" },
  { title: "Cross Podcast", type: "podcast" },
  { title: "Cross TV", type: "tv" },
  { title: "Cross YouTube", type: "youtube" },
];
const sourceFor = { book: "openlibrary", music: "itunes", movie: "tmdb", podcast: "spotify", tv: "tmdb", youtube: "youtube" };
const entry = `
import React,{useSyncExternalStore} from 'react';
import {createRoot} from 'react-dom/client';
import {useLocation} from 'wouter';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import MediaDetail from '@/pages/media-detail';
const listeners=new Set();
const seed=window.__SEED__||{};
const user={id:'fixture-user'};
window.fx={
 auth:seed.guest?{user:null,session:null,loading:false}:{user,session:{access_token:'synthetic',user},loading:false},
 writes:[],reads:[],subscribe:fn=>{listeners.add(fn);return()=>listeners.delete(fn)},
 switchAccount:id=>{const u={id};window.fx.auth={user:u,session:{access_token:'synthetic-'+id,user:u},loading:false};listeners.forEach(fn=>fn())}
};
window.testClient=new QueryClient({defaultOptions:{queries:{retry:false,refetchOnWindowFocus:false}}});
function Fixture(){const[location,navigate]=useLocation();window.fx.navigate=navigate;return <><MediaDetail/></>}
createRoot(document.getElementById('root')).render(<React.StrictMode><QueryClientProvider client={window.testClient}><Fixture/></QueryClientProvider></React.StrictMode>);
`;
const auth = `
import {useSyncExternalStore} from 'react';
export function useAuth(){return {...useSyncExternalStore(window.fx.subscribe,()=>window.fx.auth),signOut:async()=>({}),isGuest:!window.fx.auth.user}}
`;
const database = `
export const SUPABASE_URL='https://fixture.invalid',SUPABASE_ANON_KEY='synthetic';
export const getSupabaseFunctionUrl=name=>SUPABASE_URL+'/functions/v1/'+name;
export const supabase={
 from:table=>query(table),rpc:name=>query(name),
 auth:{getSession:async()=>({data:{session:window.fx.auth.session}}),getUser:async()=>({data:{user:window.fx.auth.user}})},
 functions:{invoke:async()=>({data:{},error:null})},
 channel(){const c={on(){return c},subscribe(){return c},unsubscribe(){}};return c},removeChannel(){}
};
function query(table){
 const state={single:false,filters:{}};
 const proxy=new Proxy({}, {get(_,key){
  if(key==='then')return(resolve,reject)=>{
   window.fx.reads.push(table);
   let data=[];
   if(table==='resolve_media_canonical_id')data=null;
   if(table==='room_takes')data=[{id:'discussion-1',title:'Conversation remains available',body:'A real conversation fixture.',reply_count:2,upvotes:1,users:{display_name:'Fixture Person',user_name:'fixture'}}];
   if(table==='lists')data=[{id:'want-list',name:'Want To',user_id:window.fx.auth.user?.id,is_system:true}];
   if(table==='media_ratings'&&window.__SEED__.rated)data=[{id:'own-rating',user_id:'fixture-user',rating:4,created_at:'2026-01-01'}];
   if(table==='public_user_profiles')data=[{id:'fixture-user',display_name:'Fixture Person',user_name:'fixture'}];
   return Promise.resolve({data:state.single?(data?.[0]||null):data,error:null}).then(resolve,reject);
  };
  return(...args)=>{if(key==='eq')state.filters[args[0]]=args[1];if(['single','maybeSingle'].includes(key))state.single=true;if(['insert','update','upsert','delete'].includes(key))window.fx.writes.push({table,operation:key,payload:args[0]});return proxy}
 }});
 return proxy;
}
`;
let browser, server;
const cases = [];
try {
  await build({
    stdin: { contents: entry, resolveDir: root, sourcefile: "similar-media-fixture.tsx", loader: "tsx" },
    outfile, bundle: true, platform: "browser", format: "esm", jsx: "automatic",
    define: { "process.env.NODE_ENV": '"development"', "import.meta.env": '{}', "import.meta.env.VITE_SUPABASE_URL": '"https://fixture.invalid"', "import.meta.env.VITE_SUPABASE_ANON_KEY": '"synthetic"' },
    loader: { ".png": "dataurl", ".jpg": "dataurl", ".svg": "dataurl", ".css": "empty" },
    plugins: [{
      name: "isolated-auth-and-database",
      setup(builder) {
        builder.onResolve({ filter: /(?:^|\/)(?:auth|supabase|use-blocked-users|use-dna-archetype)$/ }, args => ({ path: args.path, namespace: "fixture" }));
        builder.onLoad({ filter: /.*/, namespace: "fixture" }, args => ({
          contents: args.path.endsWith("/auth") ? auth : args.path.endsWith("/supabase") ? database :
            args.path.endsWith("use-blocked-users") ? "export const useBlockedUsers=()=>({data:[],isSuccess:true});" : "export const useDnaArchetype=()=>({archetypeKey:null});",
          loader: "js", resolveDir: root,
        }));
        builder.onResolve({ filter: /^@\// }, args => {
          const base = path.join(root, "client/src", args.path.slice(2));
          return { path: [base, ...[".ts", ".tsx", ".js", "/index.ts", "/index.tsx"].map(ext => base + ext)].find(existsSync) || base };
        });
      },
    }],
  });
  execFileSync(process.execPath, ["node_modules/tailwindcss/lib/cli.js", "-i", "client/src/index.css", "-o", path.join(temp, "fixture.css")], { cwd: root, stdio: "pipe" });
  const js = await readFile(outfile);
  const css = await readFile(path.join(temp, "fixture.css"));
  server = createServer((req, res) => {
    if (req.url === "/fixture.js") { res.setHeader("Content-Type", "text/javascript"); res.end(js); }
    else if (req.url === "/fixture.css") { res.setHeader("Content-Type", "text/css"); res.end(css); }
    else { res.setHeader("Content-Type", "text/html"); res.end('<meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/fixture.css"><div id="root"></div><script type="module" src="/fixture.js"></script>'); }
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
  async function run(name, seed, check, mediaType = "movie") {
    if (process.argv[2] && !name.includes(process.argv[2])) return;
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await context.addInitScript(value => { window.__SEED__ = value; }, seed);
    const page = await context.newPage();
    const errors = [], requests = [], held = new Map();
    page.on("pageerror", e => errors.push(e.message));
    await page.route("**/*", async route => {
      const req = route.request(), url = new URL(req.url());
      if (url.origin === origin && !url.pathname.startsWith("/api/")) return route.continue();
      if (url.pathname.endsWith("get-media-details")) {
        const id = url.searchParams.get("external_id");
        return route.fulfill({ json: { title: id === "second" ? "Second Source" : "Source Title", type: url.searchParams.get("media_type"), artwork: image, description: "Original title information.", external_id: id, external_source: "tmdb" } });
      }
      if (url.pathname.endsWith("conversational-search")) {
        requests.push({ kind: "generate", body: req.postDataJSON() });
        if (seed.holdGeneration) return held.set("generation", route);
        if (seed.generationFailure) return route.fulfill({ status: 503, json: { error: "unavailable" } });
        const recs = seed.noResults ? [] : req.postDataJSON().query.includes("Second Source") ? [{ title: "New Source Match", type: "book" }] : recommendations;
        return route.fulfill({ json: { recommendations: recs } });
      }
      if (url.pathname.endsWith("media-search")) {
        const body = req.postDataJSON();
        requests.push({ kind: "resolve", body });
        const item = recommendations.find(item => body.query.startsWith(item.title)) || { title: "New Source Match", type: "book" };
        if (seed.holdAll || seed.holdTitle === item.title) return held.set(item.title, route);
        if (seed.failAll || seed.failTitle === item.title) return route.fulfill({ status: 500, json: { error: "fixture failure" } });
        if (seed.wrongOnly) return route.fulfill({ json: { results: [{ title: "Wrong work", type: "movie", external_source: "tmdb", external_id: "wrong" }] } });
        return route.fulfill({ json: { results: [{
          ...item, type: body.type, creator: item.creator, year: item.year,
          external_source: sourceFor[body.type], external_id: body.type === "book" ? "works/OL123W" : "verified-id",
          poster_url: seed.brokenImages ? "https://images.invalid/broken.jpg" : seed.noArtwork ? "" : image,
        }] } });
      }
      if (url.pathname.endsWith("get-user-lists-with-media")) return route.fulfill({ json: { lists: [{ id: "want-list", name: "Want To", items: [], is_system: true }] } });
      if (url.hostname === "fixture.invalid" || url.hostname === "mahpgcogwpawvviapqza.supabase.co" || url.pathname.startsWith("/api/")) {
        return route.fulfill({ json: { lists: [], predictions: [], polls: [], trivia: [], comments: [], friends: [], creators: [], results: [], success: true } });
      }
      return route.abort();
    });
    try {
      await page.goto(`${origin}/media/${mediaType}/tmdb/source`);
      await page.getByRole("heading", { name: "Source Title", exact: true }).waitFor();
      await check({ page, requests, held });
      assert.deepEqual(errors, []);
      cases.push(name);
      console.log("PASS", name);
    } catch (error) {
      console.error("FAIL", name, errors, (await page.locator("body").innerText()).slice(-1700));
      throw error;
    } finally { await context.close(); }
  }
  const ready = page => page.getByTestId("similar-media-5").waitFor();

  await run("visible compact row is above conversations and retains cross-media order", {}, async ({ page, requests }) => {
    await ready(page);
    const row = page.getByTestId("more-like-this");
    assert.deepEqual(await row.locator("a p").allTextContents(), recommendations.map(x => x.title));
    assert.equal(await page.getByTestId("tab-explore").count(), 0);
    assert.equal((await row.boundingBox()).y < (await page.getByText("Conversation remains available", { exact: true }).boundingBox()).y, true);
    assert.deepEqual(requests.filter(r => r.kind === "resolve").map(r => r.body.type), ["book", "music", "movie", "podcast", "tv", "youtube"]);
    assert.equal(requests.some(r => r.body.types), false);
    if (process.argv[3]) {
      await row.scrollIntoViewIfNeeded();
      await page.screenshot({ path: path.join(process.argv[3], "similar-media-mobile.jpg") });
    }
    await page.getByTestId("similar-media-0").click();
    await page.waitForURL("**/media/book/openlibrary/works/OL123W");
  });
  for (const mediaType of ["tv", "book", "music", "podcast"]) {
    await run(`source ${mediaType} preserves generator mix`, {}, async ({ page, requests }) => {
      await ready(page);
      assert.deepEqual(requests.filter(r => r.kind === "resolve").map(r => r.body.type), ["book", "music", "movie", "podcast", "tv", "youtube"]);
    }, mediaType);
  }
  await run("late first recommendation keeps its place without hiding ready later matches", { holdTitle: "Cross Book" }, async ({ page, held }) => {
    await ready(page);
    await page.getByTestId("similar-media-pending-0").waitFor();
    assert.equal(await page.getByTestId("similar-media-0").count(), 0);
    assert.equal(await page.getByTestId("more-like-this").locator("a").count(), 5);
    assert.equal(await page.getByTestId("more-like-this-scroll").evaluate(el => el.firstElementChild.firstElementChild.dataset.testid), "similar-media-pending-0");
    await held.get("Cross Book").fulfill({ json: { results: [{ title: "Cross Book", type: "book", creator: "Book Author", year: 2021, external_source: "openlibrary", external_id: "works/OL123W" }] } });
    await page.getByTestId("similar-media-0").waitFor();
    assert.deepEqual(await page.getByTestId("more-like-this").locator("a p").allTextContents(), recommendations.map(x => x.title));
  });
  await run("individual failure preserves every other verified match", { failTitle: "Cross Book" }, async ({ page }) => {
    await ready(page);
    assert.equal(await page.getByTestId("more-like-this").locator("a").count(), 5);
    assert.equal(await page.getByTestId("similar-media-0").count(), 0);
  });
  await run("stalled lookups expire rather than leaving an endless spinner", { holdAll: true }, async ({ page }) => {
    await page.getByTestId("similar-media-pending-0").waitFor();
    await page.getByTestId("more-like-this-empty").waitFor({ timeout: 13_000 });
    assert.equal(await page.getByTestId("more-like-this").locator("a").count(), 0);
    assert.equal(await page.locator('[data-testid^="similar-media-pending"]').count(), 0);
    assert.equal(await page.getByTestId("more-like-this-empty").textContent(), "Similar titles are unavailable right now.");
  });
  await run("generation itself has a finite deadline", { holdGeneration: true }, async ({ page }) => {
    await page.getByTestId("similar-media-pending-0").waitFor();
    await page.getByTestId("more-like-this-empty").waitFor({ timeout: 23_000 });
    assert.equal(await page.locator('[data-testid^="similar-media-pending"]').count(), 0);
  });
  for (const seed of [{ generationFailure: true }, { noResults: true }, { failAll: true }, { wrongOnly: true }]) {
    await run("finite empty state " + Object.keys(seed)[0], seed, async ({ page }) => {
      await page.getByTestId("more-like-this-empty").waitFor();
      assert.equal(await page.getByTestId("more-like-this").locator("a").count(), 0);
    });
  }
  for (const seed of [{ brokenImages: true }, { noArtwork: true }]) {
    await run("artwork fallback " + Object.keys(seed)[0], seed, async ({ page }) => {
      await ready(page);
      const card = page.getByTestId("similar-media-0");
      await card.locator("svg").waitFor({ state: "attached" });
      if (seed.brokenImages) await page.waitForFunction(() => document.querySelector('[data-testid="similar-media-0"] img')?.style.display === "none");
      assert.equal(await card.getAttribute("href"), "/media/book/openlibrary/works/OL123W");
    });
  }
  await run("navigation discards late old-title recommendations", { holdTitle: "Cross Book" }, async ({ page, held }) => {
    await ready(page);
    await page.evaluate(() => window.fx.navigate("/media/movie/tmdb/second"));
    await page.getByText("New Source Match", { exact: true }).waitFor();
    await held.get("Cross Book").fulfill({ json: { results: [{ title: "Cross Book", type: "book", creator: "Book Author", year: 2021, external_source: "openlibrary", external_id: "works/OLD" }] } }).catch(() => {});
    assert.equal(await page.getByTestId("more-like-this").getByText("Cross Album", { exact: true }).count(), 0);
  });
  await run("account switch uses a fresh personalized cache", {}, async ({ page, requests }) => {
    await ready(page);
    const count = requests.filter(r => r.kind === "generate").length;
    await page.evaluate(() => window.fx.switchAccount("second-user"));
    await page.waitForFunction(() => window.testClient.getQueryCache().getAll().some(q => q.queryKey[0] === "similar-media-v2" && q.queryKey[1] === "second-user" && q.state.status === "success"));
    assert.equal(requests.filter(r => r.kind === "generate").length, count + 1);
  });
  await run("guest browsing does not start authenticated recommendation calls", { guest: true }, async ({ page, requests }) => {
    assert.equal(await page.getByTestId("more-like-this").count(), 0);
    assert.equal(requests.filter(r => ["generate", "resolve"].includes(r.kind)).length, 0);
  });
  await run("rating, list sheet, conversations and Play controls remain accessible", {}, async ({ page }) => {
    await ready(page);
    await page.getByTestId("button-quick-rate-4").click();
    await page.getByTestId("button-hero-add-to-list").click();
    await page.getByRole("dialog").waitFor();
    await page.keyboard.press("Escape");
    await page.getByTestId("tab-play").click();
    await page.getByTestId("tab-takes").click();
    await page.getByText("Conversation remains available", { exact: true }).click();
    await page.waitForURL("**/conversation/discussion-1");
  });
  await run("existing own rating still appears", { rated: true }, async ({ page }) => {
    await ready(page);
    await page.getByText("Your rating: 4.0", { exact: true }).waitFor();
  });
  await run("mobile row scrolls horizontally without locking vertical page gestures", {}, async ({ page }) => {
    await ready(page);
    const scroll = page.getByTestId("more-like-this-scroll");
    const sizing = await scroll.evaluate(el => ({ width: el.clientWidth, content: el.scrollWidth, touch: getComputedStyle(el).touchAction }));
    assert.equal(sizing.content > sizing.width, true);
    assert.equal(sizing.touch, "pan-x pan-y");
    await scroll.evaluate(el => { el.scrollLeft = 120; });
    assert.equal(await scroll.evaluate(el => el.scrollLeft > 0), true);
    const before = await page.evaluate(() => window.scrollY);
    await scroll.hover();
    await page.mouse.wheel(0, 300);
    await page.waitForFunction(value => window.scrollY !== value, before);
  });
  await run("desktop row stays compact and links are keyboard accessible", {}, async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await ready(page);
    const row = page.getByTestId("more-like-this");
    assert.equal((await row.boundingBox()).height < 220, true);
    if (process.argv[3]) {
      await row.scrollIntoViewIfNeeded();
      await page.screenshot({ path: path.join(process.argv[3], "similar-media-desktop.jpg") });
    }
    const first = page.getByTestId("similar-media-0");
    await first.focus();
    await page.keyboard.press("Enter");
    await page.waitForURL("**/media/book/openlibrary/works/OL123W");
  });
  console.log(`PASS ${cases.length} real-media-page browser cases (controlled transport; not a signed-in live-server test).`);
} finally {
  await browser?.close();
  await new Promise(resolve => server ? server.close(resolve) : resolve());
  await rm(temp, { recursive: true, force: true });
}
