# Safety checks: staged rollout

## Current stage: local preparation only

The existing Replit → GitHub → Vercel push and automatic-deployment routine
is unchanged. No routine feature branches, pull requests, deployment credentials,
Git hooks, or manual release approvals are introduced by this workflow.

`npm run build` still compiles and runs all three existing Chromium guards.
**Do not remove these build guards or change Vercel's build command yet.**

The new `build:app` command performs the same compilation without running
browser tests. Only the new CI workflow uses it at this stage.

`.github/workflows/safety-checks.yml` is not active until the user pushes it.
It runs automatically on every `main` push and, for one-time setup, pushes to
`safety-check-bootstrap`, plus an optional manual diagnostic trigger. It has
read-only repository permission, retains no checkout credential, uses no
production secrets, and contains no deployment commands.

### One-time bootstrap: local trigger prepared only

The user approved preparing the temporary-branch push trigger locally. This is
not approval to create or push a branch or change Vercel configuration.
No branch has been created or pushed as part of this preparation.

- Keep production auto-assignment and existing build tests unchanged.
- Before any user-managed temporary-branch push, verify Vercel's branch/environment
  routing and preview-build behavior, including production-service access.
- A push trigger is needed for the first branch-only run: GitHub documents that
  `workflow_dispatch` requires the workflow to exist on the default branch.
- After a real branch run, try discovering **Consumed release safety** using
  that exact commit SHA in Vercel. Non-production-branch import is unverified;
  if discovery fails, stop rather than push an ungated commit to `main`.
- Configuring the required check needs separate explicit approval. Importing a
  check does not by itself prove blocking behavior.
- Do not push `main` as part of this bootstrap preparation. Remove the temporary
  branch trigger after bootstrap is finished; retain the `main` trigger.

## What the proposed CI job checks

Stable job name: **Consumed release safety**.

- Clean locked dependency install on Ubuntu 24.04 / Node 24.
- Chromium and WebKit installed with Ubuntu system dependencies.
- App compilation, including the production CSS used by the fixtures.
- Existing `npm test` unit suites, via `test:ci` with an explicit TAP reporter;
  zero tests, missing summaries, failures,
  cancellations, skipped tests, and TODO tests cannot produce a passing step.
- Existing native identity **static source/dependency evidence** verification.
- Existing progress-dialog, modal-foundation, and profile-safety-menu guards.
- Existing optional modal WebKit variant, made explicit in this proposed gate.
- An always-running final step that rejects any missing, unsuccessful, or
  skipped mandatory step, including errors masked with `continue-on-error`.

Default step behavior stops later tests after a failure; the final step still
fails the job. This never labels unexecuted tests as passing.

The isolated browser fixtures do not authenticate or write to customer data.
The static native check and desktop WebKit do not certify an installed iPhone
build. No live database-verification scripts or migrations belong in this job.

## Required verification before production enforcement

1. Run the available tests locally and report existing failures honestly.
   A Replit run does not prove Ubuntu / Node 24 or GitHub execution.
2. After the user elects to push, verify an actual GitHub run for that exact
   commit: clean install, compilation, and every mandatory check must pass.
   Resolve failures without dropping tests or weakening production code.
3. With separate, explicit approval for Vercel configuration, select
   **Consumed release safety** as a required Deployment Check. Confirm the
   check belongs to the intended repository and production commit.
4. Verify both outcomes using controlled, non-live candidates: a passing run
   is eligible for promotion; failed, skipped, cancelled, and missing results
   hold the candidate. An older green commit must not satisfy a newer one.
   Plan these checks before touching production settings. A live production
   promotion is not an authorized test procedure.
5. Restrict administrative bypasses. Vercel's Force Promote can override
   checks, and owners can edit workflows/settings. Do not claim absolute
   enforcement against account administrators.
6. Only after gate behavior is proven, and after separate approval, switch
   Vercel to compile-only execution and remove duplicate browser execution
   there. Retain every test in the required CI job.

Vercel may create a candidate deployment while tests run. Deployment Checks
hold production-domain assignment; they do not necessarily hide its unique
deployment URL. Existing live traffic should remain on the prior deployment
while a new candidate is blocked.

## Known baseline before any CI edits

The initial local `npm test` run reported 640 tests: 636 passed, four failed,
zero skipped. All four failures came from the Open Library route fixture and
reported `isTerminalListConversationPilot is not defined`. This is a baseline
test failure, not a conclusion that the deployed app is broken.

Do not activate the replacement release gate or remove build enforcement
while its required suites are failing or have not been verified on GitHub.

## Local preparation verification

- Fixed only the route fixture's missing dependency wiring by supplying the
  actual imported helper to its VM. No app code or assertions were changed.
- All 640 unit tests passed afterward, with no skipped or TODO tests.
- App compilation passed both in the workspace and in a clean tracked-source
  export without ignored uploads or `.env`. The export reused local installed
  dependencies; it was not a fresh `npm ci`.
- All three existing Chromium guards and the native static verifier passed.
- Workflow YAML parsed, and every shell block passed Bash syntax checking.
- CI explicitly selects TAP output rather than relying on the Node version's
  default reporter, so the skipped-test summary guard has a stable input.
- The final gate accepted a complete passing result and rejected 55 simulated
  failure, cancellation, skipped, missing, and masked-error outcomes. The unit
  summary guard rejected eight invalid summaries, including the real initial
  failing run.
- WebKit could not launch in Replit because its required system libraries are
  absent. Its execution on Ubuntu / Node 24 remains unverified.
- Every pre-existing package command, including `build`, remained unchanged.

These are local results only. No GitHub run, clean dependency installation,
Vercel configuration, or actual production-promotion blocking was verified.
