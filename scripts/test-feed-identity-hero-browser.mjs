// Render the real component with isolated auth/database transports. No signed-in
// browser session, live account, credential, or database write is used.
import { chromium } from "playwright";
import { build } from "esbuild";
import assert from "node:assert/strict";
import path from "node:path";

const bundle = await build({
  stdin: {
    contents: `
      import React from "react";
      import { createRoot } from "react-dom/client";
      import { FeedIdentityHero } from "./client/src/components/feed-identity-hero";
      let root;
      window.mountHero = (label, firstName) => {
        if (root) root.unmount();
        window.heroFixture = { label, firstName };
        root = createRoot(document.getElementById("fixture"));
        root.render(React.createElement(FeedIdentityHero));
      };
    `,
    resolveDir: process.cwd(),
    loader: "tsx",
  },
  bundle: true, write: false, format: "iife", platform: "browser", jsx: "automatic",
  plugins: [{
    name: "isolated-hero-transports",
    setup(builder) {
      builder.onResolve({ filter: /^@\/lib\/(auth|supabase)$/ }, args => ({ path: args.path, namespace: "fixture" }));
      builder.onResolve({ filter: /^wouter$/ }, args => ({ path: args.path, namespace: "fixture" }));
      builder.onResolve({ filter: /^@\/components\// }, args => {
        if (args.path.endsWith("/feed-identity-name")) {
          return { path: path.resolve("client/src/components/feed-identity-name.ts") };
        }
        return { path: args.path, namespace: "fixture" };
      });
      builder.onLoad({ filter: /.*/, namespace: "fixture" }, args => {
        if (args.path.endsWith("/auth")) return { contents: `
          const user = { id: "fixture-user", user_metadata: { first_name: "Wrong metadata name" } };
          export const useAuth = () => ({ user });
        ` };
        if (args.path.endsWith("/supabase")) return { contents: `
          export const supabase = {
            auth: { getSession: async () => ({ data: { session: null } }) },
            from: table => {
              const result = { data: table === "users"
                ? { first_name: window.heroFixture.firstName }
                : table === "dna_profiles"
                  ? { label: window.heroFixture.label, secondary_archetypes: ["comfort_watcher", "emotional_binger"] }
                  : table === "login_streaks" ? { current_streak: 1 } : null,
                count: table === "list_items" ? 934 : null };
              const q = { select: () => q, eq: () => q,
                single: () => q, maybeSingle: () => q,
                then: (resolve, reject) => Promise.resolve(result).then(resolve, reject) };
              return q;
            }
          };
        ` };
        if (args.path === "wouter") return { contents: `export const useLocation = () => ["/fixture", () => {}];` };
        return { contents: `export default function Empty() { return null; }
          export const QuickTrackSheet = Empty; export const DnaShareExperience = Empty;` };
      });
    },
  }],
});

const origin = process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` : "http://127.0.0.1:5000";
const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
try {
  const page = await browser.newPage();
  await page.route("**/*", route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
  await page.goto(origin, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => [...document.querySelectorAll("style")].some(el => el.textContent.includes(".flex-col")));
  const css = await page.locator("style").allTextContents();
  await page.goto("about:blank");
  await page.setContent(`<style>${css.join("\n")}</style><div style="padding:16px;max-width:864px;margin:auto"><div id="fixture"></div></div>`);
  await page.addScriptTag({ content: bundle.outputFiles[0].text });
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  for (const width of [320, 375, 390, 430, 768]) {
    await page.setViewportSize({ width, height: 1100 });
    for (const fontSize of [16, 24]) {
      await page.evaluate(size => document.documentElement.style.fontSize = `${size}px`, fontSize);
      for (const label of ["The Completionist", "The Emotional Binger", "The ExceptionallyLongEntertainmentCompletionist"]) {
        await page.evaluate(label => window.mountHero(label, "Heidi"), label);
        await page.getByText("HEIDI, YOU’RE", { exact: true }).waitFor();
        const geometry = await page.evaluate(() => {
          const title = document.querySelector("h1").getBoundingClientRect();
          const face = document.querySelector('[data-testid="button-hero-face-dna"]').getBoundingClientRect();
          const card = document.querySelector('[data-testid="button-hero-face-dna"]').parentElement.parentElement.getBoundingClientRect();
          const greeting = document.querySelector("h1").previousElementSibling.getBoundingClientRect();
          const range = document.createRange(); range.selectNodeContents(document.querySelector("h1"));
          const text = [...range.getClientRects()].filter(rect => rect.width > 0);
          return {
            overlap: title.left < face.right && title.right > face.left && title.top < face.bottom && title.bottom > face.top,
            greetingAbove: greeting.bottom <= title.top,
            textFits: text.every(rect => rect.left >= title.left - 1 && rect.right <= title.right + 1),
            overflow: document.documentElement.scrollWidth > innerWidth,
            faceFitsDesign: innerWidth < 640 ? face.right > card.right && card.right - face.left >= 44 : face.right <= card.right,
          };
        });
        assert.deepEqual(geometry, { overlap: false, greetingAbove: true, textFits: true, overflow: false, faceFitsDesign: true }, `${width}px / ${fontSize}px / ${label}`);
      }
    }
  }
  await page.setViewportSize({ width: 390, height: 900 });
  await page.evaluate(() => {
    document.documentElement.style.fontSize = "16px";
    window.mountHero("The Completionist", "Heidi");
  });
  await page.getByText("HEIDI, YOU’RE", { exact: true }).waitFor();
  await page.screenshot({ path: "/tmp/dna-face-mobile-layout.png" });
  await page.evaluate(() => window.mountHero(null, "Heidi"));
  await page.getByRole("heading", { name: "Welcome back Heidi" }).waitFor();
  assert.equal(await page.getByText("HEIDI, YOU’RE", { exact: true }).count(), 0);
  assert.deepEqual(errors, []);
  console.log("PASS: real hero; canonical first name; greeting above type; no face overlap/text clipping at 320–768px and enlarged text; incomplete-DNA welcome preserved");
} finally { await browser.close(); }
