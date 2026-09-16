---
name: Supabase OAuth callbacks
description: Durable redirect and native deep-link rules for Google and Apple authentication.
---

Web OAuth redirects through `/login`. Native OAuth returns through the app-owned custom scheme `com.entertainlit.consumed://auth/callback`, then restores the session before entering normal identity-aware routing.

**Why:** Returning to the public feed can bypass onboarding. HTTPS Universal Links are not a reliable OAuth exit from an iOS Safari View Controller: the controller may keep rendering the authenticated website instead of opening the native app. A registered custom scheme gives Capacitor a deterministic `appUrlOpen` handoff.

**How to apply:** Register the custom scheme in iOS and Supabase’s redirect allow-list, and use it only for native OAuth. Restore token callbacks for cold and warm launches, close the Capacitor Browser after verified callbacks, and retain HTTPS callback parsing only for older builds. New/incomplete identities use onboarding guards; returning users use the normal landing route. Never log callback URLs because they can contain session tokens.