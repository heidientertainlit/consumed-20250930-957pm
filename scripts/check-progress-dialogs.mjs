// Build gate: real progress components/JSX + the production stylesheet.
// All authentication and transport are isolated; no live data is read or written.
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { createServer } from "node:http";
import { build } from "esbuild";
import { chromium } from "playwright";

async function progressMarkup(file, marker) {
  const source = await readFile(file, "utf8");
  const start = source.indexOf("<Sheet open={isProgressSheetOpen}", source.indexOf(marker));
  const end = source.indexOf("</Sheet>", start);
  assert.ok(start >= 0 && end > start, `Cannot locate active progress dialog in ${file}`);
  const jsx = source.slice(start, end + "</Sheet>".length);
  for (const component of ["ProgressSheetContent", "ProgressSheetBody", "ProgressSheetActions"]) {
    assert.ok(jsx.includes(`<${component}>`), `${file} must use ${component}`);
  }
  return jsx;
}

const collections = await progressMarkup("client/src/pages/collections.tsx", "{/* Progress Edit Sheet */}");
const detail = await progressMarkup("client/src/pages/media-detail.tsx", "{/* Update Progress Sheet */}");
const navigation = await readFile("client/src/components/navigation.tsx", "utf8");
const navClass = navigation.match(/<nav className=\{(`app-bottom-nav[^`]+`)\}/)?.[1];
assert.ok(navClass, "Use the real navigation stacking classes, not a guessed layer");

const bundle = await build({
  stdin: {
    resolveDir: process.cwd(), loader: "tsx", contents: `
      import React, {useState} from "react";
      import {createRoot} from "react-dom/client";
      import {QueryClient,QueryClientProvider} from "@tanstack/react-query";
      import {ProgressUpdateSheet} from "./client/src/components/progress-update-sheet";
      import {ProgressSheetContent,ProgressSheetBody,ProgressSheetActions,ProgressSheetConfirmation} from "./client/src/components/progress-sheet-layout";
      import {Sheet,SheetTitle} from "./client/src/components/ui/sheet";
      import {Button} from "./client/src/components/ui/button";
      import {Input} from "./client/src/components/ui/input";
      import {AlertDialog,AlertDialogTrigger,AlertDialogHeader,AlertDialogTitle,AlertDialogDescription,AlertDialogFooter,AlertDialogCancel,AlertDialogAction} from "./client/src/components/ui/alert-dialog";
      const params=new URLSearchParams(location.search);
      const variant=params.get("variant")||"shared", mediaType=params.get("media")||"tv";
      const elevated=params.has("elevated"), inline=elevated;
      window.fx={saves:[],finished:0,removed:0};
      // Keep screenshots and manual fixture visits isolated too, not just Playwright.
      const originalFetch=window.fetch.bind(window);
      window.fetch=async(resource,options)=>{
        const url=new URL(String(resource),location.href);
        if(url.origin===location.origin)return originalFetch(resource,options);
        if(url.pathname.endsWith("/functions/v1/get-media-details"))
          return Response.json({seasons:[{seasonNumber:1,episodeCount:12},{seasonNumber:2,episodeCount:12}]});
        if(url.pathname.endsWith("/functions/v1/update-item-progress")&&options?.method==="POST"){
          window.fx.saves.push(JSON.parse(options.body));
          return Response.json({success:true});
        }
        throw new Error("Unexpected fixture transport: "+url.pathname);
      };
      const item={id:"fixture-item",title:"A deliberately long media title for a small screen",
        media_type:mediaType,external_id:"fixture-media",progress:3,progress_total:mediaType==="tv"?1:300,total:300};
      const modes=mediaType==="tv"?["episode","percent"]:mediaType==="book"?["page","percent"]:mediaType==="podcast"?["minutes","percent"]:["percent"];
      function LegacyDialog(){
        const [isProgressSheetOpen,setIsProgressSheetOpen]=useState(true);
        const [editMode,setEditMode]=useState(modes[0]);
        const [editProgress,setEditProgress]=useState(3),[editTotal,setEditTotal]=useState(300);
        const [editSeason,setEditSeason]=useState(1),[editEpisode,setEditEpisode]=useState(3);
        const seasons=[{seasonNumber:1,episodeCount:12},{seasonNumber:2,episodeCount:12}];
        const maxEpisodes=12,isTvDataLoading=false,isUpdating=false;
        const deleteItemMutation={isPending:false};
        const getMediaIcon=()=>null;
        const getModeOptions=()=>modes.map(value=>({value,label:value}));
        const handleSaveProgress=()=>window.fx.saves.push({progress:editProgress,total:editTotal,mode:editMode});
        const handleRemoveFromLibrary=()=>window.fx.removed++;
        const onMoveToList=()=>window.fx.finished++;
        const updateProgressMutation={isPending:false,mutate:payload=>window.fx.saves.push(payload)};
        return variant==="collections"?(${collections}):(${detail});
      }
      function App(){
        const [open,setOpen]=useState(true);
        return <>
          <div style={elevated?{position:"fixed",inset:0,zIndex:99999,background:"#fafafa"}:{}}>
            <p>Background page</p>
            <nav className={${navClass}} style={{height:84,background:"#ddd",transform:"translateZ(0)",pointerEvents:"auto"}}>
              Bottom navigation
            </nav>
          </div>
          {variant==="shared"?<ProgressUpdateSheet isOpen={open} onOpenChange={setOpen} item={item}
            elevated={elevated} onFinished={()=>window.fx.finished++} showRemoveOption={true}
            onRemove={()=>window.fx.removed++}/>:<LegacyDialog/>}
        </>;
      }
      const client=new QueryClient({defaultOptions:{queries:{retry:false,refetchOnWindowFocus:false}}});
      createRoot(document.getElementById("root")).render(<QueryClientProvider client={client}><App/></QueryClientProvider>);
    `,
  },
  bundle: true, write: false, platform: "browser", format: "iife", jsx: "automatic",
  define: { "process.env.NODE_ENV": '"development"' },
  plugins: [{
    name: "isolated-progress-services",
    setup(builder) {
      builder.onResolve({ filter: /^@\/(?:lib\/(?:auth|supabase)|hooks\/use-toast)$/ },
        args => ({ path: args.path, namespace: "fixture" }));
      builder.onLoad({ filter: /.*/, namespace: "fixture" }, args => ({
        loader: "js",
        contents: args.path.endsWith("/auth")
          ? 'export const useAuth=()=>({session:{access_token:"fixture-only",user:{id:"fixture-user"}}});'
          : args.path.endsWith("/use-toast")
            ? 'export const useToast=()=>({toast:()=>{}});'
            : 'export const supabase={from(){throw new Error("Unexpected database access in progress fixture")}};',
      }));
    },
  }],
});
const assets = await readdir("dist/public/assets");
const stylesheet = assets.find(name => /^index-.*\.css$/.test(name));
assert.ok(stylesheet, "Build production CSS before checking dialogs");
const css = await readFile(`dist/public/assets/${stylesheet}`);
const server = createServer((req, res) => {
  if (req.url === "/fixture.js") {
    res.setHeader("Content-Type", "text/javascript");
    res.end(bundle.outputFiles[0].text);
  } else if (req.url === "/style.css") {
    res.setHeader("Content-Type", "text/css"); res.end(css);
  } else {
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.end('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"></head><body><div id="root"></div><script src="/fixture.js"></script></body></html>');
  }
});
const serving = process.argv.includes("--serve");
await new Promise(resolve => server.listen(serving ? 5001 : 0, "0.0.0.0", resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
let browser;
let passed = false;

async function buttonGeometry(button) {
  return button.evaluate(node => {
    const r = node.getBoundingClientRect();
    const points = [[.5,.5],[.1,.1],[.9,.1],[.1,.9],[.9,.9]];
    return {
      onScreen: r.width > 0 && r.height >= 32 && r.left >= 0 && r.top >= 0 &&
        r.right <= innerWidth + 1 && r.bottom <= innerHeight + 1,
      unobscured: points.every(([x,y]) =>
        node.contains(document.elementFromPoint(r.left+r.width*x,r.top+r.height*y))),
    };
  });
}

try {
  browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.route("**/*", async route => {
    const request = route.request(), url = request.url();
    if (url.startsWith(origin + "/")) return route.continue();
    if (url.includes("/functions/v1/get-media-details")) {
      return route.fulfill({ json: {seasons:[{seasonNumber:1,episodeCount:12},{seasonNumber:2,episodeCount:12}]} });
    }
    if (url.endsWith("/functions/v1/update-item-progress") && request.method() === "POST") {
      await page.evaluate(payload => window.fx.saves.push(payload), request.postDataJSON());
      return route.fulfill({ json: {success:true} });
    }
    errors.push(`Unexpected request: ${new URL(url).pathname}`);
    return route.abort();
  });
  const sizes = [
    {width:390,height:844}, {width:320,height:568}, {width:390,height:360},
    {width:390,height:320}, {width:844,height:390}, {width:1280,height:800},
  ];
  const cases = [
    ...["movie","tv","book","podcast"].map(media => ({variant:"shared",media})),
    ...["movie","tv","book","podcast"].map(media => ({variant:"collections",media})),
    ...["movie","book"].map(media => ({variant:"media-detail",media})),
    ...["tv","book"].map(media => ({variant:"shared",media,elevated:"1"})),
  ];
  let count = 0;
  for (const scenario of cases) {
    const label = JSON.stringify(scenario);
    await page.setViewportSize(sizes[0]);
    await page.goto(`${origin}/?${new URLSearchParams(scenario)}`);
    const sheet = page.locator("[data-progress-sheet]");
    await sheet.waitFor();
    // Wait for the real Radix opening transition, not an arbitrary sleep.
    await page.waitForFunction(() => {
      const node = document.querySelector("[data-progress-sheet]");
      return node && node.getAnimations().every(animation => animation.playState === "finished");
    });
    for (const size of sizes) {
      await page.setViewportSize(size);
      const save = sheet.getByRole("button", {name:"Update Progress",exact:true});
      const focusedInput = sheet.locator("input").last();
      if (await focusedInput.count()) await focusedInput.focus();
      const geometry = await buttonGeometry(save);
      assert.ok(geometry.onScreen, `${label} ${JSON.stringify(size)}: save is outside the screen`);
      assert.ok(geometry.unobscured, `${label} ${JSON.stringify(size)}: navigation covers save`);
      assert.equal(await save.isEnabled(), true, `${label}: save unexpectedly disabled`);
      for (const action of await sheet.locator("[data-progress-actions] button").all()) {
        const g = await buttonGeometry(action);
        assert.ok(g.onScreen && g.unobscured, `${label}: a footer action is hidden`);
      }
      const body = sheet.locator("[data-progress-scroll]");
      assert.ok(await body.evaluate(node => node.clientHeight > 0), `${label}: no usable scrolling form`);
      await body.evaluate(node => { node.scrollTop = node.scrollHeight; });
      assert.ok(await body.evaluate(node => Math.abs(node.scrollTop + node.clientHeight - node.scrollHeight) <= 2),
        `${label}: the bottom of the form cannot be reached`);
      count++;
    }
    await page.setViewportSize(sizes[0]);
    if (scenario.variant !== "media-detail") {
      await sheet.getByRole("button", {name:"Remove from Library",exact:true}).click();
      const confirmation = page.getByRole("alertdialog");
      await confirmation.waitFor();
      const cancel = confirmation.getByRole("button", {name:"Cancel",exact:true});
      const g = await buttonGeometry(cancel);
      assert.ok(g.onScreen && g.unobscured, `${label}: removal confirmation is buried`);
      await cancel.click();
      assert.equal(await page.evaluate(() => window.fx.removed), 0, "Cancelling must not remove media");
    }
    await sheet.getByRole("button", {name:"Update Progress",exact:true}).click();
    await page.waitForFunction(() => window.fx.saves.length === 1);
    const payload = await page.evaluate(() => window.fx.saves[0]);
    assert.ok(Number.isFinite(payload.progress), `${label}: saving lost progress data`);
    if (scenario.variant === "shared") assert.equal(payload.item_id, "fixture-item");
  }
  // Negative controls prove the gate catches both original classes of bug.
  await page.setViewportSize(sizes[0]);
  await page.goto(`${origin}/?variant=media-detail&media=movie`);
  const save = page.locator("[data-progress-sheet]").getByRole("button", {name:"Update Progress",exact:true});
  await save.waitFor();
  await page.waitForFunction(() => document.querySelector("[data-progress-sheet]").getAnimations().every(a => a.playState === "finished"));
  const buried = await page.addStyleTag({content:"[data-progress-sheet]{z-index:50!important}"});
  assert.equal((await buttonGeometry(save)).unobscured, false, "Gate did not detect a navigation-covered button");
  await buried.evaluate(node => node.remove());
  await page.addStyleTag({content:"[data-progress-actions]{transform:translateY(200px)}"});
  assert.equal((await buttonGeometry(save)).onScreen, false, "Gate did not detect an off-screen button");
  assert.deepEqual(errors, [], "Progress fixtures produced browser errors or unexpected network traffic");
  console.log(`Progress dialog build gate passed: ${count} layouts, focused inputs, scrolling, real saves, removal cancellation, and negative controls.`);
  passed = true;
} finally {
  await browser?.close();
  if (!serving || !passed) await new Promise(resolve => server.close(resolve));
}
if (serving && passed) {
  console.log("Progress dialog fixture ready on port 5001.");
  process.on("SIGTERM", () => server.close(() => process.exit(0)));
}
