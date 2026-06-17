---
name: core_archetype setup
description: How the DNA core_archetype field is populated and regenerated, and why it must be non-null for identity features to show.
---

**Rule:** `dna_profiles.core_archetype` (text, nullable) must be non-null for the DNA identity features (alignment copy on trivia/media/profile/identity surfaces) to render. All users start null — the column only populates when regeneration runs.

**How to regenerate (canonical):** call the `generate-dna-profile-v2` edge function with `POST { user_id }` and a **live user JWT** (`Bearer session.access_token`). It scores all archetypes from the DNA taxonomy and picks the best fit, writing `core_archetype` (+ `confidence_score`). It CANNOT be triggered from bash/Management API — it needs a real user session token from the client.

**Why this matters:** manually setting `core_archetype` via Management API SQL is only a stopgap for demoing the alignment features on one account; it does not reflect real taste. Prefer running `generate-dna-profile-v2` with a real session so the archetype is earned from actual signals.

**How to apply:** if identity/alignment copy is missing for a user, check `core_archetype` is non-null first; if it's null, the fix is to run `generate-dna-profile-v2` for that user — not to hand-write a value.
