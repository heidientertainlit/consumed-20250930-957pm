# Local release-verification results

## Current status: GitHub Actions setup removed

The user explicitly approved **Remove Actions only**. This supersedes the
earlier instruction to preserve the paused runnable workflow. The GitHub
Actions rollout is abandoned, not waiting to resume.

### Cleanup scope

- Deleted `.github/workflows/safety-checks.yml`.
- Deleted its Actions-only final gate, `scripts/assert-release-verification.mjs`.
- Removed mandatory Actions-step enforcement and workflow-run identity checks
  from `scripts/lib/release-verification.mjs`.
- Removed GitHub Actions environment/context handling from
  `scripts/verify-release.mjs`; useful local verification remains.
- Updated `scripts/tests/release-verification.test.mjs` to remove the two tests
  for deleted Actions features, retain the other local verification safeguards,
  and assert that the retired workflow/final gate are absent.
- Marked `docs/safety-checks-rollout.md` as historical rather than an active
  rollout checklist.
- Updated this report and `.agents/memory/safety-release-workflow.md` so later
  work does not silently restore the abandoned automation.

These are the eight files changed or deleted in this cleanup. No dependency,
Vercel setting, build command, production component, or modal test was changed.
The TypeScript fixes, real recommendation snapshot, modal correction, and all
three existing Vercel browser guards remain.

### Cleanup verification

Selected Node 24.22.3 and invoked npm 10.9.9 without changing runtime defaults
or reinstalling dependencies.

| Check | Result |
| --- | --- |
| Existing TypeScript scope | Passed. |
| Existing unit suite | **685/685 passed**; zero failures, cancellations, skips, or TODOs. |
| Local verification/diagnostic/readiness suite | **15/15 passed**; zero failures, cancellations, skips, or TODOs. The count changed from 17 because the two Actions-only tests were removed with their features, not skipped. |
| Existing protected build | Passed Vite compilation, server esbuild, all 72 progress layouts, all 30 modal layouts/behaviors, and profile safety checks at 390×844, 320×568, and 390×360, including negative controls and non-profile bottom-sheet preservation. |
| Protected-file comparison | All ten pre-cleanup SHA-256 values matched: package/lockfile/configuration, all three Vercel browser guards, modal-readiness helper, and its regression tests. |
| Preview | Mobile guest page rendered. The previously observed background HTTP 406 remained; signed-in UI and native behavior were not verified. |

The local verification-test subprocesses ran with Git unavailable in their
executable search path. No Git executable ran; repository-identity behavior
with Git available was not revalidated. The full optional `npm run verify`
and the known-incompatible WebKit launch were not repeated.

Evidence logs:
- `generated-artifacts/release-verification/actions-removal-types.log`
- `generated-artifacts/release-verification/actions-removal-unit.log`
- `generated-artifacts/release-verification/actions-removal-contracts.log`
- `generated-artifacts/release-verification/actions-removal-protected-build.log`

### Manual push boundary

This cleanup was made in the current workspace after the user selected
`safety-check-bootstrap`. It does not establish that `main` contains these
changes or the modal correction. No branch switch or Git command was performed.

**A deleted current file does not prove GitHub will accept earlier outgoing
commits that added it.** Manual push success remains unverified. No commit
history was rewritten, account reconnected, permission expanded, push performed,
or deployment triggered by the agent.

The existing workflow remains Replit development → user-controlled manual
Sync/Push → guarded Vercel build and automatic deployment. No new manual
verification routine or replacement GitHub check is required.

---

## Earlier approved scope: stabilize existing Vercel builds

This section records the subsequent, approved local modal-gate correction.
The earlier preparation record below is preserved, not discarded. Actions
rollout remains paused; no Actions or Vercel enforcement change is authorized.

### Result

**The existing protected `npm run build` passed locally with Node 24.22.3,
invoked through npm 10.9.9.** Its Vite compilation, server bundle, 72-layout
progress guard, 30-layout modal guard and behavioral checks, and profile
safety-menu guard all completed successfully. This is not proof of a post-fix
Vercel build, deployed behavior, WebKit compatibility, or installed iOS behavior.

The supplied Vercel evidence established that a visible/focused input can still
belong to an opening dialog. The latest failures were at reopened-parent
restoration, after successful child dismissal; the earlier child-only wait did
not cover that parent. Escape was logged at opacity zero during entrance.
This proved a synchronization gap, not the exact internal cause of a lost key.

The test-only correction waits for the expected open dialog, full opacity,
finished animation, focused visible/enabled input, and unblocked top **open**
modal layer. It covers the nested child, parent after child removal, reopened
parent, late-background isolation path, and simulated older-WebView path.
After child dismissal, the test explicitly selects the parent input as the
next keyboard target; the helper itself never changes focus.

The first corrected full build caught a helper assumption: the closed child's
empty/inert portal host survives in the DOM. Comparing the parent to the last
host blocked its readiness even though it was the active open modal. The final
helper considers only hosts containing open dialogs. Regression coverage
accepts retained empty/closed hosts while rejecting an actual newer open modal.
The first failed build's evidence was retained rather than called a passing run.

Every original dismissal/restoration assertion and negative control remains.
Each intended dismissal still sends exactly one Escape. No timeouts were
extended, no blanket retries or fixed sleeps were added, and no real-flow
animations or application behavior were changed.

### Measured results for this correction

| Check | Result |
| --- | --- |
| `npm run check` | Passed the unchanged TypeScript scope. |
| `npm run test:ci` | **685/685 passed**, zero failures/cancellations/skips/TODOs. |
| `node --test --test-reporter=tap scripts/tests/*.test.mjs` | **17/17 passed**: the preserved 14 verification/diagnostic tests plus three readiness regressions; zero failures/cancellations/skips/TODOs. |
| Held-animation regression | Visibility succeeds while the focused dialog is at opacity zero; readiness actually polls and sends no Escape until the held animation is finished. Then exactly one Escape is recorded at opacity one with the expected focus. |
| Readiness negative controls | Reject closed, transparent, animating, wrongly focused, inert, aria-hidden, obscured-by-newer-open-modal, hidden/disabled-input, and missing-form states. |
| Existing `npm run build` | Passed Vite compilation, server esbuild, all 72 progress layouts, all 30 modal layouts/behaviors, and all profile safety checks. |
| Profile safety details | Passed 390×844, 320×568, and 390×360; hit tests, negative controls, Cancel/Report, and non-profile bottom-sheet preservation. |
| Protected files | SHA-256 matched the pre-edit values for all 14 checked configuration, workflow, verification, diagnostic, and unrelated browser-guard files. |
| Preview | Public mobile guest page rendered. An existing background HTTP 406 also appeared, as in earlier preparation; not investigated in this test-only correction. Signed-in UI and native behavior were not visually verified. |

No dependencies were reinstalled or upgraded in this correction. Existing
installed dependencies/browser binaries were used; browser installation checks
remain part of the unchanged protected build.

**Git coverage boundary:** Git was unavailable in the verification-suite
subprocess search path, so the existing runner-failure tests could execute
without any Git operation. Their assertions were neither changed nor skipped.
This run does not independently validate ancestor-repository identity discovery
when Git is available. An initial environment preflight detected `/bin/git`
and refused the suite; the final restricted path omitted it entirely. No Git
executable was run.

The full canonical `npm run verify` and WebKit launch were not repeated: the
known Nix-library limitation remains. No Actions execution or real GitHub commit
association was certified. Application/native sources were not changed.

### Exact files changed in this correction

| File | Change |
| --- | --- |
| `scripts/check-modal-foundation.mjs` | Shares strict readiness across the relevant existing input-dismissal paths; retains all original assertions and menu/popover behavior. |
| `scripts/lib/modal-test-readiness.mjs` | New test-only readiness predicate/wait, including retained inactive-host handling. |
| `scripts/tests/modal-test-readiness.test.mjs` | Three regression tests: browser-state controls, deterministic held-animation/single-Escape behavior, and real-script readiness wiring. |
| `docs/safety-checks-rollout.md` | Clarifies the paused Actions direction and current no-Git stabilization boundary without deleting earlier preparation. |
| `docs/release-verification-local-results.md` | Adds this current result, inventory, evidence, and limitations while retaining earlier results. |
| `.agents/memory/progress-dialog-safety.md` | Records why readiness must cover reopened parents and ignore retained inactive portal hosts. |

No edits were made to `.github/workflows/safety-checks.yml`, `package.json`,
`package-lock.json`, `.npmrc`, `.replit`, `vercel.json`, the canonical verification
runner/gate/tests, diagnostic implementation/tests, progress guard, profile
guard, or production components. All previous TypeScript and snapshot
preparation was retained.

The local evidence files are:
- `generated-artifacts/release-verification/modal-readiness-types.log`
- `generated-artifacts/release-verification/modal-readiness-unit.log`
- `generated-artifacts/release-verification/modal-readiness-contracts-final.log`
- `generated-artifacts/release-verification/modal-readiness-protected-build-final.log`

These are ignored generated evidence, not new application source.

### Remaining boundary

The result is ready for **local user review**, not release authorization.
No Git operation, new branch, account reconnection, settings change, release,
or deployment was performed. Manual pushes remain exclusively user-controlled
through Replit's Sync/Push interface.

The unchanged paused workflow's OAuth upload restriction is a separate,
unresolved manual-push packaging decision. This fix does not make the saved
candidate pushable through the current authorization. Do not delete, relocate,
activate, or discard the workflow or other preparation to bypass it without
separate user approval.

Actual post-fix Vercel reliability remains unverified until the user supplies
the next real build evidence after independently authorized manual actions.

---

## Earlier release-verification preparation record

The following historical results and external-stage proposals are retained
for reference; they do not override the latest paused Actions scope above.

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
