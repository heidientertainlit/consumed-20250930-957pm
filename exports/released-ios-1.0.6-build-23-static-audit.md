# Released iOS archive audit — 1.0.6 (23)

Date: 2026-09-14. Read-only static inspection; migration remains paused.

## Artifact and provenance

The user identifies this archive as the archive uploaded for the currently
distributed App Store release. Both archive metadata and the packaged app's
Info.plist independently agree on:

- Version: 1.0.6
- Build: 23
- Native bundle identifier: com.entertainlit.consumed
- Archive creation: 2026-05-09 04:07:29 UTC
- Architecture recorded by the archive: arm64

The App Store Connect selected-build relationship is user-supplied provenance,
not an independent Apple API verification. This Xcode archive is not the
Apple-processed, re-signed App Store download.

Original ZIP SHA-256, identical before and after inspection:

`38aa8b2d863adee94f1c1ae0e60cf965f645f6bed726baee08bf068689e6e0cd`

Packaged public/assets/index-CaV02rpq.js SHA-256:

`c5e9f00c63fe6905be8f349bdc2cc7d5ffdd54c81dce59f793235900250605d0`

Inspection read ZIP entries without modifying them. Sanitized text copies were
used in /tmp. No archive code was executed, built, signed, distributed, or
uploaded. No production requests, test activity, telemetry queries, settings
changes, token rotation, or deletion operations were performed.

## Verified static findings

### Token and initialization

- The existing workspace VITE_POSTHOG_KEY was compared without displaying or
  saving its value. There were zero exact UTF-8 or UTF-16LE matches across all
  non-metadata archive file entries, including the native executable and JS.
- No file contained a `phc_` token prefix. Prefix absence alone is not proof
  about all possible token formats or encodings.
- More importantly, the bundled PostHog singleton is constructed but unused
  by app code. The minified singleton identifier `xF` occurs only in its
  declaration and assignment `xF=cg[SA]=new Xg`. The registry `cg` is used only
  by SDK internals and DOM-ready handling. Its constructor starts with
  `__loaded=false`; no app call supplies a token or calls init.
- No app calls to that SDK's identify, capture, or reset were found. The two
  app-level "PostHog identify" messages are console logs following a Supabase
  users lookup, not SDK identification calls.
- The current production project's token was not independently fetched or
  revalidated. The exact negative comparison above is against the existing
  workspace-configured reference, not a new live settings audit.

### SDK and session recording

- The bundled SDK declares `LIB_VERSION:"1.352.0"`.
- SDK defaults include the US ingestion host, autocapture enabled,
  disable_session_recording=false, external dependency loading permitted,
  and opt_out_capturing_by_default=false. These are dormant library defaults,
  not proof of active app configuration or consent behavior.
- Session-recording control and remote-configuration support are included.
  The wrapper checks for both __PosthogExtensions__.rrweb.record and
  initSessionRecording; otherwise it requests an external dependency.
- The recorder script defaults to `lazy-recorder`, subject to remote config.
  The wrapper delegates actual recording to the extension's factory. The
  actual rrweb recorder payload was not found in the packaged JS/assets.
- No app-level recording/masking override or project-specific recording
  configuration was found. SDK-level masking defaults must not be treated as
  a claim that this release actually recorded unmasked data.
- No functioning recording session, remote recording settings response,
  replay upload, or playback was observed; no runtime test was performed.

### Identity and account lifecycle

| State | Packaged app behavior |
| --- | --- |
| Before login | No app-level PostHog initialization or identity assignment. |
| Restored session / login | Looks up user profile and logs "PostHog identify"; no SDK identify call. Starts a separate first-party session tracker using the Supabase account UUID. |
| Logout | Calls Supabase signOut. SIGNED_OUT handling calls OneSignal logout and ends the first-party session tracker. No PostHog reset or capture shutdown call. |
| Delete account | Requires two confirmations and an existing session; POSTs to the app's delete-account Edge Function with session authorization. On HTTP success, shows success, awaits Supabase signOut, and schedules /login navigation. No PostHog reset, provider deletion, or provider-suppression call. |

The separate tracker writes account-linked user_sessions/user_events records
through Supabase; it is not the PostHog SDK. These operations may feed server
analytics, but the archive does not contain or prove the current backend
processing behavior.

Deletion error handling: missing session prevents the request; non-2xx
responses enter the error path. A resolved `{ error }` from signOut is ignored
in the deletion handler and still allows the redirect to be scheduled; a
thrown/rejected signOut enters the outer catch. This is a static observation,
not a tested deletion failure and not a fix authorization.

### Packaged asset loading

The packaged HTML loads the packaged JS bundle. Capacitor config has no
server.url override or live-update configuration. Startup unregisters service
workers. No packaged live-update mechanism was identified.

The HTML also references external fonts and the Replit development-banner
script. Their remote contents were not fetched or inspected. Archive review
therefore does not certify every possible runtime-loaded script.

## Inference, not runtime proof

The inspected app's own bundled integration is expected not to produce direct
PostHog SDK capture, identity changes, or session replay, because its SDK is
never initialized. This does not establish that the account produces no
server-side PostHog data, that other app versions behave identically, or that
every installed device has this release and unchanged runtime state.

## Effect on previous cleanup assumptions

The earlier generic expectation that the released iOS app embeds the accepted
PostHog token and directly uploads to PostHog must not be applied to this
archive. The static evidence contradicts that premise for its packaged app
integration. Token rotation is therefore not established as necessary to stop
direct PostHog uploads from this particular build.

This does not authorize rotation or establish safe provider cleanup. Other
native versions, web/marketing clients, backend producers, in-flight requests,
and OneSignal remain separate questions. The complete provider cleanup gate
has not passed. No architecture changes or migration implementation followed
from this audit.

## Unverified

- Independent Apple upload/selected-build linkage and processed Store binary.
- Current production token/settings independently of workspace references.
- Actual device traffic, replay activity, identity payloads and logout queues.
- Real post-deletion traffic or provider acceptance/recreation.
- Server-side analytics identity and current provider processing.
- Other installed releases and runtime-loaded external script behavior.