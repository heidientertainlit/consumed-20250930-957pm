---
name: My Media history semantics
description: Truthfulness rules for dates, completion, ratings, and progress statistics in My Media.
---

Treat legacy `created_at` dates as tracking/added dates, never completion dates. Completion is authoritative only when explicitly stored, and progress activity totals may use dated progress events only from the point event capture began. Never estimate entertainment hours from title counts. Ratings must use the newest canonical numeric row and preserve half-stars.

**Why:** Historical records do not contain trustworthy finish dates or universal runtimes, so inferred completion timing or fixed duration multipliers create plausible-looking but false statistics.

**How to apply:** Label date-filtered legacy groups as tracked/added; keep tracked and completed counts separate; use current stored progress for snapshots and append-only events for future period activity; omit metrics that lack source data.