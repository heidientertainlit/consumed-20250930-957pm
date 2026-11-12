# Shared modal foundation: staged rollout

## Scope and review boundary

This first pass opts in five representative flows only:

1. Feedback: a simple form.
2. Consumption Tracker: real shared search, review and list dropdown.
3. Shared Update Progress: nested removal confirmation.
4. Quick Add List: drawer opened above the Add composer.
5. Finished-media follow-up: optional stars/reaction/spoilers and skip.

The existing Just Tracked continuation opts in **only when called by the two
representative tracking flows**. Other callers retain their previous behavior.
Nested shared dialogs inherit the parent's policy. Retired routes and disabled
markup are unchanged. Remaining shared-component consumers and custom overlays
are deliberately not migrated pending review.

## Layer contract

The shared Radix/Vaul roots accept `layered`. This uses the existing component
architecture, keeping Radix/Vaul's dismissal, focus scopes, ARIA handling, scroll
locks and drawer gestures rather than replacing them.

Managed modal content portals into its own body-level stacking context in one
named compatibility band (`MODAL_LAYER.surface`): above existing navigation and
the full-screen composer, below toast presentation and mandatory update gates.
Local ordering is backdrop 0, content 1, floating controls 2. Legacy per-call
z-index overrides cannot escape that stacking context.

Nested modals use logical ancestry and DOM opening order in the **same** band.
There is no per-dialog z-index escalation. Radix/Vaul can recompose refs while
opening nested dialogs or handling a press. Null-to-node ref changes in one
commit must not unregister/reorder a live host: moving it during pointerdown
cancels the click and loses pointer capture.

Select, DropdownMenu (including explicitly portaled submenus), and Popover
content inherit the owning modal's portal container. Their existing placement,
collision handling, appearance and event handlers remain intact. Outside a
managed modal they keep the previous behavior.

## Background safety and cleanup

Only the top modal host is interactive. Other body children, including
body-portaled navigation, become inert. A body-child observer also blocks
background surfaces mounted after opening. Previous inert states are restored
after the last modal closes; closing a child leaves its parent modal active.

Older WKWebView versions without native `inert` receive capture-phase
background pointer/click/focus protection in addition to Radix's accessibility
and focus handling. All listeners are removed when no managed modal remains.
`modal={false}` does not opt a component into background blocking.

Managed centered dialogs get a viewport-height scrolling fallback, with
caller-specified overflow/max-height classes retaining precedence. Sheets and
drawers keep their existing sizing. No form handlers, payloads, validation,
search logic, persistence or native keyboard configuration are changed.

## Verification

- `npm run build` compiles production assets, runs the existing 72-layout
  progress guard, then runs the shared foundation browser guard.
- `npm run check:modal-foundation` uses actual app components with isolated auth
  and service responses; no account data is accessed or written.
- Checks cover five mobile/landscape sizes and desktop, focus containment, scroll reach,
  primary-action hit testing, actual form/list payloads, failed save/retry,
  nested cancellation, draft preservation, half-star input, spoilers, busy
  state, skip, dropdown/select/popover/submenus, trigger focus restoration,
  late-mounted body controls, StrictMode, unmanaged/non-modal behavior and
  simulated absence of native inert.
- `npm run check:modal-foundation:webkit` runs the same checks in WebKit when
  the host has Playwright's required WebKit system libraries.
- `node scripts/check-modal-foundation.mjs --serve` serves the isolated fixture
  locally on port 5001 for screenshots; **do not add public forwarding**.

### Native verification boundary

Capacitor `KeyboardResize.Native` and existing keyboard hooks are unchanged.
No JavaScript visual-viewport repositioning, keyboard offsets, global focus
scrolling, Xcode changes, deployment or native release is part of this work.

Chromium short-viewports and focused inputs are not an actual iOS keyboard.
WebKit desktop testing is also not installed-device proof. Verify opening,
typing, scrolling, switching inputs, dismissal, nested confirmation and reopen
in an installed iOS build before approving a native release. WebKit cannot
currently launch in this workspace because required system libraries are
missing; this must be reported, not counted as a passing check.

## Next migration groups — not approved by this pass

- Remaining shared modal consumers, checking any Tooltip, HoverCard, ContextMenu
  or other separately portaled controls before opting them in.
- Custom profile overlays (Edit Profile, Add Friend, Highlights, DNA survey).
- Custom Feed, Play, sharing and post-detail overlays.
- Full-screen/non-modal experiences remain separate; no blanket conversion.
