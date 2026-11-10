import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Brain, Vote, BarChart2, Eye, LayoutGrid, Users, Sparkles, Star } from "lucide-react";
import { transformSync } from "esbuild";

const play = readFileSync(new URL("./play.tsx", import.meta.url), "utf8");
const people = readFileSync(new URL("./people.tsx", import.meta.url), "utf8");

function renderNav(source: string, label: string, declaration: string, state: Record<string, unknown>) {
  const labelIndex = source.indexOf(`aria-label="${label}"`);
  const start = source.lastIndexOf("<nav", labelIndex);
  const end = source.indexOf("</nav>", labelIndex) + "</nav>".length;
  assert.ok(labelIndex >= 0 && start >= 0 && end > start);
  const code = transformSync(`${declaration}\nfunction renderTabs() { return (${source.slice(start, end)}); }`, {
    loader: "tsx", jsxFactory: "React.createElement",
  }).code;
  const context = { React, Brain, Vote, BarChart2, Eye, LayoutGrid, Users, Sparkles, Star, ...state };
  return new Function(...Object.keys(context), `${code}; return renderTabs();`)(...Object.values(context));
}

const modesStart = play.indexOf("const gameModes = [");
const modes = play.slice(modesStart, play.indexOf("\n];", modesStart) + 3);
const tabsStart = people.indexOf("const tabs: Array");
const tabs = people.slice(tabsStart, people.indexOf("\n  ];", tabsStart) + 5);
const playIds = ["all", "trivia", "polls", "ranks", "seen-it"];
const peopleIds = ["friends", "tribes", "creators"];

test("all five Play modes use stacked icon pills and preserve selected state and panel links", () => {
  for (const activeMode of playIds) {
    const element = renderNav(play, "Play modes", modes, { activeMode, setActiveMode() {}, handleTabKeyDown() {} });
    const html = renderToStaticMarkup(element);
    assert.match(html, /grid-cols-5 rounded-full bg-\[#f0eff2\]/);
    assert.equal((html.match(/role="tab"/g) || []).length, 5);
    assert.equal((html.match(/aria-selected="true"/g) || []).length, 1);
    const selected = element.props.children.find((button: any) => button.props["aria-selected"]);
    assert.equal(selected.props.id, `play-tab-${activeMode}`);
    assert.equal(selected.props["aria-controls"], "play-mode-panel");
    assert.match(selected.props.className, /flex-col/);
    assert.match(selected.props.className, /bg-\[#7040dc\] text-white/);
    assert.doesNotMatch(selected.props.className, /after:/);
    assert.match(html, /Seen It/);
    assert.doesNotMatch(html, /truncate|whitespace-normal/);
  }
});

test("Play click and keyboard handlers retain their original mode IDs and indices", () => {
  const clicks: string[] = [];
  const keys: any[] = [];
  const element = renderNav(play, "Play modes", modes, {
    activeMode: "all",
    setActiveMode: (id: string) => clicks.push(id),
    handleTabKeyDown: (event: any, index: number) => keys.push([event.key, index]),
  });
  element.props.children.forEach((button: any) => {
    button.props.onClick();
    button.props.onKeyDown({ key: "ArrowRight" });
  });
  assert.deepEqual(clicks, playIds);
  assert.deepEqual(keys, playIds.map((_, index) => ["ArrowRight", index]));
});

test("People uses side-by-side icons and shorter labels without changing section IDs", () => {
  for (const tab of peopleIds) {
    const clicked: string[] = [];
    const element = renderNav(people, "People sections", tabs, { tab, setTab: (id: string) => clicked.push(id) });
    const html = renderToStaticMarkup(element);
    assert.match(html, /grid-cols-3 rounded-full bg-\[#f0eff2\]/);
    assert.equal((html.match(/aria-selected="true"/g) || []).length, 1);
    assert.deepEqual(element.props.children.map((button: any) => button.props.children[1].props.children), ["Friends", "Tribes", "Creators"]);
    const selected = element.props.children.find((button: any) => button.props["aria-selected"]);
    assert.match(selected.props.className, /bg-\[#7040dc\] text-white/);
    assert.doesNotMatch(selected.props.className, /flex-col|after:/);
    element.props.children.forEach((button: any) => button.props.onClick());
    assert.deepEqual(clicked, peopleIds);
  }
  assert.match(people, />Friends & Matches<\/p>/);
  assert.match(people, />Artists & Creators<\/h2>/);
  assert.match(people, /tab === "friends" && <Friends /);
  assert.match(people, /tab === "tribes" && <Tribes /);
  assert.match(people, /tab === "creators" && <Creators /);
});
