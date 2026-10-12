---
name: Search enrichment latency
description: Live evidence that optional book-series discovery can delay non-book searches, and the compatibility boundary for optimizing it.
---

Treat optional book-series discovery as a separate latency cost, not a requirement for explicitly non-book searches.

**Why:** Alternating live TV-search requests with only the book-series flag changed showed substantially lower response times with discovery disabled and identical ordered provider/type/ID results. The active deployed code waits for this AI operation even when a TV filter is selected.

**How to apply:** The user-approved scope is Track search: preserve All/Books discovery and all other callers' existing behavior. Scope unnecessary opt-ins at the relevant caller rather than removing book-series functionality globally. Measure live behavior again before promising a particular speedup; workspace timing is not an on-device trace.

Preserve the existing search experience when optimizing latency.

**Why:** The user approved the filter-scoped improvement only on the condition that it would not break media search, and explicitly raised the importance of layered checks.

**How to apply:** Leave ranking, deduplication, canonical identity, spelling recovery, result selection, and tracking unchanged unless separately requested. Do not replace useful series discovery with a blanket speed optimization.
