import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import autoprefixer from "autoprefixer";
import postcss from "postcss";
import tailwindcss from "tailwindcss";
import WebSocket from "ws";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const temp = await mkdtemp(join(tmpdir(), "inline-feed-star-rater-"));
const entry = join(temp, "entry.tsx");
const bundle = join(temp, "bundle.js");
const stylesheet = join(temp, "fixture.css");
const screenshot = "/tmp/inline-feed-star-rater-mobile.png";

await writeFile(entry, `
import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { InlineFeedStarRater } from ${JSON.stringify(join(root, "client/src/components/inline-feed-star-rater.tsx"))};

function Fixture() {
  const [rates, setRates] = useState([]);
  const [events, setEvents] = useState({ touchstart: 0, touchmove: 0, touchend: 0, touchcancel: 0, click: 0 });
  const count = name => setEvents(old => ({ ...old, [name]: old[name] + 1 }));
  window.__fixture = {
    rates,
    events,
    clearRates: () => setRates([]),
    clearEvents: () => setEvents({ touchstart: 0, touchmove: 0, touchend: 0, touchcancel: 0, click: 0 }),
  };
  return (
    <main className="fixture-page">
      <section
        data-testid="carousel"
        className="fixture-card"
        onTouchStart={() => count("touchstart")}
        onTouchMove={() => count("touchmove")}
        onTouchEnd={() => count("touchend")}
        onTouchCancel={() => count("touchcancel")}
        onClick={() => count("click")}
      >
        <h1>Inline feed rating fixture</h1>
        <InlineFeedStarRater onRate={rating => setRates(old => [...old, rating])} />
      </section>
    </main>
  );
}
createRoot(document.getElementById("root")).render(<Fixture />);
`);

const sourceCss = await readFile(join(root, "client/src/index.css"), "utf8");
const processedCss = await postcss([
  tailwindcss({ config: join(root, "tailwind.config.ts") }),
  autoprefixer,
]).process(sourceCss, {
  from: join(root, "client/src/index.css"),
  to: stylesheet,
});
await writeFile(stylesheet, `${processedCss.css}
* { box-sizing: border-box; }
html, body, #root { margin: 0; width: 100%; min-height: 100%; }
body { overflow-x: hidden; }
.fixture-page { width: 100%; min-height: 100vh; display: flex; justify-content: center; align-items: flex-start; background: #f5f3ff; }
.fixture-card { width: min(370px, 100%); margin: 0 auto; padding: 14px 0 22px; background: white; border: 1px solid #ddd6fe; overflow: hidden; }
.fixture-card h1 { margin: 0 12px 14px; font-size: 15px; line-height: 20px; color: #4c1d95; }
`);

await build({
  entryPoints: [entry],
  outfile: bundle,
  bundle: true,
  format: "iife",
  platform: "browser",
  jsx: "automatic",
  absWorkingDir: root,
  nodePaths: [join(root, "node_modules")],
});

const html = `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Inline feed star rater fixture</title><link rel="stylesheet" href="/fixture.css"></head><body><div id="root"></div><script src="/bundle.js"></script></body></html>`;
const server = createServer(async (req, res) => {
  if (req.url === "/bundle.js") {
    res.setHeader("Content-Type", "text/javascript");
    res.end(await readFile(bundle));
  } else if (req.url === "/fixture.css") {
    res.setHeader("Content-Type", "text/css");
    res.end(await readFile(stylesheet));
  } else {
    res.setHeader("Content-Type", "text/html");
    res.end(html);
  }
});
await new Promise(resolveListen => server.listen(0, "127.0.0.1", resolveListen));
const port = server.address().port;

const chrome = spawn("/repl/tools/bin/chromium", [
  "--headless", "--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage",
  "--remote-debugging-port=0", `--user-data-dir=${join(temp, "chrome")}`, "about:blank",
], { stdio: ["ignore", "ignore", "pipe"] });

let browser;
let page;
const results = [];
async function record(name, fn) {
  try {
    await fn();
    results.push(`PASS ${name}`);
  } catch (error) {
    results.push(`FAIL ${name}: ${error.message}`);
    process.exitCode = 1;
  }
}

try {
  let stderr = "";
  const browserWs = await new Promise((resolveWs, reject) => {
    const timeout = setTimeout(() => reject(new Error(`Chromium CDP timeout: ${stderr}`)), 10000);
    chrome.stderr.on("data", chunk => {
      stderr += chunk;
      const match = stderr.match(/DevTools listening on (ws:\/\/[^\s]+)/);
      if (match) {
        clearTimeout(timeout);
        resolveWs(match[1]);
      }
    });
  });

  class CDP {
    constructor(url) {
      this.next = 1;
      this.pending = new Map();
      this.ws = new WebSocket(url);
    }
    async open() {
      await new Promise((resolveOpen, reject) => {
        this.ws.once("open", resolveOpen);
        this.ws.once("error", reject);
      });
      this.ws.on("message", raw => {
        const message = JSON.parse(raw);
        if (message.id && this.pending.has(message.id)) {
          const pending = this.pending.get(message.id);
          this.pending.delete(message.id);
          message.error ? pending.reject(new Error(message.error.message)) : pending.resolve(message.result);
        }
      });
    }
    call(method, params = {}) {
      const id = this.next++;
      return new Promise((resolveCall, reject) => {
        this.pending.set(id, { resolve: resolveCall, reject });
        this.ws.send(JSON.stringify({ id, method, params }));
      });
    }
  }

  browser = new CDP(browserWs);
  await browser.open();
  const target = await browser.call("Target.createTarget", { url: "about:blank" });
  const listUrl = browserWs.replace("ws://", "http://").replace(/\/devtools\/browser\/.*$/, "/json/list");
  const targets = await (await fetch(listUrl)).json();
  const pageInfo = targets.find(item => item.id === target.targetId);
  page = new CDP(pageInfo.webSocketDebuggerUrl);
  await page.open();
  await page.call("Page.enable");
  await page.call("Runtime.enable");
  await page.call("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 1 });

  async function evaluate(expression) {
    const result = await page.call("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
    if (result.exceptionDetails) {
      throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
    }
    return result.result.value;
  }
  async function setViewport(width) {
    await page.call("Emulation.setDeviceMetricsOverride", {
      width,
      height: 700,
      deviceScaleFactor: 1,
      mobile: false,
    });
  }
  async function load(width = 390) {
    await setViewport(width);
    await page.call("Page.navigate", { url: `http://127.0.0.1:${port}/` });
    await evaluate(`new Promise((resolve, reject) => {
      const until = Date.now() + 4000;
      const poll = () => {
        if (document.querySelectorAll('button[aria-label^="Rate "]').length === 10 && window.__fixture) return resolve(true);
        if (Date.now() > until) return reject(new Error("fixture timed out"));
        setTimeout(poll, 20);
      };
      poll();
    })`);
  }
  async function point(rating) {
    return evaluate(`(() => {
      const element = document.querySelector('button[aria-label="Rate ${rating}"]');
      const rect = element.getBoundingClientRect();
      return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    })()`);
  }
  async function mouse(type, at, button = "none") {
    await page.call("Input.dispatchMouseEvent", {
      type,
      x: at.x,
      y: at.y,
      button,
      clickCount: type === "mousePressed" || type === "mouseReleased" ? 1 : 0,
    });
  }
  async function click(at) {
    await mouse("mouseMoved", at);
    await mouse("mousePressed", at, "left");
    await mouse("mouseReleased", at, "left");
  }
  async function touch(type, at, id = 7) {
    await page.call("Input.dispatchTouchEvent", {
      type,
      touchPoints: at ? [{ x: at.x, y: at.y, id, radiusX: 2, radiusY: 2, force: 1 }] : [],
    });
  }
  async function fixtureState() {
    return evaluate(`({ rates: [...window.__fixture.rates], events: { ...window.__fixture.events } })`);
  }
  async function clearFixture() {
    await evaluate(`window.__fixture.clearRates(); window.__fixture.clearEvents(); new Promise(resolve => setTimeout(resolve, 0))`);
  }

  for (const width of [320, 390, 1280]) {
    await load(width);
    const baseline = await evaluate(`(() => {
      const buttons = [...document.querySelectorAll('button[aria-label^="Rate "]')];
      const score = buttons[0].closest('[role="group"]').nextElementSibling;
      const card = document.querySelector('[data-testid="carousel"]');
      return {
        buttons: buttons.map(button => {
          const r = button.getBoundingClientRect();
          return [r.x, r.y, r.width, r.height];
        }),
        stars: [...buttons[0].closest('[role="group"]').children].map(star => {
          const r = star.getBoundingClientRect();
          return [r.width, r.height];
        }),
        score: (() => {
          const r = score.getBoundingClientRect();
          return [r.x, r.y, r.width, r.height];
        })(),
        scoreVisibility: getComputedStyle(score).visibility,
        cardWidth: card.getBoundingClientRect().width,
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      };
    })()`);
    await record(`${width}px geometry is responsive, square, and overflow-free`, () => {
      assert.equal(baseline.buttons.length, 10);
      assert.equal(baseline.stars.length, 5);
      for (const [starWidth, starHeight] of baseline.stars) assert.ok(Math.abs(starWidth - starHeight) < 0.1);
      assert.ok(baseline.buttons.every(rect => rect[2] > 0 && rect[3] > 0));
      assert.equal(baseline.scoreVisibility, "hidden");
      assert.ok(baseline.score[2] > 0 && baseline.score[3] > 0);
      assert.ok(baseline.cardWidth <= 370.1 && baseline.cardWidth <= width);
      if (width === 1280) assert.ok(Math.abs(baseline.cardWidth - 370) < 0.1);
      assert.ok(baseline.overflow <= 0);
    });

    for (const rating of [0.5, 3, 3.5, 5]) {
      await mouse("mouseMoved", await point(rating));
      const hovered = await evaluate(`(() => {
        const buttons = [...document.querySelectorAll('button[aria-label^="Rate "]')];
        const score = buttons[0].closest('[role="group"]').nextElementSibling;
        return {
          buttons: buttons.map(button => {
            const r = button.getBoundingClientRect();
            return [r.x, r.y, r.width, r.height];
          }),
          scoreText: score.textContent.trim(),
          scoreVisibility: getComputedStyle(score).visibility,
          score: (() => {
            const r = score.getBoundingClientRect();
            return [r.x, r.y, r.width, r.height];
          })(),
          overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        };
      })()`);
      await record(`${width}px hover ${rating} preserves every hit target and shows score`, () => {
        hovered.buttons.forEach((rect, index) => {
          rect.forEach((value, part) => assert.ok(Math.abs(value - baseline.buttons[index][part]) < 0.1));
        });
        assert.equal(hovered.scoreText, `${rating}/5`);
        assert.notEqual(hovered.scoreVisibility, "hidden");
        hovered.score.forEach((value, part) => assert.ok(Math.abs(value - baseline.score[part]) < 0.1));
        assert.ok(hovered.overflow <= 0);
      });
    }
  }

  await load(390);
  await clearFixture();
  for (let rating = 0.5; rating <= 5; rating += 0.5) await click(await point(rating));
  await record("mouse clicks commit each half-step exactly once", async () => {
    assert.deepEqual((await fixtureState()).rates, [0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5]);
  });

  await clearFixture();
  for (let rating = 0.5; rating <= 5; rating += 0.5) {
    const at = await point(rating);
    await touch("touchStart", at);
    await touch("touchEnd");
    // Model a compatibility mouse event that a browser might generate after touch.
    await click(at);
  }
  await record("touch taps commit each half-step once and suppress compatibility clicks", async () => {
    assert.deepEqual((await fixtureState()).rates, [0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5]);
  });
  await record("parent carousel receives no star tap touch events or clicks", async () => {
    assert.deepEqual((await fixtureState()).events, { touchstart: 0, touchmove: 0, touchend: 0, touchcancel: 0, click: 0 });
  });

  await clearFixture();
  await touch("touchStart", await point(0.5));
  await touch("touchMove", await point(4.5));
  await touch("touchEnd");
  await record("touch drag commits final 4.5 once rather than initial 0.5", async () => {
    assert.deepEqual((await fixtureState()).rates, [4.5]);
  });
  await record("parent carousel receives no drag touch events", async () => {
    assert.deepEqual((await fixtureState()).events, { touchstart: 0, touchmove: 0, touchend: 0, touchcancel: 0, click: 0 });
  });

  await clearFixture();
  await touch("touchStart", await point(2.5));
  await touch("touchCancel");
  await record("touchcancel commits no rating", async () => {
    assert.deepEqual((await fixtureState()).rates, []);
  });

  await clearFixture();
  const releaseStart = await point(0.5);
  const releaseEnd = await point(3.5);
  await evaluate(`(() => {
    const group = document.querySelector('[role="group"]');
    const start = new Touch({ identifier: 41, target: group, clientX: ${releaseStart.x}, clientY: ${releaseStart.y} });
    const end = new Touch({ identifier: 41, target: group, clientX: ${releaseEnd.x}, clientY: ${releaseEnd.y} });
    group.dispatchEvent(new TouchEvent("touchstart", { touches: [start], targetTouches: [start], changedTouches: [start], bubbles: true, cancelable: true }));
    group.dispatchEvent(new TouchEvent("touchend", { touches: [], targetTouches: [], changedTouches: [end], bubbles: true, cancelable: true }));
  })()`);
  await record("immediate touch release uses final changed-touch x without touchmove", async () => {
    assert.deepEqual((await fixtureState()).rates, [3.5]);
  });

  await clearFixture();
  await evaluate(`document.querySelector('button[aria-label="Rate 1.5"]').focus()`);
  await page.call("Input.dispatchKeyEvent", { type: "keyDown", key: "Enter", code: "Enter", text: "\r", unmodifiedText: "\r", windowsVirtualKeyCode: 13 });
  await page.call("Input.dispatchKeyEvent", { type: "keyUp", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13 });
  await evaluate(`document.querySelector('button[aria-label="Rate 4.5"]').focus()`);
  await page.call("Input.dispatchKeyEvent", { type: "keyDown", key: " ", code: "Space", windowsVirtualKeyCode: 32 });
  await page.call("Input.dispatchKeyEvent", { type: "keyUp", key: " ", code: "Space", windowsVirtualKeyCode: 32 });
  await record("keyboard Enter and Space commit half-star values during mouse suppression", async () => {
    assert.deepEqual((await fixtureState()).rates, [1.5, 4.5]);
  });

  await setViewport(320);
  await mouse("mouseMoved", await point(3.5));
  const image = await page.call("Page.captureScreenshot", { format: "png", fromSurface: true });
  await writeFile(screenshot, Buffer.from(image.data, "base64"));
  await record("mobile fixture screenshot was captured", async () => {
    const bytes = (await readFile(screenshot)).byteLength;
    assert.ok(bytes > 1000);
  });

  console.log("InlineFeedStarRater real component + Tailwind Chromium fixture");
  console.log(results.join("\n"));
  console.log(`${results.filter(line => line.startsWith("PASS")).length}/${results.length} passed`);
  console.log(`Screenshot: ${screenshot}`);
} finally {
  page?.ws.close();
  browser?.ws.close();
  if (chrome.exitCode === null) {
    const chromeExited = new Promise(resolveExit => chrome.once("exit", resolveExit));
    chrome.kill("SIGTERM");
    await chromeExited;
  }
  await new Promise(resolveClose => server.close(resolveClose));
  await rm(temp, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 });
}