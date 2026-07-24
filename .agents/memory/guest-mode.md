---
name: Guest mode (logged-out feed)
description: How logged-out browsing works — server-side persona-only filtering, anon-key auth, GuestGate signup sheet
---

# Guest mode

Logged-out users can browse `/` and `/activity` (Feed) without login.

**Rule:** guests see the full public feed — ALL users' posts, not just personas (user decision 2026-07-24; original persona-only filter was removed). POST stays 401. Any future guest content restriction MUST live in the `social-feed` edge function, never only in the client.

**Why:** user wants a lively real feed for logged-out visitors; accepts that public content is scrapeable. Server-side enforcement matters because anyone can call the edge function with the anon key directly. A private-account toggle + guest scroll cap were discussed but deferred.

**How to apply:**
- Client with no session sends `Bearer VITE_SUPABASE_ANON_KEY` — the anon key is a valid JWT that passes the gateway; `auth.getUser()` then fails inside the function → guest branch.
- All user-specific lookups in the function are guarded behind a nullable `appUser`.
- UI gating: reusable `GuestGate` (client/src/components/guest-signup-gate.tsx) wraps guest pages with a capture-phase click interceptor → signup bottom sheet; `data-guest-allowed` opts elements out; saves `returnUrl` in sessionStorage; `/login?tab=signup` opens the Sign Up tab.
- Extend the same pattern (server-side guest branch + GuestGate wrapper) for any future guest-visible page (e.g. partner room deep links).
