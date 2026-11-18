import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { createServer } from "node:http";
import { build } from "esbuild";
import { chromium } from "playwright";

// Render the production row markup without signing in or writing library data.
const source = await readFile("client/src/components/quick-add-list-sheet.tsx", "utf8");
const start = source.indexOf("sortedLists.map((list: any) => {");
const end = source.indexOf("\n            )}", start);
assert.ok(start > 0 && end > start, "List option markup not found");
const rows = source.slice(start, end).trim();
const fixture = `
import React from "react";
import {createRoot} from "react-dom/client";
import {Check, Loader2, Clock} from "lucide-react";
const sortedLists=[{id:"want",title:"Want To"},{id:"finished",title:"Finished"},{id:"favorites",title:"Favorites"}];
const savedListIds=["finished","favorites"];
const isAdding=new URLSearchParams(location.search).has("pending")?"finished":null;
const getListStyle=()=>({bg:"bg-green-100",icon:<Clock size={20}/>,desc:"Original description"});
const getDisplayName=name=>name;
const handleAddToList=(id,name)=>{window.lastSelection={id,name};};
createRoot(document.getElementById("root")).render(
  <main className="min-h-screen bg-white px-4 py-8">
    <h1 className="mb-6 text-center text-lg font-semibold">Add to List</h1>
    {${rows}}
  </main>
);`;
const bundle = await build({
  stdin: { contents: fixture, resolveDir: process.cwd(), loader: "tsx" },
  bundle: true, write: false, jsx: "automatic",
  define: { "process.env.NODE_ENV": '"development"' },
});
const files = await readdir("dist/public/assets");
const cssFile = files.find(name => /^index-.*\.css$/.test(name));
assert.ok(cssFile, "Build app CSS before running this check");
const css = await readFile(`dist/public/assets/${cssFile}`);
const server = createServer((req, res) => {
  if (req.url === "/fixture.js") {
    res.setHeader("Content-Type", "text/javascript");
    res.end(bundle.outputFiles[0].text);
  } else if (req.url === "/style.css") {
    res.setHeader("Content-Type", "text/css");
    res.end(css);
  } else {
    res.setHeader("Content-Type", "text/html");
    res.end('<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"><div id="root"></div><script src="/fixture.js"></script>');
  }
});
const serve = process.argv.includes("--serve");
await new Promise(resolve => server.listen(serve ? 5099 : 0, "0.0.0.0", resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  for (const viewport of [{ width: 390, height: 844 }, { width: 1280, height: 800 }]) {
    await page.setViewportSize(viewport);
    await page.goto(origin);
    const finished = page.getByRole("button", { name: "Finished Already in Finished", exact: true });
    await finished.waitFor();
    assert.equal(await finished.isEnabled(), true);
    assert.equal(await finished.locator('svg[aria-hidden="true"]').count(), 1);
    await finished.click();
    assert.deepEqual(await page.evaluate(() => window.lastSelection), { id: "finished", name: "Finished" });
    await page.getByRole("button", { name: "Favorites Already in Favorites", exact: true }).waitFor();
    const want = page.getByRole("button", { name: "Want To Original description", exact: true });
    await want.click();
    assert.deepEqual(await page.evaluate(() => window.lastSelection), { id: "want", name: "Want To" });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await page.goto(`${origin}/?pending`);
    await page.getByRole("button", { name: "Finished Already in Finished", exact: true }).waitFor();
    assert.equal(await page.locator("button:disabled").count(), 3);
    console.log(`PASS ${viewport.width}x${viewport.height}: saved labels/checkmarks, tappable saved rows, unsaved rows, pending protection`);
  }
} finally {
  await browser.close();
  if (!serve) await new Promise(resolve => server.close(resolve));
}
if (serve) console.log(`Indicator fixture ready at ${origin}`);
