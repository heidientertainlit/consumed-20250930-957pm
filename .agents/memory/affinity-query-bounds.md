---
name: Affinity query bounds
description: PostgREST request-size and pagination constraints for People affinity candidate readiness.
---

Maintain tracked-item readiness as an incrementally updated projection. Candidate discovery must use a stable keyset cursor, and social member previews must be counted and capped in the database rather than materialized in an edge function.

**Why:** High-activity accounts previously produced oversized PostgREST requests, while whole-population counting and member materialization made every page request scale with global data instead of the requested page.

**How to apply:** Update readiness counts on tracking writes; read the projection for thresholds; use friend-first keyset pagination with a small lookahead; return only aggregate counts and capped privacy-safe previews.