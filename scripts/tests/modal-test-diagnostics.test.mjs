import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import test from "node:test";
import { chromium } from "playwright";
import { readModalState, reportModalFailure, formatModalDiagnosticLogs } from "../lib/modal-test-diagnostics.mjs";

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
    // Screenshots are explicitly best-effort, including under builder load.
    // The state report must still succeed if the screenshot budget expires.
    if (report.screenshot) {
      const png = await readFile(report.screenshot);
      assert.equal(png.subarray(1, 4).toString(), "PNG");
    } else {
      assert.match(report.screenshotError, /TimeoutError.*page\.screenshot/);
    }
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

test("successful screenshot capture is included in saved and logged evidence", async () => {
  let screenshotOptions;
  const page = {
    async evaluate() { return { root: { inert: true }, dialogs: [], layers: [] }; },
    async screenshot(options) {
      screenshotOptions = options;
      await writeFile(options.path, Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aOZkAAAAASUVORK5CYII=",
        "base64"));
    },
  };
  const report = await reportModalFailure({
    page, engine: "screenshot-path-test", phase: "failure",
    errors: [], consoleErrors: [], snapshots: [], error: new Error("original failure"),
  });
  assert.equal(screenshotOptions.timeout, 3000);
  assert.equal(screenshotOptions.path, report.screenshot);
  assert.equal(report.screenshotError, undefined);
  assert.equal(JSON.parse(await readFile(report.reportPath, "utf8")).screenshot, report.screenshot);
  assert.equal((await readFile(report.screenshot)).subarray(1, 4).toString(), "PNG");
});

test("full reports survive a 4096-byte per-record limit, including Unicode", () => {
  const report = {
    engine: "chromium", phase: "trigger focus and background restoration",
    error: { name: "TimeoutError", message: "Escape timed out", stack: "stack\n".repeat(400) },
    browserErrors: ["fixture error"], browserConsoleErrors: [],
    snapshots: [
      { phase: "old snapshot", text: "Unicode café 🎬".repeat(2000) },
      { phase: "failure", root: { inert: true },
        focus: { tag: "input", id: "fixture-input", label: "Parent input" },
        dialogs: [{ state: "closed", visible: false, animations: [] }],
        layers: [{ inert: false }], nestedInput: null },
    ],
    reportPath: "generated-artifacts/modal-diagnostics/test/failure.json",
  };
  const lines = formatModalDiagnosticLogs(report);
  assert.ok(lines.length > 2);
  for (const line of lines) {
    assert.ok(Buffer.byteLength(line, "utf8") < 2048, "Leave ample room below Vercel's record limit");
  }
  const summary = JSON.parse(lines[0].slice("[modal-test-diagnostics-summary] ".length));
  assert.equal(summary.phase, report.phase);
  assert.equal(summary.finalState.rootInert, true);
  assert.equal(summary.finalState.dialogs[0].state, "closed");
  assert.equal(summary.browserErrorCount, 1);
  const chunks = lines.slice(1).map(line =>
    JSON.parse(line.slice("[modal-test-diagnostics] ".length)));
  assert.equal(chunks.length, chunks[0].total);
  chunks.forEach((chunk, index) => {
    assert.equal(chunk.part, index + 1);
    assert.equal(chunk.reportId, report.reportPath);
  });
  const reconstructed = Buffer.from(chunks.map(chunk => chunk.data).join(""), "base64").toString("utf8");
  assert.deepEqual(JSON.parse(reconstructed), report);
});
