---
name: Catalog adult-content boundary
description: Provider adult labels are unreliable; pornography exclusion must preserve mainstream mature media.
---

Do not treat TMDB's `include_adult=false` or an item's `adult:false` as proof that collection metadata is non-pornographic.

**Why:** A live collection lookup for “the office” returned an explicitly labeled XXX parody collection with `adult:false`, despite adult results being disabled. Its member films were marked adult on the collection-details response.

**How to apply:** Evaluate original provider metadata server-side before exposing collection names, artwork, or member films, including direct-ID requests. Test false/missing flags and cached paths, not only adult=true fixtures.

Exclude pornography, including soft porn, without treating mature themes, romance, young-adult labeling, or the mainstream xXx action franchise as pornography. The user explicitly identified the Love in the Bosses Office collections as soft porn and said, “I don't want that kind of content to show.”

**Why:** The approved safety scope explicitly preserves mainstream controls. A provider's missing or misleading metadata also means deterministic metadata checks cannot certify every unlabelled item or image.

**How to apply:** Use narrow evidence-based rules and positive controls; report the actual verified cases and remaining metadata limitations rather than claiming universal detection.
