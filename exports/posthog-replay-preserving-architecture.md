# Replay-preserving controlled PostHog ingestion

## Decision and status

Preserve the full PostHog JavaScript SDK, session replay, SDK autocapture,
existing masking, consent behavior, and attribution on both Consumed surfaces.
Do not use custom click/change/submit tracking as a substitute.

This is a source-verified architecture candidate, not a tested implementation
or release approval. No publishing, token rotation, controlled-mode activation,
recording deletion, or recording-setting changes are authorized.

## Smallest candidate

One shared, replay-aware ingestion gateway in the existing Supabase backend,
plus a small SDK adapter and an upload-authorization/session ledger. Keep the
same PostHog project. Extend the existing gateway's identity infrastructure
rather than adding a second analytics provider, a replay implementation, or an
SDK fork. Reuse the narrow service-authenticated database event producer.

The gateway must be demonstrably capable of the SDK's replay payload sizes,
compression, throughput and unload behavior; existing single-event limits are
not suitable evidence. Reconsider hosting only if measured constraints require it.

Architecture review: acceptable for a disposable protocol prototype only.
Not approved for production; lifecycle, delivery and security contracts below
still require implementation and end-to-end verification.

Flow:

    Unmodified SDK capture/replay engine
      -> before_send adds scoped upload authorization
      -> controlled gateway validates every event/chunk
      -> gateway removes authorization and supplies provider token/identity
      -> existing PostHog project

### 1. Keep the SDK and its semantics

Retain one active full-SDK recorder for each current identity context. Preserve
SDK events, replay snapshots, timestamps, event UUIDs, pageview/session/window
correlation, first-touch and repeat-visitor behavior, and existing privacy
settings. Anonymous continuity needs an explicit persistent signed guest
identity; an in-memory guest identity that changes on each reload is not enough.

Use the documented api_host and before_send integration points. Start only
after upload authorization is available. Do not globally disable replay or
remote configuration that supplies recording/masking/sampling settings.

### 2. Bind upload authorization to the identity at capture time

Issue a purpose-scoped, expiring upload lease after validating the active
Supabase session and exact live UUID, or a server-signed anonymous identity.
Bind it to an audience, identity epoch and authorized SDK session/window
context. The exact lifetimes and renewal grace require queue/offline testing.

before_send is synchronous: snapshot an already-issued immutable lease there;
never fetch or renew it asynchronously inside that hook. Include a recorder
context nonce. Atomically first-claim observed session/window pairs in the
ledger, or bind known IDs when issuing authorization; never reassign a claimed
pair to another identity.

Specify capture validity and a separate bounded upload deadline. Revocation
and tombstones override all grace periods immediately. Client timestamps are
not proof of capture time. Expiry, overflow and offline behavior must be
measured against the existing SDK; additional loss is a release blocker, not
an implicitly approved analytics tradeoff.

Attach the lease in an isolated outer event property via before_send, including
on $snapshot. Never modify rrweb $snapshot_data to carry authorization.
The lease is a credential, but is neither the Supabase access token nor the
PostHog project token. It must not appear in URLs, logs, SDK debug output,
recorded network request bodies, persistent SDK super-properties or upstream
PostHog data. Audit recording/network-capture configuration explicitly.
Exclude ingestion/authorization routes and the lease from replay network
body/header capture. Do not indiscriminately disable existing network analytics.

Beacon can carry the body even though it cannot carry our custom auth headers.
Do not globally replace navigator.sendBeacon or monkey-patch fetch.

### 3. Enforce authorization server-side

Validate every event and replay chunk before forwarding: lease authenticity,
expiry, audience, epoch revocation, live account and deletion tombstone.
Derive the provider identity from the verified lease, never a client selector.
Validate the event's session/window binding against the server ledger.
An A-owned session must never be accepted as B-owned or anonymous.

Decode supported envelopes/compression with bounded resource use. Handle every
item in a batch independently and define partial-rejection/retry semantics;
never authorize a whole batch using only its first item. Preserve event UUIDs
for deduplication. Strip the lease before upstream transmission.

Permanently rejected items must not poison valid items in the same batch.
After valid items are successfully forwarded, acknowledge the batch and keep
only sanitized rejection counters. Define retry/deduplication for partial
upstream failure before claiming delivery equivalence; preserve original
event UUIDs and test actual replay retry behavior, not just HTTP status codes.

Do not recursively sanitize rrweb DOM/snapshot content with the existing
generic identity-field sanitizer. Validate known protocol identity fields,
and preserve masked replay content unchanged.

No missing/invalid authenticated context may fall back to anonymous capture.
New accounts with new UUIDs remain independent of deleted accounts, even if
they reuse an email address.

### 4. Cover the complete SDK protocol

Strictly allowlist and test SDK event ingestion, replay ingestion (/s/),
required configuration/flag requests, and recorder assets. Preserve applicable
recording settings. Rewrite token-bearing paths and provider endpoints safely.

Read-only static assets/configuration are not generic ingest proxies; classify
them separately. Identity-sensitive configuration must use verified identity.
No arbitrary upstream URL, redirect, identity API, alias, group mutation or
unvalidated alternate ingestion path may be exposed.

The replacement provider token stays server-side. Check response bodies,
headers, URLs, scripts, caches and source maps for leaks. Do not forward a
token-bearing remote configuration response blindly.

### 5. Make identity transitions explicit

On logout, deletion or A-to-B login, stop/retire the old recorder context,
handle old queues under their original immutable identity, and establish a new
session/epoch before recording the new context. Never update a shared lease
variable and thereby stamp old buffered snapshots with B's authorization.

Late or revoked A chunks must be rejected, not relabeled. Guest-to-account
linking must be server-authorized from both verified contexts; no arbitrary
alias/merge passthrough. Exact SDK lifecycle sequencing remains to be tested.
Retire the linked guest epoch after guest-to-account association. Logout or
deletion must create a fresh anonymous recorder identity rather than revive
a guest ID previously merged into the account.

Deletion needs an ingestion barrier: stop new authorized dispatches, account
for already in-flight requests, and define how cleanup handles uploads accepted
before the tombstone but processed by PostHog afterward. Do not claim a local
tombstone lookup alone proves no post-cleanup recreation. Provider processing
and read-back behavior must establish the barrier/settling procedure.

### 6. Close the old direct-provider path only at approved cutover

After updated app/native and marketing paths pass, a separately approved
same-project token reset closes old embedded-token capture. A normal reverse
proxy alone does not do this. No historical data is deleted by this migration.

Unupdated native builds cannot retain direct capture with a revoked token.
Preserving replay features for updated releases is achievable in principle;
guaranteeing continued analytics from every unchanged old build while also
invalidating its token is not. Rotation must remain blocked pending the
explicit release/old-build impact decision.

## Evidence

- PostHog documents reverse proxies for SDK/replay traffic:
  https://posthog.com/docs/advanced/proxy
- Replay has separate capture infrastructure and larger payload requirements:
  https://posthog.com/docs/how-posthog-works/recordings-ingestion
- Replay architecture sends $snapshot data to /s/:
  https://posthog.com/handbook/engineering/session-replay/session-replay-architecture
- Public JavaScript SDK configuration:
  https://posthog.com/docs/libraries/js
- App SDK 1.352.0, inspected locally: lazy-loaded-session-recorder.js
  _captureSnapshot calls capture('$snapshot', ...); posthog-core.js capture
  then runs before_send. request-queue.js forces sendBeacon on unload.
- Marketing SDK 1.430.3, downloaded from the public npm registry into /tmp
  without installing/changing dependencies: the same snapshot -> capture ->
  before_send path exists, and unload still selects sendBeacon.

These establish stock-SDK hook compatibility, not end-to-end correctness.
The lease, session ledger and deletion enforcement are custom application
security controls, not a built-in PostHog deletion-suppression feature.

## Required validation before activation

1. Run real SDK/rrweb browser tests for both exact versions, not handcrafted
   snapshots alone. Compare behavioral properties and replay playback against
   the existing integration using synthetic pages and fixtures.
2. Verify both marketing origins, app web, and actual supported iOS webviews.
3. Verify authenticated and anonymous replay playback in the same project;
   preserve pageview/event correlation, masking, attribution and visitor
   continuity. Check no upload credential enters replay or analytics.
4. Exercise Beacon unload, backgrounding, payload limits, compressed batches,
   offline/renewal/retry behavior and partial batch rejection.
5. Exercise A-to-B, logout, guest-to-account and deletion while snapshots are
   buffered or in flight. Reject attempts to reuse A's session/window IDs as B.
6. Exercise the real authenticated deletion flow with realistic A/B controls,
   late event AND replay uploads, and supported provider read-back. Separately
   establish the bounded treatment of uploads already accepted before deletion.
7. Audit all network paths, including GTM-loaded behavior, remote configuration,
   recorder assets and redirects. Assert no direct provider capture or token leaks.
8. Test revocation behavior for events and replay in an isolated disposable
   project before any separately approved production-token reset.
9. Review migration ordering, default-off controls and cutover/forward-repair
   procedures. The previously passing event-only tests do not satisfy this gate.

## Marketing handoff

Keep the staged flag off and do not publish. Preserve the original SDK path.
Retain useful production-mode test tooling, but supersede the custom-autocapture
replacement with the shared full-SDK adapter once its protocol is reviewed.
Do not implement a separate security protocol independently in that project.