import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { test } from "node:test";
import { build } from "esbuild";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

// Render the real page with controlled query states, without accounts or network calls.
const fixtureGlobal = globalThis as any;
const doubles: Record<string, string> = {
  "@tanstack/react-query": `export const useQuery=({queryKey})=>({
    data:undefined,isLoading:false,isPending:false,isError:false,refetch(){},
    ...globalThis.__dnaLoadingFixture.queries[queryKey[0]]
  });`,
  "@/lib/auth": `export const useAuth=()=>globalThis.__dnaLoadingFixture.auth;`,
  "wouter": `export const useLocation=()=>["/dna",()=>{}];`,
  "@/hooks/use-toast": `export const useToast=()=>({toast(){}});`,
  "@/lib/supabase": `export const supabase={};`,
  "@/lib/share": `export const APP_BASE="https://fixture.invalid";`,
  "@/components/navigation": `export default function Navigation(){return null;}`,
  "@/components/share-image-sheet": `export const ShareImageSheet=()=>null;`,
  "@/components/recommendations-glimpse": `export const RecommendationsGlimpse=()=>null;`,
  "html2canvas": `export default async()=>null;`,
};
const bundle = await build({
  entryPoints: ["client/src/pages/dna.tsx"], bundle: true, write: false,
  platform: "node", format: "cjs", jsx: "automatic",
  external: ["react", "react-dom", "react/jsx-runtime"],
  plugins: [{ name: "dna-loading-fixture", setup(api) {
    api.onResolve({ filter: /.*/ }, args => args.path in doubles ? { path: args.path, namespace: "fixture" } : undefined);
    api.onLoad({ filter: /.*/, namespace: "fixture" }, args => ({ contents: doubles[args.path] }));
  } }],
});
const compiled = { exports: {} as any };
new Function("require", "module", "exports", bundle.outputFiles[0].text)(
  createRequire(import.meta.url), compiled, compiled.exports,
);
const DnaPage = compiled.exports.default;

function render({ stats = {}, dna = {}, auth = true, friends = {} }: any = {}) {
  const previousWindow = fixtureGlobal.window;
  fixtureGlobal.window = { location: { search: "?tab=compare&friend=friend" } };
  fixtureGlobal.__dnaLoadingFixture = {
    auth: auth ? { user: { id: "viewer" }, session: { access_token: "fixture" } } : {},
    queries: {
      "user-stats-dna": { data: { moviesWatched: 12 }, ...stats },
      "dna-profile-summary": { data: { id: "dna" }, ...dna },
      "compare-friends": { data: [], ...friends },
    },
  };
  try { return renderToStaticMarkup(React.createElement(DnaPage)); }
  finally { fixtureGlobal.window = previousWindow; delete fixtureGlobal.__dnaLoadingFixture; }
}

test("comparison deep links show neutral loading while either eligibility query is pending", () => {
  for (const state of [
    { stats: { data: undefined, isPending: true, isLoading: true } },
    { dna: { data: undefined, isPending: true, isLoading: true } },
    { stats: { data: undefined, isPending: true }, dna: { data: undefined, isPending: true } },
    { auth: false },
  ]) {
    const html = render(state);
    assert.match(html, /Loading your comparison/);
    assert.doesNotMatch(html, /Comparison Locked|Finish My DNA/);
  }
});

test("confirmed eligible users and friends still loading never see the lock", () => {
  assert.match(render(), /<h2[^>]*>Your Entertainment DNA™ Profile<\/h2>/);
  assert.doesNotMatch(render(), /Comparison Locked|Loading your comparison/);
  assert.doesNotMatch(render({ friends: { isLoading: true } }), /Comparison Locked|No friends yet/);
});

test("confirmed ineligible users still see the correct unlock requirement", () => {
  assert.match(render({ dna: { data: null } }), /Comparison Locked.*Complete your Entertainment DNA/s);
  assert.match(render({ stats: { data: { moviesWatched: 4 } } }), /Comparison Locked.*Log 6 more items/s);
});

test("failed eligibility checks offer retry instead of implying the user is locked", () => {
  for (const state of [{ stats: { data: undefined, isError: true } }, { dna: { data: undefined, isError: true } }]) {
    const html = render(state);
    assert.match(html, /We couldn’t check your comparison access/);
    assert.match(html, /Try again/);
    assert.doesNotMatch(html, /Comparison Locked|Finish My DNA/);
  }
});
