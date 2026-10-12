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
    window.__fixture = {
      platform: new URLSearchParams(location.search).get("platform") || "web",
      session: { access_token: "fixture-token", user: { id: "fixture-user" } },
      requests: [], toasts: [], invalidations: [], closes: 0
    };
    window.fetch = async (url, init={}) => {
      if (!String(url).startsWith("https://fixture.invalid/")) throw Error("Unexpected network request");
      const body = JSON.parse(init.body || "{}");
      window.__fixture.requests.push({ url: String(url), body });
      if (String(url).endsWith("/media-search")) return new Response(JSON.stringify({
        results: [{ title: "Fixture title", type: body.type || "movie",
          external_id: "fixture-title", external_source: "fixture", year: "2026",
          image_url: "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==",
          creator: "Fixture creator" }]
      }));
      if (String(url).endsWith("/track-media")) return new Response("{}");
      throw Error("Unhandled fixture endpoint");
    };
    function Fixture() {
      const [open, setOpen] = useState(true);
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
    "@/lib/supabase": `export const supabase={from:()=>{throw Error("Unexpected database write")}};`,
    "@capacitor/core": `export const Capacitor={getPlatform:()=>window.__fixture.platform};`,
    "@tanstack/react-query": `export const useQuery=()=>({data:[],isLoading:false});`,
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
  page.on("pageerror", error => errors.push(error.message));
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
  assert.deepEqual(errors, []);
  console.log("PASS browser and Android retain existing percentage/vh positioning; no runtime errors.");
  console.log("Browser simulation is not physical iOS keyboard verification.");
} finally {
  await browser?.close();
  if (server?.listening) await new Promise(resolveClose => server.close(resolveClose));
  await rm(temp, { recursive: true, force: true });
}
