# Portable PostHog replay-prototype adapter handoff

## Status and scope

This is a **default-off disposable protocol prototype**, not a production
integration or an edit to the separate marketing project. The app-side
implementation is in `client/src/lib/posthog-replay-prototype.ts`; its isolated
harness is intentionally not imported by the app's legacy `posthog.ts`.

Use only an explicit build value:

```text
VITE_POSTHOG_REPLAY_PROTOTYPE=true
```

Absent, `false`, uppercase variants, and every other value remain off. There
is no activation environment variable, no deployment action, no token rotation,
and no live recording/flag/settings change in this handoff.

## Portable integration

Copy the reusable factory (not the application harness) into the marketing
project and pass that project's `posthog-js` singleton plus a reviewed lease
provider:

```ts
const adapter = createReplayPrototypeAdapter(posthog, {
  issueLease: async ({ sessionId, windowId }) => {
    // POST /api/replay-prototype/lease with both IDs and audiences
    // ["event", "replay"], then return the opaque lease plus this context.
    return gatewayLeaseOrNull;
  },
});

if (isReplayPrototypeEnabled(import.meta.env)) {
  adapter.initialize();
  await adapter.startRecorderEpoch();
}
```

The factory uses only public SDK APIs shared by the inspected app
`posthog-js` 1.352.0 and marketing `posthog-js` 1.430.3:
`init`, `set_config`, `onSessionId`, `get_session_id`,
`startSessionRecording`, `stopSessionRecording`, and `reset`. It does not
implement custom click tracking, replace autocapture, or monkey-patch
`fetch`/`sendBeacon`.

The SDK is initialized with placeholder `consumed_replay_prototype` and
`api_host: /api/replay-prototype`. The gateway must classify the standard SDK
event/replay/config paths under that base, including replay `/s/`; it is not an
event-only endpoint.

## Behavior retained by design

The adapter supplies only:

- `api_host`,
- `debug: false`, so the SDK does not print a lease-bearing envelope,
- a replay network mask that excludes **only** `/api/replay-prototype` uploads,
- `before_send`.

It intentionally does **not** set autocapture, pageview, pageleave, replay
disablement, masking, consent, attribution/referrer persistence, persistence,
remote configuration/decide/flags, batching, compression, or transport. Thus
the stock full SDK and its applicable remote settings continue to determine
those behaviors. Do not add `advanced_disable_decide`, `disable_session_recording`,
or a bespoke event transport when porting it.

`before_send` synchronously copies the normal event's `properties` and adds
`__consumed_upload_lease` there, including for `$snapshot`. It never changes
`$snapshot_data`/rrweb content. Prototype gateway uploads are omitted from
replay's network capture, so the lease does not recur into recording data.

## Epoch transitions and authorization gap

The provided provider interface is deliberately dependency-injected until the
gateway contract is reviewed:

```ts
type ReplayPrototypeLeaseProvider = {
  issueLease(context: {
    sessionId: string;
    windowId: string;
  }): Promise<{
    value: string; // opaque gateway lease, currently leaseId.secret
    recorderEpoch: string;
    expiresAt: number;
    context: { sessionId: string; windowId: string };
  } | null>;
}
```

The current factory has no Supabase import and does not acquire or place any
Supabase credential in an event. The provider must return only the opaque
gateway lease, never a Supabase JWT, and must retain the exact context it sent
to `/lease`. The adapter intentionally does not impose a `prototype.*` prefix:
that would conflict with the reviewed local gateway's opaque `leaseId.secret`
format. Replace neither the provider nor its server-derived identity binding
with browser-side user identity selection before security review.

At an identity/context boundary it calls `stopSessionRecording`, retires the
active recorder, resets the SDK, obtains a new pair, then starts recording only
after the new lease is installed. The one synchronous `before_send` router
selects an immutable lease by the event's exact session/window pair: delayed A
data stays A and is never relabeled B. This client ordering is not a substitute
for server lease, session/window-ledger, revocation, expiry, batch, retry,
deletion-barrier, or upstream token-stripping enforcement.

Critically, `before_send` also requires each captured event's
`$session_id`/`$window_id` to equal the immutable pair retained with that
lease. This catches the real late-buffer failure mode where rrweb invokes
`instance.capture` for raw A data only after the SDK instance has installed
B's current `before_send`. It is rejected locally rather than receiving B's
lease when no A route exists; while A's original unexpired route exists, it is
stamped only with A's lease. The gateway independently rejects reused A pairs.

## Renewal, session rotation, and known delivery limit

The adapter keeps a public `onSessionId` subscription for the harness
lifetime. It renews before the opaque lease expiry and serializes issuance
requests with a generation check. An older response cannot overwrite a newer
SDK session/window context. An ordinary renewal for the same pair replaces
only that immutable routing entry; it does **not** reset the SDK or restart a
new B identity context. When the SDK itself rotates its session/window pair,
the adapter requests a second lease without resetting and routes delayed A
snapshots only through A's unexpired lease.

An explicit account/auth switch is different: it stops recording, increments
the issuance generation, resets the SDK to obtain a fresh pair, then requests
the new account context. It clears all local A routes before stopping the
recorder, so delayed raw A capture is blocked locally and can never be mapped
to B. An already-stamped/queued A request remains an SDK queue concern and
must be rejected or admitted only by server epoch revocation and dispatch
rules; this unwired prototype does not claim to drain or preserve it.

While a fresh pair's lease request is pending, events for that pair are
blocked rather than labeled with a different context. The adapter does not
invent a browser-side raw replay buffer: `before_send` cannot later replay an
arbitrary SDK event without changing its UUID/timestamp/session semantics.
Issuance failures call `onAuthorizationError`; retry is capped (default two)
and an explicit `retryLease()` is available. Once a route's lease reaches
`expiresAt`, the hook removes it, reports `lease_expired`, and blocks further
events for that pair. This is a visible fail-closed delivery gap, **not** a
claim of offline/unload preservation or successful analytics continuity.

The currently coordinated gateway contract uses one five-minute `expiresAt`
for capture and upload (`captureExpiresAt` and `uploadDeadline` are presently
the same value). It does not yet provide a separate capture deadline or
post-capture upload grace. Therefore old chunks are only routable while their
original lease is unexpired, and behavior across offline, beacon unload, and
provider retry is unresolved/release-blocking rather than preserved.
In particular, integration of server epoch revocation with already-stamped SDK
queues is still unwired and must be proven before any production use; default
off means this carries no live production capture risk today.

## Required gateway expectation

The counterpart is `/api/replay-prototype`. For every independently decoded
event/chunk it must validate the synthetic/reviewed lease, audience, expiry,
recorder epoch, and session/window ownership; remove
`properties.__consumed_upload_lease` before forwarding; and preserve the rest
of the event, including rrweb data and event UUID. It must reject rather than
fall back to anonymous identity. The route and its request body must remain
excluded from replay network capture.

The local gateway contract is now documented in
`exports/replay-prototype-contract.md`. It confirms `/lease`, `/e/`, `/s/`,
and `/decide/` route names; opaque `leaseId.secret` values; per-item
session/window validation; and removal of the lease before forwarding. Before
any non-synthetic use, still validate exact compression, beacon/unload,
partial-batch, retry, recorder asset, and provider response behavior in a
real browser.