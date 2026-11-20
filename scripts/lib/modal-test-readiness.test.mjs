import assert from "node:assert/strict";
import test from "node:test";
import { chromium } from "playwright";
import { waitForModalInputReady } from "./modal-test-readiness.mjs";

test("visible input is not ready until its focused top dialog finishes opening", async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.setContent(`
      <input aria-label="Background input">
      <div data-modal-layer>
        <div role="dialog" data-state="open"><input aria-label="Parent input"></div>
      </div>
    `);
    await page.getByLabel("Parent input").focus();
    await page.evaluate(() => {
      const dialog = document.querySelector('[role="dialog"]');
      window.opening = dialog.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 1000, fill: "both" });
      window.opening.pause();
      window.opening.currentTime = 0;
    });
    // This is the former reopen gate: it resolves even at opacity zero.
    await page.getByLabel("Parent input").waitFor();
    assert.equal(await page.getByRole("dialog").evaluate(el => getComputedStyle(el).opacity), "0");
    let ready = false;
    const waiting = waitForModalInputReady(page, "Parent input").then(() => { ready = true; });
    const stillWaiting = async () => {
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      assert.equal(ready, false);
    };
    await stillWaiting();
    await page.evaluate(() => {
      window.opening.finish();
      document.querySelector('[data-modal-layer]').inert = true;
    });
    await stillWaiting();
    await page.evaluate(() => {
      document.querySelector('[data-modal-layer]').inert = false;
      const child = document.createElement("div");
      child.dataset.modalLayer = "";
      document.body.append(child);
    });
    await stillWaiting();
    await page.evaluate(() => {
      document.querySelectorAll('[data-modal-layer]')[1].remove();
      document.querySelector('input[aria-label="Background input"]').focus();
    });
    await stillWaiting();
    await page.getByLabel("Parent input").focus();
    await waiting;
    assert.equal(ready, true);
    await page.close();
  } finally {
    await browser.close();
  }
});
