# Tracker dropdown pointer-restoration failure

## Evidence

The user-supplied Vercel log reports a timeout clicking Navigation action after
the tracker saves. Its decoded diagnostic report establishes:

- No dialog remained.
- The background root was no longer inert.
- Both body and root still computed `pointer-events: none`.
- The real navigation click was intercepted by html.
- No browser runtime errors were reported.

This is different from the previous stale toast expectation.

## Reproduction and cause

The isolated fixture renders the actual tracker, dialog and dropdown components
with synthetic authentication/transport. Lengthening only the dropdown's closing
animation to two seconds reproduces the same blocked-body state.

A temporary, fixture-only trace of the installed Radix dismissable layer showed:

1. Dialog and menu both acquired the body pointer lock.
2. Closing the menu changed its outside-pointer disabling flag to false while
   its closing element remained registered.
3. The dialog cleaned up while that menu was still registered, so it did not
   restore the original body value.
4. The closing menu subsequently unmounted with its disabling flag false, so
   it also did not restore the body value.
5. Both registrations were gone, but body pointer events remained disabled.

The trace was removed after investigation. No dependency code was edited.
This establishes a cleanup-order failure; it does not establish that Vercel
always takes longer to animate or that every deployment encounters this order.

## Narrow correction

Only the tracker's action dropdown uses `modal={false}`. Its existing owning
dialog continues to block background interaction and trap focus. The dropdown
no longer acquires a redundant page-level pointer lock. Standalone menus and
other dialogs were not changed. There is no global pointer-style reset.

## Regression and checks

The modal build gate retains the real, unforced navigation click and now forces
the longer child exit. This test failed against the unchanged tracker with the
same html interception, then passed with the correction.

It also checks that background focus is blocked with the menu open, Escape
closes only the menu, the review survives, and saving releases body pointer
blocking. The inline-error and exactly-once retry checks remain in place.

Measured locally:

- TypeScript check passed.
- Full `npm run build` passed, including all three browser build gates.
- Progress gate passed 72 layouts and its interaction/negative controls.
- Modal gate passed 30 layouts and its interaction/negative controls.
- Profile safety menu gate passed all its layouts and controls.
- Modal diagnostic/readiness tests passed 7/7.

Diagnostics now include body/root pointer styles in their short summary, so
future failed builds show this state without requiring full payload decoding.

No Git operations, Vercel connection, settings changes or deployment were made.
A successful Vercel production result still requires the user's normal manual
push and subsequent remote verification.
