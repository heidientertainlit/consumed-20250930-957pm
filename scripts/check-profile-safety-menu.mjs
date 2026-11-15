import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { createServer } from "node:http";
import { build } from "esbuild";
import { chromium } from "playwright";

// Exercise the actual profile menu markup, shared sheets, and confirmation,
// without authenticating against the app or allowing account mutations.
const source = await readFile("client/src/pages/user-profile.tsx", "utf8");
const start = source.indexOf("<Dialog ", source.indexOf("{/* Profile Options Dialog */}"));
const end = source.indexOf("</Dialog>", start) + "</Dialog>".length;
assert.ok(start >= 0 && end > start, "Profile options markup not found");
const menu = source.slice(start, end);
assert.match(menu, /<Dialog layered /, "The profile safety menu must be a layered centered dialog");
assert.equal((source.match(/<BlockUserSheet\s+presentation="dialog"/g) || []).length, 2,
  "Full and limited profile confirmations must both be centered");
const fixture = `
import React,{useState} from "react";
import {createRoot} from "react-dom/client";
import {Dialog,DialogContent,DialogTitle,DialogDescription} from "./client/src/components/ui/dialog";
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
  <BlockUserSheet presentation={new URLSearchParams(location.search).has("legacy") ? "sheet" : "dialog"} isOpen={isBlockConfirmOpen} onClose={()=>setIsBlockConfirmOpen(false)} targetUserId="other-person" targetUserName="fixture-person" />
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
const origin = `http://127.0.0.1:${server.address().port}`;
if (process.argv.includes("--serve")) {
  console.log(`Isolated profile safety preview: ${origin}`);
  await new Promise(() => {});
}
const browser = await chromium.launch({ headless: true });
async function unobscured(locator) {
  return locator.evaluate(node => {
    const r = node.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && r.top >= 0 && r.bottom <= innerHeight &&
      node.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2));
  });
}
async function centered(locator) {
  return locator.evaluate(node => {
    const r = node.getBoundingClientRect();
    return Math.abs(r.x + r.width / 2 - innerWidth / 2) <= 1 &&
      Math.abs(r.y + r.height / 2 - innerHeight / 2) <= 1;
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
    assert.ok(await centered(page.getByRole("dialog")), "Options must be centered");
    assert.equal(await page.locator("#root").evaluate(node => node.inert), true);
    // Negative control proves the hit test rejects the original covered layout.
    const layer = page.locator("[data-modal-layer]");
    const dialog = page.getByRole("dialog");
    const originalStyle = await dialog.getAttribute("style");
    await dialog.evaluate(node => Object.assign(node.style, {
      top: "auto", bottom: "0", left: "0", transform: "none", width: "100%", maxWidth: "none",
    }));
    await page.locator("#root").evaluate(node => { node.inert = false; });
    await page.locator("nav").evaluate(node => { node.style.pointerEvents = "auto"; });
    await layer.evaluate(node => { node.style.zIndex = "50"; });
    assert.equal(await unobscured(block), false, "Covered-menu negative control must fail");
    await layer.evaluate(node => { node.style.zIndex = "100001"; });
    await page.locator("#root").evaluate(node => { node.inert = true; });
    await dialog.evaluate((node, style) => { if (style === null) node.removeAttribute("style"); else node.setAttribute("style", style); }, originalStyle);
    await block.tap();
    const cancel = page.getByRole("button", { name: "Cancel", exact: true });
    await cancel.waitFor();
    await page.waitForFunction(() => [...document.querySelectorAll('[role="dialog"]')]
      .every(node => node.getAnimations().every(animation => animation.playState === "finished")));
    assert.ok(await centered(page.getByRole("dialog")), "Confirmation must be centered");
    assert.equal(await page.locator("#root").evaluate(node => node.inert), true);
    assert.ok(await unobscured(cancel), "Confirmation Cancel must be visible");
    assert.ok(await unobscured(page.getByRole("button", { name: "Block user", exact: true })));
    assert.equal(await page.evaluate(() => window.blockWrites), 0, "Opening the menu must not block anyone");
    await cancel.tap();
    await page.waitForTimeout(350);
    assert.equal(await page.evaluate(() => window.blockWrites), 0, "Cancel must not block anyone");
    await page.reload();
    await report.waitFor();
    await page.waitForFunction(() => [...document.querySelectorAll('[role="dialog"]')]
      .every(node => node.getAnimations().every(animation => animation.playState === "finished")));
    await report.tap();
    await page.getByRole("status").filter({ hasText: "Reporting flow opened" }).waitFor();
    assert.deepEqual(errors, []);
    console.log(`PASS ${viewport.width}x${viewport.height}: centered menu and confirmation, hit tests, negative control, Cancel, Report`);
    await page.close();
  }
  const legacy = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await legacy.goto(`${origin}/?legacy`);
  await legacy.getByRole("button", { name: "Block this user", exact: true }).click();
  await legacy.getByRole("button", { name: "Cancel", exact: true }).waitFor();
  await legacy.waitForFunction(() => [...document.querySelectorAll('[role="dialog"]')]
    .every(node => node.getAnimations().every(animation => animation.playState === "finished")));
  assert.equal(await legacy.getByRole("dialog").evaluate(node =>
    Math.abs(node.getBoundingClientRect().bottom - innerHeight) <= 1), true,
    "Other callers must retain the bottom-sheet confirmation");
  console.log("PASS non-profile confirmation remains a bottom sheet");
  await legacy.close();
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}
