---
name: Media search text correction safety
description: Proper-name correction on blur can interrupt result clicks and collapse their owning dialog.
---

Treat blur-time text correction as part of the result-selection interaction.
Do not rely on a backdrop guard alone when search results disappear on a tap.

**Why:** A user recording showed a proper-name capitalization correction
committed between pressing and releasing the book-series arrow. Exact-string
search invalidation removed the pressed result, collapsed Track and left the
pointer outside it. Basic expansion tests omitted this correction step.

**How to apply:** Preserve query/result identity across capitalization and
outer-whitespace-only title edits, avoid unsolicited correction in proper-name
search inputs, and retain stale-result protection for genuinely different
titles and filters. Exercise correction on blur during a real press/release,
checking button continuity, expansion, request count and dialog height.
Keep browser simulation distinct from installed-device verification.
