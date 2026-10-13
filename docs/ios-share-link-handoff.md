# iPhone share-link verification

## Current status

The uploaded 1.0.9 build 29 archive lacks ordinary media-link delivery and
cold-launch recovery. It uses packaged assets, so a website update does not
update that binary. This does not establish which build is installed today.

The current source now shares a single delivery coordinator between the early
native listener and the mounted router. It retains deferred links during
startup, authentication, onboarding and recovery, and does not replay a stale
launch URL after a newer incoming link. Signed-out public media links remain
allowed. Existing authentication and consent mechanisms remain in place.

Local verification passed:

- `npm test` (450 tests, including delivery and native-auth regressions)
- `npm run check`
- `npm run build`
- `node scripts/test-native-share-delivery.mjs` (actual early listener source,
  mounted React handler, coordinator and Wouter; simulated native transport
  and auth state, not real iPhone or real identity-service verification)
- `node --test scripts/test-native-share-packaging.mjs`
- `node scripts/test-share-compatibility.mjs` (10 public-sharing scenarios)
- Current production bundle passed the shared-link marker check.

**Native assets are now prepared and verified in this workspace.**
`npm run prepare:ios` passed all 20 focused tests, built the application,
verified the shared-link implementation, and copied it into the iOS project.
All 39 built files matched their copied files by hash. The native configuration
uses packaged assets. No new Xcode archive was produced or installed, and
physical-device behavior has not been verified.

## Scope

No analytics code, configuration or secrets were changed. An older unrelated
release note was not verified as a current blocker and is not a prerequisite
for this share-link work. Existing preparation safeguards passed without
bypassing or modifying them.

## Mac handoff

1. Bring the approved source, including these share-link changes, onto your
   Mac using your normal manual Git process. Agent performs no Git networking.
2. In the project folder, with existing dependencies and authorized build
   configuration available:

   ```sh
   npm run check
   npm test
   npm run prepare:ios
   ```

   Preparation now runs focused link/auth regression tests and source-wiring
   checks, builds the web app, rejects a bundle missing shared-link delivery,
   and copies it into iOS. It then checks every built file's hash against the
   copied file and rejects remote-web-root configuration. Existing analytics
   safeguards are retained. If preparation stops, do not skip its checks.
3. Open the existing workspace:

   ```sh
   open ios/App/App.xcworkspace
   ```

4. Use existing signing/team settings. Select the connected iPhone and use
   Product > Run to install this candidate. Do not test only the previously
   installed release. No signing, version or build-number changes were made
   here. Before distributing an archive, use your normal version/build process
   and inspect the resulting archive's bundled files.

## Physical iPhone test matrix

Send this exact HTTPS link in Messages:

`https://app.consumedapp.com/media/movie/tmdb/1236045`

Tap it from Messages, not by pasting into Safari's address bar.

| State | Expected result |
| --- | --- |
| App force-closed, signed in | Opens Consumed on Animals, not Now |
| App already running on Now | Opens Animals inside Consumed |
| App signed out | Opens public Animals detail without forcing login |
| Tap a different media link after Animals | Opens the newly tapped title; no return to Animals |
| Account requires identity setup | Required setup stays enforced; intended media destination resumes afterward |
| Media link arrives during password recovery | Reset flow remains primary; media resumes after leaving recovery |
| Normal Google/Apple sign-in and password reset | Existing flows still complete, with no media routing interference |

Ordinary media links must not open an added Safari/Capacitor Browser window.
Without the app installed, the HTTPS link must retain normal website fallback.
Record the tested candidate's version/build, each observed result and any
failure. Code/packaging checks alone cannot mark this matrix passed.
