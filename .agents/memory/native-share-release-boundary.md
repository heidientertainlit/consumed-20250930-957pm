---
name: Native share release boundary
description: Native share verification must distinguish uploaded binaries, current source and approved full-app candidates.
---

Verify the actual packaged candidate, not just the current website, when diagnosing native share links. Treat an uploaded archive as evidence about that archive, not proof of the currently installed build.

**Why:** The supplied iPhone archive lacked media-link handling present in current source. Website/source verification could not establish what the installed native app executed.

**How to apply:** Inspect archive version and bundled behavior; test native delivery lifecycles separately from URL parsing; require physical-device evidence before claiming Universal Links work.

A share-link-only authorization does not approve unrelated changes or investigations. Do not turn an unverified historical release note into a new prerequisite.

**Why:** The user repeatedly instructed us to focus on share links after an unrelated analytics warning was incorrectly treated as a packaging blocker without verifying its relevance.

**How to apply:** Keep share work isolated and use the existing preparation safeguards. Stop for an actual failed prerequisite, not an assumed one. Do not modify analytics/search or expand into those investigations without a separate request.
