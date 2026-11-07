import assert from "node:assert/strict";
import { createServer } from "node:http";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import { chromium } from "playwright";
import autoprefixer from "autoprefixer";
import postcss from "postcss";
import tailwindcss from "tailwindcss";

// Production QuickTrackSheet + MediaSearchPanel, with isolated service doubles.
// No application auth bypass, credentials, real writes or installed-app claims.
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const temp = await mkdtemp(join(tmpdir(), "quick-track-position-"));
let browser, server;
try {
  const entry = join(temp, "entry.tsx");
  await writeFile(entry, `
    import React, { useState } from "react";
    import { createRoot } from "react-dom/client";
    import { QuickTrackSheet } from ${JSON.stringify(join(root, "client/src/components/quick-track-sheet.tsx"))};
    import Navigation from ${JSON.stringify(join(root, "client/src/components/navigation.tsx"))};
    import FeedComposerBar from ${JSON.stringify(join(root, "client/src/components/feed-composer-bar.tsx"))};
    window.__fixture = {
      platform: new URLSearchParams(location.search).get("platform") || "web",
      session: { access_token: "fixture-token", user: { id: "fixture-user" } },
      requests: [], toasts: [], invalidations: [], closes: 0
    };
    window.__fixture.navMedia = [
      { title: "Fixture YouTube", type: "youtube", media_subtype: "channel", external_id: "UCfixture", external_source: "youtube",
        image_url: "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==", creator: "Fixture creator" },
      { title: "Fixture TV", type: "tv", external_id: "fixture-tv", external_source: "tmdb", year: 2026 },
    ];
    window.__fixture.trending = [{
      title: "Fixture Browse", media_type: "movie", external_id: "browse-123",
      external_source: "tmdb", image_url: "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==",
    }];
    window.fetch = async (url, init={}) => {
      if (String(url).startsWith("https://mahpgcogwpawvviapqza.supabase.co/functions/v1/calculate-user-points?"))
        return new Response(JSON.stringify({ total_points: 0 }));
      if (!String(url).startsWith("https://fixture.invalid/")) throw Error("Unexpected network request");
      const body = JSON.parse(init.body || "{}");
      window.__fixture.requests.push({ url: String(url), body });
      if (String(url).endsWith("/media-search")) return new Response(JSON.stringify({
        results: [{ title: "Fixture title", type: body.type || "movie",
          external_id: "fixture-title", external_source: body.type === "book" ? "openai" : "fixture", year: "2026",
          image_url: "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==",
          creator: "Fixture creator" }]
      }));
      if (String(url).endsWith("/track-media")) return new Response("{}");
      if (String(url).includes("/get-media-details?")) return new Response(JSON.stringify({ seasons: [] }));
      throw Error("Unhandled fixture endpoint");
    };
    function Fixture() {
      const [open, setOpen] = useState(true);
      if (new URLSearchParams(location.search).get("entry") === "navigation") return <Navigation />;
      if (new URLSearchParams(location.search).get("entry") === "add") return <FeedComposerBar pageMode />;
      return <><button data-testid="reopen" onClick={() => setOpen(true)}>Reopen</button>
        <QuickTrackSheet isOpen={open} onClose={() => { window.__fixture.closes++; setOpen(false); }} />
      </>;
    }
    createRoot(document.getElementById("root")).render(<Fixture />);
  `);
  const doubles = {
    "@/lib/auth": `export const useAuth=()=>({session:window.__fixture.session,user:window.__fixture.session.user});`,
    "@/hooks/use-toast": `export const useToast=()=>({toast:x=>window.__fixture.toasts.push(x)});`,
    "@/lib/posthog": `export const trackEvent=()=>{};`,
    "@/lib/queryClient": `export const queryClient={invalidateQueries:async x=>window.__fixture.invalidations.push(x)};`,
    "@/lib/supabase": `
      const read=()=>new Proxy({}, {get:(_,key)=>key==="then"
        ? resolve=>Promise.resolve({data:[],error:null}).then(resolve) : read});
      export const supabase={from:table=>table==="social_posts"
        ? {insert:()=>{throw Error("Unexpected database write")}} : read()};
    `,
    "@capacitor/core": `export const Capacitor={getPlatform:()=>window.__fixture.platform};`,
    "@tanstack/react-query": `
      export const useQuery=opts=>({data:opts.queryKey?.[0]==="inline-media-search" && opts.enabled ? window.__fixture.navMedia : [],isLoading:false,status:"success"});
      export const useQueryClient=()=>({prefetchQuery:async()=>{},invalidateQueries:async()=>{}});
      export const useMutation=()=>({mutate:()=>{throw Error("Unexpected navigation mutation")},isPending:false});
    `,
    "@/lib/feature-flags": `export const useFeatureFlags=()=>({roomsEnabled:false});`,
    "./notification-bell": `export const NotificationBell=()=>null;`,
    "./feedback-dialog": `export const FeedbackDialog=()=>null;`,
    "./quick-add-list-sheet": `export const QuickAddListSheet=()=>null;`,
    "./save-media-sheet": `export const SaveMediaSheet=()=>null;`,
    "@/components/navigation": `export default function Navigation(){return null}`,
    "@/components/quick-add-list-sheet": `export const QuickAddListSheet=()=>null;`,
    "@/lib/share": `export const APP_BASE="https://fixture.invalid";`,
    "@/components/follow-creators-card": `export default function FollowCreatorsCard(){return null}`,
    "@/components/room-composer": `export const DISCUSSION_TAGS=[]; export default function RoomComposer(){return null}`,
    "@/components/use-trending-content": `export const useTrendingContent=()=>({data:window.__fixture.trending,isLoading:false,isError:false,refetch:async()=>{}});`,
    "@/components/trending-selection": `export const selectTrendingItems=items=>items;`,
  };
  await build({
    entryPoints: [entry], outfile: join(temp, "bundle.js"), bundle: true,
    format: "iife", platform: "browser", jsx: "automatic", absWorkingDir: root,
    nodePaths: [join(root, "node_modules")],
    define: {
      "import.meta.env.VITE_SUPABASE_URL": JSON.stringify("https://fixture.invalid"),
      "import.meta.env.VITE_SUPABASE_ANON_KEY": JSON.stringify("fixture-anon"),
    },
    plugins: [{ name: "isolated-services", setup(api) {
      api.onResolve({ filter: /.*/ }, args => args.path in doubles
        ? { path: args.path, namespace: "double" } : undefined);
      api.onLoad({ filter: /.*/, namespace: "double" }, args => ({ contents: doubles[args.path], loader: "js" }));
      api.onResolve({ filter: /^@\// }, args => {
        const base = join(root, "client/src", args.path.slice(2));
        return { path: existsSync(`${base}.tsx`) ? `${base}.tsx` : `${base}.ts` };
      });
    } }],
  });
  const styles = await postcss([tailwindcss({ config: join(root, "tailwind.config.ts") }), autoprefixer])
    .process(await readFile(join(root, "client/src/index.css"), "utf8"), {
      from: join(root, "client/src/index.css"),
    });
  await writeFile(join(temp, "styles.css"), styles.css);
  server = createServer(async (req, res) => {
    if (req.url === "/bundle.js") { res.setHeader("Content-Type", "text/javascript"); res.end(await readFile(join(temp, "bundle.js"))); }
    else if (req.url === "/styles.css") { res.setHeader("Content-Type", "text/css"); res.end(await readFile(join(temp, "styles.css"))); }
    else { res.setHeader("Content-Type", "text/html"); res.end('<meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/styles.css"><div id="root"></div><script src="/bundle.js"></script>'); }
  });
  await new Promise(resolveListen => server.listen(0, "127.0.0.1", resolveListen));
  browser = await chromium.launch({ executablePath: "/repl/tools/bin/chromium", args: ["--no-sandbox"] });
  const page = await browser.newPage({ viewport: { width: 440, height: 960 } });
  const errors = [];
  page.on("pageerror", error => { errors.push(error.message); console.error("Fixture page error:", error.message); });
  const card = page.locator("div.absolute.left-4.right-4.bg-white");
  const top = async () => (await card.boundingBox()).y;
  const input = page.getByTestId("media-search-input");
  const openPlatform = async platform => {
    await page.setViewportSize({ width: 440, height: 960 });
    await page.goto(`http://127.0.0.1:${server.address().port}/?platform=${platform}`);
    await input.waitFor();
  };

  await openPlatform("ios");
  assert.equal(await top(), 115);
  assert.equal(await input.evaluate(n => document.activeElement === n), true);
  for (const height of [820, 700, 610, 660, 610]) {
    await page.setViewportSize({ width: 440, height });
    assert.equal(await top(), 115, `Native top changed at viewport height ${height}`);
  }
  await input.fill("fixture");
  await page.getByTestId("media-search-result-fixture-title").waitFor();
  assert.equal(await page.evaluate(() => window.__fixture.requests.at(-1).body.include_book_series), true);
  for (const type of ["movie", "tv", "music", "podcast", "youtube", "game"]) {
    await page.getByTestId(`filter-media-${type}`).click();
    await page.waitForFunction(type => window.__fixture.requests.at(-1)?.body.type === type, type);
    await page.getByTestId("media-search-result-fixture-title").waitFor();
    assert.equal(await page.evaluate(() => window.__fixture.requests.at(-1).body.include_book_series), false, type);
  }
  await page.getByTestId("filter-media-all").click();
  await page.waitForFunction(() => !("type" in window.__fixture.requests.at(-1).body));
  assert.equal(await page.evaluate(() => window.__fixture.requests.at(-1).body.include_book_series), true);
  await page.getByTestId("filter-media-book").click();
  await page.waitForFunction(() => window.__fixture.requests.some(r => r.body.type === "book"));
  assert.equal(await page.evaluate(() => window.__fixture.requests.at(-1).body.include_book_series), true);
  assert.equal(await top(), 115);
  assert.equal(await page.getByTestId("media-search-type-filters").evaluate(n => getComputedStyle(n).overflowX), "auto");
  assert.equal(await input.evaluate(n => getComputedStyle(n).fontSize), "16px");
  await page.getByTestId("media-search-result-fixture-title").click();
  await page.getByTestId("quick-track-save").waitFor();
  assert.equal(await top(), 115, "Selecting media moved the anchor");
  await page.getByRole("button", { name: "Finished: Completed media" }).click();
  await page.getByTestId("quick-track-save").click();
  await card.waitFor({ state: "detached" });
  const saved = await page.evaluate(() => window.__fixture.requests.filter(r => r.url.endsWith("/track-media")));
  assert.equal(saved.length, 1, "Tracking must happen exactly once");
  assert.equal(saved[0].body.listType, "finished");
  assert.equal(saved[0].body.media.title, "Fixture title");
  assert.equal(saved[0].body.media.mediaType, "book");
  assert.equal(saved[0].body.media.externalId, "fixture-title");

  await page.getByTestId("reopen").click();
  await input.waitFor();
  assert.equal(await top(), 73, "Reopening did not capture the new opening height");
  await page.getByRole("button", { name: "Import from Netflix, Goodreads, or Letterboxd" }).click();
  await page.getByTestId("quick-track-import-back").waitFor();
  assert.equal(await top(), 73, "Import step moved the anchor");
  await page.getByTestId("quick-track-import-back").click();
  await input.waitFor();
  assert.equal(await top(), 73);
  await page.setViewportSize({ width: 440, height: 960 });
  assert.equal(await top(), 73, "Keyboard dismissal moved the anchor");
  await page.screenshot({ path: join(temp, "ios-fixture.png") });
  console.log("PASS iOS opening anchor remains fixed through simulated native resize, typing, filters, selection, tracking, import, and keyboard dismissal; reopening recaptures.");

  for (const platform of ["web", "android"]) {
    await openPlatform(platform);
    assert.equal(await card.evaluate(n => n.style.top), "12%");
    assert.equal(await card.evaluate(n => n.style.maxHeight), "82vh");
    await page.setViewportSize({ width: 440, height: 610 });
    assert.ok(Math.abs(await top() - 73.2) < 0.1);
  }

  // Real Navigation orange button + real shared dialog; only services are doubled.
  await page.setViewportSize({ width: 440, height: 960 });
  await page.goto(`http://127.0.0.1:${server.address().port}/?platform=ios&entry=navigation`);
  await page.getByTestId("nav-search-toggle").click();
  await page.getByPlaceholder("Search to add media or find friends...").fill("fixture");
  const trackRequests = () => page.evaluate(() => window.__fixture.requests.filter(r => r.url.endsWith("/track-media")));
  const openYouTube = () => page.getByRole("button", { name: "Rate Fixture YouTube", exact: true }).click();
  await openYouTube();
  await page.getByTestId("quick-track-save").waitFor();
  assert.equal(await card.getByText("Fixture YouTube", { exact: true }).count(), 1);
  assert.equal(await card.getByRole("img", { name: "Fixture YouTube" }).getAttribute("src"),
    "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==");
  assert.equal(await card.getByText("Add to a list", { exact: true }).count(), 1);
  assert.equal(await page.getByPlaceholder("Write your review...").count(), 0, "Old composer was mounted");
  assert.equal((await trackRequests()).length, 0, "Opening must not track");
  assert.equal(await top(), 115, "Preselected entry changed the shared native anchor");
  await page.getByRole("button", { name: "Rate 4.5 out of 5", exact: true }).click();
  await page.getByTestId("quick-track-take").fill("Fixture reaction");
  await page.getByRole("button", { name: "Finished: Completed media" }).click();
  await page.getByTestId("quick-track-save").click();
  await card.waitFor({ state: "detached" });
  let navSaved = await trackRequests();
  assert.equal(navSaved.length, 1, "Orange button must share the single tracking save");
  assert.equal(navSaved[0].body.rating, 4.5);
  assert.equal(navSaved[0].body.review, "Fixture reaction");
  assert.equal(navSaved[0].body.listType, "finished");
  assert.equal(navSaved[0].body.media.mediaType, "youtube");
  assert.equal(navSaved[0].body.media.externalId, "UCfixture");
  assert.equal(navSaved[0].body.media.externalSource, "youtube");
  assert.equal(navSaved[0].body.media.creator, "Fixture creator");

  // Reopen, abandon a draft, and choose another title: no stale list/rating/text.
  await openYouTube();
  await page.getByTestId("quick-track-save").waitFor();
  assert.equal(await page.getByTestId("quick-track-take").inputValue(), "");
  await page.getByTestId("quick-track-take").fill("Unsaved reaction");
  await card.locator("..").locator(":scope > div").first().click({ position: { x: 2, y: 2 } });
  await card.waitFor({ state: "detached" });
  assert.equal((await trackRequests()).length, 1, "Cancel must not save");
  await page.getByRole("button", { name: "Rate Fixture TV", exact: true }).click();
  await page.getByTestId("quick-track-save").waitFor();
  assert.equal(await card.getByText("Fixture TV", { exact: true }).count(), 1);
  assert.equal(await page.getByTestId("quick-track-take").inputValue(), "");
  await page.getByTestId("quick-track-save").click();
  await card.waitFor({ state: "detached" });
  navSaved = await trackRequests();
  assert.equal(navSaved.length, 2);
  assert.equal(navSaved[1].body.media.externalId, "fixture-tv");
  assert.equal(navSaved[1].body.media.mediaType, "tv");
  assert.equal(navSaved[1].body.listType, "queue");
  assert.equal(navSaved[1].body.rating, undefined);
  assert.equal(navSaved[1].body.review, undefined);
  assert.equal(navSaved[1].body.skip_social_post, true);

  // Change media remains the same search and selection path as the Now dialog.
  await openYouTube();
  await card.getByRole("button", { name: "Change", exact: true }).click();
  await input.fill("fixture");
  await page.getByTestId("media-search-result-fixture-title").click();
  await page.getByTestId("quick-track-save").click();
  await card.waitFor({ state: "detached" });
  navSaved = await trackRequests();
  assert.equal(navSaved.length, 3);
  assert.equal(navSaved[2].body.media.externalId, "fixture-title");
  assert.equal(navSaved[2].body.media.mediaType, "movie");
  console.log("PASS real orange search button opens the shared Add Media dialog; one save carries title/artwork/provider/rating/reaction/list, cancel and reopen reset drafts, and Change uses shared search.");

  // The /add page's orange result action must enter this same dialog rather
  // than its older text-first Post composer. No app auth bypass or real writes.
  await page.goto(`http://127.0.0.1:${server.address().port}/?platform=ios&entry=add`);
  await page.getByPlaceholder("Search movies, shows, books…").fill("fixture");
  await page.getByRole("button", { name: "Rate Fixture title", exact: true }).click();
  await page.getByTestId("quick-track-save").waitFor();
  assert.equal(await card.getByText("Fixture title", { exact: true }).count(), 1);
  assert.equal(await card.getByText("Add to a list", { exact: true }).count(), 1);
  assert.equal((await trackRequests()).length, 0, "Opening /add orange action must not track");
  await page.getByRole("button", { name: "Rate 3.5 out of 5", exact: true }).click();
  await page.getByTestId("quick-track-take").fill("Add-page reaction");
  await page.getByRole("button", { name: "Favorites: Your favorites" }).click();
  await page.getByTestId("quick-track-save").click();
  await card.waitFor({ state: "detached" });
  const addSaved = await trackRequests();
  assert.equal(addSaved.length, 1);
  assert.equal(addSaved[0].body.media.title, "Fixture title");
  assert.equal(addSaved[0].body.media.externalId, "fixture-title");
  assert.equal(addSaved[0].body.rating, 3.5);
  assert.equal(addSaved[0].body.review, "Add-page reaction");
  assert.equal(addSaved[0].body.listType, "favorites");
  assert.equal(await page.getByPlaceholder("Search movies, shows, books…").count(), 1, "Search page disappeared after save");
  await page.getByRole("button", { name: "Books", exact: true }).click();
  await page.waitForFunction(() => window.__fixture.requests.some(r =>
    r.url.endsWith("/media-search") && r.body.type === "book"));
  await page.getByRole("button", { name: "Rate Fixture title", exact: true }).click();
  await page.getByTestId("quick-track-save").click();
  await card.waitFor({ state: "detached" });
  const bookSaved = await trackRequests();
  assert.equal(bookSaved.length, 2);
  assert.equal(bookSaved[1].body.media.mediaType, "book");
  assert.equal(bookSaved[1].body.media.externalSource, "openlibrary");
  assert.equal(bookSaved[1].body.skip_social_post, true);
  console.log("PASS /add search orange button opens the shared Add Media dialog and single-save path for movies and books; search remains available after save.");

  // Poster taps navigate to details; they must never activate the adjacent
  // purple add or orange rating actions (including book/provider routing).
  await page.getByRole("button", { name: "View Fixture title details", exact: true }).click();
  assert.equal(new URL(page.url()).pathname, "/media/book/openlibrary/fixture-title");
  assert.equal(await page.getByTestId("quick-track-save").count(), 0);
  assert.equal((await trackRequests()).length, 2, "Book poster unexpectedly saved");
  await page.goto(`http://127.0.0.1:${server.address().port}/?platform=ios&entry=add`);
  await page.getByRole("button", { name: "View Fixture Browse details", exact: true }).click();
  assert.equal(new URL(page.url()).pathname, "/media/movie/tmdb/browse-123");
  assert.equal(await page.getByTestId("quick-track-save").count(), 0);
  assert.equal((await trackRequests()).length, 0, "Browse poster unexpectedly saved");
  await page.goto(`http://127.0.0.1:${server.address().port}/?platform=ios&entry=add`);
  await page.getByPlaceholder("Search movies, shows, books…").fill("fixture");
  await page.getByRole("button", { name: "View Fixture title details", exact: true }).click();
  assert.equal(new URL(page.url()).pathname, "/media/movie/fixture/fixture-title");
  assert.equal(await page.getByTestId("quick-track-save").count(), 0, "Search poster opened rating dialog");
  assert.equal((await trackRequests()).length, 0, "Search poster unexpectedly saved");
  console.log("PASS /add browse and result posters navigate to the media detail route without opening rating or saving.");
  assert.deepEqual(errors, []);
  console.log("PASS browser and Android retain existing percentage/vh positioning; no runtime errors.");
  console.log("Browser simulation is not physical iOS keyboard verification.");
} finally {
  await browser?.close();
  if (server?.listening) await new Promise(resolveClose => server.close(resolveClose));
  await rm(temp, { recursive: true, force: true });
}
