---
name: Media page DNA match line
description: Rules for the "% match" line on media detail pages — when it shows and what feeds it
---

# Media detail "% match" line

Rule: the match line on media detail pages must be evidence-based and restrained:
- **Update (Aug 13, 2026):** the poster match PILL now shows on ALL titles including rated ones — user explicitly asked for consistency ("it should be on all"). Client polls while the edge fn is generating (pending flag).
- Source of truth: the **score-media-match edge fn** — on-demand AI scoring (gpt-4o-mini) of any title vs the user's full taste profile (dna_profiles + loved/disliked ratings + signals), cached 14 days in `media_match_scores` (unique per user+source+id; score=-1 rows are in-flight reservations to dedupe AI calls; RLS select-own, service-role writes; table created via mgmt API, no migration file). Do NOT hand-roll genre/creator similarity blends — user rejected that as "terribly inaccurate". `user_recommendations` items also carry confidence/reason but only cover the current ~16-title batch.
- Show low scores too — user explicitly wants "would I like it or not", not only high matches. Client no longer gates on unrated (user override Aug 2026).
- Note: the feed's "Entertainment DNA match %" (dna_comparisons.match_score) is person-to-person only — never use it to score a title.
- Always show the written reason with the % ("Since you rated X highly...").

**Why:** user explicitly rejected generic taste blurbs ("We think you'll appreciate this one" — see replit.md preference) and called a genre-only match "terribly inaccurate." Specific + earned or nothing.

**How to apply:** any future taste/match UI (media pages, recommendations, compare cards) should follow the same bar: hide when the user already has firsthand signal, cite evidence, prefer silence over filler.
