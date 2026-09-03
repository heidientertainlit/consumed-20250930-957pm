---
name: Leaderboard share links
description: Integrity and native-routing rules for personalized leaderboard rank shares.
---

External leaderboard shares must use a server-verified, signed snapshot of the authenticated user's real Global rank. The canonical category determines the destination tab and any genre board; clients must not supply or assert those relationships independently.

**Why:** Raw rank parameters can be edited to forge achievements, and Friends rankings differ by viewer. Signed snapshots keep “reached #N” truthful, while Global scope gives sender and recipient the same board.

**How to apply:** Verify the signed payload before showing rank copy, highlighting a person, or producing personalized Open Graph metadata. Production Capacitor bundles must call the production app origin because relative `/api` URLs resolve to native localhost. Vite development and native live reload must use the current HTTP origin so dev shares exercise dev Open Graph routes. Preserve signed leaderboard links through login/onboarding.

Signed-link creation is asynchronous and may take long enough for iOS to expire browser user-activation permission. Prepare and cache the verified share data before enabling the button, then call the same immediate `navigator.share` flow used by existing DNA/rating shares.

**Why:** A successful server response can still end in a false “Could not share” error when a network request runs inside the tap before Web Share or Clipboard is called.

All Open Graph link previews use one Consumed card system: route-specific main content above a divider, then the fixed footer “See what everyone’s consuming.” and “Discover your Entertainment DNA. Find your people.” Personalized leaderboard artwork says “I reached #N on Consumed.”

**Why:** Repeating the share result and URL inside both the artwork and the native link preview makes Messages cards visually crowded.

**How to apply:** Keep route-specific copy in signed image tokens, use the real logo and embedded Poppins TTF files, and render every link through the shared server image endpoint. Native metadata titles may differ from the artwork headline when useful.