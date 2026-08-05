---
name: Media page DNA match line
description: Rules for the "% match" line on media detail pages — when it shows and what feeds it
---

# Media detail "% match" line

Rule: the match line on media detail pages must be evidence-based and restrained:
- **Never show it for titles the user has already rated** — a prediction on something they've judged reads as inaccurate/insulting (user complained when a 5-star title showed no match).
- Source of truth: the **recommendations engine** (`user_recommendations.recommendations.recommendations[]`, per-item `confidence` 1-10 + written `reason`, matched by external_id/external_source). Do NOT hand-roll genre/creator similarity blends — user explicitly rejected that as "terribly inaccurate"; reuse the existing engine.
- Note: the feed's "Entertainment DNA match %" (dna_comparisons.match_score) is person-to-person only — never use it to score a title.
- Always show the written reason with the % ("Since you rated X highly...").

**Why:** user explicitly rejected generic taste blurbs ("We think you'll appreciate this one" — see replit.md preference) and called a genre-only match "terribly inaccurate." Specific + earned or nothing.

**How to apply:** any future taste/match UI (media pages, recommendations, compare cards) should follow the same bar: hide when the user already has firsthand signal, cite evidence, prefer silence over filler.
