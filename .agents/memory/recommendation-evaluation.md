---
name: Recommendation evaluation boundaries
description: User's quality-evaluation standard and the distinction between verifiable quotations and supported profile claims.
---

The user approved the retrieval/preparation separation and overall recommendation pipeline in principle, not the scoring normalization, gate, or recommendation quality. A larger candidate count, reordered familiar titles, or passing regression assertions is not quality validation. Cross-media means entertainment that scratches a similar experiential itch, not advice/nonfiction with a matching topic.

**Why:** The user explicitly clarified this approval boundary after an evaluation reused a small prepared inventory and performed allocation without new preparation.

**How to apply:** Preserve the architecture. Disclose corpus selection, actual preparation, missing evidence, actual retrieval versus diagnostic-only candidates, and whether positive cross-media paths were demonstrated. Judge experience, tone, themes, audience plausibility, evidence and contradictions independently of recommender scores. Model-critic judgments are proxies, not human ground truth; challenge them explicitly. Production implementation/deployment and changing the $1 guardrail require approval.

Verbatim quotation does not establish that a profile label is grounded. A relationship-duration quote, for example, does not by itself establish supportive tone or conversational style.

**Why:** Evaluation exposed apparently rich cached profiles whose valid quotations did not entail the assigned experiential labels; more observed channels can therefore reinforce an unsupported match.

**How to apply:** Audit semantic support for claims before interpreting representation completeness or tuning weights. Preserve valid reusable intelligence; do not infer that all cached profiles need deletion or blanket re-preparation.

“More Like This” means “If someone loved the experience/feeling of consuming this title, what else are they plausibly likely to get really into?” It does not primarily mean the same plot, genre, subject, or shared descriptive labels. The user's example titles explain similarity; they are not hardcoded expected answers and their interpretation must be checked against evidence.

**Why:** The user explicitly clarified that shared audience motivations can cross genres and formats, including emotional engagement, character attachment and payoff, rather than just similar depicted content.

**How to apply:** Distinguish content facts, supported delivery/experience properties, and actual audience-response claims. Diagnose source coverage and representation before tuning weights. Do not infer chemistry, comfort, attachment, bingeability or payoff merely from premise, character occupation, genre or a flattering label.
