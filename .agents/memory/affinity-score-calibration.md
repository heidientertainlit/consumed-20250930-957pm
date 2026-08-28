---
name: Affinity score calibration
description: Calibration principles for meaningful People Match percentages across sparse and high-activity DNA profiles.
---

Keep unique interests in the affinity denominator, but give additional weight to the density of substantive shared signals. A single shared genre must not receive the same lift as many shared genres, titles, and creators. Disjoint profiles stay at zero and media-type-only overlap stays low.

**Why:** A high-activity profile with abundant shared evidence was compressed below the top tier because its long tail of unique interests dominated weighted Jaccard. Widening UI tiers hid the scoring problem rather than fixing it.

**How to apply:** Test sparse and dense overlap separately, bump the scoring/cache version when behavior changes, and audit the live score distribution before adjusting product tier boundaries.