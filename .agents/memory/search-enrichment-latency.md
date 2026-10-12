---
name: Search enrichment latency
description: Live evidence that optional book-series discovery can delay non-book searches, and the compatibility boundary for optimizing it.
---

Treat optional book-series discovery as a separate latency cost, not a requirement for explicitly non-book searches.

**Why:** Alternating live TV-search requests with only the book-series flag changed showed substantially lower response times with discovery disabled and identical ordered provider/type/ID results. The active deployed code waits for this AI operation even when a TV filter is selected.

**How to apply:** Scope unnecessary opt-ins at the relevant caller rather than removing book-series functionality globally. Preserve All/Books discovery and legacy callers that intentionally request cross-media series discovery. Measure live behavior again before promising a particular speedup; workspace timing is not an on-device trace.
