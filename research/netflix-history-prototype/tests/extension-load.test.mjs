// Actual extension-load verification, without Netflix or Consumed traffic.
// Uses an existing system Chromium if available; never installs a browser.
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { access, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const extension = fileURLToPath(new URL("../extension/", import.meta.url));
let executablePath;
try {
  await access("/repl/tools/bin/chromium");
  executablePath = "/repl/tools/bin/chromium";
} catch {
  // Playwright's regular Chromium must already be installed on other machines.
}
const profile = await mkdtemp(join(tmpdir(), "netflix-extension-load-"));
let context;
try {
  context = await chromium.launchPersistentContext(profile, {
    ...(executablePath ? { executablePath } : { channel: "chromium" }),
    headless: true,
    ignoreDefaultArgs: ["--disable-extensions"],
    args: ["--no-sandbox", `--disable-extensions-except=${extension}`, `--load-extension=${extension}`],
  });
  await context.route("**/*", route =>
    ["chrome-extension:", "chrome:"].includes(new URL(route.request().url()).protocol)
      ? route.continue()
      : route.abort()
  );
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto("chrome://extensions");
  await page.locator("extensions-item").first().waitFor({ timeout: 15000 });
  const loaded = await page.locator("extensions-item").evaluateAll(items =>
    items.map(item => ({ id: item.id, name: item.data?.name, errors: item.data?.manifestErrors ?? [] }))
  );
  const ours = loaded.find(item => item.name === "Netflix History — Local Access Test");
  assert.ok(ours, "extension loads in real Chromium");
  assert.equal(ours.errors.length, 0);
  await page.goto(`chrome-extension://${ours.id}/popup.html`);
  await page.getByRole("status").filter({ hasText: "Ready" }).waitFor({ timeout: 10000 });
  assert.equal(await page.getByRole("button", { name: "Check loaded history" }).isDisabled(), true);
  assert.deepEqual(errors, []);
  console.log("PASS: real Chromium extension load, actual local storage initialization, consent gate, no runtime errors");
  console.log("No Netflix or Consumed account/page was accessed.");
} finally {
  if (context) await context.close();
  await rm(profile, { recursive: true, force: true });
}
