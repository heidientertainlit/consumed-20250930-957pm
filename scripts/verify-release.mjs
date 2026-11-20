import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync, realpathSync } from "node:fs";
import { dirname, join, delimiter } from "node:path";
import { CHECKS, TOOLCHAIN, REPORT_PATH, parseTapSummary, assertVerificationReport } from "./lib/release-verification.mjs";

if (process.argv.length !== 2) throw new Error("Verification accepts no skip or partial-run options.");
const directory = dirname(REPORT_PATH);
mkdirSync(directory, { recursive: true });
const git = args => {
  const result = spawnSync("git", args, { encoding: "utf8" });
  return result.status === 0 ? result.stdout.trim() : null;
};
// An export nested inside an ignored workspace directory is not that parent's
// checkout. Never borrow an ancestor repository's SHA as verification evidence.
const gitRoot = git(["rev-parse", "--show-toplevel"]);
const ownCheckout = gitRoot !== null && realpathSync(gitRoot) === realpathSync(process.cwd());
const report = {
  schemaVersion: 1, startedAt: new Date().toISOString(), success: false,
  runId: process.env.GITHUB_RUN_ID || null,
  runAttempt: process.env.GITHUB_RUN_ATTEMPT || null,
  source: { head: ownCheckout ? git(["rev-parse", "HEAD"]) : null, dirty: null },
  toolchain: { node: process.versions.node, npm: null }, checks: [],
};
const status = ownCheckout ? git(["status", "--porcelain", "--untracked-files=normal"]) : null;
report.source.dirty = status === null ? null : Boolean(status);
// Replace any stale successful report before running or validating anything.
writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2) + "\n");
const ci = process.env.GITHUB_ACTIONS === "true";
try {
  if (Number(process.versions.node.split(".")[0]) !== TOOLCHAIN.nodeMajor) {
    throw new Error(`Verification requires Node ${TOOLCHAIN.nodeMajor}.x; development/production runtimes were not changed.`);
  }
  const npmCli = process.env.npm_execpath;
  if (!npmCli) throw new Error("Run verification through npm run verify.");
  const env = { ...process.env, PATH: `${dirname(process.execPath)}${delimiter}${process.env.PATH || ""}` };
  const npmVersion = spawnSync(process.execPath, [npmCli, "--version"], { encoding: "utf8", env });
  report.toolchain.npm = npmVersion.stdout?.trim();
  if (npmVersion.status !== 0 || report.toolchain.npm !== TOOLCHAIN.npm) {
    throw new Error(`Verification requires npm ${TOOLCHAIN.npm}; received ${report.toolchain.npm || "unknown"}.`);
  }
  if (ci && (report.source.head !== process.env.GITHUB_SHA || report.source.dirty !== false)) {
    throw new Error("CI must verify the clean, exact triggering commit.");
  }
  console.log(`Verification: Node ${report.toolchain.node}, npm ${report.toolchain.npm}; source ${report.source.head || "local export"}${report.source.dirty ? " (local changes)" : ""}`);
  for (const check of CHECKS) {
    const blocked = check.requires?.filter(id => report.checks.find(result => result.id === id)?.status !== "success") || [];
    const result = { id: check.id, status: "failure", exitCode: null };
    report.checks.push(result);
    if (blocked.length) {
      result.status = "blocked";
      result.error = `Prerequisite did not pass: ${blocked.join(", ")}`;
    } else {
      console.log(`\n--- ${check.id}: npm run ${check.script} ---`);
      const execution = spawnSync(process.execPath, [npmCli, "run", check.script], {
        encoding: "utf8", env, timeout: 8 * 60_000, killSignal: "SIGKILL", maxBuffer: 64 * 1024 * 1024,
      });
      const output = execution.stdout || "";
      const errors = execution.stderr || "";
      result.log = join(directory, `${check.id}.log`);
      writeFileSync(result.log, output + errors);
      process.stdout.write(output);
      process.stderr.write(errors);
      result.exitCode = execution.status;
      try {
        if (execution.error) throw execution.error;
        if (execution.status !== 0) throw new Error(`Command exited ${execution.status}; signal ${execution.signal || "none"}`);
        if (check.minimumTests) result.counts = parseTapSummary(output, check.minimumTests);
        result.status = "success";
      } catch (error) {
        result.error = error.message;
      }
    }
    console.log(`[verification] ${check.id}: ${result.status}${result.error ? ` — ${result.error}` : ""}`);
    writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2) + "\n");
  }
  report.success = report.checks.every(check => check.status === "success");
  assertVerificationReport(report, ci ? {
    sha: process.env.GITHUB_SHA,
    runId: process.env.GITHUB_RUN_ID,
    runAttempt: process.env.GITHUB_RUN_ATTEMPT,
  } : {});
} catch (error) {
  report.success = false;
  report.error = error.message;
  console.error(`[verification] FAILED: ${error.message}`);
} finally {
  report.finishedAt = new Date().toISOString();
  writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2) + "\n");
  console.log(`\nVerification ${report.success ? "PASSED" : "FAILED"}; report: ${REPORT_PATH}`);
  if (!report.success) process.exitCode = 1;
}
