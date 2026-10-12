---
name: Preview webview registration
description: Replit Preview can remain unreachable even when the application server and development proxy are healthy.
---

**Rule:** Keep the main workflow on internal port 5000 with webview output and use its normal HTTPS development address without public `:5000`. The user wants the normal app Preview, not an “External page” tab. Never claim the user's Preview tab is restored based only on a successful HTTP check.

**Why:** Restarting or re-registering a healthy process alone does not repair missing forwarding or close a workspace tab. The user explicitly asked to return to the normal Preview. Duplicate mappings for the same listener were accepted and briefly worked, but later disappeared; which action removed them is not established.

**How to apply:** Verify local and proxied HTTP responses, including the exact public port shown in the user's screenshot. Prefer restoring the normal managed Preview rather than depending on duplicate public-port aliases. Be explicit that app/workflow tools cannot close the user's workspace tabs. If forwarding changes are necessary, use a full temporary TOML file and verifyAndReplaceDotReplit; direct configuration edits are blocked. Do not restart the workflow for frontend-only styling changes; rely on Vite hot reload. Restart only for server, workflow, dependency, or configuration changes.