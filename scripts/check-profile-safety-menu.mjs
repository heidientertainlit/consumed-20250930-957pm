import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { createServer } from "node:http";
import { build } from "esbuild";
import { chromium } from "playwright";

// Exercise the actual profile menu markup, shared sheets, and confirmation,
// without authenticating against the app or allowing account mutations.
const source = await readFile("client/src/pages/user-profile.tsx", "utf8");
const start = source.indexOf("<Sheet ", source.indexOf("{/* Profile Options Sheet */}"));
const end = source.indexOf("</Sheet>", start) + "</Sheet>".length;
assert.ok(start >= 0 && end > start, "Profile options markup not found");
const menu = source.slice(start, end);
assert.match(menu, /<Sheet layered /, "The profile safety menu must opt into modal layering");
const fixture = `
import React,{useState} from "react";
import {createRoot} from "react-dom/client";
import {Sheet,SheetContent,SheetTitle} from "./client/src/components/ui/sheet";
import {BlockUserSheet} from "./client/src/components/block-user-sheet";
import {Flag,Ban} from "lucide-react";
window.blockWrites=0;
function Fixture(){
 const [isProfileOptionsOpen,setIsProfileOptionsOpen]=useState(true);
 const [isBlockConfirmOpen,setIsBlockConfirmOpen]=useState(false);
 const [isReportUserOpen,setIsReportUserOpen]=useState(false);
 const userProfileData={display_name:"Fixture person",user_name:"fixture-person"};
 return <>
  <nav className="app-bottom-nav" style={{position:"fixed",bottom:0,left:0,right:0,zIndex:9999,height:88,background:"#F6F6F7"}}><button>Background navigation</button></nav>
  {isReportUserOpen&&<p role="status">Reporting flow opened</p>}
  {${menu}}
  <BlockUserSheet isOpen={isBlockConfirmOpen} onClose={()=>setIsBlockConfirmOpen(false)} targetUserId="other-person" targetUserName="fixture-person" />
 </>;
}
createRoot(document.getElementById("root")).render(<Fixture/>);`;
const doubles = {
  "@/lib/auth": `export const useAuth=()=>({user:{id:"fixture-viewer"}});`,
  "@/hooks/use-block-user": `export const useBlockUser=()=>({isPending:false,mutate:()=>{window.blockWrites++}});`,
};
const bundle = await build({
  stdin: { contents: fixture, resolveDir: process.cwd(), loader: "tsx" },
  bundle: true, write: false, platform: "browser", format: "iife", jsx: "automatic",
  define: { "process.env.NODE_ENV": '"development"' },
  plugins: [{ name: "isolated-profile-services", setup(api) {
    api.onResolve({ filter: /.*/ }, args => args.path in doubles ? { path: args.path, namespace: "double" } : undefined);
    api.onLoad({ filter: /.*/, namespace: "double" }, args => ({ contents: doubles[args.path], loader: "js" }));
  } }],
});
const files = await readdir("dist/public/assets");
const cssFile = files.find(name => /^index-.*\.css$/.test(name));
assert.ok(cssFile, "Build the app CSS before running this test");
const css = await readFile(`dist/public/assets/${cssFile}`);
const server = createServer((req, res) => {
  if (req.url === "/fixture.js") {
    res.setHeader("Content-Type", "text/javascript"); res.end(bundle.outputFiles[0].text);
  } else if (req.url === "/style.css") {
    res.setHeader("Content-Type", "text/css"); res.end(css);
  } else {
    res.setHeader("Content-Type", "text/html");
    res.end('<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"><div id="root"></div><script src="/fixture.js"></script>');
  }
});
await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
const browser = await chromium.launch({ headless: true });
const origin = `http://127.0.0.1:${server.address().port}`;
async function unobscured(locator) {
  return locator.evaluate(node => {
    const r = node.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && r.top >= 0 && r.bottom <= innerHeight &&
      node.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2));
  });
}
try {
  for (const viewport of [{ width: 390, height: 844 }, { width: 320, height: 568 }, { width: 390, height: 360 }]) {
    const page = await browser.newPage({ viewport, isMobile: true, hasTouch: true });
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.route("**/*", route => route.request().url().startsWith(origin) ? route.continue() : route.abort());
    await page.goto(origin);
    const report = page.getByRole("button", { name: "Report this user", exact: true });
    const block = page.getByRole("button", { name: "Block this user", exact: true });
    await block.waitFor();
    await page.waitForFunction(() => [...document.querySelectorAll('[role="dialog"]')]
      .every(node => node.getAnimations().every(animation => animation.playState === "finished")));
    assert.ok(await unobscured(report), JSON.stringify(await report.evaluate(node => {
      const r = node.getBoundingClientRect();
      return { message: "Report must be above navigation", rect: r.toJSON(), viewport: [innerWidth, innerHeight],
        top: document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)?.outerHTML.slice(0, 450),
        dialog: (()=>{ const d=node.closest('[role="dialog"]'); const s=getComputedStyle(d); return {rect:d.getBoundingClientRect().toJSON(),bottom:s.bottom,transform:s.transform,animation:s.animation,position:s.position}; })() };
    })));
    assert.ok(await unobscured(block), "Block must be above navigation");
    assert.equal(await page.locator("#root").evaluate(node => node.inert), true);
    // Negative control proves the hit test rejects the original covered layout.
    const layer = page.locator("[data-modal-layer]");
    await page.locator("#root").evaluate(node => { node.inert = false; });
    await page.locator("nav").evaluate(node => { node.style.pointerEvents = "auto"; });
    await layer.evaluate(node => { node.style.zIndex = "50"; });
    assert.equal(await unobscured(block), false, "Covered-menu negative control must fail");
    await layer.evaluate(node => { node.style.zIndex = "100001"; });
    await page.locator("#root").evaluate(node => { node.inert = true; });
    await block.tap();
    const cancel = page.getByRole("button", { name: "Cancel", exact: true });
    await cancel.waitFor();
    await page.waitForTimeout(550);
    assert.ok(await unobscured(cancel), "Confirmation Cancel must be visible");
    assert.ok(await unobscured(page.getByRole("button", { name: "Block user", exact: true })));
    assert.equal(await page.evaluate(() => window.blockWrites), 0, "Opening the menu must not block anyone");
    await cancel.tap();
    await page.waitForTimeout(350);
    assert.equal(await page.evaluate(() => window.blockWrites), 0, "Cancel must not block anyone");
    await page.reload();
    await report.waitFor();
    await page.waitForTimeout(550);
    await report.tap();
    await page.getByRole("status").filter({ hasText: "Reporting flow opened" }).waitFor();
    assert.deepEqual(errors, []);
    console.log(`PASS ${viewport.width}x${viewport.height}: menu hit tests, negative control, confirmation, Cancel, Report`);
    await page.close();
  }
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}
