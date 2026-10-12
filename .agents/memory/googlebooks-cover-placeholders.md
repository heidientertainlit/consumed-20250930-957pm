---
name: Google Books cover placeholders
description: Why some book posters show "image not available" and how cover URLs must be built
---

Google Books serves a valid 200 PNG (tiny gray "image not available", ~1.3KB, 128px grayscale) for editions that have no cover art. A constructed `books.google.com/books/content?id=<volumeId>...` URL therefore never errors, so client-side `onError` fallbacks never fire.

**Why:** The Cinder bug (July 2026): media-search built poster URLs blindly from the volume ID for every Google Books result, so coverless editions (e.g. `...CAAJ` catalog-only entries) shipped gray placeholders into posts/lists.

**How to apply:** Only emit a Google Books cover URL when the volume's `volumeInfo.imageLinks` exists; otherwise return '' so the app renders its own gradient fallback. If checking whether a stored cover is real, curl it — placeholder is ~1269 bytes, 8-bit grayscale PNG.

**Second trap (same bug, July 2026):** fixing the DB image_url is not enough — feed.tsx had multiple client-side spots that *unconditionally rebuilt* a bare `books/content?id=...` URL from external_id for googlebooks posts, clobbering the good stored URL. Any book-cover fix must check the client pipelines too; constructed URLs may only be used as a fallback when no stored image exists. Prefer the API's `imageLinks.thumbnail` (signed `imgtk` URLs) — those render real covers in browsers.

An exact ISBN match verifies the edition, not whether its image is a flat cover. Multiple catalogs can reuse the same angled physical-book mockup while the publisher has straight-on ebook artwork.

**Why:** Catalog-only checks incorrectly suggested that no better cover was available; inspecting the publisher's artwork established otherwise. The user approved same-work publisher ebook artwork for a charted physical edition and requested automatic improvement of angled book images.

**How to apply:** Inspect candidate images before declaring a cover unavailable or changing poster layout. If using verified same-work artwork from another edition, keep that image choice separate from the original ISBN, ranking, provider identity, and tracking behavior.
