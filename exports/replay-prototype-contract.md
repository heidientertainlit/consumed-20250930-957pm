# Replay prototype gateway contract (local/staged only)

This is a disposable, **default-off** protocol prototype.  It is not wired into
the deployed `posthog-capture` function, does not alter the existing direct
capture behavior, and is not production-ready without a durable ledger and
end-to-end SDK/replay validation.

## Shared names

The protocol exports these exact constants from
`supabase/functions/_shared/replay-prototype-protocol.ts`:

- `REPLAY_PROTOTYPE_PREFIX = "/api/replay-prototype"`
- `REPLAY_PROTOTYPE_LEASE_PROPERTY = "__consumed_upload_lease"`
- `REPLAY_PROTOTYPE_PUBLIC_PLACEHOLDER = "consumed_replay_prototype"`
- `REPLAY_PROTOTYPE_EVENT_PATH = "/api/replay-prototype/e/"`
- `REPLAY_PROTOTYPE_SNAPSHOT_PATH = "/api/replay-prototype/s/"`
- `REPLAY_PROTOTYPE_LEASE_PATH = "/api/replay-prototype/lease"`
- `REPLAY_PROTOTYPE_CONFIG_PATH = "/api/replay-prototype/decide/"`
- `REPLAY_PROTOTYPE_FLAGS_PATH = "/api/replay-prototype/flags/"`
- `REPLAY_PROTOTYPE_REMOTE_CONFIG_PATH =
  "/api/replay-prototype/array/consumed_replay_prototype/config"`
- `REPLAY_PROTOTYPE_REMOTE_CONFIG_SCRIPT_PATH =
  "/api/replay-prototype/array/consumed_replay_prototype/config.js"`
- `REPLAY_PROTOTYPE_RECORDER_ASSET_PATHS =
  ["/api/replay-prototype/static/lazy-recorder.js"]`

The SDK adapter must synchronously copy an already-issued opaque upload lease
to the outer event `properties.__consumed_upload_lease` in `before_send`.
It must never write the lease into `$snapshot_data` / rrweb data, URLs,
super-properties, or provider-bound requests. `consumed_replay_prototype` is
only the public disabled-route placeholder; it is not a credential or provider
token.

## Routes and response behavior

Only the exact paths above and the explicitly enumerated recorder asset paths
are handled. `POST /lease` authenticates through injected first-party
dependencies and returns an opaque, expiring lease bound to its subject, epoch,
audience, and supplied SDK session/window pairs. `POST /e/` and `POST /s/`
accept bounded JSON/form SDK envelopes, gzip bodies, and base64 `data`
envelopes. Every batch item supplies its own outer lease.

`/e/` requires audience `event`; `/s/` requires audience `replay`. A batch can
partially succeed: rejected items are counted without returning credentials or
event bodies, while independently valid items are forwarded. Provider identity
comes only from the verified lease. The gateway removes the lease and client
identity/token fields before forwarding, while leaving rrweb snapshot content
untouched.

`/decide/`, `/flags/`, and the two fixed current-SDK remote-config paths are
first-party authenticated configuration endpoints, not generic proxies. They
accept only dependency-provided values in a strict SDK-key allowlist. Any
credential field/value (including an embedded provider token or token-bearing
URL), redirect field, external endpoint, or unsupported key rejects the entire
response rather than silently truncating settings. The only external recorder
dependency path exposed for SDK
1.352.0/1.430.3 is `/static/lazy-recorder.js` (with an optional ignored cache
query); `array.full.js` itself already bundles the recorder. Asset routes
cannot select an upstream URL, and source maps are not exposed.

The allowlist currently covers the replay recording controls exercised by this
prototype: session sampling, masking selectors, network payload capture,
`urlTriggers`/`urlBlocklist` regex match rules, and the fixed lazy recorder.
A URL is accepted only as a bounded inert `urlTriggers`/`urlBlocklist` matcher;
it is never a dispatch route. Any unrecognized current/future remote-config
field fails closed with `Configuration rejected`. That is an explicit release
blocker pending schema review, not a claim of full SDK configuration parity.

## Required production replacement

`InMemoryReplayPrototypeLedger` is deliberately marked `TEST_ONLY` and throws
when constructed with a production environment. It is useful only in local
browser harnesses and unit tests. Production activation requires an
authoritative durable implementation of `ReplayPrototypeLedger` that makes
context claims, revocation/tombstones, dispatch admission, and deletion
in-flight draining atomic with the account lifecycle. No such implementation,
deployment, migration, provider delete, recording-setting change, or token
rotation is supplied here.

The five-minute prototype lease timing is a fail-closed local default, not an
approved offline/unload retention policy. Provider retry/deduplication,
real-recording playback, and the provider-side portion of a deletion barrier
remain unresolved until the durable implementation and real SDK tests exist.