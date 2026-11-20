import { readFileSync } from "node:fs";
import { REPORT_PATH, assertWorkflowResults, assertVerificationReport } from "./lib/release-verification.mjs";

if (process.env.GITHUB_ACTIONS !== "true") throw new Error("This final gate requires GitHub workflow context.");
if (!process.env.GITHUB_SHA || !process.env.GITHUB_RUN_ID || !process.env.GITHUB_RUN_ATTEMPT) {
  throw new Error("Missing exact-commit workflow identity.");
}
assertWorkflowResults(JSON.parse(process.env.SAFETY_STEP_RESULTS || "null"));
assertVerificationReport(JSON.parse(readFileSync(REPORT_PATH, "utf8")), {
  sha: process.env.GITHUB_SHA,
  runId: process.env.GITHUB_RUN_ID,
  runAttempt: process.env.GITHUB_RUN_ATTEMPT,
});
console.log("All mandatory checks passed for this exact commit and workflow attempt.");
