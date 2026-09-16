---
name: Supabase OAuth callbacks
description: Durable redirect and native deep-link rules for Google and Apple authentication.
---

Web OAuth redirects through `/login`. Native OAuth uses a dedicated callback route rather than the human login page, then restores the session before entering normal identity-aware routing.

**Why:** Returning to the public feed can bypass onboarding. Reusing `/login` for native callbacks can display a second login screen when iOS renders the callback in the Safari controller, while Universal Links may also arrive before React mounts or during a warm launch.

**How to apply:** Web callbacks use the current origin plus `/login`; native callbacks use the configured published app URL plus `/auth/callback`. Restore token callbacks for cold and warm launches before routing; retain legacy `/login` callback parsing only for in-flight older builds. New/incomplete identities go through existing onboarding guards, while returning users go to the normal landing route. Never log callback URLs because they can contain session tokens.