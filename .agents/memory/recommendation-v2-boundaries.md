---
name: Recommendation V2 boundaries
description: User-defined recommendation goals and experimental scope, not implementation approval.
---

V2 must balance subject/themes with appeal/experience, generally favoring appeal. Semantic similarity is one signal, not the entire engine. Multiple real candidate sources feed separate inspectable signals and Consumed ranking; any optional LLM reranker may choose only supplied verified candidates.

**Why:** The user rejected superficial subject matches and unconstrained LLM recommendations and supplied an explicit architecture brief.

**How to apply:** Retain signal-level evidence and missingness; test weights rather than treating permanent values as established. Preserve cross-media discovery. TasteDive is excluded, as documented in the media-detail recommendation scope.

The primary goal is improving the existing consumer-facing Media Detail → “More like this” recommendations. The older private/content-creation “what's similar to this?” tool is a separate use case, not the current deliverable. Both may ultimately share an underlying recommendation engine.

**Why:** The user explicitly corrected a scope mix-up after work shifted into the admin Recommendation Lab instead of the consumer media-detail feature.

**How to apply:** Anchor recommendation work to the consumer media-page section unless the user explicitly chooses the private tool. Older lab/task instructions must not silently override a new request; clarify conflicting scope before implementation.

Do not spend additional time building or polishing the Recommendation Lab, spend dashboard, run controls, or other admin infrastructure unless it is necessary to validate the recommendation engine.

**Why:** The user wants reusable recommendation-engine work, not continued investment in a separate admin deliverable.

**How to apply:** Reuse useful profiling, verification, ranking, embeddings and tests. Treat the bounded lab as optional validation infrastructure, not a prerequisite for every consumer improvement.

The user clarified that “admin/dev-only preview” meant local development work for review before Git/release, not an admin-only feature in the app. The intended consumer More like this experience does not need an admin permission gate or a CURRENT/Experimental switch.

**Why:** The user wants ordinary users to see similar-title recommendations on media detail pages and is concerned that extra admin infrastructure overcomplicates or misclassifies the feature.

**How to apply:** Keep development/release boundaries separate from in-app authorization. Do not add an admin gate or comparison selector for this consumer feature unless the user explicitly requests one again. The private Recommendation Lab/content-creation tool remains paused, not abandoned; do not delete, redesign, polish or expand it.

The prior lab checkpoint compared CURRENT, provider/relationship/structured-metadata ranking, and that approach plus semantic scoring. It did not establish that the weights or results are suitable for consumers. No LLM reranking was included.

**Why:** Comparing engine evidence was useful, but completing lab infrastructure does not demonstrate consumer recommendation quality.

**How to apply:** Preserve the evidence and reusable tests without claiming an improved consumer feature has shipped. Keep experiment preparation isolated from production canonical writes, preserve provider-verified destinations, and make missing coverage explicit.

Minimize new experiment tables after auditing the live schema. Reuse genuinely appropriate existing structures, but do not force reuse that contaminates production data or weakens isolation.

**Why:** The user explicitly requested an existing-schema reuse audit before any lab migration.

**How to apply:** Distinguish read-only reuse of production evidence from writable experiment state. Propose consolidating bounded lab records before adding dedicated tables for every entity; do not repurpose production caches or feedback merely because they contain JSON.

Cache source-grounded work profiles and replaceable embeddings rather than paying for model calls on every media-page open. Investigate existing Supabase/pgvector and inexpensive small-model options before adding infrastructure. Do not build large collaborative filtering now; reserve interfaces for signed preferences, affinity, DNA and co-consumption later.

**Why:** The user explicitly prioritizes cost control, provider replaceability, and a small experiment over a premature recommendation platform.

**How to apply:** Separate cold preparation from cached reads, preserve low-rating capability, and distinguish social engagement from evidence that someone liked a work.
