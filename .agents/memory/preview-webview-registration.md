---
name: Preview webview registration
description: Replit Preview can remain unreachable even when the application server and development proxy are healthy.
---

**Rule:** Keep the main workflow on internal port 5000 with webview output. An internal port does not imply the same public port is available. When Preview uses an explicit public `:5000` address, test the normal HTTPS development address before changing port mappings.

**Why:** Restarting a healthy process does not repair stale Preview-pane routing. A working standard HTTPS address and a failing explicit-port address indicate an address/forwarding issue, not necessarily an application failure.

**How to apply:** Verify local and proxied HTTP responses first. Give the user the working standard HTTPS address when available. If port mapping changes are genuinely necessary, use Replit’s validated configuration flow. Do not restart the workflow for frontend-only styling changes; rely on Vite hot reload. Restart only for server, workflow, dependency, or configuration changes.