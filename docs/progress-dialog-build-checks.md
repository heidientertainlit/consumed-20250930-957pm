# Progress dialog build checks

`npm run build` now ends with `npm run check:progress-dialogs`. A covered or
off-screen progress action fails the build rather than passing compilation.

The check renders the actual shared progress component and the active progress
markup from Collections and Media Detail, using the production CSS. It checks
normal navigation and the elevated Add composer, phone/landscape/desktop sizes,
short keyboard-sized windows, focused inputs, scrolling, save callbacks, and
removal confirmation/cancellation. Negative controls deliberately cover or move
the button off-screen to verify that the guard detects these regressions.

All fixture authentication and service responses are isolated. No real account,
library write, or provider request is needed.

## Running locally or in CI

- `npm run build` compiles the app and runs the gate.
- `npm run check:progress-dialogs` reruns the gate against the existing build CSS.
- After building, `node scripts/check-progress-dialogs.mjs --serve` keeps the
  isolated fixture available on port 5001 for visual inspection.

The check uses the existing Playwright dependency. Its command installs/caches
Playwright's Chromium headless shell on first use. Build machines need download
access on first use and Playwright-compatible browser system libraries; an
unavailable browser fails explicitly rather than silently skipping validation.

This guard covers progress dialogs, not every modal in the app. When adding a
new progress entry point, include its real markup/component in the check.
Short-window browser tests are not proof of installed iOS keyboard animation
behavior; that still requires device verification. No native keyboard resizing
settings are changed by this fix.
