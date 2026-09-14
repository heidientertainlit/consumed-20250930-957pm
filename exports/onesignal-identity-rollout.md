# OneSignal Identity Verification rollout report

## Review hold

This is the server/scaffolding and evidence stage only. Native Identity
Verification is **blocked**, not compatible or released. The OneSignal
provider-side **Token Identity Verification** toggle was not enabled, no
OneSignal key was generated or rotated, and no provider deletion/cleanup mode
was enabled. No real provider calls, user cleanup, native distribution, or
endpoint deployment were performed.

The client flag is default-off:

```text
VITE_ONESIGNAL_IDENTITY_VERIFICATION=true
```

An absent value (the current value) keeps the existing native push permission,
notification handlers, and one-argument `OneSignal.login(UUID)` path.

## Server architecture

JWT claim names were checked against the current OneSignal Identity
Verification documentation
(`https://documentation.onesignal.com/docs/en/identity-verification`) and
the native declarations were checked against released SDK source. No provider
account was accessed.

`supabase/functions/onesignal-identity-jwt` accepts only an authenticated
empty-body `POST`. It:

1. validates the bearer token with Supabase Auth and derives the UUID from that
   verified session;
2. checks the exact `public.users.id` row immediately before issuance;
3. optionally calls a configured safe deletion-tombstone RPC
   (`ONESIGNAL_IDENTITY_TOMBSTONE_RPC`). A configured RPC error or non-boolean
   result denies issuance; there is no silent fallback;
4. signs the current UUID only with ES256, using the OneSignal app ID as `iss`
   and the official `identity.external_id` claim; and
5. returns a 120-second token. The implementation rejects any TTL above 180
   seconds.

The private key is read only from
`ONESIGNAL_IDENTITY_VERIFICATION_PRIVATE_KEY` as PKCS#8 PEM. It is not in the
repository, frontend bundle, test output, or logs. `ONESIGNAL_APP_ID` is
server-side configuration even though the public OneSignal app ID remains
present in the existing native initializer.

The queue/tombstone migration is not assumed to be deployed. Until the future
safe RPC is explicitly configured, the authoritative live `public.users` check
and Supabase Auth verification are the required deny boundary. An old signed
Auth token cannot issue after Auth/public-user deletion. Email and
caller-supplied UUIDs are never selectors; a later signup with the same email
has a different UUID and is independent.

## Native bridge decision

The reproducibly pinned artifacts are:

| Surface | Current | Identity-compatible path |
| --- | --- | --- |
| Cordova wrapper | `onesignal-cordova-plugin` `5.5.7` in `package.json`/lockfile | Official registry/GitHub source still exposes only one-argument Cordova `login`; no JWT bridge actions are claimed |
| iOS SDK | `OneSignalXCFramework` `5.6.1` in `ios/App/Podfile.lock` | Public headers expose `login:withToken:` and `onJwtExpiredWithExpiredHandler:` only; the documented invalidation/update API is absent, so native IV is blocked |
| Android SDK | No Android project or shipped native SDK | Not shipped; requirements only |

Version status is deliberately split: Cordova `5.5.7` tag commit
`4761f62204a6604a09e5b2cdfcd6470635d2c711` and iOS SDK `5.6.1` tag commit
`25977b771746b80db32da4e5f5cd8b1086707301` are staged dependency pins and
header/source evidence, not a claim that native Identity Verification is
compatible. The recommended release remains blocked until a released iOS
SDK exposes a safe asynchronous invalidation/update contract and an Xcode
build verifies the eventual checked-in bridge. Android has no staged native
version.

The exact iOS public-header evidence is checked in at
`native/onesignal-identity-ios/OneSignal-5.6.1-public-interface.h`, with its
release-source URLs and declarations. The verifier is
`scripts/verify-onesignal-identity-native.mjs`, runnable as
`npm run check:onesignal-native`. It explicitly rejects claims that 5.6.1
contains `updateUserJwt` or the newer invalidation-listener declarations.

The remaining iOS lifecycle API is not a safe JavaScript bridge substitute:
the 5.6.1 header marks the completion passed to
`onJwtExpiredWithExpiredHandler:` as `SWIFT_NOESCAPE`, and the released
`OneSignalUserManagerImpl.fireJwtExpired()` source invokes that completion
inline before returning. A server JWT fetch through Cordova `fetch()` is
asynchronous. Retaining the completion for a later request would violate the
SDK contract; returning before JavaScript supplies a token leaves the SDK
operation without its required token. This is the concrete blocker, rather
than a missing Xcode binary in this workspace. No request-ID/epoch shim can
make a non-escaping completion safely asynchronous.

The Android native filesystem/project is absent. The invalid patch artifact was
removed; `native/onesignal-jwt-bridge/README.txt` is requirements-only and
does not claim implementation. Official Android 5.9.0 source requirements are
`login(externalId, jwtBearerToken)`, `updateUserJwt(externalId, token)`, and
the invalidation listener/event APIs, with `minSdkVersion 21`. The checked
source tag commit is `fed76c44b73557fc9d0bf529a8cd3a7f15c0b9b7`.

The iOS app's CocoaPods deployment target is 15.0. The current app project has
some stale per-configuration 14.0 settings, so native release configuration
must be normalized to iOS 15.0 before distribution. No Android app minimum OS
is declared in this repository; the official Android SDK 5.9.0 source declares
`minSdkVersion 21` (Android 5.0), so a future app must use API 21 or newer and
verify its final Gradle setting. Do not claim native compatibility from this
Linux workspace.

Existing push initialization, notification click handling, foreground
handlers, permission prompts, and the public app ID were not removed. Old
installed builds continue their current push/login behavior because the server
feature flag, client native-bridge availability, and provider toggle remain
off. No enforcement behavior is claimed for old builds.

## Client lifecycle and race safety

`client/src/lib/onesignal-identity.ts` requests the JWT with an empty body and
the current Supabase access token, but the native availability constant is
explicitly false until the complete released bridge exists. If the env flag is
mistakenly set while blocked, it throws an explicit error rather than
silently falling back to legacy login. With the flag absent, existing login
behavior is unchanged.

`client/src/lib/onesignal-identity-refresh.ts` is a future-use, serialized
refresh helper. It rechecks the auth subject and epoch before/after both token
fetch and native update, retries at most twice, drops stale A results before
native update, serializes stale-provider cleanup if the subject changes after
an update, and has no legacy-login fallback. It is not wired to native events
while the released iOS SDK lacks the required APIs.

No claim is made that a short-lived JWT revokes an already-issued token or
terminates an active native session. Set the minimum app version only after
the compatible iOS and Android builds are distributed. Recommended rollout:

1. do not set the flag or provider toggle;
2. select a released iOS SDK whose public headers contain a complete
   invalidation/update contract with an explicitly escaping/asynchronous
   completion (or approve a native synchronous token provider), implement the
   bridge in a checked-in plugin source, and compile it with Xcode;
3. only then distribute a bridge-containing native release and designate it as
   the minimum app version;
4. use a 120-second TTL and wait at least the maximum issued lifetime (180
   seconds, plus an operational safety margin) before any key cleanup or
   rotation; and
5. request separate approval before enabling the OneSignal dashboard toggle.

## Tests and blocked validation

The disposable TypeScript harness
`supabase/functions/_shared/onesignal-identity.test.ts` covers:

- ES256 issue/decode/verify round trip with a synthetic key;
- the 180-second maximum and expiry;
- rejection of an expired cached token;
- app/UUID subject mismatch;
- invalid-auth rejection before account lookup;
- empty-body/auth-derived identity;
- deleted `public.users` row denial;
- tombstone denial and fail-closed RPC errors; and
- caller-supplied UUID rejection; and
- same-email/new-UUID independence after an old UUID is deleted.

The existing
`client/src/lib/provider-identity-transition.test.ts` continues to cover the
queued A→B race and before/after subject rechecks. Synthetic keys and UUIDs in
these tests are disposable fixtures, not real-user impersonation.

`client/src/lib/onesignal-identity-refresh.test.ts` covers bounded transient
retry, stale-token rejection before native update, and queued A→B refresh
serialization. `npm run check:onesignal-native` checks the exact package/Pod
pins and public-header declarations.

Native compilation cannot be claimed here: Xcode/iOS SDK, an Android project,
and two real disposable devices are unavailable in this Linux workspace. The
checked-in iOS evidence is header/source verification, not a compiled bridge.
Provider-side toggle behavior, cached-token behavior on real devices, and full
target/control cleanup remain blocked pending a compatible native release,
provider readiness, credentials, and separate approval.