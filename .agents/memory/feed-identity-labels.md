---
name: Feed identity labels
description: Product rule for human-readable names in feed surfaces versus usernames used as handles and identifiers.
---

# Feed identity labels

Feed-visible human names use first name plus last initial (for example, “Heidi P.”). This applies to post authors, comments, replies, room moments, activity groups, DNA cards, predictions, and other Now/Activity feed cards.

Raw usernames remain unchanged for explicit `@username` labels, profile pages, profile navigation, report/moderation payloads, IDs, keys, and backend calls. If someone wants the username, they can open that person’s profile.

**Why:** Mixed usernames and real-name formats made the feed feel inconsistent. The display change must remain presentation-only so identity links and backend behavior are not destabilized.

**How to apply:** Use the shared feed-name formatter only for visible feed copy. Never format a value before using it as a route parameter, handle, lookup key, report target, or API/database value.