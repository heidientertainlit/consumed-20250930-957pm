---
name: Guest mode (logged-out feed)
description: How logged-out browsing works — server-side persona-only filtering, anon-key auth, GuestGate signup sheet
---

# Guest mode

Logged-out users can browse `/` and `/activity` (Feed) without login.

**Rule:** guest-safe filtering MUST live in the `social-feed` edge function, never only in the client. Guests get only persona-authored posts (`users.is_persona = true`); if no personas exist, return an empty feed rather than leak real-user content. POST stays 401.

**Why:** anyone can call the edge function with the anon key directly, so client-side filtering alone would leak real users' posts.

**How to apply:**
- Client with no session sends `Bearer VITE_SUPABASE_ANON_KEY` — the anon key is a valid JWT that passes the gateway; `auth.getUser()` then fails inside the function → guest branch.
- All user-specific lookups in the function are guarded behind a nullable `appUser`.
- UI gating: reusable `GuestGate` (client/src/components/guest-signup-gate.tsx) wraps guest pages with a capture-phase click interceptor → signup bottom sheet; `data-guest-allowed` opts elements out; saves `returnUrl` in sessionStorage; `/login?tab=signup` opens the Sign Up tab.
- Extend the same pattern (server-side guest branch + GuestGate wrapper) for any future guest-visible page (e.g. partner room deep links).
