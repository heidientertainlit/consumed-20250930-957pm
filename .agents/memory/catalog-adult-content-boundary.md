---
name: Catalog adult-content boundary
description: Provider adult labels are unreliable; pornography exclusion must preserve mainstream mature media.
---

Do not treat TMDB's `include_adult=false` or an item's `adult:false` as proof that collection metadata is non-pornographic.

**Why:** A live collection lookup for “the office” returned an explicitly labeled XXX parody collection with `adult:false`, despite adult results being disabled. Its member films were marked adult on the collection-details response.

**How to apply:** Evaluate original provider metadata server-side before exposing collection names, artwork, or member films, including direct-ID requests. Test false/missing flags and cached paths, not only adult=true fixtures.

Exclude pornography, including soft porn, without treating mature themes, romance, young-adult labeling, or the mainstream xXx action franchise as pornography. The user explicitly identified the Love in the Bosses Office collections as soft porn and said, “I don't want that kind of content to show.”

The user clarified: “we don't just want to block THIS collection we want all soft porn blocked.” This is a category-wide requirement, not a request for an example-specific blacklist.

**Why:** The approved safety scope explicitly preserves mainstream controls. A provider's missing or misleading metadata also means deterministic metadata checks cannot certify every unlabelled item or image.

**How to apply:** Establish category-level evidence and test unrelated and unseen examples, not only reported titles. A known-work blacklist can supplement but cannot replace the category policy. Explain evidence gaps before choosing a new service or broader blocking behavior, and report remaining limitations rather than claiming universal detection.

Provider investigation on 2026-11-18 established that TMDB's adult flag is generally intended for hardcore content, not a blanket exclusion of softcore or erotic films. See the [TMDB staff explanation](https://www.themoviedb.org/talk/628f85842495ab540a1ba3c2).

**Why:** Live movie responses now also expose a `softcore` field, but it was false for several soft-porn examples, including works with an explicit softcore keyword. The reported sequel had false adult/softcore flags and no keywords. Collection summaries lacked the softcore field entirely. Mainstream mature films also had false flags and sexual subject keywords, so broad sexual-keyword bans would overblock.

**How to apply:** Check current payloads rather than assuming a newly exposed field is fully populated. Keywords can provide positive exclusion evidence, but absent keywords or false flags are not clearance. Category-wide protection needs an explicitly approved policy for uncertain items; do not quietly add a classifier or claim metadata-only rules solve it.

The user approved conservative AI content classification after being told that it adds model costs and first-lookup delay, and that uncertain or failed checks hide content, potentially including legitimate works. This does not authorize production releases or collection-placement changes.

**Why:** Provider metadata did not support the requested category boundary. In live comparisons the cheaper classifier both missed soft porn with an ordinary plot synopsis and inconsistently blocked mainstream mature romance; the stronger classifier separated those controls correctly.

**How to apply:** Require positive, high-confidence non-pornographic clearance for movie/TV results, inspect collection members before exposing a parent, and keep uncertainty fail-closed. Validate model or prompt changes against both soft-porn and mainstream controls using real model calls, not only mocked decisions. Do not claim universal accuracy from passing examples.
