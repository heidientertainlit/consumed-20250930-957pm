---
name: Preview webview registration
description: Replit Preview can remain unreachable even when the application server and development proxy are healthy.
---

**Rule:** Keep the main workflow on internal port 5000 with webview output. If Preview repeatedly forces a public `:5000` URL, map local port 5000 to both external 80 and external 5000 through validated Replit configuration so either address works.

**Why:** Restarting a healthy process does not repair stale Preview-pane routing, and frontend-only restarts repeatedly reopened the unusable explicit-port address. The dual mapping makes both forms return HTTP 200.

**How to apply:** Verify both local and proxied HTTP responses first. Use Replit’s validated `.replit` replacement flow for port mappings. Do not restart the workflow for frontend-only styling changes; rely on Vite hot reload. Restart only for server, workflow, dependency, or configuration changes.