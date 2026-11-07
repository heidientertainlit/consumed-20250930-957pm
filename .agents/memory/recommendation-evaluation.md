---
name: Recommendation evaluation boundaries
description: User's quality-evaluation standard and the distinction between verifiable quotations and supported profile claims.
---

The user selected “B” (the saved GPT-4.1 bounded-candidate selection approach) as the provisional film/TV recommendation method, rather than continuing to optimize the algorithm.

**Why:** The user said “let's just roll with B for now because we need to move on,” then approved connecting B in place of the existing selection step while retaining retrieval, caching and a fallback.

**How to apply:** Reuse existing infrastructure and budget protections; do not add a trending blend or another architecture. Approval to use B is provisional, not proof of recommendation quality across the catalog. Implementation approval is separate from activating a deployed function.

Verify the actual new candidate-construction and model-selection path in isolation before proposing activation. Mocked tests and replaying a saved B output are not substitutes for a fresh pre-deployment check.

**Why:** The user explicitly challenged the proposed deploy-then-live-test sequence and required verification before deployment.

**How to apply:** Keep pre-deployment checks out of live recommendation caches, disclose frozen versus fresh retrieval inputs, and show the resulting list to the user rather than having an AI judge its quality. Obtain approval for a bounded paid test separately from deployment; verify the active bundle again after any subsequently approved deployment.

Recommendation comparisons belong in chat or Excel, NOT a page or evaluation feature in the app. The user personally chooses between the separate, originally ordered lists.

**Why:** The user explicitly corrected the interface direction: “not like UI on the preview on the app” and “I don't want YOU deciding ... I want to choose.”

**How to apply:** For human comparisons, deliver separate, originally ordered lists in chat or a spreadsheet, optionally blind-labelled with a separate reveal. Do not build evaluation UI, rating workflows or permission features. The user—not an AI judge, quality score or automatic winner—chooses the best method. Comparison-only work must not generate new model outputs or write production caches. Keep raw human comparisons separate from the earlier LLM final-judge hypothesis below.

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
