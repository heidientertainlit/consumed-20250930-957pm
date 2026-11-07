---
name: Open Library investigation scope
description: Investigation-only default and explicit approval gates for the two proposed Open Library fixes.
---

The user said: “don't standardize anything yet I just wanted to investigate.”

**Why:** Investigation of where book ID formats originate was incorrectly expanded into implementation.

**How to apply:** Keep this investigation read-only. Report verified origins and affected paths; do not standardize IDs, prepare migrations, or change save/lookup behavior without a subsequent explicit request to implement. The separately authorized correction of Natasha's rating to the movie must remain intact.

## Scope and approval guardrails

The user asked for guardrails against breaking unrelated behavior, getting distracted by past tasks, or acting beyond the discussion.

**Why:** The user wants to discuss the changes first and assess the lookup and routing changes separately.

**How to apply:**
- Discussion, investigation, or approval of these guardrails is not approval to implement either fix.
- Before editing application code, state the exact proposed behavior and files to change. Obtain explicit approval for the first step.
- The first proposed step is Open Library details-lookup compatibility only. Do not change stored IDs, page URLs, save flows, or historical data in this step.
- Verify the first step and report changed files, passing checks, failures, and anything unverified. Stop for the user's review and explicit approval before starting the second step.
- The second proposed step is book links and routing, including old links and visibility of existing saved activity. Do not silently fold it into the lookup fix.
- Neither step authorizes ID standardization, data cleanup, migrations, UI redesign, combining add dialogs, restoring poster clickability, analytics changes, or resuming past work.
- If a fix needs work outside the approved scope, stop and explain the dependency before making that change. Do not substitute a different fix without agreement.
- Use non-mutating or isolated test fixtures. Do not create real-account ratings, list items, or posts for verification without separate approval.
- Apply the existing production-approval and security-preservation rules in replit.md. A local implementation approval is not deployment approval.
- Distinguish source inspection, local tests, and live verification. Do not claim a test proves a user action, an installed build, or an untested production path.
