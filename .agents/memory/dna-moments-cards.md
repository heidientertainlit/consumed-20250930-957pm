---
name: DNA Moment feed cards
description: How DNA Moment cards load/hide, dna_moments schema gotchas, and RLS write posture
---

- Feed `DnaMomentCard` + hero `DnaMomentFeaturedCard` query `dna_moments` directly from the client and **return null on any query error or empty result** — a schema mismatch hides them silently with no user-visible error.
- `dna_moments` schema is minimal: question_text, option_a/option_b, category, is_active, display_date, display_type (added Aug 2026, default 'both'). Client code also maps option_c/d/e + is_multi_select which do NOT exist as columns (harmless undefined).
- Cards filter `display_type in (feed|both)` / `(featured|both)` AND `is_active = true` (drafts from generate-dna-moments are is_active:false pending admin review).
- RLS: dna_moments has ONLY a public-read policy — all client writes are denied. The admin page (/admin-dna-moments) does client-side update/delete, so its mutations fail without a service-role path; publishing/editing questions needs an edge function or direct SQL.
**Why:** cards vanished for weeks because a filter referenced a missing column; verify schema vs client filters before assuming content is just unanswered.
**How to apply:** when DNA cards "disappear", check the browser query error and dna_moments columns first.
