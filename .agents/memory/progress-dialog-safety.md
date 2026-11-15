---
name: Progress dialog safety
description: Why dialog visibility requires actual browser hit tests and native verification boundaries.
---

Progress dialog acceptance requires on-screen, unobscured primary actions, not
just a successful compile or a visible DOM element. Keep navigation and nested
confirmation layers in the test, including the elevated Add composer.

**Why:** The user reported that Update Progress's button was buried repeatedly
and approved fixing the active dialogs plus automatic checks in builds.

**How to apply:** Exercise real active components/markup with production CSS,
short viewports and focused inputs. Include negative controls proving the check
rejects covered and off-screen buttons. New entry points must be added to that
coverage; passing tests for one dialog do not establish safety for another.
Keep platform keyboard changes out of these layout fixes; follow the separate
[iOS keyboard constraints](ios-keyboard-viewport-sizing.md).

Wait for modal entrance animations to finish before hit-testing, rather than
assuming a fixed delay is sufficient. Covered-navigation negative controls must
also restore background hit-testing within the isolated fixture.

**Why:** A still-animated sheet can look off-screen to a test; an inert background
can make a deliberately lowered sheet pass because navigation cannot receive hits.

**How to apply:** Check animation completion, reproduce both the old stacking and
background-interaction state for the negative control, then restore modal isolation.

Keep production-CSS browser gates in the build/validation path, not as
prerequisites for starting the development server.

**Why:** Registering a named validation can also attach it to the default Run
workflow, but a clean workspace has no production CSS until it is built.
