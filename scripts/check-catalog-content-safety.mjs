import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { createServer } from "node:http";
import { build } from "esbuild";
import { chromium } from "playwright";

// Real collection UI -> real HTTP handler -> real content policy.
// Only the catalog transport and account-free fixture host are substituted.
const backend = await build({
  entryPoints: ["server/movie-collections.ts"], bundle: true, write: false,
  format: "cjs", platform: "node",
});
const module = { exports: {} };
new Function("module", "exports", backend.outputFiles[0].text)(module, module.exports);
const calls = [];
const catalogFilms = [
  { id: 100, title: "The Office", adult: false, release_date: "2005-01-01" },
  { id: 200, title: "xXx", adult: false, release_date: "2002-01-01" },
  { id: 140971, title: "Love in the Bosses Office", adult: false, softcore: false, poster_path: "/soft-porn.jpg" },
  { id: 948855, title: "Love in the Bosses Office 2", adult: false, softcore: false, overview: "" },
];
const handler = module.exports.createMovieCollectionsHandler({
  apiKey: () => "fixture-only",
  modelKey: () => "fixture-only",
  fetcher: async (input, init) => {
    const url = new URL(String(input));
    calls.push(url.pathname);
    if (url.hostname === "api.openai.com") {
      const items = JSON.parse(JSON.parse(init.body).messages[1].content).items;
      return Response.json({ choices: [{ message: { content: JSON.stringify({ decisions: items.map(item => ({
        key: item.key, category: ["movie:140971", "movie:948855"].includes(item.key) ? "softcore_pornography" : "non_pornographic",
        confidence: "high", reason: "Fixture-reviewed catalog classification.",
      })) }) } }] });
    }
    if (/^\/3\/movie\/\d+$/.test(url.pathname)) return Response.json(catalogFilms.find(movie => String(movie.id) === url.pathname.split("/").at(-1)));
    if (url.pathname === "/3/search/collection") return Response.json({ results: [
      { id: 1024107, name: "The Office: A XXX Parody Collection", adult: false, poster_path: "/explicit.jpg" },
      { id: 11, name: "Flagged collection", adult: true, poster_path: "/flagged.jpg" },
      { id: 1164478, name: "Love in the Bosses Office Collection", adult: false, overview: "", poster_path: "/soft-porn.jpg" },
      { id: 10, name: "The Office Collection", adult: false },
      { id: 20, name: "xXx Collection", overview: "An action thriller franchise.", adult: false },
    ] });
    if (url.pathname === "/3/collection/1024107") return Response.json({
      id: 1024107, name: "The Office: A XXX Parody Collection", adult: false,
      poster_path: "/explicit.jpg", parts: [{ id: 666, title: "Private movie" }],
    });
    if (url.pathname === "/3/collection/10") return Response.json({
      id: 10, name: "The Office Collection", parts: [catalogFilms[0]],
    });
    if (url.pathname === "/3/collection/20") return Response.json({ id: 20, name: "xXx Collection", parts: [catalogFilms[1]] });
    if (url.pathname === "/3/collection/1164478") return Response.json({
      id: 1164478, name: "Love in the Bosses Office Collection", overview: "", adult: false, parts: catalogFilms.slice(2),
    });
    throw new Error(`Unexpected fixture catalog path: ${url.pathname}`);
  },
});
const frontend = await build({
  stdin: { resolveDir: process.cwd(), loader: "tsx", contents: `
    import React from "react";
    import {createRoot} from "react-dom/client";
    import {QueryClient, QueryClientProvider} from "@tanstack/react-query";
    import {MovieCollectionSearchResults} from "./client/src/components/movie-collection-search-results";
    import MediaSearchPanel from "./client/src/components/media-search-panel";
    const client=new QueryClient();
    // Prove pre-fix query-cache entries cannot restore blocked rows or films.
    client.setQueryData(["movie-collection-search","the office"],{collections:[
      {id:"1024107",title:"The Office: A XXX Parody Collection",image:"/explicit.jpg"}
    ]});
    client.setQueryData(["movie-collection-details","10"],{collection:{movies:[
      {external_id:"101",title:"The Office: A XXX Parody",type:"movie",image:"/explicit.jpg"}
    ]}});
    client.setQueryData(["movie-collection-search","adult-filter-v1","the office"],{collections:[
      {id:"1164478",title:"Love in the Bosses Office Collection",image:"/soft-porn.jpg"}
    ]});
    client.setQueryData(["movie-collection-details","adult-filter-v1","1164478"],{collection:{movies:[
      {external_id:"140971",title:"Love in the Bosses Office",type:"movie",image:"/soft-porn.jpg"}
    ]}});
    window.selected=[];
    const originalFetch=window.fetch.bind(window);
    window.fetch=(url,init)=>{
      // Ordinary media is a pre-screened fixture; the collection path below
      // still executes the real HTTP handler and real classification policy.
      if(String(url).includes("/functions/v1/media-search"))return Promise.resolve(Response.json({results:[
        {title:"The Office",type:"movie",external_id:"100",external_source:"tmdb"},
        {title:"xXx",type:"movie",external_id:"200",external_source:"tmdb"}
      ]}));
      return originalFetch(url,init);
    };
    createRoot(document.getElementById("root")).render(
      <QueryClientProvider client={client}><main className="mx-auto max-w-md bg-white p-4">
        <h1>Collection safety fixture</h1>
        {location.pathname==="/track"?<MediaSearchPanel autoFocus={false} expandableMovieCollections
          onSelect={movie=>window.selected.push(movie)}/>:<MovieCollectionSearchResults query="the office" enabled appearance="light"
          onOpenMedia={movie=>window.selected.push(movie)}
          onAddMedia={movie=>window.selected.push(movie)}/>}
      </main></QueryClientProvider>);
  ` },
  bundle: true, write: false, jsx: "automatic",
  define: {
    "process.env.NODE_ENV": '"development"',
    "import.meta.env": JSON.stringify({ VITE_SUPABASE_URL: "https://fixture.invalid", VITE_SUPABASE_ANON_KEY: "fixture", DEV: false }),
  },
  plugins: [{ name: "fixture-relative-api", setup(api) {
    api.onResolve({ filter: /^@\/lib\/share$/ }, () => ({ path: "share", namespace: "fixture" }));
    api.onResolve({ filter: /^@\/lib\/auth$/ }, () => ({ path: "auth", namespace: "fixture" }));
    api.onLoad({ filter: /.*/, namespace: "fixture" }, args => ({
      contents: args.path === "auth" ? 'export const useAuth=()=>({session:{access_token:"fixture-only"}});'
        : "export const appApiUrl = path => path;", loader: "js",
    }));
  } }],
});
const cssName = (await readdir("dist/public/assets")).find(name => /^index-.*\.css$/.test(name));
assert.ok(cssName, "Build app CSS before this check");
const css = await readFile(`dist/public/assets/${cssName}`);
const server = createServer(async (req, res) => {
  const url = new URL(req.url, "http://fixture.invalid");
  if (url.pathname === "/api/movie-collections") {
    const response = {
      setHeader: (name, value) => res.setHeader(name, value),
      status: status => { res.statusCode = status; return response; },
      json: body => { res.setHeader("Content-Type", "application/json"); res.end(JSON.stringify(body)); },
      end: () => res.end(),
    };
    await handler({ method: req.method, query: Object.fromEntries(url.searchParams) }, response);
  } else if (url.pathname === "/fixture.js") {
    res.setHeader("Content-Type", "text/javascript"); res.end(frontend.outputFiles[0].text);
  } else if (url.pathname === "/style.css") {
    res.setHeader("Content-Type", "text/css"); res.end(css);
  } else {
    res.setHeader("Content-Type", "text/html");
    res.end('<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"><body><div id="root"></div><script src="/fixture.js"></script>');
  }
});
await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
let browser;
try {
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const errors = [], blockedArtworkRequests = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.route("**/*", route => {
    const url = route.request().url();
    if (/explicit\.jpg|flagged\.jpg|soft-porn\.jpg/.test(url)) blockedArtworkRequests.push(url);
    return url.startsWith(origin) ? route.continue() : route.abort();
  });
  for (const viewport of [{ width: 390, height: 844 }, { width: 1280, height: 800 }]) {
   for (const surface of ["/", "/track"]) {
    await page.setViewportSize(viewport);
    await page.goto(origin + surface);
    if (surface === "/track") await page.getByTestId("media-search-input").fill("the office");
    await page.getByTestId("movie-collection-10").waitFor();
    if (surface === "/") await page.getByTestId("movie-collection-20").waitFor();
    else {
      assert.equal(await page.getByTestId("movie-collection-search-results").count(), 0);
      assert.equal(await page.getByText("Movie collections", { exact: true }).count(), 0);
      const order = await page.getByTestId("media-search-results").locator(":scope > [data-testid]")
        .evaluateAll(nodes => nodes.map(node => node.getAttribute("data-testid")));
      assert.deepEqual(order, ["media-search-result-100", "movie-collection-10", "media-search-result-200"]);
    }
    assert.equal(await page.getByTestId("movie-collection-1024107").count(), 0);
    assert.equal(await page.getByTestId("movie-collection-1164478").count(), 0);
    await page.getByTestId("movie-collection-10").locator(":scope > button").click();
    await page.getByTestId("collection-movie-100").waitFor();
    assert.equal(await page.getByTestId("collection-movie-101").count(), 0);
    assert.equal(await page.getByTestId("collection-movie-102").count(), 0);
    await page.getByRole("button", { name: "Add The Office to a list", exact: true }).click();
    assert.equal(await page.evaluate(() => window.selected.at(-1).external_id), "100");
    assert.doesNotMatch(await page.locator("body").innerText(), /parody|flagged|Bosses Office/i);
    console.log(`PASS ${surface === "/track" ? "Track mixed list" : "collection surface"} ${viewport.width}x${viewport.height}: server-filtered titles, expansion, selection, and legacy client-cache isolation`);
   }
  }
  const direct = await fetch(`${origin}/api/movie-collections?collectionId=1024107`);
  assert.equal(direct.status, 404);
  assert.deepEqual(await direct.json(), { error: "Collection unavailable" });
  const softDirect = await fetch(`${origin}/api/movie-collections?collectionId=1164478`);
  assert.equal(softDirect.status, 404);
  assert.deepEqual(await softDirect.json(), { error: "Collection unavailable" });
  assert.deepEqual(blockedArtworkRequests, []);
  assert.deepEqual(errors, []);
  assert.equal(calls.filter(path => path === "/3/search/collection").length, 1);
  assert.equal(calls.filter(path => path === "/3/collection/10").length, 2);
  console.log("PASS blocked direct-ID response, no blocked artwork requests, and filtered server-cache reuse");
} finally {
  await browser?.close();
  await new Promise(resolve => server.close(resolve));
}
