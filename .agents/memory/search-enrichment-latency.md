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

For Add Media series selection, match the existing app-bar dropdown rather than redesigning the experience.

**Why:** The user explicitly said screenshot 1 (app-bar search) was correct and wanted the same choices in Add Media, without rethinking or breaking search.

**How to apply:** Preserve individual-book and whole-series choices, original provider identities, and ordinary result selection. Do not broaden the change to other shared-search consumers without a separate request.

Movie-collection dropdowns are approved for app-bar search and Track/Add Media, not every shared-search consumer.

**Why:** After the app-bar pilot, the user confirmed “it works!” and requested the same feature in Add Media.

**How to apply:** Keep collection lookup separate from normal media search, use TMDB-confirmed membership, and offer individual-film actions rather than bulk-tracking a collection. In Track, respect All/Movies filters and use the existing title-selection flow. Keep other search consumers unchanged without separate approval.

Measure provider completion separately from HTTP response completion, and verify the deployed source before attributing search latency to a new local feature.

**Why:** Live investigation found results already selected well before the response completed, with canonical-identity database bookkeeping still running synchronously despite comments describing background work. A provider-only local harness with database access disabled omitted that cost. Local safety-classifier additions also did not establish that the running search function used them.

**How to apply:** Compare search-start, final-results and HTTP-completion timestamps, then corroborate the remaining interval with the deployed execution path and narrowly bounded database-request logs. Separate ordinary search, optional series enrichment and collection screening; do not treat process-warm classification timing as representative of a cold server instance.
