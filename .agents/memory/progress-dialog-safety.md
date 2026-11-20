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

Apply a negative control's layout changes, background enablement, and hit test
in a single synchronous browser evaluation. Disable animations only for that
deliberately broken layout, restore the exact prior inline styles in `finally`,
and wait for restored entrance animations before checking the real controls.

**Why:** The modal's body MutationObserver can reapply background inertness between
separate browser calls, making a covered button appear unobscured. CSS entrance
animations can also override a synthetic layout's inline transform, preventing
the intended overlap. Both invalidate the test setup rather than prove a broken
application or detector.

**How to apply:** Assert that navigation really covers the negative-control
button, that the hit test rejects it, and that modal isolation, centering, and
real actions are restored afterward. Keep real-flow animation coverage intact.

Keep production-CSS browser gates in the build/validation path, not as
prerequisites for starting the development server.

**Why:** Registering a named validation can also attach it to the default Run
workflow, but a clean workspace has no production CSS until it is built.

Check form readiness at each open-to-dismiss path, including reopened parents,
not just nested children. Input visibility or focus alone is insufficient;
the expected dialog must be fully opened and its modal layer active.

**Why:** Vercel diagnostics showed the nested child closing successfully, then
the reopened-parent check sending Escape at opacity zero during entrance and
timing out. Treating the earlier child-only wait as a complete fix hid this
separate synchronization gap. The snapshots did not prove why Escape was missed.

**How to apply:** Share the readiness predicate without repairing focus inside
it, retain single-Escape dismissal and original restoration assertions, and use
a held-animation regression rather than sleeps, larger timeouts, or retries.

Ignore retained empty or closed portal hosts when determining the top open
modal, but still require the selected open layer to be unblocked.

**Why:** The local full gate caught a strict last-host predicate blocking the
valid parent after its child closed: the child host remained mounted and inert.
Only hosts with an open dialog belong in the open-modal ordering check.
