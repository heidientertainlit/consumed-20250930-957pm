import assert from "node:assert/strict";

// Verification target only: this does not change Replit or Vercel runtimes.
// npm 10 preserves the existing installer baseline while Node 24 is evaluated.
export const TOOLCHAIN = Object.freeze({ nodeMajor: 24, npm: "10.9.9" });
export const REPORT_PATH = "generated-artifacts/release-verification/report.json";
export const REQUIRED_SETUP = ["checkout", "toolchain", "node", "npm", "dependencies", "browsers", "verify"];
export const CHECKS = Object.freeze([
  { id: "types", script: "check" },
  { id: "unit", script: "test:ci", minimumTests: 685 },
  { id: "build", script: "build:app" },
  { id: "verification-tests", script: "test:verification", minimumTests: 1 },
  { id: "native-source", script: "check:onesignal-native" },
  { id: "progress", script: "check:progress-dialogs", requires: ["build"] },
  { id: "modals", script: "check:modal-foundation", requires: ["build"] },
  { id: "profile", script: "check:profile-safety-menu", requires: ["build"] },
  { id: "webkit", script: "check:modal-foundation:webkit", requires: ["build"] },
]);

export function assertTestCounts(counts, minimumTests = 1) {
  for (const key of ["tests", "pass", "fail", "cancelled", "skipped", "todo"]) {
    assert.ok(Number.isSafeInteger(counts?.[key]) && counts[key] >= 0, `Missing or invalid test count: ${key}`);
  }
  assert.ok(counts.tests >= minimumTests, `Expected at least ${minimumTests} tests; received ${counts.tests}`);
  for (const key of ["fail", "cancelled", "skipped", "todo"]) {
    assert.equal(counts[key], 0, `Tests reported ${key}`);
  }
  assert.equal(counts.pass, counts.tests, "Not every test passed");
  return counts;
}

export function parseTapSummary(output, minimumTests = 1) {
  assert.doesNotMatch(output, /^not ok\b/m, "TAP contains a failing test");
  const counts = {};
  for (const key of ["tests", "pass", "fail", "cancelled", "skipped", "todo"]) {
    const matches = [...output.matchAll(new RegExp(`^# ${key} (\\d+)\\r?$`, "gm"))];
    assert.equal(matches.length, 1, `Expected exactly one TAP summary: ${key}`);
    counts[key] = Number(matches[0][1]);
  }
  return assertTestCounts(counts, minimumTests);
}

export function assertWorkflowResults(steps) {
  for (const id of REQUIRED_SETUP) {
    assert.equal(steps?.[id]?.outcome, "success", `Mandatory step did not succeed: ${id}`);
    assert.equal(steps?.[id]?.conclusion, "success", `Mandatory step was masked or incomplete: ${id}`);
  }
}

export function assertVerificationReport(report, expected = {}) {
  assert.equal(report?.schemaVersion, 1, "Missing or unsupported verification report");
  assert.equal(report.success, true, "Verification did not finish successfully");
  assert.equal(Number(report.toolchain?.node?.split(".")[0]), TOOLCHAIN.nodeMajor, "Wrong Node major");
  assert.equal(report.toolchain?.npm, TOOLCHAIN.npm, "Wrong npm version");
  assert.deepEqual(report.checks?.map(check => check.id), CHECKS.map(check => check.id),
    "Missing, duplicate, reordered, or unknown checks");
  for (const check of CHECKS) {
    const result = report.checks.find(result => result.id === check.id);
    assert.equal(result.status, "success", `Verification check did not pass: ${check.id}`);
    assert.equal(result.exitCode, 0, `Verification check did not exit successfully: ${check.id}`);
    if (check.minimumTests) assertTestCounts(result.counts, check.minimumTests);
  }
  if (expected.sha !== undefined) {
    assert.match(expected.sha, /^[a-f0-9]{40}$/, "A full production-candidate commit SHA is required");
    assert.equal(report.source?.head, expected.sha, "Verification belongs to a different commit");
    assert.equal(report.source?.dirty, false, "CI verified a modified working tree");
  }
  if (expected.runId !== undefined) {
    assert.ok(expected.runId && expected.runAttempt, "Workflow run identity is required");
    assert.equal(report.runId, expected.runId, "Report belongs to a different workflow run");
    assert.equal(report.runAttempt, expected.runAttempt, "Report belongs to a different workflow attempt");
  }
}
