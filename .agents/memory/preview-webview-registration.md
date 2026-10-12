---
name: Preview webview registration
description: Replit Preview can remain unreachable even when the application server and development proxy are healthy.
---

**Rule:** Keep the main workflow on internal port 5000 with webview output. An internal port does not imply the same public port is available. If Preview persists in using public `:5000`, support both standard HTTPS and that explicit-port address rather than repeatedly sending the user a different link. Never claim Preview works based only on a successful check of the standard HTTPS address.

**Why:** Restarting or re-registering a healthy process alone does not repair missing forwarding. A working standard HTTPS address does not prove the user's Preview works when it uses a different public port.

**How to apply:** Verify local and proxied HTTP responses, including the exact public port shown in the user's screenshot. If forwarding changes are necessary, use a full temporary TOML file and verifyAndReplaceDotReplit; direct configuration edits are blocked. Verify both addresses after the change. Do not restart the workflow for frontend-only styling changes; rely on Vite hot reload. Restart only for server, workflow, dependency, or configuration changes.