---
name: Track collection placement
description: Movie collections are temporarily disabled; preserve book series. Placement constraints apply only if restored.
---

Movie collections are disabled for now across Track and app-bar search. Keep book-series discovery and dropdowns, ordinary media search, filters and selection.

**Why:** The user asked: “remove the movie collections for now” and “keep our book collection series but remove movie collections” after encountering the published service failure.

**How to apply:** Keep movie-collection requests and their unavailable/loading messages disabled. Retaining dormant implementation is intentional for this temporary removal; fixing its server does not itself request restoring the feature. The placement constraints below apply if the user requests restoration.

If restored, in Track search, do not put movie collections in a separate section above ordinary results. The user said to “have it show up as it needs to IN the top results.”

**Why:** The user found the separate section strange and did not want collections automatically displacing matching individual titles.

**How to apply:** Relevant allowed collections belong in the same Top results list, preserving expandable movie choices. Do not reinterpret this as moving the separate section elsewhere.

Keep Track collection blending separate from a general search-ranking overhaul: preserve ordinary results' relative order, protect exact individual-title matches, and determine collection placement from the current query rather than request completion order.

**Why:** The approved scope explicitly excluded general cross-media ranking and latency changes. Collection discovery and ordinary search finish independently; faster collection delivery is not evidence of greater relevance.

**How to apply:** Wait for the current ordinary-search request to settle before showing collections in its result stream. Preserve existing expansions and stable item identity when a later collection is inserted. Keep the app-bar presentation independent.
