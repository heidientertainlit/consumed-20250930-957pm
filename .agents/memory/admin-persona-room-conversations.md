---
name: Admin persona room conversations
description: Safety and integrity rules for generating and publishing admin-reviewed persona threads in official rooms.
---

Keep generated room conversations private until explicit admin approval. Server-issued topic records, not client-submitted attribution, are the trusted source of provenance. Persona creation must use auth-backed identities and recompute the exact deficit while holding a short-lived concurrency lock. Public thread insertion must happen atomically through a service-role-only transaction with duplicate protection.

**Why:** Client-only approval and attribution can be bypassed, concurrent provisioning can create too many personas, and partial multi-row publication can expose broken threads.

**How to apply:** Use this pattern for any future persona conversation category or room. Validate the official target room, all participants, the full reply graph, moderation, and source binding before creating a private preview; require explicit review before the single atomic publish step.