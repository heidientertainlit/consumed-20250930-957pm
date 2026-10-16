---
name: Isolated UI test builds
description: Preventing test-only Vite dependency failures and shared preview-cache interference.
---

Isolated UI fixtures need their own dependency cache and explicit dependency discovery when the fixture entry is in an ignored directory.

**Why:** Vite did not scan a fixture under node_modules, served React DOM as raw CommonJS, and reported a missing createRoot export despite a healthy application build. Reusing the main cache also triggered unnecessary preview dependency rebuilds.

**How to apply:** Keep fixture builds and caches isolated from the application. Verify dependency optimization before diagnosing a fixture-only module error as an app regression. Keep test auth/API substitutions confined to the isolated test server; never weaken the app's real authentication to screenshot an admin page.
