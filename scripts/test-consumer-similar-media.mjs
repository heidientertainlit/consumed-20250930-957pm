// Isolated browser contract check of the real consumer hook and unchanged cards.
// No real sessions, production writes, provider requests or model requests.
import assert from "node:assert/strict";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import path from "node:path";
import { createServer } from "vite";
import react from "@vitejs/plugin-react";
import { chromium } from "playwright";

const root = process.cwd(), temp = await mkdtemp(path.join(root, "node_modules/.cache/consumer-recs-"));
await writeFile(`${temp}/index.html`, '<div id="root"></div><script type="module" src="/entry.tsx"></script>');
await writeFile(`${temp}/entry.tsx`, `
import React,{useState} from "react";import{createRoot}from"react-dom/client";
import{QueryClient,QueryClientProvider}from"@tanstack/react-query";
import {useSimilarMedia} from "${root}/client/src/hooks/use-similar-media";
import Cards from "${root}/client/src/components/more-like-this";
import "${root}/client/src/index.css";
function Fixture(){
 const [id,setId]=useState("1236045"),[user,setUser]=useState("ordinary-account");
 const state=useSimilarMedia({userId:user||undefined,accessToken:user?"fixture-only":undefined,
 source:"tmdb",externalId:id,title:"Source title",type:"movie"});
 return <main style={{maxWidth:650,margin:"20px auto",padding:16}}>
 <button onClick={()=>setId("unprepared")}>Unprepared source</button>
 <button onClick={()=>setId("1236045")}>Prepared source</button>
 <button onClick={()=>setUser("")}>Sign out fixture</button>
 <button onClick={()=>setUser("another-ordinary-account")}>Other account</button>
 <Cards {...state}/></main>;
}
createRoot(document.getElementById("root")).render(<QueryClientProvider client={new QueryClient()}><Fixture/></QueryClientProvider>);
`);
const server = await createServer({
  configFile: false, root: temp, cacheDir: `${temp}/.vite`, plugins: [react()],
  optimizeDeps: { include: ["react", "react-dom/client", "react/jsx-dev-runtime", "@tanstack/react-query", "wouter", "lucide-react"] },
  resolve: { alias: [{ find: "@", replacement: `${root}/client/src` }] },
  css: { postcss: root },
  server: { host: "127.0.0.1", port: 5126, strictPort: true, fs: { allow: [root, temp] } },
});
let browser;
try {
  await server.listen();
  browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const calls = [], errors = [];
  page.on("pageerror", e => errors.push(e.message));
  await page.route("**/functions/v1/**", async route => {
    const url = route.request().url(), body = route.request().postDataJSON();
    calls.push({ url, body });
    if (url.endsWith("/conversational-search")) return route.fulfill({
      json: { recommendations: [{ title: "Existing path result", type: "movie" }] },
    });
    if (url.endsWith("/media-search")) return route.fulfill({
      json: { results: [{ title: "Existing path result", type: "movie", external_source: "tmdb", external_id: "888", poster_url: "" }] },
    });
    throw new Error(`Unexpected endpoint: ${url}`);
  });
  await page.goto("http://127.0.0.1:5126");
  await page.locator('[data-testid="more-like-this"] a').first().waitFor();
  assert.equal(calls.length, 0, "Prepared source must not generate/resolve recommendations");
  assert.equal(await page.locator("select").count(), 0, "No admin or comparison selector");
  assert.equal(await page.getByText(/Admin preview|CURRENT|Experimental/).count(), 0);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  const href = await page.locator('[data-testid="more-like-this"] a').first().getAttribute("href");
  assert.match(href, /^\/media\/(?:movie|tv|book|music|podcast)\//);
  await page.getByRole("button", { name: "Unprepared source", exact: true }).click();
  await page.getByText("Existing path result", { exact: true }).waitFor();
  assert.equal(calls.length, 2);
  assert.ok(calls[0].url.endsWith("/conversational-search"));
  assert.deepEqual(calls[1].body, { query: "Existing path result", type: "movie" });
  await page.getByRole("button", { name: "Prepared source", exact: true }).click();
  await page.getByText("Existing path result", { exact: true }).waitFor({ state: "hidden" });
  assert.equal(calls.length, 2, "Switching back must reuse saved recommendations");
  await page.getByRole("button", { name: "Sign out fixture", exact: true }).click();
  assert.equal(await page.locator('[data-testid="more-like-this"] a').count(), 0);
  await page.getByRole("button", { name: "Other account", exact: true }).click();
  await page.locator('[data-testid="more-like-this"] a').first().waitFor();
  assert.equal(calls.length, 2, "Ordinary accounts need no admin check or model request");
  await page.setViewportSize({ width: 1280, height: 800 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  assert.deepEqual(errors, []);
  console.log("PASS consumer cards: prepared zero-call path, ordinary accounts, existing fallback, source/account transitions, destinations, mobile/desktop.");
} finally {
  await browser?.close(); await server.close(); await rm(temp, { recursive: true, force: true });
}
