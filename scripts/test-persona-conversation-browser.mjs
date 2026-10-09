import { chromium } from "playwright";
import assert from "node:assert/strict";

// The URL must refer to the isolated in-memory Mockup Sandbox fixture.
const url = process.env.PERSONA_FIXTURE_URL;
if (!url || !url.endsWith("/__mockup/preview/persona-conversations/ConversationStudioFixture")) {
  throw new Error("Set PERSONA_FIXTURE_URL to the local isolated conversation fixture");
}
const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1050 } });
  await page.route("**/*", route => new URL(route.request().url()).origin === new URL(url).origin ? route.continue() : route.abort());
  const errors = [], remoteWrites = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("request", req => {
    const target = new URL(req.url());
    if ((["fetch", "xhr"].includes(req.resourceType()) && target.origin !== new URL(url).origin) ||
        target.pathname.includes("/functions/v1/")) remoteWrites.push(req.url());
  });
  await page.goto(url);
  await page.getByRole("heading", { name: "Generate conversations" }).waitFor();
  await page.getByLabel("Persona gender filter").selectOption("woman");
  await page.getByRole("button", { name: /Mara Ellis.*mara_reads/ }).click();
  assert.equal(await page.getByRole("button", { name: /Devon Park.*devon_film/ }).count(), 0);
  await page.getByLabel("Persona gender filter").selectOption("unset");
  await page.getByRole("button", { name: /Devon Park.*devon_film/ }).click();
  await page.getByLabel("Persona gender filter").selectOption("all");
  await page.getByLabel("Opening author").selectOption("p-1");
  await page.getByLabel("Conversation topic").fill("What makes this album feel cohesive?");
  assert.equal(await page.getByLabel("Title type").inputValue(), "all", "verify the studio's default All selection");
  await page.getByLabel("Search titles").fill("Selected");
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await page.getByRole("button", { name: /Selected Album.*Select/ }).click();
  assert(await page.getByText("Attached: Selected Album").isVisible());
  await page.getByRole("button", { name: "Generate draft" }).click();
  await page.getByText("Conversation generated. Review the thread before approval.").waitFor();
  assert.equal(await page.getByRole("button", { name: "Schedule approved conversation" }).count(), 0);
  await page.locator("textarea").first().fill("A manually edited opening question.");
  assert(await page.getByRole("button", { name: "Approve revision" }).isDisabled());
  await page.getByRole("button", { name: "Save edits" }).click();
  await page.getByText("Conversation edits saved. Approval remains a separate step.").waitFor();
  await page.getByRole("button", { name: "Approve revision" }).click();
  await page.getByRole("button", { name: "Schedule approved conversation" }).click();
  const future = new Date(Date.now() + 3600000);
  const localTime = `${future.getFullYear()}-${String(future.getMonth()+1).padStart(2,"0")}-${String(future.getDate()).padStart(2,"0")}T${String(future.getHours()).padStart(2,"0")}:${String(future.getMinutes()).padStart(2,"0")}`;
  await page.locator('input[type="datetime-local"]').fill(localTime);
  await page.getByRole("button", { name: "Schedule conversation", exact: true }).click();
  await page.getByRole("button", { name: "Pause schedule" }).click();
  await page.getByRole("button", { name: "Schedule approved conversation" }).click();
  await page.locator('input[type="datetime-local"]').fill(localTime);
  await page.getByRole("button", { name: "Resume schedule" }).click();
  await page.getByRole("button", { name: "Cancel schedule" }).click();
  await page.getByText("Schedule cancelled.").waitFor();
  await page.getByRole("button", { name: "New conversation" }).click();
  await page.getByRole("button", { name: "Suggest", exact: true }).click();
  await page.getByRole("button", { name: /What makes this book's pacing work/ }).click();
  assert(await page.getByText("Attached: Fixture Book").isVisible());
  await page.setViewportSize({ width: 390, height: 844 });
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), "mobile has no horizontal overflow");
  assert.deepEqual(errors, []);
  assert.deepEqual(remoteWrites, [], "fixture has no live API requests");
  console.log("PASS: filters, exact roster, manual music, private preview, edit/approval/schedule/pause/resume/cancel, sourced selection, mobile width; no live calls");
} finally { await browser.close(); }
