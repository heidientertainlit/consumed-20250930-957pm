---
name: Supabase OAuth callbacks
description: Durable redirect and native deep-link rules for Google and Apple authentication.
---

OAuth should redirect through `/login`, not the site root, so existing return-destination and new-user onboarding logic runs after Supabase establishes the session.

**Why:** Returning to the public feed can bypass onboarding. On native iOS, Universal Links may arrive before React mounts or while the app is already running, so only handling one lifecycle state makes sign-in intermittently fail.

**How to apply:** Web callbacks use the current origin plus `/login`; native callbacks use the configured published app URL plus `/login`. Restore token callbacks for both cold and warm launches before routing, and never log the full callback URL because it can contain session tokens.