import assert from "node:assert/strict";
import test from "node:test";
import { existsSync, readFileSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import {
  CHECKS, TOOLCHAIN, REPORT_PATH,
  assertVerificationReport, parseTapSummary,
} from "../lib/release-verification.mjs";

const sha = "a".repeat(40);
const counts = { tests: 685, pass: 685, fail: 0, cancelled: 0, skipped: 0, todo: 0 };
const passingReport = () => ({
  schemaVersion: 1, success: true,
  toolchain: { node: "24.22.3", npm: TOOLCHAIN.npm },
  source: { head: sha, dirty: false },
  checks: CHECKS.map(check => ({
    id: check.id, status: "success", exitCode: 0,
    ...(check.minimumTests ? { counts: { ...counts } } : {}),
  })),
});
const expected = { sha };
const tap = (values = counts) => Object.entries(values).map(([key, value]) => `# ${key} ${value}`).join("\n");

test("accepts a complete successful exact-commit verification", () => {
  assertVerificationReport(passingReport(), expected);
  assert.deepEqual(parseTapSummary(tap(), 685), counts);
});

test("rejects incomplete or failed canonical checks even when the report claims success", () => {
  for (const check of CHECKS) {
    for (const status of ["failure", "blocked", "skipped", "cancelled", "neutral", "pending", undefined]) {
      const report = passingReport();
      report.checks.find(row => row.id === check.id).status = status;
      assert.throws(() => assertVerificationReport(report, expected), undefined, `${check.id}/${status}`);
    }
    const report = passingReport();
    report.checks = report.checks.filter(row => row.id !== check.id);
    assert.throws(() => assertVerificationReport(report, expected));
    const nonzero = passingReport();
    nonzero.checks.find(row => row.id === check.id).exitCode = 1;
    assert.throws(() => assertVerificationReport(nonzero, expected));
  }
  const duplicate = passingReport();
  duplicate.checks[1] = duplicate.checks[0];
  assert.throws(() => assertVerificationReport(duplicate, expected));
});

test("rejects wrong commits, dirty sources, and wrong toolchains", () => {
  for (const mutate of [
    report => { report.source.head = "b".repeat(40); },
    report => { report.source.dirty = true; },
    report => { report.source.dirty = null; },
    report => { report.toolchain.node = "22.23.5"; },
    report => { report.toolchain.npm = "11.19.1"; },
    report => { report.success = false; },
    report => { report.schemaVersion = 0; },
  ]) {
    const report = passingReport();
    mutate(report);
    assert.throws(() => assertVerificationReport(report, expected));
  }
  assert.throws(() => assertVerificationReport(null, expected));
  assert.throws(() => assertVerificationReport(passingReport(), { ...expected, sha: "" }));
});

test("rejects empty, failing, skipped, cancelled, TODO, truncated, and contradictory TAP", () => {
  for (const key of ["fail", "cancelled", "skipped", "todo"]) {
    assert.throws(() => parseTapSummary(tap({ ...counts, [key]: 1 }), 685));
  }
  for (const invalid of [
    "", tap({ ...counts, tests: 0, pass: 0 }),
    tap({ ...counts, tests: 684, pass: 684 }),
    tap({ ...counts, pass: 684 }),
    tap().replace("# skipped 0", ""), `${tap()}\n# fail 0`,
    `not ok 1 - broken\n${tap()}`, tap().replace("# tests 685", "# tests NaN"),
  ]) assert.throws(() => parseTapSummary(invalid, 685));
  assert.deepEqual(parseTapSummary(tap().replaceAll("\n", "\r\n"), 685), counts);
  const forged = passingReport();
  forged.checks.find(row => row.id === "unit").counts.skipped = 1;
  assert.throws(() => assertVerificationReport(forged, expected));
});

test("an actual runner setup failure cannot leave a stale green report", () => {
  const root = mkdtempSync(join(tmpdir(), "consumed-release-verification-"));
  try {
    const reportFile = join(root, REPORT_PATH);
    mkdirSync(dirname(reportFile), { recursive: true });
    writeFileSync(reportFile, JSON.stringify(passingReport()));
    const result = spawnSync(process.execPath, [resolve("scripts/verify-release.mjs")], {
      cwd: root, encoding: "utf8",
      env: { PATH: process.env.PATH, npm_execpath: join(root, "missing-npm.cjs") },
      timeout: 15_000,
    });
    assert.equal(result.status, 1);
    const report = JSON.parse(readFileSync(reportFile, "utf8"));
    assert.equal(report.success, false);
    assert.ok(report.error);
    assert.throws(() => assertVerificationReport(report, expected));
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("an ignored source export cannot borrow its ancestor repository identity", () => {
  const artifactRoot = resolve("generated-artifacts");
  mkdirSync(artifactRoot, { recursive: true });
  const root = mkdtempSync(join(artifactRoot, "verification-export-"));
  try {
    const result = spawnSync(process.execPath, [resolve("scripts/verify-release.mjs")], {
      cwd: root, encoding: "utf8",
      env: { PATH: process.env.PATH, npm_execpath: join(root, "missing-npm.cjs") },
      timeout: 15_000,
    });
    assert.equal(result.status, 1);
    const report = JSON.parse(readFileSync(join(root, REPORT_PATH), "utf8"));
    assert.equal(report.source.head, null);
    assert.equal(report.source.dirty, null);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("existing build protection remains while GitHub Actions automation is removed", () => {
  const pkg = JSON.parse(readFileSync("package.json", "utf8"));
  assert.equal(pkg.scripts.build, "vite build && esbuild server/index.ts --platform=node --packages=external --bundle --format=esm --outdir=dist && npm run check:progress-dialogs && npm run check:modal-foundation && npm run check:profile-safety-menu");
  assert.equal(pkg.scripts.test, "tsx --test client/src/lib/*.test.ts supabase/functions/_shared/*.test.ts");
  assert.equal(pkg.scripts["test:ci"], "tsx --test --test-reporter=tap client/src/lib/*.test.ts supabase/functions/_shared/*.test.ts");
  assert.equal(pkg.scripts.verify, "node scripts/verify-release.mjs");
  for (const check of CHECKS) assert.ok(pkg.scripts[check.script], `Missing script: ${check.script}`);
  assert.equal(existsSync(".github/workflows/safety-checks.yml"), false);
  assert.equal(existsSync("scripts/assert-release-verification.mjs"), false);
  const runner = readFileSync("scripts/verify-release.mjs", "utf8");
  assert.doesNotMatch(runner, /GITHUB_ACTIONS|GITHUB_SHA|GITHUB_RUN_ID|GITHUB_RUN_ATTEMPT/);
});

test("restored snapshots contain actual recorded outputs and traceable provenance", () => {
  const snapshots = JSON.parse(readFileSync("server/data/recommendation-bakeoff-snapshots.json", "utf8"));
  assert.equal(Object.keys(snapshots).length, 10);
  for (const [source, systems] of Object.entries(snapshots)) {
    assert.match(source, /^(movie|tv):\d+$/);
    for (const [system, snapshot] of Object.entries(systems)) {
      assert.ok(["production", "experimental"].includes(system));
      assert.ok(snapshot.items.length > 0);
      assert.ok(snapshot.provenance.length > 30);
      for (const [index, item] of snapshot.items.entries()) {
        assert.equal(item.rank, index + 1);
        assert.ok(item.title && item.id);
        assert.ok(["movie", "tv"].includes(item.type));
      }
    }
  }
  const prepared = JSON.parse(readFileSync("client/src/data/prepared-similar-media.json", "utf8"));
  for (const row of prepared.filter(row => ["movie", "tv"].includes(row.source.type))) {
    const key = `${row.source.type}:${row.source.external_id}`;
    if (key === "tv:250923") continue; // Original generator uses the actual recorded consumer-cache output.
    assert.deepEqual(snapshots[key].production.items.map(item => item.title), row.recommendations.map(item => item.title));
  }
});
