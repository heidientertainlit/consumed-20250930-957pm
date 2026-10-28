---
name: Recommendation evaluation boundaries
description: User's quality-evaluation standard and the distinction between verifiable quotations and supported profile claims.
---

Recommendation algorithm iteration is paused. The user wants an internal, admin-only, human-rated blind Film/TV bake-off of raw TMDB Recommendations, raw TMDB Similar, current consumer outputs, and an explicitly identified unchanged experiment before further architecture decisions.

**Why:** The user explicitly said to stop changing the algorithm and first establish whether an existing recommendation source already gives better results.

**How to apply:** Inspect and report system identities, duplicate paths and paid-call side effects before obtaining setup approval and building. Do not change weights/profiles, blend providers, add LLM ranking/judging, populate production recommendation caches or deploy recommendation changes for this evaluation. Disclose and obtain approval before reproducing an existing experiment that inherently makes paid model calls. Keep current raw blind bake-off separate from the earlier LLM final-judge hypothesis below.

The user approved the retrieval/preparation separation and overall recommendation pipeline in principle, not the scoring normalization, gate, or recommendation quality. A larger candidate count, reordered familiar titles, or passing regression assertions is not quality validation. Cross-media means entertainment that scratches a similar experiential itch, not advice/nonfiction with a matching topic.

**Why:** The user explicitly clarified this approval boundary after an evaluation reused a small prepared inventory and performed allocation without new preparation.

**How to apply:** Preserve the architecture. Disclose corpus selection, actual preparation, missing evidence, actual retrieval versus diagnostic-only candidates, and whether positive cross-media paths were demonstrated. Judge experience, tone, themes, audience plausibility, evidence and contradictions independently of recommender scores. Model-critic judgments are proxies, not human ground truth; challenge them explicitly. Production implementation/deployment and changing the $1 guardrail require approval.

Verbatim quotation does not establish that a profile label is grounded. A relationship-duration quote, for example, does not by itself establish supportive tone or conversational style.

**Why:** Evaluation exposed apparently rich cached profiles whose valid quotations did not entail the assigned experiential labels; more observed channels can therefore reinforce an unsupported match.

**How to apply:** Audit semantic support for claims before interpreting representation completeness or tuning weights. Preserve valid reusable intelligence; do not infer that all cached profiles need deletion or blanket re-preparation.

“More Like This” means “If someone loved the experience/feeling of consuming this title, what else are they plausibly likely to get really into?” It does not primarily mean the same plot, genre, subject, or shared descriptive labels. The user's example titles explain similarity; they are not hardcoded expected answers and their interpretation must be checked against evidence.

**Why:** The user explicitly clarified that shared audience motivations can cross genres and formats, including emotional engagement, character attachment and payoff, rather than just similar depicted content.

**How to apply:** Distinguish content facts, supported delivery/experience properties, and actual audience-response claims. Diagnose source coverage and representation before tuning weights. Do not infer chemistry, comfort, attachment, bingeability or payoff merely from premise, character occupation, genre or a flattering label.

Validate an evaluation model against known negative and positive inference controls before treating its approvals or recall judgments as evidence. Keep structural/provenance rejection distinct from genuine abstention and from semantic rejection; retained input text is not necessarily retained structured output.

**Why:** A separate-model verifier can endorse the very character-to-work and marketing-to-audience inferences it was instructed to reject, and can report recovery using input-only or unrelated item IDs. Duplicate-ID/schema losses can also make an extractor appear to abstain correctly.

**How to apply:** Preserve failed pilots and raw outputs, audit source support independently of model agreement, check recovery against actual output items, and report pre-structural, post-structural and post-semantic losses separately. Do not headline analyst-curated residual precision as automated pipeline quality.

Constrained LLM reranking is a final-judgment hypothesis, not permission to redesign or discard retrieval/preparation. Compare provider ordering, an honestly named unchanged deterministic policy, and the model on the same verified eligible universe. The deterministic experiential gate belongs to that comparator, not to shared candidate eligibility.

**Why:** The user requested a clean test of holistic final judgment rather than further experiential-dimension/weight expansion, while preserving existing leases, caching, deduplication, demand-driven preparation and runaway-AI protections.

**How to apply:** Freeze pools, prompt and comparator before model calls; do not coach toward preferred-example titles or tune until they rise. Profiles/embeddings may remain retrieval/context inputs, not mandatory final-decision representations. Disclose historical-pool replay versus fresh retrieval and previously evaluated supplementary cases versus true untouched holdouts. Evaluation does not authorize production writes or deployment.
