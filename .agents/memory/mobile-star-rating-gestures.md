---
name: Mobile star rating gestures
description: Reliable half-star rating interaction inside mobile sheets and feed cards.
---

Use the feed card’s existing interaction pattern for swipeable half-star controls: touch-move tracking on the rating row plus separate left/right half-star buttons for taps and mouse hover.

**Why:** A pointer-capture implementation did not behave consistently inside the portaled Add Media sheet on mobile, leaving the control effectively tap-only.

**How to apply:** When adding or changing a swipeable star control in a sheet, reuse the feed rater’s event structure rather than rebuilding it with pointer capture.