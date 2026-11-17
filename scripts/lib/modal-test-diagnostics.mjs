import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

// Only used by the isolated, synthetic-data modal fixture. Never capture the
// signed-in application or field values with this helper.
export async function readModalState(page, phase) {
  try {
    const state = await page.evaluate(() => {
      const describe = node => {
        if (!(node instanceof Element)) return null;
        const rect = node.getBoundingClientRect();
        const style = getComputedStyle(node);
        return {
          tag: node.tagName.toLowerCase(),
          id: node.id || null,
          role: node.getAttribute("role"),
          label: node.getAttribute("aria-label"),
          labelledBy: node.getAttribute("aria-labelledby"),
          state: node.getAttribute("data-state"),
          ariaHidden: node.getAttribute("aria-hidden"),
          inert: Boolean(node.inert),
          blockedByAncestor: Boolean(node.closest('[inert],[aria-hidden="true"]')),
          visible: rect.width > 0 && rect.height > 0 &&
            style.display !== "none" && style.visibility !== "hidden" &&
            style.visibility !== "collapse" && Number(style.opacity) !== 0,
          display: style.display,
          visibility: style.visibility,
          opacity: style.opacity,
          pointerEvents: style.pointerEvents,
          zIndex: style.zIndex,
          rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
          animations: node.getAnimations().map(animation => ({
            name: animation.animationName || null,
            playState: animation.playState,
            currentTime: animation.currentTime,
          })),
        };
      };
      const child = document.querySelector('input[aria-label="Nested input"]');
      return {
        focus: describe(document.activeElement),
        root: describe(document.querySelector("#root")),
        nestedInput: describe(child),
        nestedDialog: describe(child?.closest('[role="dialog"]')),
        dialogs: [...document.querySelectorAll('[role="dialog"],[role="alertdialog"]')].map(describe),
        layers: [...document.querySelectorAll("[data-modal-layer]")].map(describe),
      };
    });
    return { phase, ...state };
  } catch (error) {
    return { phase, captureError: String(error) };
  }
}

// Vercel truncated the original single log record at 4096 characters. Emit a
// short readable summary first, then independently numbered ASCII records.
// Base64 preserves Unicode even when a chunk boundary falls inside a character.
export function formatModalDiagnosticLogs(report) {
  const finalState = report.snapshots.at(-1);
  const shorten = value => typeof value === "string" ? value.slice(0, 100) : value;
  const focus = finalState?.focus;
  const summary = {
    engine: report.engine,
    phase: report.phase,
    error: { name: report.error?.name, message: report.error?.message?.slice(0, 400) },
    finalState: {
      captureError: finalState?.captureError?.slice(0, 200),
      rootInert: finalState?.root?.inert,
      focus: focus ? { tag: focus.tag, id: shorten(focus.id), label: shorten(focus.label) } : null,
      nestedInputPresent: Boolean(finalState?.nestedInput),
      dialogs: (finalState?.dialogs || []).slice(0, 8).map(dialog => ({
        state: shorten(dialog.state), visible: dialog.visible,
        inert: dialog.inert, blockedByAncestor: dialog.blockedByAncestor,
        opacity: shorten(dialog.opacity),
        animations: (dialog.animations || []).slice(0, 3).map(animation => animation.playState),
      })),
      layers: (finalState?.layers || []).slice(0, 8).map(layer => ({
        inert: layer.inert, blockedByAncestor: layer.blockedByAncestor,
      })),
    },
    browserErrorCount: report.browserErrors.length,
    browserConsoleErrorCount: report.browserConsoleErrors.length,
  };
  const encoded = Buffer.from(JSON.stringify(report), "utf8").toString("base64");
  const chunkSize = 1700;
  const total = Math.ceil(encoded.length / chunkSize);
  const lines = [`[modal-test-diagnostics-summary] ${JSON.stringify(summary)}`];
  for (let index = 0; index < total; index++) {
    lines.push(`[modal-test-diagnostics] ${JSON.stringify({
      reportId: report.reportPath || report.engine,
      part: index + 1, total, encoding: "base64",
      data: encoded.slice(index * chunkSize, (index + 1) * chunkSize),
    })}`);
  }
  return lines;
}

// Best-effort reporting must never replace the assertion/timeout that failed.
export async function reportModalFailure({ page, engine, phase, errors, consoleErrors, snapshots, error }) {
  const report = {
    engine,
    phase,
    error: { name: error?.name, message: error?.message, stack: error?.stack },
    browserErrors: errors,
    browserConsoleErrors: consoleErrors,
    snapshots: [...snapshots],
  };
  try {
    report.snapshots.push(await readModalState(page, "failure"));
    const directory = path.join("generated-artifacts", "modal-diagnostics",
      `${engine.replace(/[^a-z0-9_-]/gi, "_")}-${Date.now()}`);
    await mkdir(directory, { recursive: true });
    try {
      const screenshot = path.join(directory, "failure.png");
      await page.screenshot({ path: screenshot, timeout: 3000 });
      report.screenshot = screenshot;
    } catch (captureError) {
      report.screenshotError = String(captureError);
    }
    const reportPath = path.join(directory, "failure.json");
    report.reportPath = reportPath;
    await writeFile(reportPath, JSON.stringify(report, null, 2) + "\n");
  } catch (captureError) {
    report.reportingError = String(captureError);
  }
  // Failed Vercel builds may not expose files. Always include state and browser
  // errors in build logs too; do not rely on the screenshot being retrievable.
  for (const line of formatModalDiagnosticLogs(report)) console.error(line);
  return report;
}
