---
name: Resumable onboarding state
description: Defines authoritative completion and recovery rules for the integrated onboarding and Entertainment DNA flow.
---

Treat successful DNA profile generation as onboarding completion. Reconcile the resume step from persisted DNA answers, ratings, tracked titles, and room follows; use user-scoped local storage only to preserve optional step position and temporary prompt dismissal.

**Why:** Historical completion flags were unreliable because older route guards silently marked established users complete and “Skip for now” also set the same flag. Trusting those flags would permanently strand users who never generated a DNA profile.

**How to apply:** Never mark onboarding complete when an incomplete user skips or dismisses it. Fail closed when profile or response hydration cannot be read, preserve completed profiles, and keep intermediate response/follow/rating writes idempotent. The explicit `resume=dna` route is also the completed-user retake flow: prefill it at the free-text DNA step and preserve completion if the user exits before regenerating.