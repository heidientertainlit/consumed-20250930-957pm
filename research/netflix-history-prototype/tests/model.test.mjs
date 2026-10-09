import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { getProfile, isHistoryUrl, normalizeEntries, recordCheck } from "../extension/history-model.js";

const first = { title: "Synthetic Movie", dateText: "10/08/26", titleId: "1001" };
const second = { title: "Synthetic Show: Episode Two", dateText: "10/09/26", titleId: "1002" };

test("URL allowlist rejects login, other sites, spoofed hosts, HTTP and embedded credentials", () => {
  for (const url of [
    "https://www.netflix.com/viewingactivity", "https://netflix.com/settings/viewing-history",
    "https://www.netflix.com/en-US/viewingactivity?ignored=1",
  ]) assert.equal(isHistoryUrl(url), true, url);
  for (const url of [
    "https://app.consumedapp.com/login", "https://www.netflix.com/login",
    "https://www.netflix.com/browse", "http://www.netflix.com/viewingactivity",
    "https://netflix.com.evil.example/viewingactivity", "https://evil.example/netflix.com/viewingactivity",
    "https://user:password@www.netflix.com/viewingactivity", "not a URL",
  ]) assert.equal(isHistoryUrl(url), false, url);
});

test("first check creates a baseline, second identifies differences and retains older rows", () => {
  const initial = recordCheck(null, "Mine", [first], "2026-10-08T00:00:00Z");
  assert.equal(initial.baselineCreated, true);
  assert.equal(initial.profile.lastNewCount, 0);
  const next = recordCheck(initial.state, "Mine", [second], "2026-10-09T00:00:00Z");
  assert.equal(next.baselineCreated, false);
  assert.equal(next.added.length, 1);
  assert.equal(next.profile.entries.length, 2);
  assert.equal(next.profile.checks, 2);
  assert.equal(initial.profile.entries.length, 1, "previous state is immutable");
});

test("identical checks, duplicate rows and whitespace do not create new activity", () => {
  const initial = recordCheck(null, "Mine", [first, first]);
  const next = recordCheck(initial.state, " mine ", [{ ...first, title: " Synthetic   Movie " }]);
  assert.equal(next.profile.entries.length, 1);
  assert.equal(next.added.length, 0);
});

test("episode text and date distinguish history rows sharing a series ID", () => {
  const rows = normalizeEntries([
    first, { ...first, title: "Episode Two" }, { ...first, dateText: "09/10/26" },
  ]);
  assert.equal(rows.length, 3);
});

test("profile labels do not mix histories or collide with object properties", () => {
  const initial = recordCheck(null, "__proto__", [first]);
  const next = recordCheck(initial.state, "Other", [second]);
  assert.equal(getProfile(next.state, "__proto__").entries[0].title, first.title);
  assert.equal(getProfile(next.state, "Other").entries[0].title, second.title);
  assert.equal({}.entries, undefined);
});

test("empty and invalid reads fail instead of overwriting a baseline", () => {
  const initial = recordCheck(null, "Mine", [first]);
  assert.throws(() => recordCheck(initial.state, "Mine", []), /No recognizable/);
  assert.throws(() => recordCheck(initial.state, "Mine", null), /invalid/);
  assert.throws(() => recordCheck(initial.state, "", [first]), /Enter a local label/);
  assert.throws(() => recordCheck({ version: 99 }, "Mine", [first]), /Unsupported/);
  assert.equal(initial.profile.entries.length, 1);
});

test("limits fail explicitly and keep existing state intact", () => {
  const rows = Array.from({ length: 2500 }, (_, i) => ({ ...first, title: `Synthetic ${i}` }));
  const initial = recordCheck(null, "Mine", rows);
  assert.throws(() => recordCheck(initial.state, "Mine", [second]), /2,500/);
  assert.equal(initial.profile.entries.length, 2500);
  const two = recordCheck(initial.state, "Two", [first]);
  const three = recordCheck(two.state, "Three", [first]);
  assert.throws(() => recordCheck(three.state, "Four", [first]), /three local/);
});

test("extension manifest has only temporary access and local storage, with network-blocking CSP", async () => {
  const manifest = JSON.parse(await readFile(new URL("../extension/manifest.json", import.meta.url), "utf8"));
  assert.deepEqual(manifest.permissions, ["activeTab", "scripting", "storage"]);
  for (const field of ["host_permissions", "background", "content_scripts", "externally_connectable"]) {
    assert.equal(manifest[field], undefined);
  }
  assert.match(manifest.content_security_policy.extension_pages, /connect-src 'none'/);
});
