import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { createServer } from "node:http";
import { build } from "esbuild";
import { chromium } from "playwright";

// Real Play page, activity hook, routing predicate, and social-proof cards.
// Double only account services and unrelated game modules; no real accounts or writes.
const doubles = {
  "@/lib/auth": 'export const useAuth=()=>({user:{id:"fixture-owner"},session:{access_token:"fixture-token"}});',
  "@/lib/supabase": 'export const supabase={auth:{getSession:async()=>({data:{session:null}})}};',
  "@/hooks/use-toast": 'export const useToast=()=>({toast:()=>{}});',
  "@/components/navigation": 'export default ()=>null;',
  "@/components/daily-hero-section": 'export const DailyHeroSection=()=>null;',
  "@/components/trivia-carousel": 'import React from "react";export const TriviaCarousel=()=> <div data-testid="trivia-game">Trivia game</div>;',
  "@/components/polls-carousel": 'export const PollsCarousel=()=>null;',
  "@/components/ranks-carousel": 'export const RanksCarousel=()=>null;',
  "@/components/seen-it-game": 'export default ()=>null;',
  "@/components/create-rank-dialog": 'export default ()=>null;',
  "@/components/quick-add-list-sheet": 'export const QuickAddListSheet=()=>null;',
};
const { outputFiles } = await build({
  stdin: { resolveDir: process.cwd(), loader: "tsx", contents: `
import React from "react";
import {createRoot} from "react-dom/client";
import {QueryClient,QueryClientProvider} from "@tanstack/react-query";
import PlayPage from "./client/src/pages/play";
window.fixture={requests:[],failActivity:location.search.includes("fail")};
window.fetch=async(url,init={})=>{
 const path=String(url);window.fixture.requests.push({path,body:JSON.parse(init.body||"{}")});
 if(path.includes("/manage-friendships"))return new Response(JSON.stringify({friends:[{friend:{id:"friend-1"}}]}));
 if(path.includes("/get-play-activity")){
  if(window.fixture.failActivity)return new Response("Unavailable",{status:503});
  return new Response(JSON.stringify({items:[
   {id:"lb-your-rank",text:"You're ranked #5 this week — Play Trivia to move up",link:"/play/trivia"},
   {id:"lb-books",text:"You've read 12 books this year",link:"/leaderboard?tab=consumption&category=books"},
   {id:"trivia-friend",text:"Your friend just played Trivia",link:"/play/trivia"},
   {id:"rating-clash-123",text:"Who rated this movie higher?",link:null,conflictData:{mediaTitle:"Movie"}}
  ]}));
 }
 throw Error("Unexpected request: "+path);
};
createRoot(document.getElementById("root")).render(<QueryClientProvider client={new QueryClient()}><PlayPage/></QueryClientProvider>);
` },
  bundle: true, write: false, jsx: "automatic",
  define: { "process.env.NODE_ENV": '"development"', "import.meta.env": JSON.stringify({ VITE_SUPABASE_URL: "https://fixture.invalid" }) },
  plugins: [{ name: "isolated-play-services", setup(api) {
    api.onResolve({ filter: /.*/ }, args => args.path in doubles ? { path: args.path, namespace: "double" } : undefined);
    api.onLoad({ filter: /.*/, namespace: "double" }, args => ({ contents: doubles[args.path], loader: "tsx", resolveDir: process.cwd() }));
  }}],
});
const cssFile = (await readdir("dist/public/assets")).find(name => /^index-.*\.css$/.test(name));
assert.ok(cssFile, "Run npm run build:app first");
const css = await readFile(`dist/public/assets/${cssFile}`);
const server = createServer((req, res) => {
  if (req.url === "/fixture.js") { res.setHeader("Content-Type", "text/javascript"); res.end(outputFiles[0].text); }
  else if (req.url === "/style.css") { res.setHeader("Content-Type", "text/css"); res.end(css); }
  else { res.setHeader("Content-Type", "text/html"); res.end('<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"><div id="root"></div><script src="/fixture.js"></script>'); }
});
await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  for (const viewport of [{ width: 390, height: 844 }, { width: 1280, height: 800 }]) {
    await page.setViewportSize(viewport);
    await page.goto(origin);
    const rank = page.getByText("You're ranked #5 this week — Play Trivia to move up", { exact: true });
    await rank.waitFor();
    await page.getByText("Your friend just played Trivia", { exact: true }).waitFor();
    assert.equal(await page.getByText("You've read 12 books this year", { exact: true }).count(), 0);
    assert.equal(await page.getByText("Who rated this movie higher?", { exact: true }).count(), 0);
    assert.equal(await rank.locator("xpath=ancestor::a").getAttribute("href"), "/play/trivia");
    assert.deepEqual(await page.evaluate(() => window.fixture.requests.find(r => r.path.includes("/get-play-activity")).body), { friendIds: ["friend-1"] });
    const nodes = await page.locator('#play-mode-panel > div').count();
    assert.ok(nodes > 1, "Prompts are interleaved with the game feed");
    await page.getByRole("tab", { name: "Trivia", exact: true }).click();
    assert.equal(await rank.count(), 0, "Dedicated game tabs do not duplicate All-feed prompts");
    await page.getByRole("tab", { name: "All", exact: true }).click();
    await rank.waitFor();
    assert.equal(await page.evaluate(() => window.fixture.requests.filter(r => r.path.includes("/get-play-activity")).length), 1, "Tab changes reuse the account-scoped activity cache");
    console.log(`PASS ${viewport.width}x${viewport.height}: real Play feed shows gameplay prompts, preserves links, excludes consumption, and caches tab changes`);
  }
  await page.goto(`${origin}/?fail`);
  // Fresh query key and retry are isolated to this browser page.
  await page.getByRole("button", { name: "Try again", exact: true }).waitFor();
  assert.ok(await page.getByTestId("trivia-game").count() > 0, "Game feed remains available during activity failures");
  await page.evaluate(() => { window.fixture.failActivity = false; });
  await page.getByRole("button", { name: "Try again", exact: true }).click();
  await page.getByText("You're ranked #5 this week — Play Trivia to move up", { exact: true }).waitFor();
  assert.deepEqual(errors, []);
  const feed = await readFile("client/src/pages/feed.tsx", "utf8");
  assert.match(feed, /activityItems\.filter\(item => !isGameplayActivity\(item\)\)/);
  assert.match(feed, /item\.conflictData\s*\?\s*renderPlayActivityCard\(item\)/);
  console.log("PASS failed update requests can be retried without hiding games; Now uses the complementary filter and preserves rating-conflict actions");
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}
