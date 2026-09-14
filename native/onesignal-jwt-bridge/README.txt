OneSignal native bridge requirements
====================================

No Android project exists in this repository. No Android source patch is
shipped. The previous draft patch was removed because it had incomplete
hunks and was not compiled. Android Identity Verification remains blocked.

Before an Android build can be enabled, the first generated project must pin
the official OneSignal Android SDK at 5.9.0 or newer (the checked source
evidence is tag commit `fed76c44b73557fc9d0bf529a8cd3a7f15c0b9b7`) and expose these
documented APIs from its maintained Cordova bridge:

* `OneSignal.login(externalId, jwtBearerToken)`
* `OneSignal.updateUserJwt(externalId, token)`
* `OneSignal.addUserJwtInvalidatedListener(IUserJwtInvalidatedListener)`
* `UserJwtInvalidatedEvent.getExternalId()`

The npm registry package check was read-only: official
`onesignal-cordova-plugin` 5.5.7 still exposes only the one-argument Cordova
login wrapper and no JWT bridge actions. Upgrading the wrapper alone is
therefore not evidence of an Android-compatible bridge.

No provider toggle is changed. The client flag remains off unless
`VITE_ONESIGNAL_IDENTITY_VERIFICATION=true` is deliberately set, and that
value must remain false while Android native support is blocked.