import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Dna, List } from "lucide-react";
import { transformSync } from "esbuild";

const source = readFileSync(new URL("./user-profile.tsx", import.meta.url), "utf8");
const section = source.slice(
  source.indexOf("{/* Section navigation (only for own profile) */}"),
  source.indexOf("{/* Section Navigation for Friend Profiles */}"),
);
const jsx = section.slice(section.indexOf("<div"), section.lastIndexOf("</div>") + "</div>".length);
const compiled = transformSync(`function renderTabs() { return (${jsx}); }`, {
  loader: "tsx",
  jsxFactory: "React.createElement",
}).code;

function tabs(activeSection: string, onChange: (value: string) => void = () => {}) {
  return new Function("React", "Dna", "List", "activeSection", "setActiveSection", `${compiled}; return renderTabs();`)(
    React, Dna, List, activeSection, onChange,
  );
}

test("DNA and My Media each render with the same purple selected pill as media-detail tabs", () => {
  for (const [value, testId] of [["dna", "nav-dna-profile"], ["all-media", "nav-all-media"]]) {
    const html = renderToStaticMarkup(tabs(value));
    assert.match(html, /role="tablist"/);
    assert.match(html, /max-w-sm rounded-full bg-\[#f0eff2\]/);
    assert.equal((html.match(/aria-selected="true"/g) || []).length, 1);
    const selected = (html.match(/<button[^>]+>/g) || []).find((button) => button.includes(`data-testid="${testId}"`));
    assert.ok(selected);
    assert.match(selected, /aria-selected="true"/);
    assert.match(selected, /rounded-full/);
    assert.match(selected, /bg-\[#7040dc\] text-white/);
    assert.match(html, />DNA<\/span>/);
    assert.match(html, />My Media<\/span>/);
  }
});

test("tab clicks preserve the original section values and own-profile visibility gate", () => {
  const selected: string[] = [];
  const element = tabs("dna", (value) => selected.push(value));
  const buttons = element.props.children.props.children;
  buttons[0].props.onClick();
  buttons[1].props.onClick();
  assert.deepEqual(selected, ["dna", "all-media"]);
  assert.match(section, /isOwnProfile &&/);
  assert.match(source, /!isOwnProfile && friendshipStatus === 'friends'/);
});
