---
name: Persona conversation timing
description: Why late delivery preserves reviewed gaps rather than compressing catch-up messages
---
Overdue persona conversations must retain the full reviewed inter-message gaps
after actual arrival, even if the final message slips beyond the original window.

**Why:** The user requires genuinely staggered creation timestamps, not an overdue
thread released in one simultaneous burst. Planned duration is a proposed window,
not permission to compress late replies.

**How to apply:** Preserve this rule when changing workers, retries, resume times
or scheduler frequency. Never backdate public timestamps to planned offsets.
