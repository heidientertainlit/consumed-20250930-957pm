---
name: Canonical media identity
description: Durable rules for reconciling provider IDs across ratings, lists, posts, details, search, and media match scoring.
---

Canonical media identity is server-owned. Browser-supplied canonical IDs are only hints and must be replaced or cleared using the exact persisted provider alias.

Resolution precedence is: exact provider alias; authoritative story key, ISBN, or Open Library work ID; then verified normalized title + creator + exact source-backed year. Title alone never merges works, and unknown-year title/creator matches remain isolated.

**Why:** The same book appeared under separate Goodreads and Google Books IDs, so provider-only reads hid an existing rating and offered a misleading prediction/rating state. Loose title matching would fix that case by creating dangerous collisions elsewhere.

**How to apply:** Preserve legacy provider fields and routes during rollout, prefer canonical reads with provider fallback, make canonical writes uniqueness-safe, and let identity failures fall back rather than blocking user actions. Search may trust metadata returned directly by a real provider for immediate identity handoff, while expensive semantic enrichment remains off the response path.