---
name: Track collection placement
description: User requires relevant movie collections within Top results, never a separate pinned section above them.
---

In Track search, do not put movie collections in a separate section above ordinary results. The user said to “have it show up as it needs to IN the top results.”

**Why:** The user found the separate section strange and did not want collections automatically displacing matching individual titles.

**How to apply:** Relevant allowed collections belong in the same Top results list, preserving expandable movie choices. Do not reinterpret this as moving the separate section elsewhere.

Keep Track collection blending separate from a general search-ranking overhaul: preserve ordinary results' relative order, protect exact individual-title matches, and determine collection placement from the current query rather than request completion order.

**Why:** The approved scope explicitly excluded general cross-media ranking and latency changes. Collection discovery and ordinary search finish independently; faster collection delivery is not evidence of greater relevance.

**How to apply:** Wait for the current ordinary-search request to settle before showing collections in its result stream. Preserve existing expansions and stable item identity when a later collection is inserted. Keep the app-bar presentation independent.
