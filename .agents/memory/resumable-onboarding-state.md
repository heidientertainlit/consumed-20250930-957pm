---
name: Resumable onboarding state
description: Defines authoritative completion and recovery rules for the integrated onboarding and Entertainment DNA flow.
---

Treat successful DNA profile generation as onboarding completion. Reconcile the resume step from persisted DNA answers, ratings, tracked titles, and room follows; use user-scoped local storage only to preserve optional step position and temporary prompt dismissal. Account age is never evidence of progress: an incomplete account with no canonical answers or saved draft starts at the beginning.

**Why:** Historical completion flags were unreliable because older route guards silently marked established users complete and “Skip for now” also set the same flag. A short-lived “new account” window also caused untouched OAuth accounts to jump into later onboarding steps after the window expired. Trusting those heuristics would strand users who never generated a DNA profile.

**How to apply:** Never mark onboarding complete when an incomplete user skips or dismisses it. Fail closed when profile or response hydration cannot be read, preserve completed profiles, and keep intermediate response/follow/rating writes idempotent. Treat `resume=dna` as a retake shortcut only when a canonical DNA profile exists. Incomplete users must pass through title selection unless a saved `love` or `drivers` step proves they already advanced beyond it.