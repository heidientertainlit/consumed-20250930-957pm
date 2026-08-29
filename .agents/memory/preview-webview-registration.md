---
name: Preview webview registration
description: Replit Preview can remain unreachable even when the application server and development proxy are healthy.
---

**Rule:** When the main server responds on port 5000 and the development proxy returns HTTP 200 but the embedded Preview still says it cannot reach the app, explicitly configure the main workflow with webview output and `waitForPort` 5000.

**Why:** Restarting a healthy process does not repair stale or missing Preview-pane workflow registration.

**How to apply:** Verify both local and proxied HTTP responses first. Re-register the existing main workflow rather than creating a duplicate, restart once, and confirm with an embedded app-preview capture.