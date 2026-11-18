import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { createServer } from "node:http";
import { build } from "esbuild";
import { chromium } from "playwright";

// Real shared search panel and series loader; no live services or account writes.
const bundle = await build({
  stdin: {
    resolveDir: process.cwd(), loader: "tsx",
    contents: `
import React from "react";
import {createRoot} from "react-dom/client";
import {QueryClient, QueryClientProvider} from "@tanstack/react-query";
import MediaSearchPanel from "./client/src/components/media-search-panel";
window.fixture={requests:[],seriesRequests:[],collectionRequests:[],selected:[],failSeries:false,failCollections:false,failMovies:false};
window.fetch=async (url,init={})=>{
 const f=window.fixture;
 if(String(url).includes("/api/movie-collections")){
   f.collectionRequests.push(String(url));const parsed=new URL(String(url),location.origin);
   if(parsed.searchParams.has("collectionId")){
     if(f.failMovies)return new Response("Unavailable",{status:503});
     return new Response(JSON.stringify({collection:{id:"1241",title:"Harry Potter Collection",image:"",movies:[
       {title:"Harry Potter and the Philosopher's Stone",type:"movie",external_id:"671",external_source:"tmdb",year:2001,image:""},
       {title:"Harry Potter and the Chamber of Secrets",type:"movie",external_id:"672",external_source:"tmdb",year:2002,image:""}
     ]}}));
   }
   if(f.failCollections)return new Response("Unavailable",{status:503});
   return new Response(JSON.stringify({collections:parsed.searchParams.get("query")==="empty"?[]:[{id:"1241",title:"Harry Potter Collection",image:""}]}));
 }
 if(String(url).includes("/functions/v1/media-search")){
   const body=JSON.parse(init.body); f.requests.push(body);
   if(body.query==="slow") await new Promise(r=>setTimeout(r,650));
   const results=[
    {title:"Harry Potter",type:"book_series",series_count:7,creator:"J. K. Rowling",external_id:"series-hp",external_source:"openai"},
    {title:"Harry Potter movie",type:"movie",year:2001,external_id:"movie-hp",external_source:"tmdb"},
    {title:"Ordinary book",type:"book",external_id:"ordinary-book",external_source:"googlebooks"}
   ];
   return new Response(JSON.stringify({results:body.query==="empty"?[]:results}));
 }
 if(String(url).startsWith("https://openlibrary.org/search.json")){
   f.seriesRequests.push(String(url));
   await new Promise(r=>setTimeout(r,100));
   if(f.failSeries)return new Response("Unavailable",{status:503});
   return new Response(JSON.stringify({docs:[
    {key:"/works/OL1W",title:"Harry Potter and the Philosopher's Stone",author_name:["J. K. Rowling"],first_publish_year:1997},
    {key:"/works/OL2W",title:"Harry Potter and the Chamber of Secrets",author_name:["J. K. Rowling"],first_publish_year:1998}
   ]}));
 }
 throw new Error("Unexpected fixture request: "+url);
};
createRoot(document.getElementById("root")).render(
 <QueryClientProvider client={new QueryClient()}>
 <main className="mx-auto flex h-[90dvh] max-w-md flex-col rounded-2xl bg-white py-4">
  <h1 className="mb-4 text-center text-lg font-semibold">Track</h1>
  <MediaSearchPanel autoFocus={false} bookSeriesDiscovery="matching-filter" expandableBookSeries={!location.search.includes("legacy")} expandableMovieCollections={!location.search.includes("legacy")} onSelect={r=>window.fixture.selected.push(r)}/>
 </main>
 </QueryClientProvider>
);`,
  },
  bundle: true, write: false, jsx: "automatic",
  define: {
    "process.env.NODE_ENV": '"development"',
    "import.meta.env.VITE_SUPABASE_URL": '"https://fixture.invalid"',
    "import.meta.env.VITE_SUPABASE_ANON_KEY": '""',
    "import.meta.env.VITE_APP_URL": '"https://fixture.invalid"',
    "import.meta.env.DEV": "false",
  },
  plugins: [{
    name: "isolated-auth",
    setup(api) {
      api.onResolve({ filter: /^@\/lib\/auth$/ }, () => ({ path: "auth", namespace: "fixture" }));
      api.onLoad({ filter: /.*/, namespace: "fixture" }, () => ({ contents: 'export const useAuth=()=>({session:{access_token:"fixture-token"}});' }));
    },
  }],
});
const files = await readdir("dist/public/assets");
const cssFile = files.find(name => /^index-.*\.css$/.test(name));
assert.ok(cssFile, "Run npm run build:app first");
const css = await readFile(`dist/public/assets/${cssFile}`);
const server = createServer((req, res) => {
  if (req.url === "/fixture.js") {
    res.setHeader("Content-Type", "text/javascript"); res.end(bundle.outputFiles[0].text);
  } else if (req.url === "/style.css") {
    res.setHeader("Content-Type", "text/css"); res.end(css);
  } else {
    res.setHeader("Content-Type", "text/html");
    res.end('<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"><body style="background:#ede9f3"><div id="root"></div><script src="/fixture.js"></script>');
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
  const search = async (query = "harry potter") => {
    await page.getByTestId("media-search-input").fill(query);
    await page.getByTestId("media-search-result-series-hp").waitFor();
  };
  for (const viewport of [{ width: 390, height: 844 }, { width: 1280, height: 800 }]) {
    await page.setViewportSize(viewport);
    await page.goto(origin);
    await search();
    const collection = page.getByTestId("movie-collection-1241");
    await collection.waitFor();
    assert.equal(await page.evaluate(() => window.fixture.collectionRequests.some(url => url.includes("collectionId"))), false);
    await collection.locator(":scope > button").click();
    await page.getByTestId("collection-movie-672").waitFor();
    await collection.getByText("2 movies", { exact: true }).waitFor();
    await page.getByRole("button", { name: "Add Harry Potter and the Chamber of Secrets to a list", exact: true }).click();
    assert.deepEqual(await page.evaluate(() => window.fixture.selected.at(-1)), {
      title: "Harry Potter and the Chamber of Secrets", type: "movie", external_id: "672", external_source: "tmdb", year: 2002, image: "",
    });
    await page.getByTestId("collection-movie-671").getByRole("button", { name: "Harry Potter and the Philosopher's Stone Movie · 2001", exact: true }).click();
    assert.equal(await page.evaluate(() => window.fixture.selected.at(-1).external_id), "671");
    assert.equal(await collection.getByRole("button", { name: /^Rate / }).count(), 0);
    await collection.locator(":scope > button").click();
    await collection.locator(":scope > button").click();
    assert.equal(await page.evaluate(() => window.fixture.collectionRequests.filter(url => url.includes("collectionId")).length), 1);
    await page.evaluate(() => { window.fixture.selected = []; });
    assert.equal(await page.evaluate(() => window.fixture.seriesRequests.length), 0);
    const series = page.getByTestId("media-search-result-series-hp");
    assert.equal(await series.getAttribute("aria-expanded"), "false");
    await series.click();
    await page.getByTestId("media-search-series-book-OL1W").waitFor();
    assert.equal(await page.evaluate(() => window.fixture.selected.length), 0);
    assert.equal(await series.getAttribute("aria-expanded"), "true");
    await series.click();
    assert.equal(await page.getByTestId("media-search-series-book-OL1W").count(), 0);
    await series.click();
    await page.getByTestId("media-search-series-book-OL2W").click();
    const selected = await page.evaluate(() => window.fixture.selected.at(-1));
    assert.equal(selected.type, "book");
    assert.equal(selected.external_id, "OL2W");
    assert.equal(selected.external_source, "openlibrary");
    assert.equal(selected.title, "Harry Potter and the Chamber of Secrets");
    assert.equal(await page.evaluate(() => window.fixture.seriesRequests.length), 1);
    await page.getByRole("button", { name: "Add Harry Potter series", exact: true }).click();
    assert.equal(await page.evaluate(() => window.fixture.selected.at(-1).type), "book_series");
    await page.getByTestId("media-search-result-movie-hp").click();
    assert.equal(await page.evaluate(() => window.fixture.selected.at(-1).external_source), "tmdb");
    await page.getByTestId("filter-media-movie").click();
    await page.waitForFunction(() => window.fixture.requests.at(-1).type === "movie");
    assert.equal(await page.getByTestId("media-search-result-series-hp").count(), 0);
    assert.equal(await page.evaluate(() => window.fixture.requests.at(-1).include_book_series), false);
    await page.getByTestId("filter-media-book").click();
    await series.waitFor();
    assert.equal(await page.getByTestId("movie-collection-search-results").count(), 0);
    const collectionCalls = await page.evaluate(() => window.fixture.collectionRequests.length);
    await page.getByTestId("filter-media-tv").click();
    await page.waitForTimeout(350);
    assert.equal(await page.evaluate(() => window.fixture.collectionRequests.length), collectionCalls);
    await page.getByTestId("filter-media-book").click();
    await series.waitFor();
    assert.equal(await page.evaluate(() => window.fixture.requests.at(-1).include_book_series), true);
    await page.getByTestId("media-search-result-ordinary-book").click();
    assert.equal(await page.evaluate(() => window.fixture.selected.at(-1).external_id), "ordinary-book");
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    console.log(`PASS ${viewport.width}x${viewport.height}: movie and book dropdowns, cached expansion, exact selected IDs, ordinary choices, All/Movies/Books/TV filters`);
  }
  await page.goto(origin);
  await page.evaluate(() => { window.fixture.failSeries = true; });
  await search();
  await page.getByTestId("media-search-result-series-hp").click();
  await page.getByRole("alert").waitFor();
  await page.evaluate(() => { window.fixture.failSeries = false; });
  await page.getByRole("button", { name: "Try again", exact: true }).click();
  await page.getByTestId("media-search-series-book-OL1W").waitFor();
  await page.getByTestId("media-search-input").fill("empty");
  await page.getByText('No individual titles for "empty".', { exact: true }).waitFor();
  assert.equal(await page.getByTestId("media-search-series-book-OL1W").count(), 0);
  await page.getByTestId("media-search-input").fill("slow");
  await page.waitForFunction(() => window.fixture.requests.at(-1).query === "slow");
  await page.getByTestId("media-search-input").fill("empty");
  await page.getByText('No individual titles for "empty".', { exact: true }).waitFor();
  await page.waitForTimeout(700);
  assert.equal(await page.getByTestId("media-search-result-series-hp").count(), 0);
  console.log("PASS series failure/retry, query reset, and stale-response protection");
  await page.goto(origin);
  await page.evaluate(() => { window.fixture.failMovies = true; });
  await search();
  await page.getByTestId("movie-collection-1241").locator(":scope > button").click();
  await page.getByRole("alert").waitFor();
  await page.evaluate(() => { window.fixture.failMovies = false; });
  await page.getByRole("button", { name: "Try again", exact: true }).click();
  await page.getByTestId("collection-movie-671").waitFor();
  await page.goto(origin);
  await page.evaluate(() => { window.fixture.failCollections = true; });
  await search();
  await page.getByText("Movie collections unavailable. Other search results are unaffected.", { exact: true }).waitFor();
  await page.getByTestId("media-search-result-movie-hp").click();
  assert.equal(await page.evaluate(() => window.fixture.selected.at(-1).external_id), "movie-hp");
  console.log("PASS movie lookup retry and ordinary selection when collection discovery fails");
  await page.goto(`${origin}/?legacy`);
  await search();
  await page.getByTestId("media-search-result-series-hp").click();
  assert.equal(await page.evaluate(() => window.fixture.selected.at(-1).type), "book_series");
  assert.equal(await page.evaluate(() => window.fixture.seriesRequests.length), 0);
  assert.equal(await page.evaluate(() => window.fixture.collectionRequests.length), 0);
  assert.deepEqual(errors, []);
  console.log("PASS other shared-search callers remain unchanged; no browser errors");
} finally {
  await browser.close();
  if (!serve) await new Promise(resolve => server.close(resolve));
}
if (serve) console.log(`Track series fixture ready at ${origin}`);
