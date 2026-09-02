---
name: Leaderboard share links
description: Integrity and native-routing rules for personalized leaderboard rank shares.
---

External leaderboard shares must use a server-verified, signed snapshot of the authenticated user's real Global rank. The canonical category determines the destination tab and any genre board; clients must not supply or assert those relationships independently.

**Why:** Raw rank parameters can be edited to forge achievements, and Friends rankings differ by viewer. Signed snapshots keep “reached #N” truthful, while Global scope gives sender and recipient the same board.

**How to apply:** Verify the signed payload before showing rank copy, highlighting a person, or producing personalized Open Graph metadata. Web API calls may be same-origin, but Capacitor must call the production app origin because relative `/api` URLs resolve to the native localhost bundle. Preserve signed leaderboard links through login/onboarding.

Signed-link creation is asynchronous and may take long enough for iOS to expire browser user-activation permission. In native builds, use the Capacitor Share plugin after verification instead of relying on `navigator.share` or the Clipboard API; keep the plugin synced into iOS. Capacitor 8 tooling requires Node 22.

**Why:** A successful server response can still end in a false “Could not share” error when delayed Web Share and Clipboard calls are denied.