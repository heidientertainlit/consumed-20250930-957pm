---
name: Native share release boundary
description: Native share verification must distinguish uploaded binaries, current source and approved full-app candidates.
---

Verify the actual packaged candidate, not just the current website, when diagnosing native share links. Treat an uploaded archive as evidence about that archive, not proof of the currently installed build.

**Why:** The supplied iPhone archive lacked media-link handling present in current source. Website/source verification could not establish what the installed native app executed.

**How to apply:** Inspect archive version and bundled behavior; test native delivery lifecycles separately from URL parsing; require physical-device evidence before claiming Universal Links work.

A share-link-only authorization does not approve unrelated release-baseline changes.

**Why:** Preparing an iPhone candidate bundles the entire current application. Existing release notes flagged analytics differences and unresolved verification outside the share-link scope.

**How to apply:** Keep share work isolated, preserve existing build safeguards, and explicitly resolve the approved candidate boundary before copying/distributing a full native build. Do not silently fix or approve unrelated analytics work.
