---
name: Recommendation V2 boundaries
description: User-defined recommendation goals and experimental scope, not implementation approval.
---

V2 must balance subject/themes with appeal/experience, generally favoring appeal. Semantic similarity is one signal, not the entire engine. Multiple real candidate sources feed separate inspectable signals and Consumed ranking; any optional LLM reranker may choose only supplied verified candidates.

**Why:** The user rejected superficial subject matches and unconstrained LLM recommendations and supplied an explicit architecture brief.

**How to apply:** Retain signal-level evidence and missingness; test weights rather than treating permanent values as established. Preserve cross-media discovery. TasteDive is excluded, as documented in the media-detail recommendation scope.

Build an isolated internal CURRENT versus V2 comparison lab first, with persistent Great/Fine/Bad evaluations and deliberately varied source works. Production recommendation behavior remains untouched until separately approved.

**Why:** The user wants to review the smallest technical architecture before any implementation and evaluate quality before replacement.

**How to apply:** Do not expand into shared search, canonical identity, media pages, conversations, ratings, navigation, or existing schemas beyond separately approved isolated experiment additions. Flag blockers instead of broadening scope.

The approved initial lab has three configurations: CURRENT, provider/relationship/structured-metadata ranking, and that approach plus semantic retrieval/scoring. No LLM reranking initially. Use text-embedding-3-small first and keep initial model spend within $5–$15.

**Why:** The user confirmed this bounded experiment and wants candidate generation and semantic scoring evaluated without another ranking variable.

**How to apply:** Preparation must not mutate production canonical records. Show only provider-verified candidates with supported destinations; sparse or empty categories are acceptable. Retain diagnostic feedback reasons and source cases that distinguish subject overlap from appeal overlap.

Minimize new experiment tables after auditing the live schema. Reuse genuinely appropriate existing structures, but do not force reuse that contaminates production data or weakens isolation.

**Why:** The user explicitly requested an existing-schema reuse audit before any lab migration.

**How to apply:** Distinguish read-only reuse of production evidence from writable experiment state. Propose consolidating bounded lab records before adding dedicated tables for every entity; do not repurpose production caches or feedback merely because they contain JSON.

Cache source-grounded work profiles and replaceable embeddings rather than paying for model calls on every media-page open. Investigate existing Supabase/pgvector and inexpensive small-model options before adding infrastructure. Do not build large collaborative filtering now; reserve interfaces for signed preferences, affinity, DNA and co-consumption later.

**Why:** The user explicitly prioritizes cost control, provider replaceability, and a small experiment over a premature recommendation platform.

**How to apply:** Separate cold preparation from cached reads, preserve low-rating capability, and distinguish social engagement from evidence that someone liked a work.
