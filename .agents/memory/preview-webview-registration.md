---
name: Preview webview registration
description: Replit Preview can remain unreachable even when the application server and development proxy are healthy.
---

**Rule:** Keep the main workflow on internal port 5000 with webview output and use its normal HTTPS development address without public `:5000`. The user wants the normal app Preview, not an “External page” tab. Never claim the user's Preview tab is restored based only on a successful HTTP check.

**Why:** Restarting or re-registering a healthy process alone does not repair missing forwarding or close a workspace tab. The user explicitly asked to return to the normal Preview. Duplicate mappings for the same listener were accepted and briefly worked, but later disappeared; which action removed them is not established.

**How to apply:** Verify local and proxied HTTP responses, including the exact public port shown in the user's screenshot. Prefer restoring the normal managed Preview rather than depending on duplicate public-port aliases. Be explicit that app/workflow tools cannot close the user's workspace tabs. If forwarding changes are necessary, use a full temporary TOML file and verifyAndReplaceDotReplit; direct configuration edits are blocked. Do not restart the workflow for frontend-only styling changes; rely on Vite hot reload. Restart only for server, workflow, dependency, or configuration changes.

Do not leave public Preview port mappings pointing to temporary test fixtures.

**Why:** A stopped dialog fixture can leave a public preview address returning 502 even while the real app remains healthy.

**How to apply:** Keep temporary fixture servers local to validation; remove any temporary forwarding when they stop and verify the normal app address.

Keep development module URLs canonical; do not append random cache-busting
queries to the entry module.

**Why:** Query propagation through relative imports but not aliased imports can
instantiate two copies of a React context, making an existing provider appear
absent. Overlapping development listeners can also serve old and new module
graphs intermittently.

**How to apply:** Use development HTML cache headers and Vite's own freshness
handling. When responses alternate, inspect actual server processes rather
than assuming another restart or auth-code change is needed.

A current response from the Preview URL does not prove an already-open Preview tab has loaded the current module graph.

**Why:** The user confirmed a newly implemented search feature appeared only after reloading Preview, although its code and endpoint were already served correctly.

**How to apply:** Distinguish served-code checks from active-tab verification. If reloading is needed, give one direct instruction to use the Preview reload button rather than asking an ambiguous diagnostic question.