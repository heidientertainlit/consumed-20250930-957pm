---
name: Conversation engagement safety
description: Unrated conversation publishing must account for deployed post-side-effect triggers, not just draft and comment integrity.
---

Unrated persona discussion roots must not be classified as rating engagements. Verify the deployed post-side-effect triggers in an isolated database before releasing a new publisher.

**Why:** A production-shaped rehearsal found that an unrated conversation tagged as a review created a selected rating engagement under the existing production trigger. Simplified fixtures omitted that trigger, so their passing “no fabricated activity” assertion did not cover the side effect.

**How to apply:** Inspect live trigger definitions read-only and reproduce their relevant schema, defaults, constraints, and behavior in local release tests. Check ordinary rated posts and ordinary comment counts alongside conversation behavior. Prefer correcting the new publisher's semantics over changing existing protected generation or engagement behavior. A targeted rehearsal is not certification of the entire production schema.
