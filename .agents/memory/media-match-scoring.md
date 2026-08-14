---
name: Media match % scoring
description: How the feed "% match" badge is scored and calibrated (score-media-match edge fn)
---
- The feed card % match comes from the `score-media-match` edge fn (gpt-4o-mini, per-user cache in `media_match_scores`, 14-day TTL).
- Callers (feed.tsx Rate & Review cards) send ONLY title/type — no genres/description — so the prompt must tell the model to use its own knowledge of recognized titles or famous favorites score absurdly low.
- Calibration lives in the prompt: 0-4 no overlap (client hides badge when score < 5), 5-15 generic overlap, 70+ clear genre/tone kinship with loved titles. Don't add "be brutal" wording without the "use your own knowledge of the title" rule — that combo made Ever After score 40 for a period-romance lover.
- **How to apply:** after any calibration change, redeploy the fn AND `DELETE FROM media_match_scores` (via Management API) or stale cached scores keep showing for up to 14 days.
