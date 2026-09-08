---
name: Mobile star rating gestures
description: Reliable half-star rating interaction inside mobile sheets and feed cards.
---

Use touch-move tracking on the star hit areas plus separate left/right half-star buttons for mouse and keyboard. A completed touch must commit only once; suppress its generated mouse click and stop propagation into parent carousel gestures.

**Why:** A pointer-capture implementation did not behave consistently inside the portaled Add Media sheet on mobile, leaving the control effectively tap-only.

**How to apply:** Avoid rebuilding mobile sheet controls with pointer capture. Calculate a drag rating from the actual star bounds, not a whole row that also includes labels, gaps, or a score. Test touch release, cancellation, and keyboard separately.

Keep rating feedback from changing the geometry of the hit areas.

**Why:** A conditional score label can shrink flex items underneath a stationary cursor, causing the selected half to change repeatedly and making the stars flicker.

**How to apply:** Reserve score space before interaction and keep the rendered stars aligned with their hit areas at narrow widths; verify bounds remain unchanged across hover values.