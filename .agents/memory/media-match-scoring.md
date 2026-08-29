---
name: Media match % scoring
description: How the feed "% match" badge is scored and calibrated (score-media-match edge fn)
---
- Media matching has an isolated, reversible v2 test path; v1 remains available and its cache is preserved.
- **Rule:** v2 scores only from signed rating-derived genre evidence. Never treat raw DNA signal strength as positive preference; tracked, followed, or engaged-with media is not proof the user liked it.
- **Why:** title-recognition scoring produced confident matches with no defensible connection to the user's demonstrated taste.
- **How to apply:** actual ratings always suppress predictions; weak or missing verified evidence returns no badge. Keep archetype, People, Friends, and Tribe scoring unchanged while media v2 is evaluated.
- V2 uses canonical media genres and a short, version-separated cache. Its lease acquisition, completion, and release must remain atomically fenced so feed fan-out cannot duplicate work or overwrite a newer result.
- V1 calibration remains in the AI prompt and its 14-day cache. Only clear v1 rows when intentionally recalibrating or retiring v1; never clear them merely to test v2.
- **Deferred by user decision (Aug 2026): keep scoring personal-taste-only for now.** Inputs today: user's cross-media ratings, DNA profile, DNA signals + model's title knowledge. Deliberately NOT using community averages or taste-neighbor ("users like you") signals — too few real users; thin data would make scores feel random. **Revisit when many titles have ~5+ real-user ratings.** Agreed first step then: feed the title's Consumed avg/count + friends'/DNA-matches' ratings of that exact title into the prompt, adding guardrail cases before deploy. Full collaborative filtering only after real user growth.
- **Drift guardrail:** `node scripts/match-calibration-check.mjs` scores a fixed golden set against the real prompt (needs OPENAI_API_KEY). Run it after ANY prompt change, before deploying. Lessons baked in: gpt-4o-mini snaps to round band edges (40/70) without explicit numeric anchors + "pick a precise integer"; and it treats absence of genre kinship as a dislike unless told "absence of evidence is NOT a dislike" with a mixed-fit anchor.
