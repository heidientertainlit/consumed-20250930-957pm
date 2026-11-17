import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { chromium } from "playwright";
import { readModalState, reportModalFailure } from "../lib/modal-test-diagnostics.mjs";

test("captures real browser state and writes failure evidence without changing the dialog", async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await page.setContent(`<div id="root" inert>Background</div>
      <div data-modal-layer><div role="dialog" data-state="open">
      <input aria-label="Nested input" value="do-not-log-this-value"></div></div>`);
    await page.getByLabel("Nested input").focus();
    const before = await readModalState(page, "before Escape");
    assert.equal(before.nestedDialog.state, "open");
    assert.equal(before.nestedInput.visible, true);
    assert.equal(before.focus.label, "Nested input");
    assert.equal(before.root.inert, true);
    assert.equal(before.layers.length, 1);
    assert.ok(!JSON.stringify(before).includes("do-not-log-this-value"));
    // Simulate the observed ambiguity: closed content can still be in the DOM.
    await page.evaluate(() => {
      const dialog = document.querySelector('[role="dialog"]');
      dialog.dataset.state = "closed";
      dialog.style.display = "none";
    });
    const original = new Error("synthetic assertion failure");
    const report = await reportModalFailure({
      page, engine: "chromium-diagnostic-test", phase: "synthetic failure",
      errors: ["synthetic runtime error"], consoleErrors: ["synthetic console error"],
      snapshots: [before], error: original,
    });
    const after = report.snapshots.at(-1);
    assert.equal(after.nestedDialog.state, "closed");
    assert.equal(after.nestedInput.visible, false);
    assert.equal(after.nestedDialog.visible, false);
    assert.equal(await page.getByLabel("Nested input").count(), 1);
    assert.equal(report.error.message, original.message);
    assert.deepEqual(report.browserErrors, ["synthetic runtime error"]);
    assert.deepEqual(report.browserConsoleErrors, ["synthetic console error"]);
    assert.equal(JSON.parse(await readFile(report.reportPath, "utf8")).phase, "synthetic failure");
    const png = await readFile(report.screenshot);
    assert.equal(png.subarray(1, 4).toString(), "PNG");
  } finally {
    await browser.close();
  }
});

test("diagnostics cannot replace an original failure when page capture fails", async () => {
  const page = {
    async evaluate() { throw new Error("page already closed"); },
    async screenshot() { throw new Error("screenshot unavailable"); },
  };
  const original = new Error("original timeout");
  const report = await reportModalFailure({
    page, engine: "closed-page-test", phase: "first Escape",
    errors: [], consoleErrors: [], snapshots: [], error: original,
  });
  assert.equal(report.error.message, "original timeout");
  assert.match(report.snapshots[0].captureError, /page already closed/);
  assert.match(report.screenshotError, /screenshot unavailable/);
});
