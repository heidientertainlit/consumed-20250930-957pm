---
name: Resumable onboarding state
description: Defines authoritative completion and recovery rules for the integrated onboarding and Entertainment DNA flow.
---

Treat successful DNA profile generation as onboarding completion only when canonical identity is already complete. New DNA rows carry a durable identity-customization marker until the post-reveal name/username step succeeds. Reconcile earlier resume steps from persisted DNA answers, ratings, tracked titles, and room follows; use user-scoped local storage only to preserve optional step position and temporary prompt dismissal. Account age is never evidence of progress.

**Why:** Historical completion flags were unreliable because older route guards silently marked established users complete and “Skip for now” also set the same flag. DNA existence alone cannot prove identity completion after identity customization moved behind the reveal, while account-age cutoffs misclassify old accounts that generate their first DNA later.

**How to apply:** Existing DNA rows explicitly marked legacy-safe may bypass identity setup; newly created DNA must not. Clear the marker only after server-confirmed identity completion. Fail closed when profile or response hydration cannot be read, preserve completed profiles, and keep intermediate writes idempotent. Treat `resume=dna` as a retake shortcut only when canonical DNA exists.