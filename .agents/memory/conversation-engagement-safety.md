---
name: Conversation engagement safety
description: Reviews may omit star ratings; distinguish internal engagement labels from actual ratings and verify downstream effects before declaring a release blocker.
---

“There doesn't have to be a rating to give a review.” Reviews may omit a star rating. Do not require stars or categorically reclassify an unrated review as a discussion.

**Why:** The user clarified this product rule after a release assessment incorrectly treated an internal rating-engagement classification as sufficient proof of fabricated rating activity. That classification alone does not establish an invented star rating or harmful downstream behavior.

**How to apply:** Preserve unrated reviews. When assessing publishing side effects, distinguish the stored star value, internal engagement category, and downstream use of that category. Verify an actual unintended consequence before calling it a release blocker or changing publisher semantics. Reproduce relevant deployed triggers in isolated tests rather than relying only on simplified fixtures.
