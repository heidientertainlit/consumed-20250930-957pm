import assert from "node:assert/strict";
import { createServer } from "node:http";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
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
const screenshotDir = process.argv.includes("--screenshots")
  ? join(root, "generated-artifacts/add-anything-dialog")
  : null;
if (screenshotDir) await mkdir(screenshotDir, { recursive: true });
let browser, server;
try {
  const entry = join(temp, "entry.tsx");
  await writeFile(entry, `
    import React, { useState } from "react";
    import { createRoot } from "react-dom/client";
    import { QuickTrackSheet } from ${JSON.stringify(join(root, "client/src/components/quick-track-sheet.tsx"))};
    import Navigation from ${JSON.stringify(join(root, "client/src/components/navigation.tsx"))};
    import FeedComposerBar, { FeedActionChips } from ${JSON.stringify(join(root, "client/src/components/feed-composer-bar.tsx"))};
    import AddMediaPage from ${JSON.stringify(join(root, "client/src/pages/add-media-page.tsx"))};
    import { HeroCTAButtons } from ${JSON.stringify(join(root, "client/src/components/now-hero-actions.tsx"))};
    import { useNowAddFlow } from ${JSON.stringify(join(root, "client/src/hooks/use-now-add-flow.ts"))};
    import { MediaAddedConfirmation } from ${JSON.stringify(join(root, "client/src/components/media-added-confirmation.tsx"))};
    import { FinishedMediaReview } from ${JSON.stringify(join(root, "client/src/components/finished-media-review.tsx"))};
    import { QuickAddListSheet } from ${JSON.stringify(join(root, "client/src/components/quick-add-list-sheet.tsx"))};
    import { showMediaAdded } from ${JSON.stringify(join(root, "client/src/lib/media-added-confirmation.ts"))};
    import { Route, Switch } from "wouter";
    window.__fixture = {
      platform: new URLSearchParams(location.search).get("platform") || "web",
      session: { access_token: "fixture-token", user: { id: "fixture-user" } },
      requests: [], posts: [], allowThoughtInsert:false, toasts: [], invalidations: [], closes: 0, ancestorClicks:0,
      routeFlow: new URLSearchParams(location.search).get("entry") === "now-flow",
      feedMounts: 0, failTrack: false, failRating: false,
      savedNotes: "A pre-existing note", noteWrites: 0
    };
    window.__fixture.showMediaAdded=showMediaAdded;
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
      if (String(url).startsWith("https://openlibrary.org/search.json")) {
        return Response.json({docs:Array.from({length:7},(_,i)=>({
          key:"/works/OL"+(i+1)+"W",title:"Harry Potter book "+(i+1),
          author_name:["J. K. Rowling"],first_publish_year:1997+i
        }))});
      }
      if (String(url).startsWith("https://mahpgcogwpawvviapqza.supabase.co/functions/v1/calculate-user-points?"))
        return new Response(JSON.stringify({ total_points: 0 }));
      if (!String(url).startsWith("https://fixture.invalid/")) throw Error("Unexpected network request");
      const body = JSON.parse(init.body || "{}");
      window.__fixture.requests.push({ url: String(url), body });
      if (String(url).endsWith("/media-search") && body.query.trim().toLowerCase() === "harry potter") return Response.json({
        results:[{title:"Harry Potter",type:"book_series",series_count:7,creator:"J. K. Rowling",
          external_id:"series-hp",external_source:"openai"},
          ...Array.from({length:4},(_,i)=>({title:"Harry Potter title "+i,type:"book",creator:"J. K. Rowling",
            external_id:"hp-book-"+i,external_source:"googlebooks"}))]
      });
      if (String(url).endsWith("/media-search")) return new Response(JSON.stringify({
        results: [{ title: "Fixture title", type: body.type || "movie",
          external_id: "fixture-title", external_source: body.type === "book" ? "openai" : "fixture", year: "2026",
          image_url: "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==",
          creator: "Fixture creator" }]
      }));
      if (String(url).endsWith("/track-media")) return new Response("{}", {status:window.__fixture.failTrack ? 500 : 200});
      if (String(url).endsWith("/rate-media")) {
        if(!body.media_type) return Response.json({error:"Missing required fields: media_type"},{status:400});
        if(!window.__fixture.failRating)window.__fixture.existingRating=true;
        return Response.json({success:!window.__fixture.failRating}, {status:window.__fixture.failRating ? 500 : 200});
      }
      if (String(url).endsWith("/add-media-to-list")) return Response.json({data:{id:"fixture-saved-item",notes:window.__fixture.savedNotes}}, {status:window.__fixture.failTrack ? 500 : 200});
      if (String(url).includes("/get-media-details?")) return Response.json({
        seasons:window.__fixture.tvScopes ? [{season_number:1},{season_number:2}] : []
      });
      if (String(url).includes("/get-season-episodes?")) return Response.json({
        episodes:[{episode_number:1,name:"First episode"},{episode_number:2,name:"Second episode"}]
      });
      throw Error("Unhandled fixture endpoint");
    };
    function FlowFeed() {
      const [note,setNote]=useState("");
      const [feedListOpen,setFeedListOpen]=useState(false);
      React.useEffect(()=>{window.__fixture.feedMounts++},[]);
      return <div style={{minHeight:3000}}>
        <div style={{height:550}} />
        <input data-testid="feed-note" value={note} onChange={e=>setNote(e.target.value)} />
        <button data-testid="fixture-feed-poster-add" onClick={()=>setFeedListOpen(true)}>Add feed title</button>
        <QuickAddListSheet isOpen={feedListOpen} onClose={()=>setFeedListOpen(false)}
          media={{title:"The Bourne Identity",type:window.__fixture.feedCardType || "movie",
            externalId:"2501",externalSource:"tmdb"}} />
        <HeroCTAButtons />
        <Navigation />
      </div>;
    }
    function FlowFixture() {
      const {routeLocation,entry,returnToNow}=useNowAddFlow();
      return <><div style={entry ? {visibility:"hidden"} : undefined}
        {...(entry ? {inert:"","aria-hidden":true} : {})}><Switch location={routeLocation}>
        <Route path="/add"><AddMediaPage /></Route>
        <Route><FlowFeed /></Route>
      </Switch></div>{entry && <AddMediaPage onReturnToNow={returnToNow} />}</>;
    }
    function Fixture() {
      const [open, setOpen] = useState(true);
      if(window.__fixture.routeFlow) return <FlowFixture />;
      if (new URLSearchParams(location.search).get("entry") === "navigation") return <Navigation />;
      if (new URLSearchParams(location.search).get("entry") === "add") return <FeedComposerBar pageMode />;
      const takeEntry = new URLSearchParams(location.search).get("entry");
      if (takeEntry === "take-hero") return <HeroCTAButtons />;
      if (takeEntry === "take-cards") return <FeedActionChips variant="cards" />;
      if (takeEntry === "take-dark") return <FeedActionChips dark />;
      if (takeEntry === "take-default") return <FeedActionChips />;
      return <div onClick={()=>window.__fixture.ancestorClicks++}><button data-testid="reopen" onClick={() => setOpen(true)}>Reopen</button>
        <QuickTrackSheet isOpen={open} onClose={() => { window.__fixture.closes++; setOpen(false); }} />
      </div>;
    }
    createRoot(document.getElementById("root")).render(<><Fixture /><MediaAddedConfirmation /><FinishedMediaReview /></>);
  `);
  const doubles = {
    "@/lib/auth": `export const useAuth=()=>({session:window.__fixture.session,user:window.__fixture.session.user});`,
    "@/hooks/use-toast": `export const useToast=()=>({toast:x=>window.__fixture.toasts.push(x)});`,
    "@/lib/posthog": `export const trackEvent=()=>{};`,
    "@/lib/queryClient": `export const queryClient={invalidateQueries:async x=>window.__fixture.invalidations.push(x)};`,
    "@/lib/supabase": `
      const read=(rows=[])=>new Proxy({}, {get:(_,key)=>key==="then"
        ? resolve=>Promise.resolve({data:rows,error:null}).then(resolve) : ()=>read(rows)});
      export const supabase={
        auth:{getUser:async()=>({data:{user:{id:"fixture-user"}}})},
        from:table=>table==="social_posts"
        ? {select:()=>read(window.__fixture.existingReview?[{id:"prior-review"}]:window.__fixture.posts),
        insert:async payload=>{
          if(!window.__fixture.allowThoughtInsert)throw Error("Unexpected database write");
          window.__fixture.posts.push(payload);return {error:null};
        },upsert:async payload=>{
          if(!window.__fixture.allowThoughtInsert)throw Error("Unexpected database write");
          if(!window.__fixture.posts.some(p=>p.id===payload.id))window.__fixture.posts.push(payload);
          return {error:null};
        }} : table==="lists" ? new Proxy({}, {get:(_,key)=>key==="maybeSingle"
          ? async()=>({data:{id:"fixture-target-list"},error:null})
          : ()=>supabase.from("lists")}) : table==="list_items" ? (()=>{
          let mode="read", update=null;
          const builder={
            select:fields=>{if(fields==="id,notes")mode="notes";return query},
            eq:()=>query,is:()=>query,
            update:value=>{mode="update";update=value;return query},
            maybeSingle:async()=>{
              if(mode==="update" && "notes" in update){window.__fixture.savedNotes=update.notes;window.__fixture.noteWrites++}
              if(mode==="update" && "list_id" in update){window.__fixture.listMoves=(window.__fixture.listMoves||0)+1}
              return {data:{id:"fixture-saved-item",notes:window.__fixture.savedNotes},error:null};
            },
            then:resolve=>Promise.resolve({data:[],error:null}).then(resolve)
          };
          const query=new Proxy(builder,{get:(target,key)=>key in target?target[key]:()=>query});
          return query;
        })() : read(table==="media_ratings" && window.__fixture.existingRating ? [{id:1}] : [])};
    `,
    "@capacitor/core": `export const Capacitor={
      getPlatform:()=>window.__fixture.platform,
      isNativePlatform:()=>window.__fixture.platform!=="web",
      isPluginAvailable:name=>name==="Haptics"
    };`,
    "@capacitor/haptics": `export const ImpactStyle={Light:"LIGHT"};
      export const Haptics={impact:async options=>{
        (window.__fixture.haptics??=[]).push({...options,at:performance.now()});
      }};`,
    "@tanstack/react-query": `
      export const useQuery=opts=>({data:opts.queryKey?.[0]==="inline-media-search" && opts.enabled ? window.__fixture.navMedia :
        opts.queryKey?.[0]==="user-lists-with-media" && window.__fixture.routeFlow ? {lists:[
          {id:"fixture-finished",title:"Finished",is_default:true},
          {id:"fixture-queue",title:"Want To",is_default:true}
          ,{id:"fixture-currently",title:"Currently",is_default:true}
          ,{id:"fixture-dnf",title:"Did Not Finish",is_default:true}
          ,{id:"fixture-favorites",title:"Favorites",is_default:true}
        ]} : [],isLoading:false,status:"success"});
      export const useQueryClient=()=>({prefetchQuery:async()=>{},invalidateQueries:async()=>{}});
      export const useMutation=()=>({mutate:()=>{throw Error("Unexpected navigation mutation")},isPending:false});
    `,
    "@/lib/feature-flags": `export const useFeatureFlags=()=>({roomsEnabled:false});`,
    "./notification-bell": `export const NotificationBell=()=>null;`,
    "./feedback-dialog": `export const FeedbackDialog=()=>null;`,
    "./quick-add-list-sheet": `
      import React from "react";
      import {QuickAddListSheet as RealSheet} from ${JSON.stringify(join(root,"client/src/components/quick-add-list-sheet.tsx"))};
      export const QuickAddListSheet=props=>window.__fixture.routeFlow ? React.createElement(RealSheet,props) : null;`,
    "./save-media-sheet": `export const SaveMediaSheet=()=>null;`,
    "@/components/navigation": `
      import React from "react";
      import RealNavigation from ${JSON.stringify(join(root, "client/src/components/navigation.tsx"))};
      export default function Navigation(props){
        return window.__fixture.routeFlow ? React.createElement(RealNavigation,props) : null;
      }`,
    "@/components/quick-add-list-sheet": `
      import React from "react";
      import {QuickAddListSheet as RealSheet} from ${JSON.stringify(join(root,"client/src/components/quick-add-list-sheet.tsx"))};
      export const QuickAddListSheet=props=>window.__fixture.routeFlow ? React.createElement(RealSheet,props) : null;`,
    "@/lib/share": `export const APP_BASE="https://fixture.invalid"; export const appApiUrl=path=>APP_BASE+path;`,
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
      api.onLoad({ filter: /.*/, namespace: "double" }, args => ({ contents: doubles[args.path], loader: "js", resolveDir: root }));
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
    else if (req.url === "/bundle.css") { res.setHeader("Content-Type", "text/css"); res.end(await readFile(join(temp, "bundle.css"))); }
    else if (req.url === "/server/assets/Fraunces.ttf") { res.setHeader("Content-Type", "font/ttf"); res.end(await readFile(join(root, "server/assets/Fraunces.ttf"))); }
    else { res.setHeader("Content-Type", "text/html"); res.end('<meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/styles.css"><link rel="stylesheet" href="/bundle.css"><div id="root"></div><script src="/bundle.js"></script>'); }
  });
  await new Promise(resolveListen => server.listen(0, "127.0.0.1", resolveListen));
  browser = await chromium.launch({ executablePath: "/repl/tools/bin/chromium", args: ["--no-sandbox"] });
  const page = await browser.newPage({ viewport: { width: 440, height: 960 }, hasTouch:true });
  const errors = [];
  page.on("pageerror", error => { errors.push(error.message); console.error("Fixture page error:", error.message); });
  const card = page.locator("div.absolute.left-4.right-4.bg-white");
  const top = async () => (await card.boundingBox()).y;
  const input = page.getByTestId("media-search-input");
  const assertUnobscured = async (locator, label) => {
    const probe = await locator.evaluate(node => {
      const rect = node.getBoundingClientRect();
      const x = rect.left + rect.width / 2;
      const y = rect.top + rect.height / 2;
      const hit = document.elementFromPoint(x, y);
      return { unobscured: rect.width > 0 && rect.height > 0 &&
        x >= 0 && y >= 0 && x < innerWidth && y < innerHeight &&
        node.contains(hit), rect: rect.toJSON(), viewport: [innerWidth, innerHeight],
        hit: hit?.outerHTML.slice(0, 250) };
    });
    assert.equal(probe.unobscured, true, `${label} must be on-screen and unobscured: ${JSON.stringify(probe)}`);
  };
  const openPlatform = async (platform, viewport = { width: 440, height: 960 }) => {
    await page.setViewportSize(viewport);
    await page.goto(`http://127.0.0.1:${server.address().port}/?platform=${platform}`);
    await input.waitFor();
  };

  for (const [platform,viewport] of [
    ["web",{width:1280,height:800}],
    ["web",{width:390,height:844}],
    ["web",{width:320,height:568}],
    ["web",{width:390,height:480}],
    ["web",{width:844,height:390}],
    ["ios",{width:390,height:844}],
    ["android",{width:390,height:844}],
  ]) {
    await openPlatform(platform,viewport);
    const heading = card.getByRole("heading", {name:"Add Anything",exact:true});
    assert.equal(await heading.isVisible(), true, "The dialog title must say Add Anything");
    assert.equal(await heading.evaluate(n => getComputedStyle(n).fontSize), "20px");
    assert.equal(await card.locator("svg.lucide-dna").count(), 1, "The empty state must show a DNA icon");
    assert.equal(await card.locator("svg.lucide-sparkles").count(), 0, "The Add dialog must not show the AI sparkle icon");
    const rect = await card.boundingBox();
    assert.ok(rect.x >= 0 && rect.x + rect.width <= viewport.width + 1, "The dialog must fit the viewport width");
    assert.ok(rect.y >= 0 && rect.y + rect.height <= viewport.height + 1, "The dialog must fit the viewport height");
    if (viewport.height >= 800) {
      assert.ok(rect.height >= viewport.height * .75, "The search dialog must use its available height, not shrink to a cramped card");
    }
    await assertUnobscured(input, "Search input");
    await assertUnobscured(card.getByRole("button", {name:"Close Add Anything",exact:true}), "Close button");
    await assertUnobscured(page.getByTestId("quick-track-import-open"), "Import button");
    assert.equal(await page.locator('[data-testid^="filter-media-"]').count(), 8, "All eight media filters must remain available");
    if (screenshotDir && platform === "web") {
      await page.evaluate(() => document.fonts.ready);
      await page.screenshot({ path: join(screenshotDir, `${viewport.width}x${viewport.height}.png`) });
    }
    for (const type of ["all", "movie", "tv", "book", "music", "podcast", "youtube", "game"]) {
      const filter = page.getByTestId(`filter-media-${type}`);
      await filter.scrollIntoViewIfNeeded();
      await filter.click();
      assert.equal(await filter.getAttribute("aria-pressed"), "true");
    }
    await page.getByTestId("filter-media-all").click();
    await page.getByTestId("quick-track-import-open").click();
    await page.getByTestId("quick-track-import-back").click();
    assert.equal(await heading.isVisible(), true, "Import back must return to the same Add Anything dialog");
    await input.fill("harry potter");
    const series = page.getByTestId("media-search-result-series-hp");
    await series.waitFor();
    assert.equal(await card.getByRole("heading", {name:"Go ahead. Add another."}).count(), 0,
      "The decorative headline must make room for real search results");
    const clearSearch = card.getByRole("button", {name:"Clear search",exact:true});
    await assertUnobscured(clearSearch, "Clear search button");
    await clearSearch.click();
    assert.equal(await input.inputValue(), "", "Clear search must still clear the query");
    await input.fill("harry potter");
    await series.waitFor();
    await assertUnobscured(series, "Search result");
    const toggle = series.getByText("7 books", {exact:true});
    if(viewport.width<500) await toggle.tap(); else await toggle.click();
    await page.getByTestId("media-search-series-book-OL1W").waitFor();
    assert.equal(await card.isVisible(), true, "Expanding a series must keep Track open");
    assert.equal(await page.evaluate(() => window.__fixture.closes), 0);
    // A browser may deliver a later click to the backdrop after an interaction
    // started inside the sheet (for example after focus/viewport changes).
    // Exercise that retargeted-click case explicitly, not as a native-iOS claim.
    const backdrop = page.getByTestId("quick-track-backdrop");
    await series.dispatchEvent("pointerdown", {pointerId:1, pointerType:"touch", bubbles:true});
    await backdrop.dispatchEvent("click", {bubbles:true});
    assert.equal(await card.isVisible(), true, "An inside-origin interaction must not dismiss Track via its backdrop");
    assert.equal(await page.evaluate(() => window.__fixture.closes), 0);
    assert.equal(await page.evaluate(() => window.__fixture.ancestorClicks), 0,
      "Dialog clicks must not bubble through the portal to feed handlers");
    await series.click();
    assert.equal(await page.getByTestId("media-search-series-book-OL1W").count(), 0);
    await series.click();
    await page.getByTestId("media-search-series-book-OL1W").click();
    await page.getByTestId("quick-track-save").waitFor();
    assert.equal(await page.evaluate(() => window.__fixture.closes), 0);
    await page.mouse.click(4, 4);
    assert.equal(await card.count(), 0, "A deliberate outside tap must still close Track");
    assert.equal(await page.evaluate(() => window.__fixture.closes), 1);
    await page.getByTestId("reopen").click();
    await card.getByRole("button", {name:"Close Add Anything",exact:true}).click();
    assert.equal(await card.count(), 0, "The close button must still dismiss Track");
    assert.equal(await page.evaluate(() => window.__fixture.closes), 2);
  }
  console.log("PASS spacious Add Anything layout, all eight filters, unobscured search/close/import, import return, series expansion/collapse and child selection across desktop, narrow/short mobile, landscape, iOS and Android simulations.");

  // Reproduce the recording's missing step: macOS commits a capitalization
  // correction on input blur, between pressing the dropdown and releasing it.
  for (const platform of ["web","ios"]) {
    await openPlatform(platform,{width:390,height:844});
    await input.fill("harry potter");
    const series = page.getByTestId("media-search-result-series-hp");
    const toggle = series.getByText("7 books",{exact:true});
    await toggle.waitFor();
    const beforeHeight = (await card.boundingBox()).height;
    const beforeRequests = await page.evaluate(()=>window.__fixture.requests.filter(r=>r.url.endsWith("/media-search")).length);
    await input.evaluate(node=>{
      window.__fixture.originalSeries=document.querySelector('[data-testid="media-search-result-series-hp"]');
      node.addEventListener("blur",()=>{
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,"value").set.call(node,"Harry Potter");
        node.dispatchEvent(new InputEvent("input",{bubbles:true,inputType:"insertReplacementText",data:"Harry Potter"}));
      },{once:true});
    });
    const box = await toggle.boundingBox();
    await page.mouse.move(box.x+box.width-8,box.y+box.height/2);
    await page.mouse.down();
    assert.equal(await input.inputValue(),"Harry Potter");
    assert.equal(await series.isVisible(),true,"Blur capitalization must not clear the result under the pressed arrow");
    assert.equal(await page.evaluate(()=>window.__fixture.originalSeries.isConnected),true,
      "The pressed series button must not be remounted during correction");
    assert.ok(Math.abs((await card.boundingBox()).height-beforeHeight)<1,"Case correction must not shrink Track");
    await page.mouse.up();
    await page.getByTestId("media-search-series-book-OL1W").waitFor();
    assert.equal(await page.evaluate(()=>window.__fixture.closes),0);
    await input.fill("HARRY POTTER ");
    assert.equal(await series.getAttribute("aria-expanded"),"true","Equivalent text edits must preserve expanded books");
    assert.equal(await page.getByTestId("media-search-series-book-OL1W").count(),1);
    await page.waitForTimeout(250); // Beyond the real search debounce: no hidden replacement request.
    assert.equal(await page.evaluate(()=>window.__fixture.requests.filter(r=>r.url.endsWith("/media-search")).length),beforeRequests);
    await input.fill("fixture");
    await page.getByTestId("media-search-result-fixture-title").waitFor();
    assert.equal(await series.count(),0,"A genuinely different title must clear the old series");
    assert.equal(await page.evaluate(()=>window.__fixture.requests.filter(r=>r.url.endsWith("/media-search")).length),beforeRequests+1);
  }
  console.log("PASS blur-time capitalization during the dropdown press preserves results, button identity and Track; genuine query changes still search.");

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
  await page.getByTestId("quick-track-spoilers").check();
  await page.getByRole("button", { name: "Finished: Completed media" }).click();
  await page.getByTestId("quick-track-save").click();
  await card.waitFor({ state: "detached" });
  let navSaved = await trackRequests();
  assert.equal(navSaved.length, 1, "Orange button must share the single tracking save");
  assert.equal(navSaved[0].body.rating, 4.5);
  assert.equal(navSaved[0].body.review, "Fixture reaction");
  assert.equal(navSaved[0].body.containsSpoilers, true);
  assert.equal(navSaved[0].body.listType, "finished");
  assert.equal(navSaved[0].body.media.mediaType, "youtube");
  assert.equal(navSaved[0].body.media.externalId, "UCfixture");
  assert.equal(navSaved[0].body.media.externalSource, "youtube");
  assert.equal(navSaved[0].body.media.creator, "Fixture creator");

  // Reopen, abandon a draft, and choose another title: no stale list/rating/text.
  await openYouTube();
  await page.getByTestId("quick-track-save").waitFor();
  assert.equal(await page.getByTestId("quick-track-take").inputValue(), "");
  assert.equal(await page.getByTestId("quick-track-spoilers").isChecked(), false);
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
  const addRatingBox = await page.getByRole("group", { name: "Rating", exact: true }).boundingBox();
  const addListChoices = await page.getByTestId("quick-track-status-queue").boundingBox();
  assert.ok(addRatingBox.y < addListChoices.y, "Rating must appear above the list choices");
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
  for (const entry of ["take-hero", "take-cards", "take-dark", "take-default"]) {
    await page.goto(`http://127.0.0.1:${server.address().port}/?platform=ios&entry=${entry}`);
    await page.getByRole("button", { name: /^Share a take\b/i }).click();
    await input.fill("fixture");
    await page.getByTestId("media-search-result-fixture-title").click();
    await page.getByTestId("quick-track-save").waitFor();
    assert.equal(await card.getByText("Fixture title", { exact: true }).count(), 1);
    assert.equal(await page.getByPlaceholder("What do you think?").count(), 1);
    const ratingBox = await page.getByRole("group", { name: "Rating", exact: true }).boundingBox();
    const listChoices = await page.getByTestId("quick-track-status-queue").boundingBox();
    assert.ok(ratingBox.y < listChoices.y, `${entry}: rating must appear before list choices`);
    assert.equal(await page.getByRole("button", { name: "Post", exact: true }).count(), 0,
      "Share a Take must not mount the older standalone composer");
    await page.getByRole("button", { name: "Rate 4.5 out of 5", exact: true }).click();
    await page.getByTestId("quick-track-take").fill("Shared rating dialog reaction");
    await page.getByTestId("quick-track-spoilers").setChecked(true);
    if (screenshotDir && entry === "take-hero") {
      await page.getByTestId("quick-track-take").blur();
      await page.screenshot({ path: join(screenshotDir, "share-a-take-rating-first.png") });
    }
    await page.getByTestId("quick-track-save").click();
    await card.waitFor({ state: "detached" });
    const takes = await trackRequests();
    assert.equal(takes.length, 1, `${entry}: Share a Take must use one shared save`);
    assert.equal(takes[0].body.rating, 4.5);
    assert.equal(takes[0].body.review, "Shared rating dialog reaction");
    assert.equal(takes[0].body.containsSpoilers, true);
  }
  console.log("PASS every Share a Take entry opens the exact shared rating dialog, places ratings above lists, and preserves the single save, reaction, and spoiler flag.");
  for (const containsSpoilers of [true,false]) {
    await page.goto(`http://127.0.0.1:${server.address().port}/?platform=web`);
    await input.fill("fixture");
    await page.getByTestId("media-search-result-fixture-title").click();
    await page.getByTestId("quick-track-take").fill("Text-only spoiler fixture.");
    await page.getByTestId("quick-track-spoilers").setChecked(containsSpoilers);
    await page.evaluate(()=>{window.__fixture.allowThoughtInsert=true});
    await page.getByTestId("quick-track-save").click();
    await card.waitFor({state:"detached"});
    const posts=await page.evaluate(()=>window.__fixture.posts);
    assert.equal(posts.length,1);
    assert.equal(posts[0].contains_spoilers,containsSpoilers);
    const requests=await trackRequests();
    assert.equal(requests.length,1);
    assert.equal(requests[0].body.containsSpoilers,containsSpoilers);
    assert.equal(requests[0].body.skip_social_post,true);
  }
  console.log("PASS Add Media search spoiler controls save both rated reviews and text-only reactions, and reset on reopening.");

  // Real Now CTA, Add page, routing hook and shared save sheet. Only services
  // are doubled; the background route must preserve its actual React instance.
  let nowAddButtonBackground;
  const openNowFlow = async (path = "/activity") => {
    await page.setViewportSize({width:390,height:844});
    await page.goto(`http://127.0.0.1:${server.address().port}${path}?entry=now-flow`);
    await page.getByTestId("feed-note").fill("Keep this feed state");
    await page.evaluate(()=>window.scrollTo(0,450));
    const nowAddButton=page.getByRole("button",{name:"Add media",exact:true});
    nowAddButtonBackground=await nowAddButton.evaluate(el=>getComputedStyle(el).backgroundImage);
    await nowAddButton.click();
    await page.getByPlaceholder("Search movies, shows, books…").waitFor();
    assert.equal(await page.getByRole("button",{name:"Back to Now",exact:true}).count(),0,
      "The Add page must not show an extra Back to Now button");
    assert.equal(new URL(page.url()).pathname,"/add");
    assert.equal(await page.getByTestId("media-search-input").count(),0,
      "The Now CTA must open the existing Add page, not the old search dialog");
    assert.equal(await page.evaluate(()=>window.__fixture.feedMounts),1);
  };
  const choosePageMedia = async () => {
    await page.getByPlaceholder("Search movies, shows, books…").fill("fixture");
    await page.getByRole("button",{name:"Rate Fixture title",exact:true}).click();
    await page.getByTestId("quick-track-save").waitFor();
  };
  const assertNowRestored = async path => {
    await page.waitForURL(url=>url.pathname===path);
    assert.equal(await page.getByTestId("feed-note").inputValue(),"Keep this feed state");
    assert.equal(await page.evaluate(()=>window.__fixture.feedMounts),1,"Returning must not remount the feed");
    assert.equal(await page.evaluate(()=>window.scrollY),450,"The original feed position must be restored");
    assert.equal(await page.getByTestId("add-back-to-now").count(),0);
  };
  await openNowFlow();
  await choosePageMedia();
  await page.evaluate(()=>{window.__fixture.platform="ios";window.__fixture.failTrack=true});
  await page.getByTestId("quick-track-save").click();
  await page.waitForFunction(()=>window.__fixture.toasts.some(t=>t.title==="Couldn't save that"));
  assert.equal(new URL(page.url()).pathname,"/add","Failed saves must stay on Add");
  assert.equal(await page.getByTestId("quick-track-save").isVisible(),true);
  await page.evaluate(()=>{window.__fixture.failTrack=false});
  await page.getByTestId("quick-track-save").click();
  await assertNowRestored("/activity");
  assert.equal((await trackRequests()).length,2,"One failed request plus one successful retry");
  await page.getByTestId("nav-add").click();
  await page.getByPlaceholder("Search movies, shows, books…").waitFor();
  assert.equal(await page.getByTestId("add-back-to-now").count(),0,
    "A prior Now visit must not make ordinary Add-tab navigation return to Now");
  await choosePageMedia();
  await page.getByTestId("quick-track-save").click();
  await card.waitFor({state:"detached"});
  assert.equal(new URL(page.url()).pathname,"/add","Direct Add-tab saves must stay on Add");

  for (const origin of ["/","/activity"]) {
    await openNowFlow(origin);
    await page.goBack();
    await assertNowRestored(origin);
    await openNowFlow(origin);
    await choosePageMedia();
    await card.getByRole("button",{name:"Close Track",exact:true}).click();
    await assertNowRestored(origin);
    assert.equal((await trackRequests()).length,0,"Cancelling must not write media");
  }
  console.log("PASS Now CTA opens the real Add page; successful saves return only for Now entry, failed saves stay, direct Add remains independent, and Back/cancel preserve feed state and scroll for both Now URLs.");
  await openNowFlow();
  await page.getByPlaceholder("Search movies, shows, books…").fill("fixture");
  await page.getByRole("button",{name:"Add Fixture title",exact:true}).click();
  await page.getByTestId("list-option-fixture-finished").waitFor();
  await page.evaluate(()=>{window.__fixture.platform="ios";window.__fixture.failTrack=true});
  await page.getByTestId("list-option-fixture-finished").click();
  await page.waitForFunction(()=>window.__fixture.toasts.some(t=>t.title==="Failed to add to list"));
  await page.waitForTimeout(250); // Wait beyond the 190ms impact before asserting no feedback.
  assert.equal(await page.evaluate(()=>window.__fixture.haptics?.length??0),0,
    "A failed save must never trigger a success haptic");
  assert.equal(new URL(page.url()).pathname,"/add","A failed list save must not return to Now");
  assert.equal(await page.getByTestId("media-added-confirmation").count(),0,"A failed save must not show success feedback");
  await page.evaluate(()=>{
    window.__fixture.failTrack=false;
    window.__fixture.standaloneFinishedSeen=false;
    const observer=new MutationObserver(()=>{
      if(document.querySelector('[data-testid="media-added-confirmation"],[data-testid="media-added-backdrop"]'))
        window.__fixture.standaloneFinishedSeen=true;
    });
    observer.observe(document.body,{childList:true,subtree:true});
    window.__fixture.finishedObserver=observer;
  });
  await page.getByTestId("list-option-fixture-finished").click();
  assert.equal(new URL(page.url()).pathname,"/add","Finished must stay on its source page");
  const addedFeedback=page.getByTestId("media-added-confirmation");
  await page.getByTestId("finished-review-reminder").waitFor();
  assert.equal(await page.getByTestId("finished-review-confirmation").count(),0,
    "The Finished row replaces the redundant top confirmation");
  assert.equal(await page.evaluate(()=>window.__fixture.haptics?.length||0),0);
  assert.equal(new URL(page.url()).pathname,"/add","The Finished review must open on the same page as Consumed");
  const finishedDialog=page.getByRole("dialog",{name:"Rate or review finished title",exact:true});
  assert.equal(await finishedDialog.evaluate(el=>getComputedStyle(el).animationName),"finished-review-dialog-enter");
  await finishedDialog.evaluate(el=>Promise.all(el.getAnimations().map(animation=>animation.finished.catch(()=>{}))));
  const fullPageBounds=await finishedDialog.boundingBox();
  const viewport=page.viewportSize();
  assert.ok(fullPageBounds.x>0 && fullPageBounds.x<=20 &&
    fullPageBounds.width>=viewport.width-40 && fullPageBounds.width<viewport.width &&
    fullPageBounds.y>0 && fullPageBounds.y+fullPageBounds.height<viewport.height,
    "Finished review should keep narrow phone margins");
  assert.ok(fullPageBounds.height<viewport.height-40,
    "The compact review should be shorter than the viewport, rather than filling it");
  assert.ok(await finishedDialog.evaluate(el=>parseFloat(getComputedStyle(el).borderTopLeftRadius)>=20),
    "Finished review must have rounded outer corners");
  const reviewBackdrop=page.getByTestId("finished-review-backdrop");
  assert.equal(await reviewBackdrop.count(),1);
  const backdropColor=await reviewBackdrop.evaluate(el=>getComputedStyle(el).backgroundColor);
  const backdropAlpha=Number(backdropColor.match(/,\s*([\d.]+)\)$/)?.[1]);
  assert.ok(backdropAlpha>=0.95,`Backdrop must be nearly black so the app header and navigation don't compete with the dialog: ${backdropColor}`);
  assert.equal(await finishedDialog.evaluate(el=>getComputedStyle(el).backgroundColor),"rgb(255, 255, 255)");
  assert.equal(await addedFeedback.count(),0,"Combined flow must not show a standalone stamp");
  assert.equal(await page.evaluate(()=>window.__fixture.standaloneFinishedSeen),false,
    "Neither a separate stamp nor backdrop may appear before the review");
  await page.evaluate(()=>window.__fixture.finishedObserver.disconnect());
  const headingRect=await page.getByTestId("finished-review-reminder").boundingBox();
  assert.ok(headingRect.y-fullPageBounds.y<40,"The review heading must stay at the top of the dialog without a confirmation strip");
  const purpleHeader=page.getByTestId("finished-review-header");
  const headerBackground=await purpleHeader.evaluate(el=>getComputedStyle(el).backgroundImage);
  assert.ok(headerBackground.includes("rgb(48, 36, 82)") && headerBackground.includes("rgb(28, 22, 48)"),
    "The header should match the existing dark Now purple gradient");
  assert.equal(await page.getByTestId("quick-track-save").evaluate(el=>getComputedStyle(el).backgroundImage),
    nowAddButtonBackground,"Save must use the actual Now Add Media button gradient");
  const assertReviewFits=async(label)=>{
    const dimensions=await page.getByTestId("finished-review-body").evaluate(el=>({
      content:el.scrollHeight,visible:el.clientHeight,
    }));
    assert.ok(dimensions.content<=dimensions.visible+1,`${label} should fit without body scrolling: ${JSON.stringify(dimensions)}`);
    const shareRect=await page.getByTestId("finished-review-private").boundingBox();
    const saveRect=await page.getByTestId("quick-track-save").boundingBox();
    assert.ok(shareRect.y+shareRect.height<=saveRect.y,`${label} sharing must be visible above Save`);
  };
  await assertReviewFits("Default movie review");
  const purpleHeaderRect=await purpleHeader.boundingBox();
  assert.ok(purpleHeaderRect.height>=85 && purpleHeaderRect.height<=180,"The purple header must stay compact");
  assert.equal(await purpleHeader.getByTestId("finished-review-face").count(),1);
  assert.equal(await purpleHeader.getByTestId("finished-review-comment-bubble").count(),1);
  const facePaths=await purpleHeader.getByTestId("finished-review-face").locator("path").evaluateAll(paths=>paths.map(path=>path.getAttribute("d")));
  assert.ok(facePaths.includes("M28 48 q7 -8 14 0") && facePaths.includes("M58 48 q7 -8 14 0") &&
    facePaths.includes("M34 62 q16 14 32 0"),"Use the exact Now-page happy face, not another smiley");
  assert.doesNotMatch(await finishedDialog.textContent(),/Added to Finished|Entertainment DNA/);
  assert.equal(await page.getByTestId("finished-review-reminder").textContent(),
    "Okay, let's hear it.");
  assert.equal(await page.getByText("You've got thoughts.",{exact:true}).count(),1);
  const reviewRect=await page.getByTestId("quick-track-take").boundingBox();
  const starsRect=await page.getByRole("group",{name:"Rating",exact:true}).boundingBox();
  const listsRect=await page.getByText("Add to a list",{exact:true}).boundingBox();
  assert.ok(starsRect.y<reviewRect.y && reviewRect.y<listsRect.y,
    "The Finished follow-up must put rating first, then reaction, then lists");
  const contextRect=await page.getByTestId("finished-review-media").boundingBox();
  assert.ok(reviewRect.y+reviewRect.height<=contextRect.y && contextRect.y<listsRect.y,
    "The media belongs with list details, below the writing area");
  assert.ok(reviewRect.height>=70 && reviewRect.height<=120,"The open writing area must be compact but comfortable to type in");
  assert.equal(await page.getByTestId("quick-track-take").evaluate(el=>getComputedStyle(el).borderTopWidth),"0px");
  assert.ok(await page.getByTestId("quick-track-take").evaluate(el=>parseFloat(getComputedStyle(el).fontSize)>=16));
  assert.equal(await page.getByTestId("quick-track-status-finished").count(),0,
    "The list picker should stay collapsed until Change is pressed");
  assert.equal(await page.getByTestId("finished-review-private").isChecked(),true,
    "Share to NOW defaults on");
  assert.equal(await page.getByTestId("quick-track-save").isDisabled(),true);
  await page.getByTestId("quick-track-take").fill("A draft in the clean review form");
  await page.getByTestId("quick-track-take").fill("");
  assert.equal(await page.evaluate(()=>window.__fixture.haptics?.length||0),0,
    "Editing the reaction must not trigger a removed confirmation haptic");
  await page.getByRole("button",{name:"Not now",exact:true}).click();
  await page.getByTestId("finished-review-reminder").waitFor({state:"detached"});
  await assertNowRestored("/activity");
  assert.equal(await page.evaluate(()=>window.__fixture.noteWrites),0);
  assert.equal(await page.evaluate(()=>window.__fixture.requests.filter(r=>r.url.endsWith("/add-media-to-list")).length),2);
  await page.getByTestId("nav-add").click();
  await page.getByPlaceholder("Search movies, shows, books…").fill("fixture");
  await page.getByRole("button",{name:"Add Fixture title",exact:true}).click();
  await page.getByTestId("list-option-fixture-finished").click();
  assert.equal(new URL(page.url()).pathname,"/add","Direct Add list saves must also stay on Add");
  await page.getByTestId("finished-review-reminder").waitFor();
  assert.equal(await addedFeedback.count(),0);
  if(process.argv.includes("--screenshots"))await page.screenshot({path:join(screenshotDir,"finished-review-shared-dialog.png")});
  await page.evaluate(()=>{window.__fixture.allowThoughtInsert=true});
  await page.getByTestId("quick-track-take").fill("My Finished review");
  await page.getByTestId("quick-track-spoilers").check();
  await page.getByRole("button",{name:"Rate 4.5 out of 5",exact:true}).click();
  await page.getByTestId("quick-track-save").click();
  await page.getByTestId("finished-review-reminder").waitFor({state:"detached"});
  const reviewCompletion=page.getByTestId("finished-review-completion");
  await reviewCompletion.waitFor();
  assert.match(await reviewCompletion.textContent(),/That’s a wrap!/);
  assert.match(await reviewCompletion.textContent(),/Review saved\./);
  assert.match(await reviewCompletion.evaluate(el=>getComputedStyle(el).backgroundImage),/linear-gradient.*48, 36, 82.*28, 22, 48/);
  assert.equal(await reviewCompletion.evaluate(el=>getComputedStyle(el).color),"rgb(255, 255, 255)");
  assert.equal(await page.getByTestId("finished-review-completion-face").count(),1);
  assert.equal(await page.getByTestId("quick-track-save").count(),0,"Success must replace the form, preventing duplicate saves");
  assert.equal(await page.getByTestId("finished-review-backdrop").isVisible(),true);
  assert.equal(await page.evaluate(()=>window.__fixture.toasts.filter(t=>t.variant!=="destructive").length),0,"Review completion must not produce a toast");
  if(screenshotDir) {
    await page.waitForTimeout(380);
    await page.screenshot({path:join(screenshotDir,"finished-review-completion.png")});
  }
  await reviewCompletion.click();
  await reviewCompletion.waitFor({state:"detached"});
  assert.equal(new URL(page.url()).pathname,"/add");
  const sharedReaction=await page.evaluate(()=>window.__fixture.posts);
  assert.equal(sharedReaction.length,1);
  assert.equal(sharedReaction[0].content,"My Finished review");
  assert.equal(sharedReaction[0].rating,4.5);
  assert.equal(sharedReaction[0].contains_spoilers,true);
  assert.equal(await page.evaluate(()=>window.__fixture.requests.filter(r=>r.url.endsWith("/track-media")).length),0);
  assert.ok((await page.evaluate(()=>window.__fixture.savedNotes)).startsWith("A pre-existing note"));
  await page.waitForTimeout(300);
  assert.equal(await addedFeedback.count(),0,"Saving a follow-up must not start another success/prompt loop");
  console.log("PASS compact Finished review fits without scrolling, matches Now's dark purple header and Add Media gradient, and keeps the exact face, bubble, and dark backdrop.");

  const openFinishedReview=async()=>{
    await openNowFlow();
    await page.getByPlaceholder("Search movies, shows, books…").fill("fixture");
    await page.getByRole("button",{name:"Add Fixture title",exact:true}).click();
    await page.getByTestId("list-option-fixture-finished").click();
    await page.getByTestId("finished-review-reminder").waitFor();
    assert.equal(new URL(page.url()).pathname,"/add");
  };
  await openFinishedReview();
  const dismissBackdrop=page.getByTestId("finished-review-backdrop");
  await dismissBackdrop.click({position:{x:2,y:2}});
  await page.getByTestId("finished-review-reminder").waitFor({state:"detached"});
  await assertNowRestored("/activity");
  assert.equal(await page.evaluate(()=>window.__fixture.noteWrites),0,"Backdrop dismissal must preserve the saved Finished entry");

  for(const privateMode of [false,true]){
    await openFinishedReview();
    await page.evaluate(()=>{window.__fixture.allowThoughtInsert=true});
    await page.getByTestId("quick-track-take").fill(privateMode?"Keep this reaction off the feed":"Review without stars");
    if(privateMode){
      await page.getByTestId("finished-review-private").uncheck();
      await page.getByRole("button",{name:"Rate 3.5 out of 5",exact:true}).click();
    }
    await page.getByTestId("quick-track-save").click();
    await page.getByTestId("finished-review-reminder").waitFor({state:"detached"});
    await assertNowRestored("/activity");
    assert.equal((await page.evaluate(()=>window.__fixture.posts)).length,privateMode?0:1);
    assert.ok((await page.evaluate(()=>window.__fixture.savedNotes)).includes(privateMode?"Keep this reaction off the feed":"Review without stars"));
    const followRequests=await page.evaluate(()=>window.__fixture.requests);
    assert.equal(followRequests.filter(r=>r.url.endsWith("/add-media-to-list")).length,1);
    assert.equal(followRequests.filter(r=>r.url.endsWith("/track-media")).length,0);
    if(privateMode)assert.equal(followRequests.find(r=>r.url.endsWith("/rate-media")).body.skip_social_post,true);
  }
  await openFinishedReview();
  await page.evaluate(()=>{window.__fixture.allowThoughtInsert=true;window.__fixture.failRating=true});
  await page.getByTestId("quick-track-take").fill("Keep my draft on failure");
  await page.getByRole("button",{name:"Rate 4 out of 5",exact:true}).click();
  await page.getByTestId("quick-track-save").click();
  await page.getByRole("alert").waitFor();
  assert.equal(await reviewCompletion.count(),0,"Failed saves must not celebrate");
  assert.equal(await page.getByTestId("quick-track-take").inputValue(),"Keep my draft on failure");
  assert.equal(await page.evaluate(()=>window.__fixture.posts.length),0);
  await page.evaluate(()=>{window.__fixture.failRating=false});
  await page.getByTestId("quick-track-save").click();
  await page.getByTestId("finished-review-reminder").waitFor({state:"detached"});
  assert.equal(await page.evaluate(()=>window.__fixture.noteWrites),1);
  assert.equal(await page.evaluate(()=>window.__fixture.posts.length),1);
  assert.equal(await page.evaluate(()=>window.__fixture.requests.filter(r=>r.url.endsWith("/add-media-to-list")).length),1);
  console.log("PASS review-only sharing, feed opt-out, retained review notes, error-visible drafts, and safe retries without duplicate tracking, notes, or reaction posts.");

  await openFinishedReview();
  await page.getByRole("button",{name:"Change",exact:true}).click();
  await page.getByTestId("quick-track-status-queue").click();
  assert.equal(await page.getByTestId("quick-track-status-finished").count(),0,"Choosing a list collapses the picker");
  assert.equal(await page.evaluate(()=>window.__fixture.listMoves||0),0,"Changing a draft selection must not write");
  await page.getByRole("button",{name:"Not now",exact:true}).click();
  await assertNowRestored("/activity");
  assert.equal(await page.evaluate(()=>window.__fixture.listMoves||0),0,"Not now preserves Finished");
  await openFinishedReview();
  await page.getByRole("button",{name:"Change",exact:true}).click();
  await page.getByTestId("quick-track-status-queue").click();
  await page.getByTestId("quick-track-save").click();
  await page.getByTestId("finished-review-reminder").waitFor({state:"detached"});
  await assertNowRestored("/activity");
  assert.equal(await page.evaluate(()=>window.__fixture.listMoves),1);
  assert.equal(await page.evaluate(()=>window.__fixture.posts.length),0,"List-only saves must not invent reactions");
  assert.equal(await page.evaluate(()=>window.__fixture.requests.filter(r=>r.url.endsWith("/track-media")).length),0);
  console.log("PASS compact Finished row expands on Change, Not now cancels the list edit, and Save updates the existing row without re-tracking or creating a reaction.");

  await page.emulateMedia({reducedMotion:"reduce"});
  await openFinishedReview();
  await page.waitForTimeout(250);
  assert.equal(await page.getByTestId("finished-review-confirmation").count(),0);
  assert.equal(await page.getByTestId("finished-review-reminder").isVisible(),true);
  assert.equal(await page.evaluate(()=>window.__fixture.haptics?.length||0),0);
  await page.emulateMedia({reducedMotion:"no-preference"});
  await page.waitForTimeout(250);
  assert.equal(await page.evaluate(()=>window.__fixture.haptics?.length||0),0,"A preference change must not produce a late haptic");
  await page.getByRole("button",{name:"Not now",exact:true}).click();
  await assertNowRestored("/activity");
  console.log("PASS reduced motion keeps the clean review usable without animation, haptics, or delayed replay.");

  for(const startsReduced of [true,false]) {
    await page.emulateMedia({reducedMotion:startsReduced?"reduce":"no-preference"});
    await openFinishedReview();
    if(startsReduced) {
      assert.equal(await page.getByRole("dialog",{name:"Rate or review finished title",exact:true})
        .evaluate(el=>getComputedStyle(el).animationName),"none","Reduced motion must skip the dialog entrance");
    }
    await page.evaluate(()=>{window.__fixture.platform="ios";window.__fixture.allowThoughtInsert=true});
    await page.getByTestId("quick-track-take").fill("A completed reaction");
    await page.getByTestId("quick-track-save").click();
    await reviewCompletion.waitFor();
    assert.equal(new URL(page.url()).pathname,"/add","Keep the source page until completion ends");
    await assertUnobscured(reviewCompletion,"Completion dismissal");
    if(!startsReduced)await page.emulateMedia({reducedMotion:"reduce"});
    assert.equal(await reviewCompletion.evaluate(el=>el.classList.contains("finished-review-completion--animated")),false);
    await page.waitForTimeout(250);
    assert.equal(await page.evaluate(()=>window.__fixture.haptics?.length??0),0,
      "Reduced motion must suppress or cancel completion haptics");
    await page.emulateMedia({reducedMotion:"no-preference"});
    await page.waitForTimeout(220);
    assert.equal(await page.evaluate(()=>window.__fixture.haptics?.length??0),0,"Do not replay skipped haptics");
    if(startsReduced) {
      await page.keyboard.press("Escape");
      await reviewCompletion.waitFor({state:"detached"});
    } else {
      await reviewCompletion.waitFor({state:"detached",timeout:2500});
    }
    await assertNowRestored("/activity");
  }
  console.log("PASS completion replaces saved reviews, supports early tap/Escape and automatic dismissal, respects live reduced motion, and never emits a toast.");

  await openNowFlow();
  await page.evaluate(()=>{
    window.__fixture.tvScopes=true;
    window.__fixture.allowThoughtInsert=true;
    window.__fixture.showMediaAdded({
      title:"Fixture TV",listName:"Finished",finishedReview:{
        userId:"fixture-user",listItemId:"fixture-saved-item",
        media:{title:"Fixture TV with a two-line title for realistic layout coverage",type:"tv",external_id:"fixture-tv",external_source:"tmdb",year:2026,
          image:"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='58' height='82'%3E%3Crect width='58' height='82' fill='%23302452'/%3E%3C/svg%3E"}
      }
    });
  });
  await page.getByTestId("finished-review-reminder").waitFor();
  const seasonSelect=page.getByRole("combobox",{name:"Season",exact:true});
  const episodeSelect=page.getByRole("combobox",{name:"Episode",exact:true});
  await seasonSelect.locator('option[value="1"]').waitFor({state:"attached"});
  assert.equal(await seasonSelect.inputValue(),"");
  assert.equal(await page.getByTestId("quick-track-season-all").count(),0,
    "Finished TV scope must use subtle selects instead of pills");
  await seasonSelect.selectOption("1");
  await episodeSelect.locator('option[value="2"]').waitFor({state:"attached"});
  await episodeSelect.selectOption("2");
  await seasonSelect.selectOption("2");
  await page.waitForFunction(()=>document.querySelector('[data-testid="finished-review-episode-select"]')?.value==="");
  await episodeSelect.locator('option[value="1"]').waitFor({state:"attached"});
  await episodeSelect.selectOption("1");
  const tvReactionRect=await page.getByTestId("quick-track-take").boundingBox();
  const tvMediaRect=await page.getByTestId("finished-review-media").boundingBox();
  const tvSeasonRect=await seasonSelect.boundingBox();
  assert.ok(tvReactionRect.y+tvReactionRect.height<=tvMediaRect.y && tvMediaRect.y<tvSeasonRect.y,
    "TV context and scope belong below the reaction");
  await assertReviewFits("Default TV review with artwork and scope selectors");
  if(process.argv.includes("--screenshots"))await page.screenshot({path:join(screenshotDir,"finished-review-open-tv.png")});
  const originalViewport=page.viewportSize();
  await page.setViewportSize({width:1200,height:900});
  const desktopReviewRect=await page.getByRole("dialog",{name:"Rate or review finished title",exact:true}).boundingBox();
  assert.ok(desktopReviewRect.width<1000 && Math.abs(desktopReviewRect.x*2+desktopReviewRect.width-1200)<2,
    "Desktop review should be a centered dialog rather than stretched edge to edge");
  if(process.argv.includes("--screenshots"))await page.screenshot({path:join(screenshotDir,"finished-review-rounded-desktop.png")});
  await page.setViewportSize({width:320,height:568});
  await page.getByTestId("quick-track-take").fill("A scoped TV reaction");
  await page.getByTestId("quick-track-spoilers").check();
  const footerRect=await page.getByTestId("quick-track-save").boundingBox();
  assert.ok(footerRect.y>=0 && footerRect.y+footerRect.height<=568,
    "The Save footer must remain in view on a short phone");
  if(process.argv.includes("--screenshots"))await page.screenshot({path:join(screenshotDir,"finished-review-open-tv-short.png")});
  await page.getByTestId("quick-track-save").click();
  await page.getByTestId("finished-review-reminder").waitFor({state:"detached"});
  const scopedReaction=await page.evaluate(()=>window.__fixture.posts.at(-1));
  assert.equal(scopedReaction.content,"A scoped TV reaction");
  assert.equal(scopedReaction.media_season_number,2);
  assert.equal(scopedReaction.media_episode_number,1);
  assert.equal(scopedReaction.media_episode_title,"First episode");
  assert.equal(scopedReaction.contains_spoilers,true);
  assert.equal(await page.evaluate(()=>window.__fixture.requests.filter(r=>r.url.endsWith("/track-media")).length),0);
  await page.setViewportSize(originalViewport);
  console.log("PASS reaction-first presentation, subtle TV scope selects near list details, episode reset, scoped spoiler reactions, and reachable short-phone footer.");

  // Actual Now feed-card callbacks pass `type`, unlike Add's `mediaType`.
  // Exercise that boundary through the real picker and shared Finished review.
  for(const mediaType of ["movie","tv"]) {
    await page.setViewportSize({width:390,height:844});
    await page.goto(`http://127.0.0.1:${server.address().port}/activity?entry=now-flow`);
    await page.evaluate(type=>{window.__fixture.feedCardType=type;window.__fixture.allowThoughtInsert=true},mediaType);
    await page.getByTestId("fixture-feed-poster-add").click();
    await page.getByTestId("list-option-fixture-finished").click();
    await page.getByTestId("finished-review-reminder").waitFor();
    assert.match(await page.getByTestId("finished-review-media").textContent(),mediaType==="movie" ? /Movie/ : /TV Series/);
    await page.getByRole("button",{name:"Rate 5 out of 5",exact:true}).click();
    await page.getByTestId("quick-track-save").click();
    await page.getByTestId("finished-review-reminder").waitFor({state:"detached"});
    await reviewCompletion.waitFor();
    assert.match(await reviewCompletion.textContent(),/Rating saved\./);
    await reviewCompletion.waitFor({state:"detached"});
    const feedResult=await page.evaluate(()=>({
      requests:window.__fixture.requests,posts:window.__fixture.posts,noteWrites:window.__fixture.noteWrites,
    }));
    const listWrites=feedResult.requests.filter(request=>request.url.endsWith("/add-media-to-list"));
    const ratingWrites=feedResult.requests.filter(request=>request.url.endsWith("/rate-media"));
    assert.equal(listWrites.length,1);
    assert.equal(listWrites[0].body.media_type,mediaType);
    assert.equal(ratingWrites.length,1);
    assert.equal(ratingWrites[0].body.media_type,mediaType);
    assert.equal(ratingWrites[0].body.rating,5);
    assert.equal(feedResult.posts.length,1);
    assert.equal(feedResult.posts[0].media_type,mediaType);
    assert.equal(feedResult.noteWrites,0);
    assert.equal(feedResult.requests.filter(request=>request.url.endsWith("/track-media")).length,0);
  }
  console.log("PASS Now feed-card type aliases survive list save, five-star rating, and exactly one shared post for movies and TV.");

  await openNowFlow();
  await choosePageMedia();
  await page.getByRole("button",{name:"Finished: Completed media",exact:true}).click();
  await page.getByRole("button",{name:"Rate 4 out of 5",exact:true}).click();
  await page.getByTestId("quick-track-save").click();
  await assertNowRestored("/activity");
  await addedFeedback.waitFor();
  await addedFeedback.waitFor({state:"detached"});
  assert.equal(await page.getByTestId("finished-review-reminder").count(),0,
    "A normal save that already included a rating must not ask again");
  for(const evidence of ["existingRating","existingReview"]){
    await openNowFlow();
    await page.getByPlaceholder("Search movies, shows, books…").fill("fixture");
    await page.getByRole("button",{name:"Add Fixture title",exact:true}).click();
    await page.evaluate(key=>{window.__fixture[key]=true},evidence);
    await page.getByTestId("list-option-fixture-finished").click();
    await addedFeedback.waitFor();
    await addedFeedback.waitFor({state:"detached"});
    await page.waitForTimeout(100);
    assert.equal(await page.getByTestId("finished-review-reminder").count(),0,
      "Previously supplied ratings and reviews must suppress the optional prompt");
  }

  for (const [listId,label] of [
    ["fixture-queue","Want To"],["fixture-currently","Currently"],
    ["fixture-dnf","Did Not Finish"],["fixture-favorites","Favorites"],
  ]) {
    await openNowFlow();
    await page.getByPlaceholder("Search movies, shows, books…").fill("fixture");
    await page.getByRole("button",{name:"Add Fixture title",exact:true}).click();
    await page.getByTestId(`list-option-${listId}`).click();
    await assertNowRestored("/activity");
    await addedFeedback.filter({hasText:`Added to ${label}`}).waitFor();
    const listFeedback=addedFeedback.filter({hasText:`Added to ${label}`}).last();
    assert.equal(await listFeedback.locator(".consumed-added-headline").textContent(),"Logged!");
    assert.equal(await listFeedback.getByTestId("media-added-finished-check").count(),0);
    await page.getByRole("dialog").waitFor({state:"hidden"});
    assert.equal(await page.evaluate(()=>window.__fixture.requests.some(r=>
      /get-recommendations|rate-media|update-item-progress/.test(r.url))),false,
      "A primary save must not launch recommendation, rating or progress follow-ups");
    assert.equal(await page.evaluate(()=>window.__fixture.toasts.filter(t=>t.variant!=="destructive").length),0,
      "The animated acknowledgment must replace, not duplicate, plain success toasts");
  }
  await page.evaluate(()=>window.__fixture.showMediaAdded({title:"A very long title that should fit on a small phone without overflowing the screen",listName:"Finished"}));
  const newestFeedback=addedFeedback.filter({hasText:"Added to Finished"}).last();
  await newestFeedback.waitFor();
  assert.equal(await page.locator(".consumed-added-orbit").count(),0,
    "The approved stamp-and-snap refinement must not restore background rings");
  assert.equal(await page.locator(".consumed-dna-rail").count(),0,"The DNA icon must not have the old boxed rail");
  assert.equal(await page.locator(".media-added-dna__icon").last().evaluate(
    n=>getComputedStyle(n).animationName),"media-added-dna-pulse",
    "The rounded DNA icon must pulse with the stamp");
  const geometry=await newestFeedback.evaluate(node=>{
    const rect=node.getBoundingClientRect();
    const hit=document.elementFromPoint(rect.x+rect.width/2,rect.y+rect.height/2);
    const headline=Array.from(node.querySelectorAll("*")).find(n=>
      /^(Logged!|Consumed)$/.test(n.textContent.trim()) && parseFloat(getComputedStyle(n).fontSize)>=38);
    return {x:rect.x,right:rect.right,bottom:rect.bottom,centerY:rect.y+rect.height/2,
      panelHeight:rect.height,headline:!!headline,width:innerWidth,height:innerHeight,
      pointerEvents:getComputedStyle(node).pointerEvents,intercepts:node.contains(hit)};
  });
  assert.ok(geometry.x>=0&&geometry.right<=geometry.width,"Feedback must fit a phone");
  assert.ok(await newestFeedback.evaluate(n=>n.getBoundingClientRect().width)>=300,
    "Rapid additions must overlap during transitions, never shrink into side-by-side confirmations");
  assert.ok(geometry.panelHeight>=250,"Success must be a substantial animated moment, not a toast");
  assert.ok(geometry.headline,"Success must have a large Logged! or Consumed headline");
  assert.ok(Math.abs(geometry.centerY-geometry.height/2)<80,"The animation must appear in the middle of the screen");
  assert.ok(geometry.bottom<=geometry.height-64,"Feedback must stay above bottom navigation");
  assert.equal(geometry.pointerEvents,"none");
  assert.equal(geometry.intercepts,false,"The animation must not intercept taps");
  assert.equal(await page.locator('[role="status"][aria-live="polite"][aria-atomic="true"]').count(),1);
  if(screenshotDir) {
    await page.waitForFunction(()=>Array.from(document.querySelectorAll('[data-testid="media-added-confirmation"]')).some(
      node=>getComputedStyle(node).opacity==="1"));
    await page.screenshot({path:join(screenshotDir,"media-added-phone.png")});
  }
  await page.waitForFunction(()=>!document.querySelector('[data-testid="media-added-confirmation"]'),{},{timeout:5000});
  await page.setViewportSize({width:320,height:568});
  await page.emulateMedia({reducedMotion:"reduce"});
  await page.evaluate(()=>{window.__fixture.platform="ios"});
  const hapticsBeforeReducedMotion=await page.evaluate(()=>window.__fixture.haptics?.length??0);
  await page.evaluate(()=>window.__fixture.showMediaAdded({title:"Reduced motion",listName:"Finished"}));
  await addedFeedback.filter({hasText:"Added to Finished"}).waitFor();
  assert.equal(await addedFeedback.last().locator(".consumed-added-headline").textContent(),"Consumed");
  assert.equal(await addedFeedback.last().evaluate(n=>Array.from(n.querySelectorAll("*")).every(
    child=>getComputedStyle(child).animationName==="none")),true,
    "Reduced motion must disable decorative CSS animations");
  const smallRect=await addedFeedback.boundingBox();
  assert.ok(smallRect.x>=0&&smallRect.x+smallRect.width<=320,"Reduced-motion feedback must fit narrow phones");
  await page.waitForFunction(()=>!document.querySelector('[data-testid="media-added-confirmation"]'),{},{timeout:5000});
  assert.equal(await page.evaluate(()=>window.__fixture.haptics?.length??0),hapticsBeforeReducedMotion,
    "Reduced motion must not start a haptic timer");
  await page.emulateMedia({reducedMotion:"no-preference"});
  console.log("PASS Finished has its optional shared review, other destinations retain Logged!, and the rounded DNA icon pulses without a boxed rail; mobile positioning, tap-through, auto-dismiss, one live announcement and reduced motion are verified.");
  assert.deepEqual(errors, []);
  console.log("PASS browser and Android retain existing percentage/vh positioning; no runtime errors.");
  console.log("Browser simulation is not physical iOS keyboard verification.");
} finally {
  await browser?.close();
  if (server?.listening) await new Promise(resolveClose => server.close(resolveClose));
  await rm(temp, { recursive: true, force: true });
}
