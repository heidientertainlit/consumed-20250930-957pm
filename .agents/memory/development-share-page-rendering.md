---
name: Development share-page rendering
description: Direct metadata routes can bypass Vite's React preamble even when normal SPA navigation works.
---

Verify both direct links and navigation within the mounted app when testing share-enabled pages in preview. Any development HTML response that loads React modules must preserve Vite's HTML transformation and React preamble.

**Why:** A server-side Open Graph response served raw development HTML, producing a blank page with “plugin-react can't detect preamble.” The home page and client-side routing still worked, so neither a server restart nor isolated component tests exposed the real distinction.

**How to apply:** Investigate middleware order and HTML transformation before treating this error as a React component failure. Keep development rendering fixes separate from production crawler metadata and private-share authorization.