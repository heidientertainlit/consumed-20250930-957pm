import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { createServer } from "node:http";
import { build } from "esbuild";
import { chromium } from "playwright";

// Actual Navigation + collection UI. Only account services and mutation sheets
// are doubled; no real accounts, tracking writes, credentials, or TMDB calls.
const doubles = {
  "@/lib/auth": 'const user={id:"fixture-owner"};const session={access_token:"fixture-token"};export const useAuth=()=>({user,session});',
  "@/lib/supabase": 'export const supabase={rpc:()=>({select:()=>({single:async()=>({data:null})})})};',
  "@/lib/feature-flags": 'export const useFeatureFlags=()=>({roomsEnabled:false});',
  "@/hooks/use-toast": 'export const useToast=()=>({toast:()=>{}});',
  "./feedback-dialog": 'export const FeedbackDialog=()=>null;',
  "./notification-bell": 'export const NotificationBell=()=>null;',
  "./quick-track-sheet": 'import React from "react";export const QuickTrackSheet=p=>p.isOpen?<output className="block break-all" data-testid="rate-sheet">{JSON.stringify(p.initialMedia)}</output>:null;',
  "./quick-add-list-sheet": 'import React from "react";export const QuickAddListSheet=p=>p.isOpen?<output className="block break-all" data-testid="add-sheet">{JSON.stringify(p.media)}</output>:null;',
  "./save-media-sheet": 'export const SaveMediaSheet=()=>null;',
};
const bundle = await build({
  stdin: { resolveDir: process.cwd(), loader: "tsx", contents: `
import React, {useEffect} from "react";
import {createRoot} from "react-dom/client";
import {QueryClient,QueryClientProvider} from "@tanstack/react-query";
import {useLocation} from "wouter";
import Navigation from "./client/src/components/navigation";
window.fixture={requests:[],failSearch:false,failDetails:false,delay:0};
window.fetch=async(url,init={})=>{
 const f=window.fixture;const path=String(url);f.requests.push(path);
 if(path.includes("/api/movie-collections")){
  const u=new URL(path,location.origin);await new Promise(r=>setTimeout(r,f.delay));
  if(u.searchParams.has("collectionId")){
   if(f.failDetails)return new Response("Unavailable",{status:503});
   return new Response(JSON.stringify({collection:{id:"1241",title:"Harry Potter Collection",image:"",movies:[
    {title:"Harry Potter and the Philosopher's Stone",type:"movie",external_id:"671",external_source:"tmdb",year:2001,image:""},
    {title:"Harry Potter and the Chamber of Secrets",type:"movie",external_id:"672",external_source:"tmdb",year:2002,image:""}
   ]}}));
  }
  if(f.failSearch)return new Response("Unavailable",{status:503});
  return new Response(JSON.stringify({collections:u.searchParams.get("query").toLowerCase().includes("harry")?[{id:"1241",title:"Harry Potter Collection",image:""}]:[]}));
 }
 if(path.includes("/media-search"))return new Response(JSON.stringify({results:[
  {title:"Ordinary exact movie",type:"movie",external_id:"99",external_source:"tmdb",year:2001},
  {title:"Harry Potter",type:"book_series",external_id:"book-series",external_source:"openai",creator:"J. K. Rowling",series_count:7}
 ]}));
 if(path.includes("/calculate-user-points"))return new Response(JSON.stringify({points:{all_time:17000}}));
 if(path.includes("/get-user-lists-with-media"))return new Response(JSON.stringify({lists:[]}));
 if(path.includes("/search.json"))return new Response(JSON.stringify({docs:[{key:"/works/OL1W",title:"First book",author_name:["J. K. Rowling"]}]}));
 if(path.includes("/manage-friendships"))return new Response(JSON.stringify({users:[]}));
 throw Error("Unexpected request: "+path);
};
function Fixture(){
 const [route]=useLocation();
 useEffect(()=>{
  if(location.pathname!=="/showcase")return;
  const timer=setInterval(()=>{
   const input=document.querySelector('[data-testid="nav-search-input"]');
   if(!input){document.querySelector('[data-testid="nav-search-toggle"]')?.click();return;}
   if(input.value!=="harry potter"){
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,"value").set.call(input,"harry potter");
    input.dispatchEvent(new Event("input",{bubbles:true}));return;
   }
   const button=document.querySelector('[data-testid="movie-collection-1241"] > button');
   if(button&&button.getAttribute("aria-expanded")==="false"){button.click();clearInterval(timer);}
  },100);
  return()=>clearInterval(timer);
 },[]);
 return <><Navigation inline/><output data-testid="route">{route}</output></>;
}
createRoot(document.getElementById("root")).render(<QueryClientProvider client={new QueryClient()}><Fixture/></QueryClientProvider>);` },
  bundle: true, write: false, jsx: "automatic",
  define: {
    "process.env.NODE_ENV": '"development"',
    "import.meta.env": JSON.stringify({ DEV: false, VITE_SUPABASE_URL: "https://fixture.invalid" }),
  },
  plugins: [{ name: "isolated-nav-services", setup(api) {
    api.onResolve({ filter: /.*/ }, args => args.path in doubles ? { path: args.path, namespace: "double" } : undefined);
    api.onLoad({ filter: /.*/, namespace: "double" }, args => ({ contents: doubles[args.path], loader: "tsx", resolveDir: process.cwd() }));
  } }],
});
const files = await readdir("dist/public/assets");
const cssFile = files.find(name => /^index-.*\.css$/.test(name));
assert.ok(cssFile, "Build app CSS first");
const css = await readFile(`dist/public/assets/${cssFile}`);
const server = createServer(async (req, res) => {
  if (req.url === "/fixture.js") {
    res.setHeader("Content-Type", "text/javascript"); res.end(bundle.outputFiles[0].text);
  } else if (req.url === "/style.css") {
    res.setHeader("Content-Type", "text/css"); res.end(css);
  } else if (req.url === "/consumed-logo-new.png") {
    res.setHeader("Content-Type", "image/png"); res.end(await readFile("client/public/consumed-logo-new.png"));
  } else {
    res.setHeader("Content-Type", "text/html"); res.end('<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"><body style="background:#11111e"><div id="root"></div><script src="/fixture.js"></script>');
  }
});
const serve = process.argv.includes("--serve");
await new Promise(resolve => server.listen(serve ? 5099 : 0, "0.0.0.0", resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  if (process.argv.includes("--collections-enabled")) {
  const start = async () => {
    await page.goto(origin);
    await page.getByTestId("nav-search-toggle").click();
    await page.getByTestId("nav-search-input").fill("harry potter");
    await page.getByTestId("movie-collection-1241").waitFor();
  };
  for (const viewport of [{ width: 390, height: 844 }, { width: 1280, height: 800 }]) {
    await page.setViewportSize(viewport);
    await start();
    const row = page.getByTestId("movie-collection-1241");
    const toggle = row.locator(":scope > button");
    assert.equal(await page.evaluate(() => window.fixture.requests.filter(url=>url.includes("collectionId")).length), 0);
    await toggle.click();
    await page.getByTestId("collection-movie-672").waitFor();
    await row.getByText("2 movies", { exact: true }).waitFor();
    await page.getByRole("button", { name: "Add Harry Potter and the Chamber of Secrets to a list", exact: true }).click();
    assert.deepEqual(JSON.parse(await page.getByTestId("add-sheet").innerText()), {
      title: "Harry Potter and the Chamber of Secrets", mediaType: "movie", imageUrl: "", externalId: "672", externalSource: "tmdb",
    });
    await page.getByRole("button", { name: "Rate Harry Potter and the Chamber of Secrets", exact: true }).click();
    const rated = JSON.parse(await page.getByTestId("rate-sheet").innerText());
    assert.equal(rated.type, "movie"); assert.equal(rated.external_id, "672"); assert.equal(rated.external_source, "tmdb");
    await toggle.click();
    assert.equal(await page.getByTestId("collection-movie-672").count(), 0);
    await toggle.click();
    await page.getByTestId("collection-movie-672").waitFor();
    assert.equal(await page.evaluate(() => window.fixture.requests.filter(url=>url.includes("collectionId")).length), 1);
    await page.getByText("Harry Potter", { exact: true }).click();
    await page.getByText("First book", { exact: true }).waitFor();
    await page.getByTestId("collection-movie-671").getByRole("button", { name: "Harry Potter and the Philosopher's Stone Movie · 2001", exact: true }).click();
    assert.equal(await page.getByTestId("route").innerText(), "/media/movie/tmdb/671");
    assert.equal(await page.getByTestId("movie-collection-search-results").count(), 0);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    console.log(`PASS ${viewport.width}x${viewport.height}: lazy expansion, count, cached reopen, real movie IDs for add/rate/open, existing book expansion`);
  }
  await page.goto(origin);
  await page.evaluate(() => { window.fixture.failSearch = true; });
  await page.getByTestId("nav-search-toggle").click();
  await page.getByTestId("nav-search-input").fill("harry potter");
  await page.getByText("Ordinary exact movie", { exact: true }).waitFor();
  await page.getByText("Movie collections unavailable. Other search results are unaffected.", { exact: true }).waitFor();
  await page.getByText("Ordinary exact movie", { exact: true }).click();
  assert.equal(await page.getByTestId("route").innerText(), "/media/movie/tmdb/99");
  console.log("PASS collection search failure leaves ordinary movie results visible");
  await start();
  await page.evaluate(() => { window.fixture.failDetails = true; });
  await page.getByTestId("movie-collection-1241").locator(":scope > button").click();
  await page.getByRole("alert").waitFor();
  await page.evaluate(() => { window.fixture.failDetails = false; });
  await page.getByRole("button", { name: "Try again", exact: true }).click();
  await page.getByTestId("collection-movie-671").waitFor();
  await page.getByTestId("nav-search-input").fill("not a franchise");
  await page.waitForTimeout(450);
  assert.equal(await page.getByTestId("movie-collection-search-results").count(), 0);
  await page.evaluate(() => { window.fixture.delay = 700; });
  await page.getByTestId("nav-search-input").fill("harry");
  await page.waitForTimeout(350);
  await page.getByTestId("nav-search-input").fill("no collection");
  await page.waitForTimeout(1100);
  assert.equal(await page.getByTestId("movie-collection-search-results").count(), 0);
  console.log("PASS expansion retry, query reset, stale collection response protection");
  } else {
    for (const viewport of [{ width: 390, height: 844 }, { width: 1280, height: 800 }]) {
      await page.setViewportSize(viewport);
      await page.goto(origin);
      await page.evaluate(() => { window.fixture.failSearch = true; });
      await page.getByTestId("nav-search-toggle").click();
      await page.getByTestId("nav-search-input").fill("harry potter");
      await page.getByText("Ordinary exact movie", { exact: true }).waitFor();
      await page.getByText("Harry Potter", { exact: true }).click();
      await page.getByText("First book", { exact: true }).waitFor();
      await page.getByText("First book", { exact: true }).click();
      assert.equal(await page.getByTestId("route").innerText(), "/media/book/openlibrary/OL1W");
      await page.getByTestId("nav-search-toggle").click();
      await page.getByTestId("nav-search-input").fill("harry potter");
      await page.getByText("Ordinary exact movie", { exact: true }).click();
      assert.equal(await page.getByTestId("route").innerText(), "/media/movie/tmdb/99");
      await page.waitForTimeout(450);
      assert.equal(await page.evaluate(() => window.fixture.requests.filter(url => url.includes("/api/movie-collections")).length), 0);
      assert.equal(await page.getByTestId("movie-collection-search-results").count(), 0);
      assert.doesNotMatch(await page.locator("body").innerText(), /Movie collections unavailable/);
      console.log(`PASS ${viewport.width}x${viewport.height}: app-bar movie collections disabled; book-series dropdown, individual book and ordinary movie selection preserved`);
    }
  }
  assert.deepEqual(errors, []);
} finally {
  await browser.close();
  if (!serve) await new Promise(resolve => server.close(resolve));
}
if (serve) console.log(`Actual app-bar collection fixture ready at ${origin}/showcase`);
