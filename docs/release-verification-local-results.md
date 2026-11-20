# Local release-verification results

Local preparation on November 19, 2026 (America/Denver). No Git network
operations, merges, deployments, external account connections, or GitHub/Vercel
settings changes were performed.

## Verdict

The approved local code and workflow preparation is implemented. The existing
production build protection remains intact. **The replacement gate is not yet
fully validated or approved for production enforcement.**

Node 24.22.3 with npm 10.9.9 successfully installed the locked dependencies and
passed TypeScript, all 685 existing unit tests, application compilation,
verification/diagnostic tests, native static verification, and all three
Chromium guards. The full canonical command correctly failed because WebKit
could not launch with this Replit host's native libraries.

Do not summarize this as an entirely green Node 24 release gate.

## Files changed and why

| File | Change |
| --- | --- |
| `client/src/components/feed-conversation-section.tsx` | Removed two impossible comparisons against `"takes"` from a value that is always `"replies"`; singular/plural text and accessible labels remain the same. |
| `server/data/recommendation-bakeoff-snapshots.json` | Restored the missing real snapshot using the existing generator and its original available local inputs; ten source identities, no placeholder data or new provider/model calls. |
| `package.json` | Added only `verify` and `test:verification`; all existing commands and dependency declarations remain unchanged. |
| `scripts/lib/release-verification.mjs` | Defines the shared Node/npm target, mandatory checks, TAP/count requirements, workflow outcome rules, and exact-commit/run report validation. |
| `scripts/verify-release.mjs` | Runs the canonical checks, writes fresh structured evidence, rejects incorrect toolchains, and fails when mandatory checks fail or cannot execute. |
| `scripts/assert-release-verification.mjs` | Implements the unconditional Actions final gate; checks setup outcomes, complete evidence, commit SHA, clean-source claim, and workflow run/attempt identity. |
| `scripts/tests/release-verification.test.mjs` | Adds ten tests covering successful verification, failure/skip/cancellation/missing-result rejection, stale reports, source-export identity, actual CLI failures, unchanged protections, and snapshot provenance. |
| `.github/workflows/safety-checks.yml` | Prepares read-only exact-commit Actions verification on Ubuntu, explicit Node/npm setup, locked install, Chromium/WebKit dependencies, evidence retention, and final enforcement; no deployment commands or production secrets. |
| `docs/safety-checks-rollout.md` | Replaces stale workflow/baseline claims with the actual local implementation, coverage boundaries, and separately approved external stages. |
| `docs/release-verification-local-results.md` | Records this file inventory, measured results, limitations, and external requirements. |
| `.agents/memory/safety-release-workflow.md` | Records the environment-specific lesson that broad Nix library paths can break Node and must not be used to conceal unsupported browser-library ABIs. |

Build outputs, copied clean source, fresh dependencies, and test evidence are
under the existing ignored `dist/` and `generated-artifacts/` locations.
They are not application source changes to push.

## Measured checks

| Check | Result |
| --- | --- |
| Existing TypeScript scope | Passed; all three reported errors resolved without changing exclusions or suppressing diagnostics. |
| Existing unit suite, fresh Node 24 dependencies | **685/685 passed**; zero failures, cancellations, skips, or TODOs. |
| Verification/diagnostic tests under Node 24 | **14/14 passed**: ten new verification-contract tests and four existing modal-diagnostic tests. |
| Production compilation, fresh Node 24 dependencies | Passed Vite build and existing server esbuild bundle. |
| Progress-dialog Chromium guard | Passed 72 layouts, focused inputs, scrolling, saves, cancellation, and negative controls. |
| Modal-foundation Chromium guard | Passed 30 real-flow layouts and save/cancel, nested focus, dropdown/select/popover, StrictMode, restoration, and non-modal checks. |
| Profile-safety-menu Chromium guard | Passed mobile and short-screen geometry, hit tests, negative control, Cancel/Report behavior, and preservation of non-profile bottom-sheet presentation. |
| Native identity static source/dependency verifier | Passed; not an installed-device certification. |
| WebKit modal-foundation guard | **Failed before browser tests could execute** because required host libraries were unavailable; not skipped or reported as passing. |
| Existing Node 22 `npm run build` | Passed compilation and all three unchanged Chromium build guards using Node 22.23.5/npm 10.9.9. |
| Actions YAML | Parsed successfully using the available Ruby Psych parser; all six command blocks passed `bash -n`. |
| Existing commands/dependencies | Confirmed all pre-existing npm commands and dependency sections unchanged. |
| Lockfile | Clean `npm ci` succeeded and left the lockfile byte-identical; no Replit-internal registry URLs. |
| Replit preview | Workflow restarted and public guest page rendered; authenticated UI and installed iOS behavior were not visually certified. A background guest request returned HTTP 406; its cause was not investigated in this release-preparation work. |

## Clean-source validation

The clean source export contains tracked files plus the prepared new source
files, without the workspace's `node_modules`, ignored uploads, `.env`, or
`.git`. A fresh `npm ci --include=dev --include=optional --no-audit --no-fund`
ran under Node 24.22.3/npm 10.9.9; no existing dependency tree was reused.

The test process received only selected runtime/path/certificate settings and
the existing Playwright browser cache location, not the application's production
secrets. Browser fixtures use synthetic services. Reusing downloaded browser
binaries is not a claim that their native dependencies are present.

This is a local working-source export, **not a verified GitHub commit**.
The final runner and regression test distinguish such exports from an ancestor
Git checkout. Actual GitHub checkout/commit association and hosted-runner
behavior remain external acceptance requirements.

The snapshot generator itself was not changed. It used the pre-existing bundled
consumer recommendations, recorded consumer-cache audit, and frozen
bounded-rerank outputs. The resulting snapshot is 15,401 bytes with SHA-256:

`3099377247e2763f7600b9a2de624c7cbd43be8b236d3be1b4080a859f10137e`

## What remains unchanged

- `.replit`, including the current Node 22 development module and deployment section.
- `vercel.json`, Vercel settings, production Node version, and build command.
- `.npmrc`, `package-lock.json`, existing dependency versions, and optional declarations.
- Existing build/browser commands, browser test scripts, assertions, readiness conditions, and negative controls.
- Existing TypeScript coverage and exclusions.
- Supabase deployment workflows, database schema/data, and native release configuration.

The locally available nested-dialog readiness change is already in main and
its actual code was inspected. It was not merged, cherry-picked, weakened, or
reimplemented. PR #3's live status was not accessed.

## Remaining blockers and external requirements

1. **WebKit environment validation:** Replit lacks the browser's required native
   library environment, including ICU 74. Existing Nix GTK/GStreamer packages
   do not establish ABI compatibility. No incompatible library symlinks,
   browser-validation bypass, skipped check, or weakened assertion was added.
   Ubuntu execution with Playwright's `--with-deps` setup still needs proof.
2. **Real GitHub execution:** The workflow has only been prepared and validated
   locally. A user-managed, separately approved non-production bootstrap must
   demonstrate the exact commit's complete run, including WebKit.
3. **Vercel settings and enforcement:** Obtain actual commands/runtime/output,
   production branch/environment routing, current checks, and latest failed
   build log. Required-check configuration and controlled non-live
   failure/cancellation/missing/wrong-commit promotion tests require separate
   approval and must retain current build guards.
4. **Actual deployment packaging/environment:** Vercel API packaging, share
   fonts/images/HTML, routing, and build-time environment still require safe
   candidate-deployment smoke checks. Existing TypeScript checking does not
   cover API or Deno Edge Function source.
5. **Non-blocking existing warnings:** Deprecated npm configuration flags,
   upstream package deprecation notices, stale Browserslist data, and bundle
   size warnings were not used as justification for unrelated upgrades.

No production switchover is requested or authorized by these results. The next
external validation can test the prepared workflow without removing any
existing Vercel safeguard.
