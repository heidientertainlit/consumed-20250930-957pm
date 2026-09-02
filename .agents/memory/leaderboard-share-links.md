---
name: Leaderboard share links
description: Integrity and native-routing rules for personalized leaderboard rank shares.
---

External leaderboard shares must use a server-verified, signed snapshot of the authenticated user's real Global rank. The canonical category determines the destination tab and any genre board; clients must not supply or assert those relationships independently.

**Why:** Raw rank parameters can be edited to forge achievements, and Friends rankings differ by viewer. Signed snapshots keep “reached #N” truthful, while Global scope gives sender and recipient the same board.

**How to apply:** Verify the signed payload before showing rank copy, highlighting a person, or producing personalized Open Graph metadata. Production Capacitor bundles must call the production app origin because relative `/api` URLs resolve to native localhost. Vite development and native live reload must use the current HTTP origin so dev shares exercise dev Open Graph routes. Preserve signed leaderboard links through login/onboarding.

Signed-link creation is asynchronous and may take long enough for iOS to expire browser user-activation permission. Prepare and cache the verified share data before enabling the button, then call the same immediate `navigator.share` flow used by existing DNA/rating shares.

**Why:** A successful server response can still end in a false “Could not share” error when a network request runs inside the tap before Web Share or Clipboard is called.

Open Graph artwork for Play challenges and leaderboard rank shares should contain only the purple branded panel. Do not draw a white title/URL panel inside the image; Messages and other clients already add their own metadata panel below it. Personalized leaderboard artwork should say “I reached #N on Consumed.”

**Why:** Repeating the share result and URL inside both the artwork and the native link preview makes Messages cards visually crowded.

**How to apply:** Keep result-specific Play copy and leaderboard context in the Open Graph title/description. Use versioned artwork URLs to avoid stale social-preview caches, and derive dynamic rank images only from the verified signed token.