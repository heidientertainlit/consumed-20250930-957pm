---
name: Canonical media identity
description: Durable rules for reconciling provider IDs across ratings, lists, posts, details, search, and media match scoring.
---

Canonical media identity is server-owned. Browser-supplied canonical IDs are only hints and must be replaced or cleared using the exact persisted provider alias.

Resolution precedence is: exact provider alias; authoritative story key, ISBN, or Open Library work ID; then verified normalized title + creator + exact source-backed year. Title alone never merges works, and unknown-year title/creator matches remain isolated.

**Why:** The same book appeared under separate Goodreads and Google Books IDs, so provider-only reads hid an existing rating and offered a misleading prediction/rating state. Loose title matching would fix that case by creating dangerous collisions elsewhere.

**How to apply:** Preserve legacy provider fields and routes during rollout, prefer canonical reads with provider fallback, make canonical writes uniqueness-safe, and let identity failures fall back rather than blocking user actions. Search may trust metadata returned directly by a real provider for immediate identity handoff, while expensive semantic enrichment remains off the response path.

Strict historical backfills must not populate the weak canonical release-year key when a directly verified provider tuple has no authoritative cross-provider key. Keep the verified year in metadata and leave the canonical release-year column null so the tuple stays isolated.

**Why:** The canonical title/creator/year uniqueness constraint can otherwise force or reject a text-based identity decision even when strict mode explicitly forbids that evidence.

**How to apply:** This exception is only for no-guess historical cataloging. Normal ongoing resolution may still use verified title + creator + exact year after exact aliases and authoritative keys.