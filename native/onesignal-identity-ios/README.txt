OneSignal iOS native status
===========================

The app now pins the official `OneSignalXCFramework` 5.6.1 release in
`ios/App/Podfile.lock`. The official Cordova npm package is pinned to
`onesignal-cordova-plugin` 5.5.7 (Git tag commit
`4761f62204a6604a09e5b2cdfcd6470635d2c711`). The iOS SDK evidence is from
tag commit `25977b771746b80db32da4e5f5cd8b1086707301`. The public-header
snapshot and verifier in `scripts/verify-onesignal-identity-native.mjs` are
checked-in evidence from those releases.

The released iOS 5.6.1 public headers expose:

* `+[OneSignal login:withToken:]`
* `-[OSUser onJwtExpiredWithExpiredHandler:]`

They do **not** expose the newer:

* `addUserJwtInvalidatedListener`
* `removeUserJwtInvalidatedListener`
* `updateUserJwt:withToken:`

The expiry callback is not an asynchronous Cordova event contract. The
released Swift interface marks its completion `SWIFT_NOESCAPE`, and the
released implementation calls that completion inline from
`OneSignalUserManagerImpl.fireJwtExpired()` before the handler returns. A
Cordova callback cannot fetch a server JWT with `fetch()` and later retain or
invoke that non-escaping completion. Retaining it would violate the released
SDK contract; dispatching to JavaScript and returning would leave the SDK's
pending operation without a token. No request-ID/epoch shim can make that
completion safe.

The current npm Cordova wrapper also exposes only its one-argument
`login(externalId)` JavaScript wrapper. No generated Capacitor source is
modified as a native implementation because `ios/capacitor-cordova-ios-plugins`
is ignored and recreated by `cap sync`. No known-invalid Objective-C symbols
are shipped.

Therefore iOS native Identity Verification is **blocked**, not compatible or
released. Keep `VITE_ONESIGNAL_IDENTITY_VERIFICATION` false. A future native
change must select a released SDK whose public headers contain the complete
documented invalidation/update API, or implement and compile a safe bridge
against an API whose completion is explicitly escaping/asynchronous (or use a
reviewed native synchronous token provider). Linux cannot perform that Xcode
verification, and this repository does not claim the blocked bridge exists.