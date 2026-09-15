---
name: Supabase authentication lifecycle safety
description: SDK lock and startup-event behavior that can stall consent or produce inconsistent guest state.
---

Keep awaited Supabase work outside auth-state callbacks, and do not treat a failed session lookup as proof of anonymous state.

**Why:** Auth callbacks can run while the SDK holds its session lock. A query from inside that callback can wait on the same lock and leave consent loading indefinitely. Session lookup can resolve with an error rather than throw, and a null INITIAL_SESSION event can follow a failed lookup while credentials remain stored.

**How to apply:** Use one bounded startup authority and block access on unresolved authentication. Test resolved SDK errors as well as exceptions. Ensure same-account token refresh cannot cancel pending identity preparation, and stale logout work cannot reset a replacement account. Preserve consent enforcement and provider-authorization checks when changing scheduling.