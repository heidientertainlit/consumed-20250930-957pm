---
name: External-component styles in mockup fixtures
description: Tailwind v4 discovery does not automatically include imported production components outside the mockup artifact
---
When a mockup fixture imports a production component from outside its artifact,
include that component explicitly in Tailwind v4 source discovery.

**Why:** A fixture can build and render without errors while its external
component's responsive grids, borders and typography classes are missing.
Importing the component alone does not guarantee Tailwind discovers its classes.

**How to apply:** Add an explicit CSS source declaration for the imported
component before judging fixture layout. Do not change production layout to
compensate for incomplete preview CSS.
