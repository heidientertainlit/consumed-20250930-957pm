import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { chromium } from "playwright";
import { modalInputIsReady, waitForModalInputReady } from "../lib/modal-test-readiness.mjs";

const markup = `<button id="trigger">Open</button><div id="root" inert>Background</div>
  <div data-modal-layer><div role="dialog" data-state="open">
    <input aria-label="Parent input">
  </div></div>`;

test("modal readiness checks the actual dialog, focus, animation, and active layer", async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.route("**/*", route => route.abort());
    const reset = async () => {
      await page.setContent(markup);
      await page.getByLabel("Parent input").focus();
      assert.equal(await page.evaluate(modalInputIsReady, "Parent input"), true);
    };
    for (const [name, mutate] of [
      ["closed dialog", () => { document.querySelector('[role="dialog"]').dataset.state = "closed"; }],
      ["transparent dialog", () => { document.querySelector('[role="dialog"]').style.opacity = "0"; }],
      ["partially transparent dialog", () => { document.querySelector('[role="dialog"]').style.opacity = ".5"; }],
      ["unfinished animation even at full opacity", () => {
        const animation = document.querySelector('[role="dialog"]').animate(
          [{ transform: "translateY(1px)" }, { transform: "translateY(0)" }], { duration: 200 });
        animation.pause();
        animation.currentTime = 100;
      }],
      ["wrong focus", () => { document.querySelector("#trigger").focus(); }],
      ["inert layer", () => { document.querySelector("[data-modal-layer]").inert = true; }],
      ["aria-hidden ancestor", () => { document.querySelector("[data-modal-layer]").setAttribute("aria-hidden", "true"); }],
      ["newer open top layer", () => {
        document.body.insertAdjacentHTML("beforeend",
          '<div data-modal-layer><div role="dialog" data-state="open">Other modal</div></div>');
      }],
      ["hidden input", () => { document.querySelector("input").style.visibility = "hidden"; }],
      ["disabled input", () => { document.querySelector("input").disabled = true; }],
      ["missing form", () => { document.querySelector('[role="dialog"]').remove(); }],
    ]) {
      await reset();
      await page.evaluate(mutate);
      assert.equal(await page.evaluate(modalInputIsReady, "Parent input"), false, name);
    }
    await reset();
    // Real Radix/Vaul flows can retain empty and closed child portal hosts.
    // Neither is an active modal; an actual newer open dialog above still is.
    await page.evaluate(() => {
      document.body.insertAdjacentHTML("beforeend", `<div data-modal-layer inert></div>
        <div data-modal-layer inert><div role="dialog" data-state="closed"></div></div>`);
    });
    assert.equal(await page.evaluate(modalInputIsReady, "Parent input"), true);
    // No auto-focus repair: an incorrect focus state remains incorrect.
    await page.locator("#trigger").focus();
    assert.equal(await page.evaluate(modalInputIsReady, "Parent input"), false);
    assert.equal(await page.locator("#trigger").evaluate(node => node === document.activeElement), true);
    assert.equal(await page.evaluate(modalInputIsReady, "Different input"), false);
    await page.close();
  } finally { await browser.close(); }
});

test("visible focused input cannot cause premature Escape during a held entrance animation", async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.route("**/*", route => route.abort());
    await page.setContent(markup);
    await page.getByLabel("Parent input").focus();
    await page.evaluate(() => {
      const dialog = document.querySelector('[role="dialog"]');
      window.entrance = dialog.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 200, fill: "both" });
      // A held real animation makes the test deterministic without a sleep or
      // disabling the application fixture's real-flow entrance animations.
      window.entrance.pause();
      window.entrance.currentTime = 0;
      window.readinessPolls = 0;
      window.escapes = [];
      const realStyle = window.getComputedStyle.bind(window);
      window.getComputedStyle = (...args) => {
        if (args[0] === dialog) window.readinessPolls++;
        return realStyle(...args);
      };
      document.addEventListener("keydown", event => {
        if (event.key !== "Escape") return;
        window.escapes.push({
          opacity: realStyle(dialog).opacity,
          animation: window.entrance.playState,
          focused: document.activeElement === document.querySelector("input"),
        });
        dialog.remove();
        document.querySelector("#root").inert = false;
        document.querySelector("#trigger").focus();
      });
    });
    // This is the old synchronization condition: Playwright visibility passes
    // at opacity zero, despite the focused input's parent still opening.
    await page.getByLabel("Parent input").waitFor();
    assert.equal(await page.getByLabel("Parent input").isVisible(), true);
    assert.equal(await page.evaluate(modalInputIsReady, "Parent input"), false);
    await page.evaluate(() => { window.readinessPolls = 0; });
    let escapeSent = false;
    const dismissal = (async () => {
      await waitForModalInputReady(page, "Parent input");
      await page.keyboard.press("Escape");
      escapeSent = true;
    })();
    // Wait for an actual predicate evaluation, not an arbitrary delay.
    await page.waitForFunction(() => window.readinessPolls > 0);
    assert.equal(escapeSent, false);
    assert.deepEqual(await page.evaluate(() => window.escapes), []);
    assert.equal(await page.locator("#root").evaluate(node => node.inert), true);
    await page.evaluate(() => { window.entrance.finish(); });
    await dismissal;
    assert.deepEqual(await page.evaluate(() => window.escapes),
      [{ opacity: "1", animation: "finished", focused: true }]);
    assert.equal(await page.getByLabel("Parent input").count(), 0);
    assert.equal(await page.locator("#root").evaluate(node => node.inert), false);
    assert.equal(await page.locator("#trigger").evaluate(node => node === document.activeElement), true);
    await page.close();
  } finally { await browser.close(); }
});

test("real modal dismissal paths share readiness while retaining single Escape assertions", async () => {
  const source = await readFile("scripts/check-modal-foundation.mjs", "utf8");
  for (const [start, end, label] of [
    ['diagnostics.phase = "nested form: opening readiness"', 'diagnostics.phase = "nested form: second Escape', "Nested input"],
    ['diagnostics.phase = "nested form: second Escape', '// Reopen from a real focused trigger', "Parent input"],
    ['diagnostics.phase = "trigger focus and background restoration"', 'await page.waitForFunction(() => document.activeElement?.id', "Parent input"],
  ]) {
    const section = source.slice(source.indexOf(start), source.indexOf(end, source.indexOf(start) + start.length));
    assert.ok(section.indexOf(`waitForModalInputReady(page, "${label}")`) >= 0);
    assert.ok(section.indexOf("waitForModalInputReady(") < section.indexOf('page.keyboard.press("Escape")'));
    assert.equal((section.match(/page\.keyboard\.press\("Escape"\)/g) || []).length, 1);
  }
  assert.match(source, /!document\.querySelector\('input\[aria-label="Nested input"\]'\)/);
  assert.match(source, /document\.activeElement\?\.id === "modal-trigger"/);
  assert.match(source, /await waitForModalInputReady\(oldWebView, "Parent input"\)/);
  assert.doesNotMatch(source, /waitForTimeout|setDefaultTimeout|setDefaultNavigationTimeout/);
});
