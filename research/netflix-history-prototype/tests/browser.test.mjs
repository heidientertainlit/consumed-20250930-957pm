import assert from "node:assert/strict";
import { chromium } from "playwright";
import { readLoadedHistory } from "../extension/history-reader.js";
import { createPreviewServer } from "./preview-server.mjs";

const server = createPreviewServer();
await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
let externalRequests = 0;
let fixture = "";
const row = (title, date, id, style = "") =>
  `<div class="retableRow" style="${style}"><span class="date">${date}</span><span class="title"><a href="/title/${id}">${title}</a></span></div>`;

try {
  const context = await browser.newContext({ viewport: { width: 410, height: 1000 } });
  // Network guard: only local static assets are fetched. Netflix URLs are
  // intercepted synthetic documents, never forwarded to Netflix.
  await context.route("**/*", route => {
    const url = new URL(route.request().url());
    if (url.origin === origin) return route.continue();
    if (url.origin === "https://www.netflix.com") {
      return route.fulfill({ contentType: "text/html", body: fixture });
    }
    externalRequests++;
    return route.abort();
  });
  const page = await context.newPage();
  fixture = row("Synthetic Movie", "10/08/26", 1001) +
    row("Hidden record", "10/07/26", 1002, "display:none") +
    '<input type="password" value="must-never-be-collected">';
  await page.goto("https://www.netflix.com/viewingactivity");
  const before = await page.content();
  const result = await page.evaluate(readLoadedHistory);
  assert.equal(result.ok, true);
  assert.deepEqual(result.entries, [
    { title: "Synthetic Movie", dateText: "10/08/26", titleId: "1001" },
  ]);
  assert.equal(JSON.stringify(result).includes("must-never-be-collected"), false);
  assert.equal(await page.content(), before, "reader does not modify Netflix DOM");
  console.log("PASS: loaded-row extraction, hidden-row filtering, no input capture, unchanged DOM");

  await page.goto("https://www.netflix.com/login");
  assert.equal((await page.evaluate(readLoadedHistory)).ok, false);
  fixture = "<p>Unrecognized synthetic history layout</p>";
  await page.goto("https://www.netflix.com/settings/viewing-history");
  assert.equal((await page.evaluate(readLoadedHistory)).ok, false);
  fixture = Array.from({ length: 1001 }, (_, i) => row(`Synthetic ${i}`, "10/08/26", i)).join("");
  await page.goto("https://www.netflix.com/viewingactivity");
  assert.match((await page.evaluate(readLoadedHistory)).error, /1,000/);
  console.log("PASS: login-page rejection, unknown-layout failure and bounded reads");

  await context.addInitScript(({ origin }) => {
    if (location.origin !== origin) return;
    const stored = "prototype-browser-test-storage";
    const getDB = () => JSON.parse(localStorage.getItem(stored) || "{}");
    window.__testEntries = [{ title: "Synthetic Movie", dateText: "10/08/26", titleId: "1001" }];
    window.__testTabUrl = "https://www.netflix.com/viewingactivity";
    window.__testInjectionCount = 0;
    window.__testStorageFailure = false;
    window.__testReaderFailure = false;
    const chromeStub = {
      storage: {
        local: {
          setAccessLevel: async options => {
            if (options.accessLevel !== "TRUSTED_CONTEXTS") throw new Error("Unsafe storage access");
          },
          get: async key => ({ [key]: getDB()[key] }),
          set: async values => {
            if (window.__testStorageFailure) throw new Error("Synthetic storage failure");
            localStorage.setItem(stored, JSON.stringify({ ...getDB(), ...values }));
          },
          remove: async key => {
            const db = getDB();
            delete db[key];
            localStorage.setItem(stored, JSON.stringify(db));
          },
        },
      },
      tabs: { query: async () => [{ id: 1, url: window.__testTabUrl }] },
      scripting: {
        executeScript: async options => {
          window.__testInjectionCount++;
          if (options.world !== "ISOLATED" || options.target.tabId !== 1) {
            throw new Error("Unexpected injection target");
          }
          return [{
            frameId: 0,
            result: window.__testReaderFailure
              ? { ok: false, error: "Synthetic unfamiliar layout" }
              : { ok: true, entries: window.__testEntries, skippedRows: 0 },
          }];
        },
      },
    };
    Object.defineProperty(window, "chrome", { configurable: true, value: chromeStub });
  }, { origin });
  await page.goto(`${origin}/popup.html`);
  await page.getByRole("status").filter({ hasText: "Ready" }).waitFor();
  const check = page.getByRole("button", { name: "Check loaded history" });
  assert.equal(await check.isDisabled(), true);
  await page.getByLabel("Local profile label").fill("Synthetic profile");
  assert.equal(await check.isDisabled(), true);
  await page.locator("#consent").check();
  await check.click();
  await page.getByRole("status").filter({ hasText: "Baseline saved" }).waitFor();
  assert.equal(await page.locator("#saved-count").textContent(), "1");
  assert.equal(await page.locator("#consent").isChecked(), false);
  const baseline = await page.evaluate(() => localStorage.getItem("prototype-browser-test-storage"));
  console.log("PASS: explicit consent, label requirement, baseline creation and consent reset");

  await page.evaluate(() => {
    window.__testTabUrl = "https://app.consumedapp.com/login";
  });
  await page.locator("#consent").check();
  await check.click();
  await page.getByRole("status").filter({ hasText: "Other pages are not read" }).waitFor();
  assert.equal(await page.evaluate(() => window.__testInjectionCount), 1);
  assert.equal(await page.evaluate(() => localStorage.getItem("prototype-browser-test-storage")), baseline);
  console.log("PASS: Consumed is rejected before injection; baseline preserved");

  await page.evaluate(() => {
    window.__testTabUrl = "https://www.netflix.com/viewingactivity";
    window.__testReaderFailure = true;
  });
  await page.locator("#consent").check();
  await check.click();
  await page.getByRole("status").filter({ hasText: "unfamiliar layout" }).waitFor();
  assert.equal(await page.evaluate(() => localStorage.getItem("prototype-browser-test-storage")), baseline);

  await page.evaluate(() => {
    window.__testReaderFailure = false;
    window.__testStorageFailure = true;
    window.__testEntries.push({ title: "New synthetic movie", dateText: "10/09/26", titleId: "1002" });
  });
  await page.locator("#consent").check();
  await check.click();
  await page.getByRole("status").filter({ hasText: "storage failure" }).waitFor();
  assert.equal(await page.evaluate(() => localStorage.getItem("prototype-browser-test-storage")), baseline);
  assert.equal(await page.locator("#saved-count").textContent(), "1");
  console.log("PASS: reader and storage failures do not overwrite baseline");

  await page.evaluate(() => {
    window.__testStorageFailure = false;
    window.__testEntries.push({ title: "<img src=x onerror=alert(1)>", dateText: "10/09/26", titleId: "1003" });
  });
  await page.locator("#consent").check();
  await check.click();
  await page.getByRole("status").filter({ hasText: "2 not previously saved" }).waitFor();
  assert.equal(await page.locator("#saved-count").textContent(), "3");
  assert.equal(await page.locator("#new-count").textContent(), "2");
  assert.equal(await page.locator("#new-entries img").count(), 0);
  assert.match(await page.locator("#new-entries").textContent(), /<img src=x/);
  await page.reload();
  await page.getByRole("status").filter({ hasText: "Ready" }).waitFor();
  assert.equal(await page.locator("#saved-count").textContent(), "3");
  assert.equal(await check.isDisabled(), true);
  console.log("PASS: repeat differences, safe text rendering and local persistence across popup reload");

  page.once("dialog", dialog => dialog.accept());
  await page.getByRole("button", { name: "Delete this prototype's local data" }).click();
  await page.getByRole("status").filter({ hasText: "were deleted" }).waitFor();
  assert.equal(await page.locator("#saved-count").textContent(), "—");
  assert.equal(await page.evaluate(() => localStorage.getItem("prototype-browser-test-storage")), "{}");
  assert.equal(externalRequests, 0);
  console.log("PASS: confirmed local deletion; zero external requests throughout verification");
  await context.close();

  const plain = await browser.newPage();
  await plain.goto(`${origin}/popup.html`);
  await plain.getByRole("status").filter({ hasText: "Not running as an extension" }).waitFor();
  assert.equal(await plain.getByRole("button", { name: "Check loaded history" }).isDisabled(), true);
  console.log("PASS: ordinary-page preview cannot access accounts");
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}
