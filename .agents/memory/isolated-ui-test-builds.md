---
name: Isolated UI test builds
description: Preventing test-only Vite dependency failures and shared preview-cache interference.
---

Isolated UI fixtures need their own dependency cache and explicit dependency discovery when the fixture entry is in an ignored directory.

**Why:** Vite did not scan a fixture under node_modules, served React DOM as raw CommonJS, and reported a missing createRoot export despite a healthy application build. Reusing the main cache also triggered unnecessary preview dependency rebuilds.

**How to apply:** Keep fixture builds and caches isolated from the application. Verify dependency optimization before diagnosing a fixture-only module error as an app regression. Keep test auth/API substitutions confined to the isolated test server; never weaken the app's real authentication to screenshot an admin page.

Keep unrelated native-only dependencies outside server-rendered component tests.

**Why:** Optional media-search UI pulls in native push registration, whose module requires a browser/device even before any interaction. This can fail a byline test without indicating a problem in the app.

**How to apply:** Isolate the unrelated dependency at the test boundary while rendering the actual component under test. Do not change production authentication or native initialization just to accommodate server-side tests.
