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
const handler = module.exports.createMovieCollectionsHandler({
  apiKey: () => "fixture-only",
  fetcher: async input => {
    const url = new URL(String(input));
    calls.push(url.pathname);
    if (url.pathname === "/3/search/collection") return Response.json({ results: [
      { id: 1024107, name: "The Office: A XXX Parody Collection", adult: false, poster_path: "/explicit.jpg" },
      { id: 11, name: "Flagged collection", adult: true, poster_path: "/flagged.jpg" },
      { id: 10, name: "The Office Collection", adult: false },
      { id: 20, name: "xXx Collection", overview: "An action thriller franchise.", adult: false },
    ] });
    if (url.pathname === "/3/collection/1024107") return Response.json({
      id: 1024107, name: "The Office: A XXX Parody Collection", adult: false,
      poster_path: "/explicit.jpg", parts: [{ id: 666, title: "Private movie" }],
    });
    if (url.pathname === "/3/collection/10") return Response.json({
      id: 10, name: "The Office Collection", parts: [
        { id: 100, title: "The Office", adult: false, release_date: "2005-01-01" },
        { id: 101, title: "The Office: A XXX Parody", adult: false, poster_path: "/explicit.jpg" },
        { id: 102, title: "Flagged movie", adult: true, poster_path: "/flagged.jpg" },
      ],
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
    const client=new QueryClient();
    // Prove pre-fix query-cache entries cannot restore blocked rows or films.
    client.setQueryData(["movie-collection-search","the office"],{collections:[
      {id:"1024107",title:"The Office: A XXX Parody Collection",image:"/explicit.jpg"}
    ]});
    client.setQueryData(["movie-collection-details","10"],{collection:{movies:[
      {external_id:"101",title:"The Office: A XXX Parody",type:"movie",image:"/explicit.jpg"}
    ]}});
    window.selected=[];
    createRoot(document.getElementById("root")).render(
      <QueryClientProvider client={client}><main className="mx-auto max-w-md bg-white p-4">
        <h1>Collection safety fixture</h1>
        <MovieCollectionSearchResults query="the office" enabled appearance="light"
          onOpenMedia={movie=>window.selected.push(movie)}
          onAddMedia={movie=>window.selected.push(movie)}/>
      </main></QueryClientProvider>);
  ` },
  bundle: true, write: false, jsx: "automatic",
  define: { "process.env.NODE_ENV": '"development"' },
  plugins: [{ name: "fixture-relative-api", setup(api) {
    api.onResolve({ filter: /^@\/lib\/share$/ }, () => ({ path: "share", namespace: "fixture" }));
    api.onLoad({ filter: /.*/, namespace: "fixture" }, () => ({
      contents: "export const appApiUrl = path => path;", loader: "js",
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
    if (/explicit\.jpg|flagged\.jpg/.test(url)) blockedArtworkRequests.push(url);
    return url.startsWith(origin) ? route.continue() : route.abort();
  });
  for (const viewport of [{ width: 390, height: 844 }, { width: 1280, height: 800 }]) {
    await page.setViewportSize(viewport);
    await page.goto(origin);
    await page.getByTestId("movie-collection-10").waitFor();
    await page.getByTestId("movie-collection-20").waitFor();
    assert.equal(await page.getByTestId("movie-collection-1024107").count(), 0);
    await page.getByTestId("movie-collection-10").locator(":scope > button").click();
    await page.getByTestId("collection-movie-100").waitFor();
    assert.equal(await page.getByTestId("collection-movie-101").count(), 0);
    assert.equal(await page.getByTestId("collection-movie-102").count(), 0);
    await page.getByRole("button", { name: "Add The Office to a list", exact: true }).click();
    assert.equal(await page.evaluate(() => window.selected.at(-1).external_id), "100");
    assert.doesNotMatch(await page.locator("body").innerText(), /parody|flagged/i);
    console.log(`PASS ${viewport.width}x${viewport.height}: server-filtered titles, expansion, selection, and legacy client-cache isolation`);
  }
  const direct = await fetch(`${origin}/api/movie-collections?collectionId=1024107`);
  assert.equal(direct.status, 404);
  assert.deepEqual(await direct.json(), { error: "Collection unavailable" });
  assert.deepEqual(blockedArtworkRequests, []);
  assert.deepEqual(errors, []);
  assert.equal(calls.filter(path => path === "/3/search/collection").length, 1);
  assert.equal(calls.filter(path => path === "/3/collection/10").length, 1);
  console.log("PASS blocked direct-ID response, no blocked artwork requests, and filtered server-cache reuse");
} finally {
  await browser?.close();
  await new Promise(resolve => server.close(resolve));
}
