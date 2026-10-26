// Isolated full MediaDetail browser fixture. All transport is controlled below;
// unexpected requests fail loudly and no production writes/services are used.
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
const temp = await mkdtemp(path.join(tmpdir(), "media-detail-conversation-"));
const outfile = path.join(temp, "fixture.js");
const artwork = "data:image/svg+xml," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="240" height="360"><rect width="240" height="360" fill="#564294"/></svg>');
const entry = `
import React from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import MediaDetail from "@/pages/media-detail";
window.fx = { auth:{user:{id:"fixture-user"},session:{access_token:"fixture-token",user:{id:"fixture-user"}},loading:false}, votes:[], replies:[], unexpected:[] };
const client=new QueryClient({defaultOptions:{queries:{retry:false,refetchOnWindowFocus:false}}});
createRoot(document.getElementById("root")).render(<QueryClientProvider client={client}><MediaDetail/></QueryClientProvider>);
`;
const auth = `export const useAuth=()=>({...window.fx.auth,signOut:async()=>({})});`;
const database = `
export const SUPABASE_ANON_KEY="fixture-token";
export const supabase={
 auth:{getUser:async()=>({data:{user:window.fx.auth.user}}),getSession:async()=>({data:{session:window.fx.auth.session}})},
 from:table=>query(table),rpc:()=>Promise.resolve({data:null,error:null}),
 functions:{invoke:async()=>({data:{},error:null})},
 channel(){const c={on(){return c},subscribe(){return c},unsubscribe(){return c}};return c},removeChannel(){}
};
function query(table){const state={single:false};const proxy=new Proxy({}, {get(_,key){
 if(key==="then")return(resolve,reject)=>{let data=[];
  if(table==="list_items"&&!location.search.includes("untracked"))data=[{id:"fixture-list-item",list_id:"want-list",title:"The Terminal List",lists:{id:"want-list",title:"Want To",is_default:true}}];
  if(table==="media_ratings"&&!location.search.includes("untracked"))data=[{id:"own-rating",user_id:"fixture-user",rating:4.5,created_at:"2026-01-01"}];
  if(table==="social_posts")data=[{id:"take-1",user_id:"other-user",post_type:"thought",rating:4.5,content:"The quiet tension is what stayed with me.",created_at:"2026-01-01T12:00:00Z",likes_count:3,comments_count:2,visibility:"public",users:{display_name:"Avery Park",user_name:"avery"}}];
  if(table==="public_user_profiles")data=[];
  return Promise.resolve({data:state.single?(data[0]||null):data,error:null}).then(resolve,reject)};
 if(key==="single"||key==="maybeSingle") {state.single=true;return()=>proxy}
 if(key==="insert"||key==="upsert"||key==="delete"||key==="update")return()=>({select:()=>proxy,then:resolve=>resolve({data:[],error:null})});
 return()=>proxy;
 }});return proxy}
`;
let browser, server;
try {
  await build({
    stdin: { contents: entry, resolveDir: root, sourcefile: "media-detail-fixture.tsx", loader: "tsx" },
    outfile, bundle: true, platform: "browser", format: "esm", jsx: "automatic",
    define: { "process.env.NODE_ENV": '"development"', "import.meta.env": '{}', "import.meta.env.VITE_SUPABASE_URL": '"https://fixture.invalid"', "import.meta.env.VITE_SUPABASE_ANON_KEY": '"fixture-token"' },
    loader: { ".png": "dataurl", ".jpg": "dataurl", ".svg": "dataurl", ".css": "empty" },
    plugins: [{
      name: "fixture-aliases",
      setup(builder) {
        builder.onResolve({ filter: /(?:^|\/)(?:auth|supabase|use-blocked-users|use-dna-archetype)$/ }, args => ({ path: args.path, namespace: "fixture" }));
        builder.onLoad({ filter: /.*/, namespace: "fixture" }, args => ({
          contents: args.path.endsWith("/auth") ? auth : args.path.endsWith("/supabase") ? database :
            args.path.endsWith("use-blocked-users") ? "export const useBlockedUsers=()=>({data:[],isSuccess:true});" :
              "export const useDnaArchetype=()=>({archetypeKey:null});",
          loader: "js", resolveDir: root,
        }));
        builder.onResolve({ filter: /^@\// }, args => {
          const base = path.join(root, "client/src", args.path.slice(2));
          return { path: [base, ...[".ts", ".tsx", ".js", "/index.ts", "/index.tsx"].map(ext => base + ext)].find(existsSync) || base };
        });
      },
    }],
  });
  const js = await readFile(outfile);
  const cssPath = path.join(temp, "fixture.css");
  execFileSync(process.execPath, ["node_modules/tailwindcss/lib/cli.js", "-i", "client/src/index.css", "-o", cssPath], { cwd: root, stdio: "pipe" });
  const css = await readFile(cssPath);
  server = createServer((req, res) => {
    if (req.url === "/fixture.js") { res.setHeader("Content-Type", "text/javascript"); res.end(js); }
    else if (req.url === "/fixture.css") { res.setHeader("Content-Type", "text/css"); res.end(css); }
    else { res.setHeader("Content-Type", "text/html"); res.end('<meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/fixture.css"><div id="root"></div><script type="module" src="/fixture.js"></script>'); }
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  const errors = [];
  const replyRequests = [];
  let fixtureVote = { userVote: "up", upVoteCount: 2, downVoteCount: 0 };
  let failNextVote = false;
  page.on("pageerror", error => errors.push(error.message));
  await page.route("**/*", async route => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin === origin) return route.continue();
    if (url.pathname.endsWith("/get-media-details")) return route.fulfill({ json: { title: "The Terminal List", type: "tv", creator: "Jack Carr", artwork, description: "A Navy SEAL investigates a conspiracy.", external_id: "120911", external_source: "tmdb", totalSeasons: 1 } });
    if (url.pathname.endsWith("/get-user-lists-with-media")) return route.fulfill({ json: { lists: [{ title: "Currently", items: [] }] } });
    if (url.pathname.endsWith("/score-media-match")) return route.fulfill({ json: { score: 83 } });
    if (url.pathname.endsWith("/calculate-user-points")) return route.fulfill({ json: { points: 0, total_points: 0 } });
    if (url.pathname.endsWith("/get-user-lists-metadata")) return route.fulfill({ json: { lists: [] } });
    if (url.pathname.endsWith("/get-user-ranks")) return route.fulfill({ json: { ranks: [] } });
    if (url.pathname.endsWith("/manage-friendships")) return route.fulfill({ json: { success: true, friendships: [] } });
    if (url.pathname.endsWith("/media-similarity")) return route.fulfill({ json: { items: [
      { title: "Reacher", type: "tv", external_source: "tmdb", external_id: "108978", poster_url: artwork },
      { title: "Jack Carr's next book", type: "book", external_source: "openlibrary", external_id: "OLTESTW", poster_url: artwork },
    ], preparing: false } });
    if (url.pathname.endsWith("/conversational-search")) return route.fulfill({ json: { recommendations: [] } });
    if (url.pathname.endsWith("/media-search")) return route.fulfill({ json: { results: [] } });
    if (url.pathname.endsWith("/social-feed-comments") && request.method() === "GET") {
      const deepReplies = Array.from({ length: 12 }, (_, index) => ({
        id: 300 + index, user_id: "deep-user", display_name: `Deep reply ${index + 1}`,
        content: `Deep reply ${index + 1}`, replies: [],
      }));
      const deepParent = { id: 201, user_id: "deep-parent", display_name: "Deep parent", content: "Deep parent comment", replies: [] };
      let deepCursor = deepParent;
      for (let index = 1; index <= 7; index += 1) {
        const next = { id: 201 + index, user_id: "deep-chain", display_name: `Deep chain ${index}`, content: `Deep chain ${index}`, replies: [] };
        deepCursor.replies = [next];
        deepCursor = next;
      }
      deepCursor.replies = deepReplies;
      const children = Array.from({ length: 12 }, (_, index) => ({
        id: 100 + index, user_id: "child-user", display_name: `Child ${index + 1}`,
        content: `Child reply ${index + 1}`,
        replies: index === 0 ? [deepParent] : [],
      }));
      const comments = [{
        id: 71, post_id: "take-1", user_id: "reply-user", display_name: "Riley Chen", avatar: "",
        content: "That pacing made the finale land.", created_at: "2026-01-02T12:00:00Z",
        upVoteCount: fixtureVote.upVoteCount, downVoteCount: fixtureVote.downVoteCount,
        currentUserVote: fixtureVote.userVote, replies: children,
      }, ...Array.from({ length: 22 }, (_, index) => ({
        id: 80 + index, user_id: "root-user", display_name: `Root reply ${index + 2}`,
        content: `Root reply ${index + 2}`, replies: [],
      }))];
      return route.fulfill({ json: { comments } });
    }
    if (url.pathname.endsWith("/social-feed-comments") && request.method() === "POST") {
      const payload = request.postDataJSON();
      replyRequests.push(payload);
      await route.fulfill({ json: { comment: { id: 73, ...payload } } });
      return;
    }
    if (url.pathname.endsWith("/comment-vote")) {
      await page.evaluate(({ method, body }) => window.fx.votes.push({ method, ...JSON.parse(body) }), { method: request.method(), body: request.postData() || "{}" });
      if (failNextVote) {
        failNextVote = false;
        return route.fulfill({ status: 500, body: "Fixture vote failure" });
      }
      const direction = request.postDataJSON().direction;
      const previousVote = fixtureVote.userVote;
      let action = "created";
      if (request.method() === "DELETE") {
        action = "removed";
        fixtureVote = { ...fixtureVote, userVote: null, upVoteCount: direction === "up" ? fixtureVote.upVoteCount - 1 : fixtureVote.upVoteCount, downVoteCount: direction === "down" ? fixtureVote.downVoteCount - 1 : fixtureVote.downVoteCount };
      } else if (fixtureVote.userVote === direction) {
        action = "removed";
        fixtureVote = { ...fixtureVote, userVote: null, upVoteCount: direction === "up" ? fixtureVote.upVoteCount - 1 : fixtureVote.upVoteCount, downVoteCount: direction === "down" ? fixtureVote.downVoteCount - 1 : fixtureVote.downVoteCount };
      } else {
        action = previousVote ? "updated" : "created";
        fixtureVote = {
          userVote: direction,
          upVoteCount: fixtureVote.upVoteCount + (direction === "up" ? 1 : 0) - (fixtureVote.userVote === "up" ? 1 : 0),
          downVoteCount: fixtureVote.downVoteCount + (direction === "down" ? 1 : 0) - (fixtureVote.userVote === "down" ? 1 : 0),
        };
      }
      return route.fulfill({ json: { success: true, action, ...fixtureVote, voteScore: fixtureVote.upVoteCount - fixtureVote.downVoteCount } });
    }
    if (url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com") {
      return route.fulfill({ status: 200, contentType: "text/css", body: "" });
    }
    await page.evaluate(({ requestUrl, method }) => window.fx.unexpected.push({ requestUrl, method }), { requestUrl: request.url(), method: request.method() });
    return route.fulfill({ status: 501, json: { error: "Unexpected fixture request" } });
  });

  await page.goto(`${origin}/media/tv/tmdb/120911`);
  await page.getByTestId("media-hero-actions").waitFor();
  await page.getByRole("heading", { name: "The Terminal List" }).waitFor();
  assert.equal(await page.getByTestId("button-hero-rate").innerText().then(text => text.includes("4.5")), true);
  assert.equal(await page.getByTestId("button-hero-add-to-list").innerText().then(text => text.includes("Want To")), true);
  await page.getByTestId("more-like-this").getByText("Reacher", { exact: true }).waitFor();
  const sectionOrder = await page.evaluate(() => {
    const y = selector => document.querySelector(selector).getBoundingClientRect().top;
    return [y('[data-testid="media-hero-actions"]'), y('[data-testid="more-like-this"]'), y('[data-testid="tab-takes"]')];
  });
  assert.ok(sectionOrder[0] < sectionOrder[1] && sectionOrder[1] < sectionOrder[2], "Hero actions, recommendations, then tabs");
  await page.screenshot({ path: "/tmp/consumed-media-detail-phone.png", fullPage: true });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({ path: "/tmp/consumed-media-detail-desktop.png", fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByTestId("button-hero-add-to-list").click();
  await page.getByRole("dialog").waitFor();
  await page.keyboard.press("Escape");

  await page.getByTestId("button-hero-rate").click();
  await page.getByRole("textbox", { name: "" }).last().waitFor();
  await page.getByTestId("tab-play").click();
  await page.getByTestId("button-hero-rate").click();
  assert.equal(await page.locator("textarea").last().isVisible(), true, "Rate also opens the composer from Play");
  await page.getByTestId("tab-takes").click();
  const prompt = page.getByRole("button", { name: "What stayed with you after this?" });
  await prompt.click();
  const composer = page.locator('[data-testid="conversation-starter-prompts"]').locator("..").locator("..");
  const textArea = page.locator("textarea").last();
  await page.waitForFunction(() => document.querySelectorAll("textarea").length > 0);
  await textArea.fill("My unsent thought should stay here.");
  await page.getByRole("button", { name: "I didn't expect…" }).click();
  assert.equal(await textArea.inputValue(), "My unsent thought should stay here.");
  assert.ok(await composer.count());
  await textArea.fill("An opening thought worth sharing.");
  await page.getByRole("button", { name: "Post", exact: true }).click();
  await page.getByTestId("button-open-composer").waitFor();
  await page.getByTestId("button-open-composer").click();
  assert.equal(await page.locator("textarea").last().inputValue(), "");

  await page.getByTestId("take-toggle-take-1").click();
  await page.getByText("That pacing made the finale land.", { exact: true }).waitFor();
  await page.getByText("Child reply 10", { exact: true }).waitFor();
  await page.getByTestId("take-card-take-1").evaluate(element => element.scrollIntoView({ block: "start" }));
  await page.screenshot({ path: "/tmp/consumed-media-detail-thread-phone.png" });
  await page.getByTestId("thread-more-root-take-1").click();
  await page.getByText("Root reply 23", { exact: true }).waitFor();
  await page.getByTestId("thread-more-71").click();
  await page.getByText("Child reply 12", { exact: true }).waitFor();
  await page.getByText("Deep parent comment", { exact: true }).waitFor();
  await page.getByText("Deep chain 7", { exact: true }).waitFor();
  await page.getByTestId("thread-more-208").click();
  await page.getByText("Deep reply 12", { exact: true }).waitFor();
  const upVote = page.getByTestId("comment-vote-up-71");
  const downVote = page.getByTestId("comment-vote-down-71");
  assert.equal(await upVote.getAttribute("aria-pressed"), "true");
  assert.match(await upVote.innerText(), /2/);
  failNextVote = true;
  await downVote.click();
  await page.waitForFunction(() => window.fx.votes.some(vote => vote.comment_id === "71" && vote.direction === "down" && vote.method === "POST"));
  await page.waitForFunction(() => document.querySelector('[data-testid="comment-vote-down-71"]')?.disabled === false);
  assert.equal(await upVote.getAttribute("aria-pressed"), "true");
  assert.equal(await downVote.getAttribute("aria-pressed"), "false");
  await downVote.click();
  await page.waitForFunction(() => window.fx.votes.filter(vote => vote.comment_id === "71" && vote.direction === "down" && vote.method === "POST").length >= 1);
  await page.waitForFunction(() => document.querySelector('[data-testid="comment-vote-down-71"]')?.getAttribute("aria-pressed") === "true");
  assert.match(await upVote.innerText(), /1/);
  assert.match(await downVote.innerText(), /1/);
  await upVote.click();
  await page.waitForFunction(() => document.querySelector('[data-testid="comment-vote-up-71"]')?.getAttribute("aria-pressed") === "true");
  assert.match(await upVote.innerText(), /2/);
  assert.doesNotMatch(await downVote.innerText(), /0/);
  await upVote.click();
  await page.waitForFunction(() => window.fx.votes.some(vote => vote.comment_id === "71" && vote.direction === "up" && vote.method === "DELETE"));
  await page.waitForFunction(() => document.querySelector('[data-testid="comment-vote-up-71"]')?.getAttribute("aria-pressed") === "false");
  await page.getByTestId("comment-reply-71").click();
  await page.getByTestId("comment-reply-input-71").fill("A reply from the fixture.");
  await page.getByTestId("comment-reply-send-71").click();
  await page.waitForFunction(() => document.querySelector('[data-testid="comment-reply-input-71"]') === null);
  assert.deepEqual(replyRequests.at(-1), { post_id: "take-1", content: "A reply from the fixture.", parent_comment_id: 71 });
  await page.setViewportSize({ width: 375, height: 800 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await page.goto(`${origin}/media/tv/tmdb/120911?untracked`);
  await page.getByTestId("media-hero-actions").waitFor();
  assert.equal(await page.getByTestId("button-hero-rate").innerText(), "Rate this title");
  assert.match(await page.getByTestId("button-hero-add-to-list").innerText(), /Add to my list/);
  assert.deepEqual(errors, []);
  const unexpected = await page.evaluate(() => window.fx.unexpected);
  assert.deepEqual(unexpected, []);
  console.log("PASS full media-detail hero, prompt draft preservation, tabs, expandable deep threads, authoritative thumb votes/replies, and mobile width (isolated transport).");
  console.log("Screenshots: /tmp/consumed-media-detail-phone.png and /tmp/consumed-media-detail-desktop.png");
} finally {
  await browser?.close();
  await new Promise(resolve => server ? server.close(resolve) : resolve());
  await rm(temp, { recursive: true, force: true });
}
