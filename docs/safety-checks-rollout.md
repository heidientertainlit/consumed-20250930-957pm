# Release verification: local preparation

## Current status: GitHub Actions approach retired

The user explicitly requested removal of the GitHub Actions setup. The workflow
and Actions-only final gate have been deleted, along with workflow-step/run
enforcement and their dedicated tests. Useful local verification remains.

The release process stays Replit development → user-controlled manual Sync/Push
→ the existing guarded Vercel build and automatic deployment. All three Vercel
browser guards and the modal-readiness correction remain unchanged.

**The earlier rollout proposal below is historical, not an active checklist.**
Do not recreate its workflow, configure a required Actions check, or replace
Vercel's build command without a new user request.

Deleting a workflow from the current files does not prove GitHub will accept
the outgoing commit history. No Git command, history rewrite, account change,
push, or deployment is part of this cleanup. See
`docs/release-verification-local-results.md` for the cleanup's measured results.

---

## Historical preparation and rollout proposal

## Approval boundary

The user approved local preparation only. The existing Replit → GitHub → Vercel
routine, automatic production assignment, Vercel settings, and production
configuration have not been changed. No Git network operation, PR merge,
deployment, migration, or live-service test is part of this preparation.

`npm run build` is unchanged: it compiles the application and runs all three
existing Chromium build guards. **Do not remove these guards or change Vercel's
build command before separately approved replacement-gate proof.**

The checked-in Actions workflow is preparation, not evidence of an actual
GitHub run or active Vercel enforcement. An earlier workflow was removed;
this version deliberately reintroduces it with a canonical runner and type
checking. Do not rely on older documentation about a workflow being active.

### Current direction: retain the existing Vercel build

The user paused the Actions rollout after the validation-branch push was
rejected because the manual push credential lacks GitHub's workflow scope.
All prepared workflow, verification, TypeScript, snapshot, and test work is
retained. The external Actions stages below are historical preparation, not
instructions to resume rollout or change the user's permissions.

The supplied latest Vercel failures passed application compilation, server
bundling, browser setup, and the progress gate. They failed in the modal gate's
reopened-parent dismissal sequence: Escape was sent during its entrance
animation. The child readiness wait was present, but the parent path still
waited only for input visibility. This is a demonstrated synchronization gap;
the logs do not conclusively establish the internal reason Escape was missed.

The approved local correction shares strict input/dialog readiness across the
relevant modal-dismissal paths, preserves one Escape per dismissal and every
existing post-dismissal assertion, and adds a held-animation regression.
It does not alter the application components, animations, browser dependencies,
Vercel configuration, build command, or release process.

All Git pushes remain exclusively user-controlled through Replit's Sync/Push
interface. Do not execute even read-only Git commands as part of this local
stabilization. Existing runner-failure regression tests that probe Git can be
run with Git absent from their executable search path; this does not certify
Git-source identity behavior. The canonical all-browser command remains
unverified on this host because WebKit is not compatible with its Nix libraries.

Local test success is not post-fix Vercel evidence or release authorization.
The prepared workflow's OAuth upload restriction remains a separate,
unresolved manual-push packaging decision; do not delete, move, or activate the
workflow to bypass it without the user's approval.

## One verification contract

Run `npm run verify` using the toolchain declared in
`scripts/lib/release-verification.mjs`: **Node 24.x and npm 10.9.9**.
The same runner is used locally and in Actions. npm is explicitly selected
instead of inheriting whichever major a Node installation bundles.

These are verification targets only. This preparation does not change
`.replit`, Vercel runtime settings, root package engines, the lockfile, or the
development default. Node 22 remains the current Replit development runtime.
Use a separately selected Node 24 executable/environment to run verification.
With a compatible Node 24 environment, select npm 10.9.9 through the developer's
normal version manager before invoking `npm run verify`.

The canonical ordered checks are:

1. Existing TypeScript check.
2. Existing 685-test unit baseline, with TAP summary enforcement.
3. Existing `build:app` compilation, producing production CSS before fixtures.
4. Verification-contract and modal-diagnostic regression tests.
5. Existing native identity source/dependency verifier.
6. Existing progress-dialog Chromium guard.
7. Existing modal-foundation Chromium guard.
8. Existing profile-safety-menu Chromium guard.
9. Existing modal-foundation WebKit variant.

No check can be disabled through a partial-run or skip option. Missing tests,
failures, cancellations, skips, TODOs, absent summaries, and a smaller unit
baseline fail verification. Existing assertions and negative controls remain
unchanged. Update the baseline deliberately if an approved test reorganization
legitimately changes the count; do not reduce it to conceal missing tests.

The runner writes logs and a structured report under
`generated-artifacts/release-verification/`, already excluded from Git and
deployment. It records actual runtime versions and labels modified local
sources and source exports honestly. Failed setup replaces stale green reports.
Build-dependent fixtures are marked blocked, not passed, if compilation fails.

### Coverage boundaries and retained supplementary tests

- TypeScript currently covers client, shared, and server source; its existing
  configuration excludes tests, `api/`, and Supabase Edge Functions. No
  exclusions were added. This is not full-stack type certification.
- The three Chromium guards, WebKit variant, and diagnostic tests use isolated
  synthetic services. They do not need production credentials or customer data.
- The native identity check is static evidence; desktop WebKit is not an
  installed-iPhone keyboard or release test.
- Feature-specific harnesses under `scripts/test-*.mjs` and `scripts/check-*.mjs`
  remain unchanged and available. Examples include Track positioning, media
  search, auth/onboarding, native sharing, feed interactions, and recommendations.
  They are not silently represented as covered by the three release guards.
  Expanding the mandatory set requires reviewing each harness's isolation,
  fixtures, dependencies, duration, and whether it writes to live services.
- Existing database/SQL, live-provider, and operational shell checks remain
  operator-only; do not add them to CI by blindly globbing the scripts directory.

## Authentic snapshot restoration and readiness patch

The missing recommendation bakeoff JSON is regenerated with the pre-existing
`scripts/prepare-bakeoff-snapshots.py`, using its original bundled recommendations,
recorded consumer-cache audit, and frozen bounded-rerank outputs. It contains ten
source identities, with recorded provenance. No model/provider call, new ranking,
dummy row, or empty placeholder is used. The restored JSON must accompany the
source changes so clean builds do not require ignored local research inputs.

The nested-dialog readiness patch is already present in local main. Its focused,
active, fully opened child readiness conditions and existing assertions are
preserved. No assumption is made about PR #3's remote status; no merge is needed
to obtain the code that is already present locally.

## Prepared GitHub workflow

Stable job name: **Consumed release safety**.

- Triggers on every `main` push without path filtering.
- Also supports the specifically named, user-managed `safety-check-bootstrap`
  branch for separately approved one-time setup, plus manual dispatch.
- Does not require routine feature branches or PRs.
- Checks out the exact triggering SHA, uses read-only repository permission,
  and retains no checkout credential.
- Reads Node/npm targets from the canonical contract, installs locked dev and
  optional dependencies, and installs Chromium/WebKit with Ubuntu dependencies.
- Runs canonical verification without `continue-on-error` or test retries.
- Retains synthetic diagnostics and verification reports for seven days.
- Always runs the final gate, requiring successful setup and verification
  outcomes AND conclusions, the complete report, clean exact-commit source,
  and the current workflow run/attempt. Missing files or context fail closed.

The workflow contains no deployment commands, production secrets, migration
commands, or Vercel credentials. Workflow cancellation and environment-specific
GitHub/Vercel behavior must still be proven externally; local simulations alone
cannot establish production blocking.

## Local verification evidence

Record the final preparation results in
`docs/release-verification-local-results.md`. Distinguish workspace checks,
clean-source/fresh-dependency checks, and unavailable host capabilities.
Never report a failed WebKit launch as a passing WebKit test.

## External stages: not authorized or performed

1. **Capture actual settings.** The user or their authorized administrator
   retrieves Vercel Build and Deployment settings (install/build/output/Node),
   production branch and automatic assignment, Deployment Checks, and the
   latest failed build log with commit SHA. Review applicable GitHub rulesets
   and required checks separately. Do not replace a native dependency setup
   command without understanding it.
2. **Agree on safe bootstrap.** A branch-only run needs the push trigger;
   GitHub manual dispatch requires a workflow on the default branch. Before
   any user-managed bootstrap push, review Vercel branch/environment routing,
   preview exposure, and production-service access. No branch is created here.
3. **Prove real Actions execution.** Inspect the exact SHA's fresh dependency
   install and every mandatory check, including WebKit. Do not infer Ubuntu
   success from Replit results or select an unrelated green workflow.
4. **Separately approve Vercel gating.** In Project Settings → Build and
   Deployment → Deployment Checks, require **Consumed release safety** from
   the intended repository. Keep existing build guards and automatic
   production assignment. Merely importing a check is not enforcement proof.
5. **Prove blocking without a live release.** Plan controlled non-live
   candidates for passing, failing, pending, skipped, cancelled, missing, and
   wrong-commit outcomes. An older green SHA or workflow attempt must not
   authorize another candidate. Restrict and document administrative bypasses.
6. **Check the actual candidate.** Verify critical SPA routes, share metadata
   endpoints, fonts/images, association files, and expected build-time
   environment against the candidate URL. Do not wait for production promotion
   to start a check that is itself required for promotion. Preview protection
   and any safe access mechanism require separate configuration.
7. **Separately approve switchover.** Only after all proof, Vercel may use the
   existing compile-only `build:app`. Keep guarded `build` as a fallback.
   Release remains automatic after required checks pass. Removing duplicate
   browser execution is not part of this local task.

Vercel Deployment Checks hold production-domain assignment, not necessarily
access to a candidate's unique URL. Force Promote and workflow/settings edits
are administrative bypasses; do not promise protection against administrators.
The same commit can produce different builds with different environment
variables, so retain Vercel compilation and candidate asset checks.

## Maintenance

Keep the job name stable and unique. Add mandatory checks through the shared
manifest, retain negative controls, inspect test changes, and review clean
installs after lockfile updates. Preserve optional dependencies and public
registry URLs. Log actual Node/npm versions because hosted platforms may
advance Node minor/patch releases. Keep source packaging and environment
verification separate from fixture coverage.
