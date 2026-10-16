import { chromium } from "playwright";
import { createServer } from "vite";
import react from "@vitejs/plugin-react";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");
const server = await createServer({
  configFile: false,
  root: path.join(root, "client"),
  plugins: [
    {
      name: "isolated-admin-conversation-fixture",
      configureServer(vite) {
        vite.middlewares.use(async (req, res, next) => {
          if (req.url !== "/__fixture/") return next();
          const html = await vite.transformIndexHtml("/__fixture/", '<html><body><div id="root"></div><script type="module" src="/src/components/admin/conversation-browser-fixture.tsx"></script></body></html>');
          res.setHeader("Content-Type", "text/html");
          res.end(html);
        });
      },
    },
    react(),
  ],
  resolve: { alias: [
    { find: "@/lib/auth", replacement: path.join(root, "client/src/components/admin/conversation-browser-auth-fixture.ts") },
    { find: "@", replacement: path.join(root, "client/src") },
  ] },
  optimizeDeps: { entries: ["src/components/admin/conversation-browser-fixture.tsx"] },
  define: {
    "import.meta.env.VITE_SUPABASE_URL": JSON.stringify("https://fixture.invalid"),
    "import.meta.env.VITE_SUPABASE_ANON_KEY": JSON.stringify("fixture-anon-key"),
  },
  server: { host: "127.0.0.1", port: 0 },
});
let browser;
try {
  await server.listen();
  const origin = `http://127.0.0.1:${server.httpServer.address().port}`;
  browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
  const errors = [], unexpected = [], calls = [], details = [], pending = [];
  page.on("pageerror", error => errors.push(error.message));
  const media = query => ({
    title: query === "slow" ? "Slow Show" : query === "second" ? "Second Show" : "Fixture Show",
    type: "tv", external_id: query === "slow" ? "303" : query === "second" ? "202" : "101", external_source: "tmdb",
  });
  let runs = [];
  const fulfill = (route, data) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(data) });
  await page.route("**/*", async route => {
    const request = route.request(), url = new URL(request.url());
    if (url.pathname === "/__fixture/admin") {
      const body = request.postDataJSON();
      calls.push(body);
      if (body.action === "select-subject") {
        const result = { id: `stored-${body.media.external_id}`, subject: { ...body.media }, provenance: [{ kind: "media-selection" }] };
        if (body.media.external_id === "303") {
          pending.push(() => fulfill(route, result));
          return;
        }
        return fulfill(route, result);
      }
      if (body.action === "generate") {
        const run = {
          id: `run-${runs.length + 1}`, topic: body.topic, status: "draft", revision: 1,
          participant_ids: ["p-1", "p-2"], opening_author_id: "p-1", created_at: new Date().toISOString(),
          subject: {
            title: body.subjectId === "stored-202" ? "Second Show" : "Fixture Show", type: "tv",
            ...(body.seasonNumber !== undefined ? { season: { number: body.seasonNumber, name: "The return", overview: "A changed workplace." } } : {}),
            ...(body.episodeNumber !== undefined ? { episode: { number: body.episodeNumber, name: "The meeting", overview: "An unexpected visitor." } } : {}),
          },
          provenance: [
            { kind: "persona-selection", participant_id: "p-1", reason: "Follows character-led workplace dramas." },
            { kind: "persona-selection", participant_id: "p-2", reason: "Brings a contrasting view of visual storytelling." },
          ],
          messages: [{ client_id: "m-1", participant_id: "p-1", parent_client_id: null, body: "What changed in this episode?", offset_seconds: 0 }],
        };
        runs.unshift(run);
        return fulfill(route, run);
      }
      if (body.action === "state") return fulfill(route, { runs });
      if (body.action === "edit") {
        const run = runs.find(item => item.id === body.runId);
        run.messages = body.messages;
        run.revision += 1;
        return fulfill(route, run);
      }
      if (body.action === "approve") {
        const run = runs.find(item => item.id === body.runId);
        run.status = "approved"; run.approved_revision = run.revision;
        return fulfill(route, run);
      }
      unexpected.push(body);
      return route.abort();
    }
    if (url.origin === "https://fixture.invalid") {
      if (url.pathname.endsWith("/media-search")) return fulfill(route, { results: [media(request.postDataJSON().query)] });
      if (url.pathname.endsWith("/get-media-details")) {
        details.push(url.pathname + url.search);
        return fulfill(route, { seasons: [{ seasonNumber: 1, name: "First" }, { season_number: 2, name: "The return" }] });
      }
      if (url.pathname.endsWith("/get-season-episodes")) {
        details.push(url.pathname + url.search);
        return fulfill(route, { episodes: [{ episodeNumber: 3, name: "The meeting" }] });
      }
    }
    if (url.origin === origin) return route.continue();
    // Fonts are not relevant to functional verification; no request leaves the fixture.
    if (url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com") return route.abort();
    unexpected.push(request.url());
    return route.abort();
  });
  await page.goto(`${origin}/__fixture/`);
  await page.getByRole("heading", { name: "Generate conversations" }).waitFor();
  assert.equal(await page.getByLabel("Angle", { exact: true }).count(), 0);
  assert.equal(await page.getByLabel("Opening author", { exact: true }).count(), 0);
  assert.equal(await page.getByLabel("Persona gender filter").count(), 0);
  assert.equal(await page.getByLabel("Filter persona name, tone or interests").count(), 0);
  await page.getByLabel("Conversation topic", { exact: true }).fill("What changed at the workplace?");
  await page.getByLabel("Context", { exact: true }).fill("Discuss only the selected scope.");
  const generate = page.getByRole("button", { name: "Generate draft", exact: true });
  assert.equal(await generate.isEnabled(), true, "no manual roster required");

  const pick = async (query, id) => {
    await page.getByTestId("media-search-input").fill(query);
    await page.getByTestId(`media-search-result-${id}`).click();
  };
  const chooseScope = async () => {
    const season = page.getByLabel("Conversation season", { exact: true });
    await season.locator('option[value="2"]').waitFor({ state: "attached" });
    await season.selectOption("2");
    const episode = page.getByLabel("Conversation episode", { exact: true });
    await episode.locator('option[value="3"]').waitFor({ state: "attached" });
    await episode.selectOption("3");
  };
  await pick("fixture", "101");
  await page.getByText("Attached: Fixture Show · tv", { exact: true }).waitFor();
  assert.deepEqual(calls.find(call => call.action === "select-subject"), {
    action: "select-subject",
    media: { title: "Fixture Show", type: "tv", external_id: "101", external_source: "tmdb" },
  });
  await chooseScope();
  // Season changes cannot retain the old episode.
  await page.getByLabel("Conversation season", { exact: true }).selectOption("1");
  assert.equal(await page.getByLabel("Conversation episode", { exact: true }).inputValue(), "");
  await chooseScope();
  await generate.click();
  await page.getByRole("heading", { name: "Why these participants" }).waitFor();
  const generated = calls.find(call => call.action === "generate");
  assert.deepEqual(generated, {
    action: "generate", topic: "What changed at the workplace?", subjectId: "stored-101",
    context: "Discuss only the selected scope.", autoParticipants: true,
    seasonNumber: 2, episodeNumber: 3, replyCount: 6, durationMinutes: 90, maxWords: 65,
  });
  assert(details.includes("/functions/v1/get-media-details?source=tmdb&external_id=101&media_type=tv"));
  assert(details.includes("/functions/v1/get-season-episodes?external_id=101&season=2"));
  assert(await page.getByText("Mara Ellis · opening author", { exact: true }).isVisible());
  assert(await page.getByText("Follows character-led workplace dramas.", { exact: true }).isVisible());
  assert(await page.getByText("Brings a contrasting view of visual storytelling.", { exact: true }).isVisible());
  assert(await page.getByLabel("Conversation scope").getByText("Episode 3 · The meeting", { exact: true }).isVisible());
  assert.equal(calls.filter(call => call.action === "approve" || call.action === "schedule").length, 0);
  assert.equal(await page.getByRole("button", { name: "Schedule approved conversation" }).count(), 0);
  await page.getByLabel("Message content 1").fill("An edited opening question.");
  assert(await page.getByRole("button", { name: "Approve revision" }).isDisabled());
  await page.getByRole("button", { name: "Save edits" }).click();
  await page.getByText("Conversation edits saved. Approval remains a separate step.").waitFor();
  await page.getByRole("button", { name: "Approve revision" }).click();
  await page.getByRole("button", { name: "Schedule approved conversation" }).waitFor();
  assert.equal(calls.filter(call => call.action === "approve").length, 1);
  assert.equal(calls.filter(call => call.action === "schedule").length, 0);

  await page.getByRole("button", { name: "New conversation", exact: true }).click();
  await page.getByRole("button", { name: "Change / remove" }).click();
  await pick("second", "202");
  await page.getByText("Attached: Second Show · tv", { exact: true }).waitFor();
  assert.equal(await page.getByLabel("Conversation season", { exact: true }).inputValue(), "");
  assert.equal(await page.getByLabel("Conversation episode", { exact: true }).count(), 0);
  await generate.click();
  await page.getByRole("heading", { name: "Why these participants" }).waitFor();
  const second = calls.filter(call => call.action === "generate").at(-1);
  assert.equal(second.subjectId, "stored-202");
  assert.equal("seasonNumber" in second, false);
  assert.equal("episodeNumber" in second, false);
  await page.getByRole("button", { name: "New conversation", exact: true }).click();
  await chooseScope();
  await page.getByRole("button", { name: "Change / remove" }).click();
  await generate.click();
  await page.getByRole("heading", { name: "Why these participants" }).waitFor();
  const removed = calls.filter(call => call.action === "generate").at(-1);
  for (const key of ["subjectId", "seasonNumber", "episodeNumber"]) assert.equal(key in removed, false);

  await page.getByRole("button", { name: "New conversation", exact: true }).click();
  await pick("slow", "303");
  await page.getByText("Attaching title…", { exact: true }).waitFor();
  assert(await generate.isDisabled());
  await page.waitForFunction(() => document.querySelector('[data-testid="media-search-input"]') !== null);
  await pick("second", "202");
  await page.getByText("Attached: Second Show · tv", { exact: true }).waitFor();
  assert.equal(pending.length, 1);
  await pending.shift()();
  await page.waitForTimeout(120);
  assert(await page.getByText("Attached: Second Show · tv", { exact: true }).isVisible(), "late selection cannot replace newer title");
  assert.equal(await page.getByText("Attached: Slow Show · tv", { exact: true }).count(), 0);
  await page.getByRole("button", { name: "Change / remove" }).click();
  await pick("slow", "303");
  await page.getByText("Attaching title…", { exact: true }).waitFor();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  assert.equal(pending.length, 1);
  await pending.shift()();
  await page.waitForTimeout(120);
  assert.equal(await page.getByText("Attached: Slow Show · tv", { exact: true }).count(), 0, "cancel invalidates pending selection");
  assert(await generate.isEnabled());
  await page.setViewportSize({ width: 390, height: 844 });
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), "mobile fixture does not overflow");
  assert.deepEqual(errors, []);
  assert.deepEqual(unexpected, [], "all requests are isolated; no live backend calls");
  console.log("PASS actual ConversationStudio + MediaSearchPanel: automatic participants, exact selection/generate payloads, TV scope/reset, selection races, visible reasons, separate edit/approval, mobile; no live calls.");
} finally {
  await browser?.close();
  await server.close();
}
