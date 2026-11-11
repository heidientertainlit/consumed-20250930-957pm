// Real dialog and the existing feed's actual spoiler/reveal JSX, with no live
// session, database calls, posts, or library writes.
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import http from "node:http";
import { build } from "esbuild";
import { chromium } from "playwright";

const feed = await readFile("client/src/pages/feed.tsx", "utf8");
const start = feed.indexOf("post.containsSpoilers && !isSpoilerRevealed ? (");
const end = feed.indexOf("\n                )}", start);
assert.ok(start > 0 && end > start);
const expression = feed.slice(start, end);
const bundle = await build({
  stdin: { contents: `
    import React, {useState} from "react";
    import {createRoot} from "react-dom/client";
    import {Eye} from "lucide-react";
    import {FinishedMediaFollowUpContent,FinishedMediaFollowUp} from "./client/src/components/finished-media-follow-up";
    function FeedExcerpt({containsSpoilers}) {
      const post={containsSpoilers};
      const displayContent="The unexpected ending changes everything.";
      const [isSpoilerRevealed,setIsSpoilerRevealed]=useState(false);
      const [contentExpanded,setContentExpanded]=useState(false);
      return <>{${expression}}</>;
    }
    function App() {
      const [containsSpoilers,setContainsSpoilers]=useState(false);
      const [busy,setBusy]=useState(false);
      const [modal,setModal]=useState(false);
      const [elevated,setElevated]=useState(false);
      window.fixture={containsSpoilers,setBusy,openModal:()=>setModal(true),setElevated};
      const Dialog=modal?FinishedMediaFollowUp:FinishedMediaFollowUpContent;
      return <main style={{maxWidth:440,margin:"0 auto"}}>
        {modal && <nav id="fixture-nav" style={{position:"fixed",bottom:0,left:0,right:0,height:84,zIndex:elevated?99999:9999,background:"silver"}}>Bottom navigation</nav>}
        <Dialog isOpen={true} elevated={elevated} media={{title:"Example film",mediaType:"movie"}}
          rating={0} reaction="The final scene changes everything." error={null} busy={busy}
          containsSpoilers={containsSpoilers} onContainsSpoilersChange={setContainsSpoilers}
          onRatingChange={()=>{}} onReactionChange={()=>{}} onClose={()=>{}}
          onSubmit={()=>{window.savedSpoiler=containsSpoilers}} />
        <section id="feed-check" style={{padding:20,background:"white",marginTop:16}}>
          <FeedExcerpt key={String(containsSpoilers)} containsSpoilers={containsSpoilers}/>
        </section>
      </main>;
    }
    createRoot(document.getElementById("root")).render(<App/>);
  `, resolveDir: process.cwd(), loader: "tsx" },
  bundle: true, write: false, format: "iife", platform: "browser", jsx: "automatic",
});
const files = await readdir("dist/public/assets");
const css = await readFile(`dist/public/assets/${files.find(name => /^index-.*\.css$/.test(name))}`);
const server = http.createServer((req, res) => {
  if (req.url === "/fixture.js") { res.setHeader("Content-Type", "text/javascript"); res.end(bundle.outputFiles[0].text); return; }
  if (req.url === "/style.css") { res.setHeader("Content-Type", "text/css"); res.end(css); return; }
  res.setHeader("Content-Type","text/html; charset=utf-8");
  res.end('<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"></head><body style="background:#e6e2ec"><div id="root"></div><script src="/fixture.js"></script></body></html>');
});
await new Promise(resolve => server.listen(5001, "0.0.0.0", resolve));
const browser = await chromium.launch({headless:true,args:["--no-sandbox"]});
try {
  const page = await browser.newPage({viewport:{width:402,height:874}});
  await page.goto("http://127.0.0.1:5001");
  const checkbox = page.getByRole("checkbox", {name:"Contains spoilers"});
  await checkbox.waitFor();
  assert.equal(await checkbox.isChecked(),false);
  assert.equal(await page.locator("#feed-check .blur-md").count(),0);
  await checkbox.check();
  await page.waitForFunction(()=>window.fixture.containsSpoilers===true);
  assert.equal(await page.locator("#feed-check .blur-md").count(),1);
  await page.locator("#feed-check").getByRole("button",{name:"Show Spoiler"}).click();
  assert.equal(await page.locator("#feed-check .blur-md").count(),0);
  await page.getByRole("button",{name:"Save",exact:true}).click();
  assert.equal(await page.evaluate(()=>window.savedSpoiler),true);
  await checkbox.focus();
  await page.keyboard.press("Space");
  await page.waitForFunction(()=>window.fixture.containsSpoilers===false);
  await page.getByRole("button",{name:"Save",exact:true}).click();
  assert.equal(await page.evaluate(()=>window.savedSpoiler),false);
  await page.evaluate(()=>window.fixture.setBusy(true));
  await page.waitForFunction(()=>document.querySelector('input[type="checkbox"]').disabled);
  assert.equal(await checkbox.isDisabled(),true);
  await page.evaluate(()=>{window.fixture.setBusy(false);window.fixture.openModal()});
  await page.getByRole("dialog").waitFor();
  for (const elevated of [false,true]) {
    await page.evaluate(value=>window.fixture.setElevated(value),elevated);
    for (const height of [874,600]) {
      await page.setViewportSize({width:402,height});
      const footer=page.getByRole("button",{name:"Not now",exact:true});
      await footer.waitFor({state:"visible"});
      // Vaul's opening animation is visible before it finishes sliding on-screen.
      await page.waitForFunction(()=>{
        const button=[...document.querySelectorAll('[role="dialog"] button')].find(el=>el.textContent==="Not now");
        if(!button)return false;
        const r=button.getBoundingClientRect();
        return r.y>=0 && r.bottom<=window.innerHeight;
      });
      const box=await footer.boundingBox();
      assert.ok(box && box.y>=0 && box.y+box.height<=height, "Footer fell outside the visible screen");
      const reachable=await footer.evaluate(button=>{
        const r=button.getBoundingClientRect();
        return document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)?.closest("button")===button;
      });
      assert.equal(reachable,true,"Bottom navigation covered the footer button");
    }
  }
  assert.doesNotMatch(await page.getByRole("dialog").innerText(),/Already saved to Finished|Your reaction will be blurred|Reactions and ratings are public/);
  console.log("Browser checks passed: spoiler toggle, feed blur/reveal, removed copy, and reachable modal footer above navigation at two mobile heights and both elevations.");
} finally {
  await browser.close();
  if (!process.argv.includes("--serve")) server.close();
}
if(process.argv.includes("--serve")) {
  console.log("Spoiler fixture ready on port 5001.");
  process.on("SIGTERM",()=>server.close(()=>process.exit(0)));
}
