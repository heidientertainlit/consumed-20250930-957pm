---
name: Typography override specificity
description: Why alternate display fonts must be applied to the actual text elements in this app.
---

The global typography rule assigns the sans-serif font directly to every element. When using an alternate display font, apply its override class to each nested element that renders text, not only to a parent heading.

**Why:** A parent font override appeared correct in markup but nested spans kept their own globally assigned sans-serif font.

**How to apply:** For split or styled headings, put the alternate font class on the child spans as well as—or instead of—the parent.