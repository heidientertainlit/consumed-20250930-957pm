import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { createServer } from "node:http";
import { build } from "esbuild";
import { chromium, webkit } from "playwright";
import { readModalState, reportModalFailure } from "./lib/modal-test-diagnostics.mjs";
import { waitForModalInputReady } from "./lib/modal-test-readiness.mjs";

const doubles = {
  "@/lib/auth": `export const useAuth=()=>({user:{id:"fixture-user"},session:{access_token:"fixture-only"}});`,
  "@/hooks/use-toast": `export const useToast=()=>({toast:message=>{window.fx.toasts=(window.fx.toasts||[]).concat(message)}});`,
  "@/lib/share": `
    export const APP_BASE = "https://fixture.invalid";
    export const appApiUrl = (path) => path;
  `,
  "@/lib/supabase": `
    export const supabase={auth:{getUser:async()=>({data:{user:{id:"fixture-user"}},error:null})},from(table){
      const q={select(){return q},eq(){return q},neq(){return q},in(){return q},limit(){return q},
        order(){return q},single(){return q},maybeSingle(){return q},
        insert(payload){window.fx.writes.push({table,payload});return q},
        then(resolve,reject){return Promise.resolve({data:[],error:null}).then(resolve,reject)}};
      return q;
    }};`,
};
const bundle = await build({
  entryPoints: ["scripts/fixtures/modal-foundation.tsx"],
  bundle: true, write: false, platform: "browser", format: "iife", jsx: "automatic",
  define: { "process.env.NODE_ENV": '"development"', "import.meta.env": '{"VITE_SUPABASE_URL":"https://fixture.invalid","VITE_SUPABASE_ANON_KEY":"fixture-only"}' },
  plugins: [{ name: "isolated-services", setup(api) {
    api.onResolve({ filter: /.*/ }, args => args.path in doubles ? { path: args.path, namespace: "double" } : undefined);
    api.onLoad({ filter: /.*/, namespace: "double" }, args => ({ contents: doubles[args.path], loader: "js" }));
  } }],
});
const assets = await readdir("dist/public/assets");
const cssFile = assets.find(name => /^index-.*\.css$/.test(name));
assert.ok(cssFile, "Build production CSS before running modal checks");
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
const serving = process.argv.includes("--serve");
await new Promise(resolve => server.listen(serving ? 5001 : 0, serving ? "0.0.0.0" : "127.0.0.1", resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
if (serving) {
  console.log("Isolated modal fixture ready on port 5001. No public port mapping is required.");
  await new Promise(() => {});
}
const browsers = process.argv.includes("--webkit") ? [webkit] : [chromium];
let checked = 0;

async function settled(page) {
  await page.waitForFunction(() => [...document.querySelectorAll('[role="dialog"],[role="alertdialog"]')]
    .every(node => node.getAnimations().every(animation => animation.playState === "finished")));
}
async function unobscured(locator) {
  return locator.evaluate(node => {
    const r = node.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && r.top >= -1 && r.bottom <= innerHeight + 1 &&
      (node.disabled ? node.parentElement : node).contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2));
  });
}
async function backgroundDisabled(page) {
  assert.equal(await page.locator("#root").evaluate(el => el.inert), true);
  await page.locator('input[aria-label="Background input"]').evaluate(el => el.focus());
  assert.equal(await page.locator('input[aria-label="Background input"]').evaluate(el => el === document.activeElement), false);
  assert.equal(await page.evaluate(() => window.fx.navClicks), 0);
}
async function restored(page) {
  await page.waitForFunction(() => !document.querySelector("#root").inert);
  await page.getByRole("button", { name: "Navigation action", exact: true }).click();
  assert.equal(await page.evaluate(() => window.fx.navClicks), 1);
}

try {
  for (const engine of browsers) {
    const browser = await engine.launch({ headless: true });
    const diagnostics = {
      engine: engine.name(), phase: "initialization",
      errors: [], consoleErrors: [], snapshots: [],
    };
    try {
      const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
      diagnostics.page = page;
      const errors = diagnostics.errors;
      const consoleErrors = diagnostics.consoleErrors;
      page.on("pageerror", e => errors.push(e.message));
      page.on("console", message => {
        if (message.type() === "error") consoleErrors.push(message.text());
      });
      await page.route("**/*", route => route.request().url().startsWith(origin + "/")
        ? route.continue() : route.abort());
      const visit = async query => {
        diagnostics.phase = query;
        if (page.url() !== "about:blank") assert.deepEqual(await page.evaluate(() => window.fx.unexpected), []);
        await page.goto(`${origin}/?${query}`);
        await page.locator('[data-modal-layer] [role="dialog"]').waitFor();
        await settled(page);
      };
      for (const flow of ["feedback", "tracker", "progress", "add", "finished"]) {
        for (const size of [{ width: 390, height: 844 }, { width: 320, height: 568 }, { width: 390, height: 360 }, { width: 390, height: 320 }, { width: 844, height: 390 }, { width: 1280, height: 800 }]) {
          await page.setViewportSize(size);
          await visit(`flow=${flow}${flow === "add" ? "&elevated=1" : ""}`);
          // Use programmatic focus (not tap) so background remains open for this assertion.
          assert.equal(await page.locator("[data-modal-layer]").last().evaluate(el => el.inert), false);
          if (flow === "tracker") {
            const height = await page.locator('[data-modal-layer] [role="dialog"]').evaluate(el => parseFloat(getComputedStyle(el).maxHeight));
            assert.ok(Math.abs(height - size.height * .9) < 1, "Tracker's existing max-height was overridden");
          }
          const input = page.locator('[data-modal-layer] input,[data-modal-layer] textarea').first();
          if (await input.count()) await input.focus();
          for (let i = 0; i < 5; i++) {
            await page.keyboard.press("Tab");
            assert.equal(await page.evaluate(() => document.activeElement === document.body ||
              !!document.activeElement.closest("[data-modal-layer]")), true, `${flow}: focus escaped`);
          }
          // Hit-test the modal surface against the navigation without dismissing it.
          assert.equal(await page.locator("#root").evaluate(el => el.inert), true);
          const scroller = page.locator('[data-modal-layer] .overflow-y-auto').first();
          if (await scroller.count()) {
            await scroller.evaluate(el => { el.scrollTop = el.scrollHeight; });
            assert.equal(await scroller.evaluate(el => Math.abs(el.scrollTop + el.clientHeight - el.scrollHeight) <= 2), true, `${flow}: content cannot be reached`);
          }
          const action = flow === "feedback" ? page.getByTestId("submit-feedback-button")
            : flow === "tracker" ? page.getByRole("button", { name: "Quick Add", exact: true })
            : flow === "progress" ? page.getByRole("button", { name: "Update Progress", exact: true })
            : flow === "add" ? page.getByRole("button", { name: /Want To/ }).first()
            : page.getByRole("button", { name: "Save", exact: true });
          await action.scrollIntoViewIfNeeded();
          assert.equal(await unobscured(action), true, `${flow} ${size.width}x${size.height}: primary action is buried`);
          checked++;
        }
      }
      await page.setViewportSize({ width: 390, height: 844 });
      await visit("flow=feedback");
      await page.getByTestId("open-feedback-textarea").fill("Feedback preserved through the modal foundation");
      await backgroundDisabled(page);
      await page.getByTestId("submit-feedback-button").click();
      await restored(page);
      assert.equal(await page.evaluate(() => window.fx.writes[0].payload.open_feedback), "Feedback preserved through the modal foundation");

      await visit("flow=tracker");
      // Force the menu's exit to outlast the owning dialog. This exposes the
      // nested Radix pointer-lock leak independently of builder/frame timing.
      // Never force clicks or override pointer-events to make restoration pass.
      await page.addStyleTag({ content: '[role="menu"][data-state="closed"] { animation-duration: 2s !important; }' });
      await page.getByPlaceholder("Search movies, shows, books, games…").fill("Fixture");
      await page.getByText("Fixture movie", { exact: true }).click();
      await page.locator("textarea").fill("Keep this review");
      await page.getByRole("button").filter({ has: page.locator("svg.lucide-chevron-down") }).last().click();
      const finished = page.getByRole("menuitem", { name: "Finished", exact: true });
      await finished.waitFor();
      assert.equal(await unobscured(finished), true, "Tracker menu is buried");
      await backgroundDisabled(page);
      // The nested menu must still dismiss independently, preserve the review
      // and leave the owning modal's background protection active.
      await page.keyboard.press("Escape");
      await page.getByRole("menu").waitFor({ state: "hidden" });
      assert.equal(await page.getByRole("dialog").count(), 1);
      assert.equal(await page.locator("textarea").inputValue(), "Keep this review");
      await backgroundDisabled(page);
      await page.getByRole("button").filter({ has: page.locator("svg.lucide-chevron-down") }).last().click();
      await finished.waitFor();
      await finished.click();
      await page.waitForFunction(() => window.fx.writes.some(w => w.name === "track-media"));
      const track = await page.evaluate(() => window.fx.writes.find(w => w.name === "track-media").payload);
      assert.equal(track.review, "Keep this review");
      assert.equal(track.listType, "finished");
      // A confirmed add now releases the page instead of opening a follow-up.
      await restored(page);
      assert.notEqual(await page.locator("body").evaluate(el => getComputedStyle(el).pointerEvents), "none",
        "Closing the tracker and its menu must release the body's pointer lock");
      assert.equal(await page.getByRole("dialog").count(), 0);
      assert.equal(await page.evaluate(() => window.fx.getAddedNotice()?.title), "Fixture movie");
      assert.equal(await page.evaluate(() => window.fx.getAddedNotice()?.listName), "Finished");

      await visit("flow=progress");
      await page.locator('input[type="number"]').first().fill("37");
      await page.getByRole("button", { name: "Remove from Library", exact: true }).click();
      await page.getByRole("alertdialog").waitFor();
      await settled(page);
      assert.equal(await page.locator('[data-modal-layer]').first().evaluate(el => el.inert), true);
      const cancel = page.getByRole("button", { name: "Cancel", exact: true });
      assert.equal(await unobscured(cancel), true);
      await cancel.click();
      await page.waitForFunction(() => document.querySelectorAll('[role="alertdialog"]').length === 0);
      assert.equal(await page.locator("#root").evaluate(el => el.inert), true);
      assert.deepEqual(await page.evaluate(() => window.fx.saved), []);
      assert.equal(await page.locator('input[type="number"]').first().inputValue(), "37");
      await page.evaluate(() => { window.fx.failNext = true; });
      await page.getByRole("button", { name: "Update Progress", exact: true }).click();
      await page.waitForFunction(() => (window.fx.toasts || []).some(t => t.variant === "destructive"));
      assert.equal(await page.locator('input[type="number"]').first().inputValue(), "37");
      assert.equal(await page.locator("#root").evaluate(el => el.inert), true);
      await page.getByRole("button", { name: "Update Progress", exact: true }).click();
      await page.waitForFunction(() => !document.querySelector("#root").inert);
      assert.equal(await page.evaluate(() => window.fx.writes[0].payload.item_id), "fixture-item");

      await visit("flow=add&elevated=1");
      const wantTo = page.getByRole("button", { name: /Want To/ }).first();
      await page.waitForFunction(() => window.fx.requests.some(r => r.name === "get-user-lists-with-media"));
      await page.evaluate(() => { window.fx.failNext = true; });
      await wantTo.click();
      // The real picker reports save failures inline, not through a toast.
      // Require the exact injected server error so a silent failure cannot pass.
      await page.getByRole("alert").filter({ hasText: "Fixture save failed" }).waitFor({ state: "visible" });
      assert.equal(await page.evaluate(() => window.fx.failNext), false,
        "The fixture must actually deliver the simulated save failure");
      assert.equal(await page.evaluate(() => window.fx.requests.filter(r => r.name === "add-media-to-list").length), 1,
        "The failed attempt must issue exactly one save request");
      assert.equal(await page.evaluate(() => window.fx.writes.filter(w => w.name === "add-media-to-list").length), 0,
        "A failed save must not be recorded as a successful write");
      assert.equal(await page.locator("#root").evaluate(el => el.inert), true,
        "A failed save must keep the real list picker open");
      assert.equal(await page.evaluate(() => window.fx.closes), 0,
        "A failed save must not dismiss the picker");
      assert.equal(await page.evaluate(() => window.fx.getAddedNotice()), null,
        "A failed save must not acknowledge an addition");
      assert.equal(await wantTo.isEnabled(), true,
        "A failed save must release the submission lock so the user can retry");
      await wantTo.click();
      await page.waitForFunction(() => window.fx.writes.some(w => w.name === "add-media-to-list") || window.fx.unexpected.length);
      assert.deepEqual(await page.evaluate(() => window.fx.unexpected), []);
      await restored(page);
      assert.equal(await page.getByRole("dialog").count(), 0);
      assert.equal(await page.evaluate(() => window.fx.getAddedNotice()?.listName), "Want To");
      assert.equal(await page.evaluate(() => window.fx.requests.some(r => r.name === "get-recommendations")), false,
        "A successful add must not fetch automatic recommendation follow-ups");
      assert.equal(await page.evaluate(() => window.fx.writes.find(w => w.name === "add-media-to-list").payload.list_id), "list-1");
      assert.equal(await page.evaluate(() => window.fx.requests.filter(r => r.name === "add-media-to-list").length), 2,
        "Retry must issue exactly one additional save request");
      assert.equal(await page.evaluate(() => window.fx.writes.filter(w => w.name === "add-media-to-list").length), 1,
        "Retry must produce exactly one successful write");
      assert.equal(await page.getByRole("alert").count(), 0,
        "The previous save error must not remain after a successful retry");

      await visit("flow=finished&elevated=1");
      await page.locator("textarea").fill("Preserve the optional reaction");
      const backgroundScroll = await page.evaluate(() => window.scrollY);
      await page.setViewportSize({ width: 390, height: 360 });
      assert.equal(await page.locator("textarea").inputValue(), "Preserve the optional reaction");
      assert.equal(await unobscured(page.getByRole("button", { name: "Save", exact: true })), true);
      await page.mouse.wheel(0, 400);
      assert.equal(await page.evaluate(() => window.scrollY), backgroundScroll, "Background scrolled behind the modal");
      await page.setViewportSize({ width: 390, height: 844 });
      await page.getByRole("button", { name: "Rate 3.5 out of 5", exact: true }).tap();
      await page.getByRole("checkbox").check();
      await page.evaluate(() => window.fx.setBusy(true));
      assert.equal(await page.getByRole("button", { name: "Saving…" }).isDisabled(), true);
      await page.evaluate(() => window.fx.setBusy(false));
      await page.getByRole("button", { name: "Save", exact: true }).click();
      await restored(page);
      assert.deepEqual(await page.evaluate(() => window.fx.saved), [{ rating: 3.5, reaction: "Preserve the optional reaction", spoilers: true }]);
      await visit("flow=finished");
      await page.getByRole("button", { name: "Not now", exact: true }).click();
      await restored(page);
      assert.deepEqual(await page.evaluate(() => window.fx.saved), []);

      if (engine === chromium) {
        await visit("flow=finished");
        const handle = await page.locator("[data-vaul-drawer] > div").first().boundingBox();
        const session = await page.context().newCDPSession(page);
        const x = handle.x + handle.width / 2, y = handle.y + handle.height / 2;
        await session.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y }] });
        for (const offset of [25, 80, 160, 240]) {
          await session.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x, y: y + offset }] });
        }
        await session.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
        await restored(page);
        assert.deepEqual(await page.evaluate(() => window.fx.saved), [], "Swiping must not save");
        await session.detach();
      }

      await visit("flow=controls");
      await page.getByRole("combobox").click();
      const two = page.getByRole("option", { name: "Two", exact: true });
      assert.equal(await unobscured(two), true);
      await two.click();
      await page.getByRole("button", { name: "Open popover" }).click();
      const popover = page.getByRole("button", { name: "Popover action" });
      assert.equal(await unobscured(popover), true);
      await popover.click();
      await page.keyboard.press("Escape");
      await page.getByRole("button", { name: "Open nested menu" }).click();
      await page.getByRole("menuitem", { name: "More choices" }).hover();
      const nestedAction = page.getByRole("menuitem", { name: "Nested action" });
      await nestedAction.waitFor();
      assert.equal(await unobscured(nestedAction), true);
      await nestedAction.click();
      diagnostics.phase = "nested form: open and fill";
      await page.getByRole("button", { name: "Nested form", exact: true }).click();
      await page.getByLabel("Nested input").fill("nested draft");
      diagnostics.snapshots.push(await readModalState(page, "before nested readiness"));
      diagnostics.phase = "nested form: opening readiness";
      // Filling an input does not wait for its dialog's entry animation.
      // Wait for the actual focused, active child before sending Escape once.
      await waitForModalInputReady(page, "Nested input");
      diagnostics.snapshots.push(await readModalState(page, "before nested Escape"));
      diagnostics.phase = "nested form: first Escape and child removal";
      await page.keyboard.press("Escape");
      diagnostics.snapshots.push(await readModalState(page, "after nested Escape"));
      await page.waitForFunction(() => !document.querySelector('input[aria-label="Nested input"]'));
      diagnostics.snapshots.push(await readModalState(page, "after nested child removal"));
      assert.equal(await page.getByLabel("Parent input").inputValue(), "preserved");
      assert.equal(await page.locator("#root").evaluate(el => el.inert), true);
      diagnostics.phase = "nested form: second Escape and parent restoration";
      // Child dismissal returns focus to its trigger; choose the next form's
      // keyboard target explicitly, then verify readiness without repairing it.
      await page.getByLabel("Parent input").focus();
      await waitForModalInputReady(page, "Parent input");
      await page.keyboard.press("Escape");
      await restored(page);

      // Reopen from a real focused trigger, preserve scroll, restore focus.
      diagnostics.phase = "trigger focus and background restoration";
      await page.locator("#modal-trigger").click();
      await page.getByLabel("Parent input").waitFor();
      await waitForModalInputReady(page, "Parent input");
      diagnostics.snapshots.push(await readModalState(page, "before reopened parent Escape"));
      await page.keyboard.press("Escape");
      diagnostics.snapshots.push(await readModalState(page, "after reopened parent Escape"));
      await page.waitForFunction(() => !document.querySelector("#root").inert);
      await page.waitForFunction(() => document.activeElement?.id === "modal-trigger");

      await page.locator("#modal-trigger").click();
      await page.getByLabel("Parent input").waitFor();
      await waitForModalInputReady(page, "Parent input");
      await page.evaluate(() => {
        const late = document.createElement("button");
        late.id = "late-background";
        late.onclick = () => window.fx.navClicks++;
        late.textContent = "Late background action";
        document.body.appendChild(late);
      });
      await page.waitForFunction(() => document.querySelector("#late-background").inert);
      await page.locator("#late-background").evaluate(el => el.click());
      // restored() already clicked navigation once before this open.
      assert.equal(await page.evaluate(() => window.fx.navClicks), 1);
      await page.keyboard.press("Escape");
      await page.waitForFunction(() => !document.querySelector("#root").inert);
      assert.equal(await page.locator("#late-background").evaluate(el => el.inert), false);

      // Simulate older WKWebView without native inert; the capture guard and
      // Radix focus scope must still reject background actions/focus.
      const oldWebView = await browser.newPage({ viewport: { width: 390, height: 844 } });
      diagnostics.page = oldWebView;
      diagnostics.phase = "older WebView inert fallback";
      await oldWebView.addInitScript(() => {
        const values = new WeakMap();
        Object.defineProperty(HTMLElement.prototype, "inert", {
          configurable: true, get() { return values.get(this) || false; },
          set(value) { values.set(this, !!value); },
        });
      });
      await oldWebView.goto(`${origin}/?flow=controls`);
      await oldWebView.getByLabel("Parent input").waitFor();
      await waitForModalInputReady(oldWebView, "Parent input");
      await oldWebView.evaluate(() => {
        document.querySelector("#fixture-nav button").click();
        document.querySelector('input[aria-label="Background input"]').focus();
      });
      assert.equal(await oldWebView.evaluate(() => window.fx.navClicks), 0);
      assert.equal(await oldWebView.evaluate(() => !!document.activeElement.closest("[data-modal-layer]")), true);
      await waitForModalInputReady(oldWebView, "Parent input");
      await oldWebView.keyboard.press("Escape");
      await restored(oldWebView);
      await oldWebView.close();
      diagnostics.page = page;

      // Modal false and unmigrated components retain their previous behavior.
      for (const flow of ["legacy", "nonmodal"]) {
        diagnostics.phase = flow;
        await page.goto(`${origin}/?flow=${flow}`);
        await page.getByRole("heading", { name: "Foundation controls" }).waitFor();
        assert.equal(await page.locator("[data-modal-layer]").count(), 0);
        assert.equal(await page.locator("#root").evaluate(el => el.inert), false);
      }
      assert.deepEqual(await page.evaluate(() => window.fx.unexpected), []);
      assert.deepEqual(errors, [], "Browser runtime errors");
      assert.deepEqual(consoleErrors, [], "Browser console errors");
      console.log(`${engine.name()}: ${checked} real-flow layouts plus save, cancel, nested focus, dropdown/select/popover, StrictMode, restoration and non-modal checks passed.`);
    } catch (error) {
      await reportModalFailure({ ...diagnostics, error });
      throw error;
    } finally { await browser.close(); }
  }
} finally { await new Promise(resolve => server.close(resolve)); }
