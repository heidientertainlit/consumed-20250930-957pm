---
name: Google Books cover placeholders
description: Why some book posters show "image not available" and how cover URLs must be built
---

Google Books serves a valid 200 PNG (tiny gray "image not available", ~1.3KB, 128px grayscale) for editions that have no cover art. A constructed `books.google.com/books/content?id=<volumeId>...` URL therefore never errors, so client-side `onError` fallbacks never fire.

**Why:** The Cinder bug (July 2026): media-search built poster URLs blindly from the volume ID for every Google Books result, so coverless editions (e.g. `...CAAJ` catalog-only entries) shipped gray placeholders into posts/lists.

**How to apply:** Only emit a Google Books cover URL when the volume's `volumeInfo.imageLinks` exists; otherwise return '' so the app renders its own gradient fallback. If checking whether a stored cover is real, curl it — placeholder is ~1269 bytes, 8-bit grayscale PNG.
