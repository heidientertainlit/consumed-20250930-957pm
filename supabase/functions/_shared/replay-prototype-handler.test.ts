import assert from "node:assert/strict";
import test from "node:test";
import {
  handleReplayPrototypeRequest,
  type ReplayPrototypeGatewayDependencies,
} from "./replay-prototype-handler.ts";
import { InMemoryReplayPrototypeLedger } from "./replay-prototype-ledger.ts";
import {
  REPLAY_PROTOTYPE_CONFIG_PATH,
  REPLAY_PROTOTYPE_EVENT_PATH,
  REPLAY_PROTOTYPE_FLAGS_PATH,
  REPLAY_PROTOTYPE_LEASE_PATH,
  REPLAY_PROTOTYPE_LEASE_PROPERTY,
  REPLAY_PROTOTYPE_REMOTE_CONFIG_PATH,
  REPLAY_PROTOTYPE_REMOTE_CONFIG_SCRIPT_PATH,
  REPLAY_PROTOTYPE_SNAPSHOT_PATH,
  type ReplayPrototypeIdentity,
} from "./replay-prototype-protocol.ts";

const accountA: ReplayPrototypeIdentity = {
  kind: "account",
  subject: "11111111-1111-4111-8111-111111111111",
  epoch: "account-a-epoch-1",
};
const accountB: ReplayPrototypeIdentity = {
  kind: "account",
  subject: "22222222-2222-4222-8222-222222222222",
  epoch: "account-b-epoch-1",
};
const guestA: ReplayPrototypeIdentity = {
  kind: "guest",
  subject: "guest:server-signed-persistent-a",
  epoch: "guest-a-epoch-1",
};

function context(sessionId = "session-a", windowId = "window-a") {
  return { sessionId, windowId };
}

function event(
  lease: string,
  sessionId = "session-a",
  windowId = "window-a",
  name = "clicked",
): Record<string, unknown> {
  return {
    event: name,
    uuid: "018f2e4c-7a65-7cc8-8f21-123456789abc",
    properties: {
      $session_id: sessionId,
      $window_id: windowId,
      [REPLAY_PROTOTYPE_LEASE_PROPERTY]: lease,
    },
  };
}

function fixture(
  overrides: Partial<ReplayPrototypeGatewayDependencies> = {},
) {
  const ledger = new InMemoryReplayPrototypeLedger({ environment: "test" });
  const forwarded: Array<{ route: string; payload: Record<string, unknown> }> = [];
  let sequence = 0;
  const dependencies: ReplayPrototypeGatewayDependencies = {
    enabled: true,
    ledger,
    providerToken: "server-only-provider-token",
    now: () => 1_800_000_000_000,
    randomBytes: (size) => Uint8Array.from({ length: size }, (_, index) => index + ++sequence),
    authenticateFirstPartyRequest: async (request) => {
      switch (request.headers.get("x-test-identity")) {
        case "a":
          return accountA;
        case "b":
          return accountB;
        case "guest":
          return guestA;
        default:
          return null;
      }
    },
    checkLiveIdentity: async () => "live",
    forward: async (route, payload) => {
      forwarded.push({ route, payload: payload as unknown as Record<string, unknown> });
      return { ok: true };
    },
    ...overrides,
  };
  return { dependencies, ledger, forwarded };
}

async function issue(
  dependencies: ReplayPrototypeGatewayDependencies,
  identity: "a" | "b" | "guest",
  contexts = [context()],
  audiences = ["event", "replay"],
): Promise<string> {
  const response = await handleReplayPrototypeRequest(
    new Request(`https://harness.test${REPLAY_PROTOTYPE_LEASE_PATH}`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-test-identity": identity },
      body: JSON.stringify({ audiences, contexts }),
    }),
    dependencies,
  );
  assert.equal(response.status, 200);
  return (await response.json() as { upload_lease: string }).upload_lease;
}

test("is default-off and exposes only the public placeholder", async () => {
  const local = fixture({ enabled: undefined });
  const response = await handleReplayPrototypeRequest(
    new Request(`https://harness.test${REPLAY_PROTOTYPE_EVENT_PATH}`, { method: "POST" }),
    local.dependencies,
  );
  assert.equal(response.status, 404);
  assert.deepEqual(await response.json(), { error: "consumed_replay_prototype" });
});

test("validates every item of a mixed SDK batch and preserves rrweb data untouched", async () => {
  const local = fixture();
  const lease = await issue(local.dependencies, "a");
  const acceptedSnapshot = event(lease, "session-a", "window-a", "$snapshot");
  (acceptedSnapshot.properties as Record<string, unknown>).$snapshot_data = {
    node: { [REPLAY_PROTOTYPE_LEASE_PROPERTY]: "inside-rrweb-must-remain" },
  };
  const invalid = event("not-a-lease", "session-a", "window-a", "$snapshot");
  const response = await handleReplayPrototypeRequest(
    new Request(`https://harness.test${REPLAY_PROTOTYPE_SNAPSHOT_PATH}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ batch: [acceptedSnapshot, invalid] }),
    }),
    local.dependencies,
  );
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { accepted: 1, rejected: 1 });
  assert.equal(local.forwarded.length, 1);
  const payload = local.forwarded[0].payload;
  assert.equal(payload.api_key, "server-only-provider-token");
  const providerEvent = (payload.batch as Record<string, unknown>[])[0];
  const properties = providerEvent.properties as Record<string, unknown>;
  assert.equal(properties[REPLAY_PROTOTYPE_LEASE_PROPERTY], undefined);
  assert.equal(properties.distinct_id, accountA.subject);
  assert.deepEqual(properties.$snapshot_data, {
    node: { [REPLAY_PROTOTYPE_LEASE_PROPERTY]: "inside-rrweb-must-remain" },
  });
});

test("enforces symmetric e/s event type routing for every mixed-batch item", async () => {
  const local = fixture();
  const lease = await issue(local.dependencies, "a");
  const normalEvent = event(lease, "session-a", "window-a", "ordinary_event");
  const replayEvent = event(lease, "session-a", "window-a", "$snapshot");
  (replayEvent.properties as Record<string, unknown>).$snapshot_data = { type: 2 };

  const mixedEventRoute = await handleReplayPrototypeRequest(
    new Request(`https://harness.test${REPLAY_PROTOTYPE_EVENT_PATH}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ batch: [normalEvent, replayEvent] }),
    }),
    local.dependencies,
  );
  assert.equal(mixedEventRoute.status, 200);
  assert.deepEqual(await mixedEventRoute.json(), { accepted: 1, rejected: 1 });
  const eventBatch = local.forwarded[0].payload.batch as Record<string, unknown>[];
  assert.equal(eventBatch.length, 1);
  assert.equal(eventBatch[0].event, "ordinary_event");

  const nonSnapshotOnReplayRoute = await handleReplayPrototypeRequest(
    new Request(`https://harness.test${REPLAY_PROTOTYPE_SNAPSHOT_PATH}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ batch: [normalEvent] }),
    }),
    local.dependencies,
  );
  assert.equal(nonSnapshotOnReplayRoute.status, 400);
  assert.equal(local.forwarded.length, 1);
});

test("supports gzip and base64 SDK envelopes within bounded decoding", async (t) => {
  if (typeof CompressionStream === "undefined") {
    t.skip("CompressionStream is unavailable in this runtime");
    return;
  }
  const local = fixture();
  const lease = await issue(local.dependencies, "a");
  const source = new Blob([JSON.stringify({ batch: [event(lease)] })])
    .stream().pipeThrough(new CompressionStream("gzip"));
  const gzip = await new Response(source).arrayBuffer();
  const compressed = await handleReplayPrototypeRequest(
    new Request(`https://harness.test${REPLAY_PROTOTYPE_EVENT_PATH}`, {
      method: "POST",
      headers: { "content-type": "application/json", "content-encoding": "gzip" },
      body: gzip,
    }),
    local.dependencies,
  );
  assert.equal(compressed.status, 200);

  const encodedSnapshot = event(lease, "session-a", "window-a", "$snapshot");
  (encodedSnapshot.properties as Record<string, unknown>).$snapshot_data = { type: 2 };
  const base64 = btoa(JSON.stringify({ batch: [encodedSnapshot] }));
  const encoded = await handleReplayPrototypeRequest(
    new Request(`https://harness.test${REPLAY_PROTOTYPE_SNAPSHOT_PATH}`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: `data=${encodeURIComponent(base64)}`,
    }),
    local.dependencies,
  );
  assert.equal(encoded.status, 200);
  assert.equal(local.forwarded.length, 2);
  assert.deepEqual(local.forwarded.map((entry) => entry.route), ["e", "s"]);
});

test("does not leak lease, client credentials, or client identity upstream", async () => {
  const local = fixture();
  const lease = await issue(local.dependencies, "a");
  const captured = event(lease);
  (captured.properties as Record<string, unknown>).authorization = "Bearer browser-secret";
  (captured.properties as Record<string, unknown>).distinct_id = accountB.subject;
  const response = await handleReplayPrototypeRequest(
    new Request(`https://harness.test${REPLAY_PROTOTYPE_EVENT_PATH}?token=browser-token`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: "Bearer browser-secret",
      },
      body: JSON.stringify(captured),
    }),
    local.dependencies,
  );
  assert.equal(response.status, 200);
  const providerEvent = (local.forwarded[0].payload.batch as Record<string, unknown>[])[0];
  const properties = providerEvent.properties as Record<string, unknown>;
  assert.equal(properties[REPLAY_PROTOTYPE_LEASE_PROPERTY], undefined);
  assert.equal(properties.authorization, undefined);
  assert.equal(properties.distinct_id, accountA.subject);
  const forwarded = JSON.stringify(local.forwarded);
  assert.equal(forwarded.includes("browser-secret"), false);
  assert.equal(forwarded.includes(lease), false);
});

test("returns complete safe first-party configuration without adding provider credentials", async () => {
  const local = fixture({
    publicConfiguration: async () => ({
      sessionRecording: {
        maskAllInputs: true,
        maskTextSelector: "[data-legacy-mask]",
        sampleRate: "1",
        masking: {
          maskAllInputs: true,
          maskTextSelector: "[data-mask]",
          blockSelector: ".private",
        },
        networkPayloadCapture: {
          recordBody: { request: false, response: false },
          recordHeaders: false,
        },
        urlTriggers: [{
          url: "https://consumedapp.com/(discover|play).*",
          matching: "regex",
        }],
        urlBlocklist: [{
          url: "https://consumedapp.com/private/.*",
          matching: "regex",
        }],
      },
    }),
  });
  const response = await handleReplayPrototypeRequest(
    new Request(`https://harness.test${REPLAY_PROTOTYPE_CONFIG_PATH}`, {
      headers: { "x-test-identity": "a" },
    }),
    local.dependencies,
  );
  assert.equal(response.status, 200);
  const config = await response.json() as Record<string, unknown>;
  assert.deepEqual(config, {
    sessionRecording: {
      maskAllInputs: true,
      maskTextSelector: "[data-legacy-mask]",
      sampleRate: "1",
      masking: {
        maskAllInputs: true,
        maskTextSelector: "[data-mask]",
        blockSelector: ".private",
      },
      networkPayloadCapture: {
        recordBody: { request: false, response: false },
        recordHeaders: false,
      },
      urlTriggers: [{
        url: "https://consumedapp.com/(discover|play).*",
        matching: "regex",
      }],
      urlBlocklist: [{
        url: "https://consumedapp.com/private/.*",
        matching: "regex",
      }],
    },
  });
  assert.equal(JSON.stringify(config).includes("server-only-provider-token"), false);
});

test("rejects whole configuration objects with embedded secrets, secret keys, redirects, or external endpoints", async () => {
  const unsafeConfigurations = [
    { analytics: { endpoint: "https://provider.example/e/" } },
    { sessionRecording: { redirect_url: "https://provider.example/?token=ACTUAL" } },
    { sessionRecording: { [`url_server-only-provider-token`]: "safe-looking" } },
    { sessionRecording: { source: "https://provider.example/?token=server-only-provider-token" } },
    { sessionRecording: { networkPayloadCapture: { routing_url: "/e/" } } },
    {
      sessionRecording: {
        urlTriggers: [{
          url: "https://consumedapp.com/?token=server-only-provider-token",
          matching: "regex",
        }],
      },
    },
  ];
  for (const unsafe of unsafeConfigurations) {
    const local = fixture({ publicConfiguration: async () => unsafe });
    const response = await handleReplayPrototypeRequest(
      new Request(`https://harness.test${REPLAY_PROTOTYPE_CONFIG_PATH}`, {
        headers: { "x-test-identity": "a" },
      }),
      local.dependencies,
    );
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), { error: "Configuration rejected" });
  }
});

test("recorder assets are fixed-path only and cannot leak the provider token", async () => {
  const requested: string[] = [];
  const local = fixture({
    loadRecorderAsset: async (name) => {
      requested.push(name);
      return new Response("self.recorder = true", {
        headers: {
          "content-type": "application/javascript",
          location: "https://provider.example/redirect-should-be-ignored",
        },
      });
    },
  });
  const redirecting = await handleReplayPrototypeRequest(
    new Request("https://harness.test/api/replay-prototype/static/lazy-recorder.js?v=1.352.0"),
    local.dependencies,
  );
  assert.equal(redirecting.status, 502);
  assert.deepEqual(requested, ["lazy-recorder.js"]);

  const unknown = await handleReplayPrototypeRequest(
    new Request("https://harness.test/api/replay-prototype/static/recorder.js"),
    local.dependencies,
  );
  assert.equal(unknown.status, 404);
  assert.deepEqual(requested, ["lazy-recorder.js"]);

  const tokenAsset = fixture({
    loadRecorderAsset: async () => new Response("server-only-provider-token"),
  });
  const leaked = await handleReplayPrototypeRequest(
    new Request("https://harness.test/api/replay-prototype/static/lazy-recorder.js"),
    tokenAsset.dependencies,
  );
  assert.equal(leaked.status, 502);
});

test("serves only actual SDK flags and remote-config paths with safe response keys", async () => {
  const local = fixture({
    publicConfiguration: async () => ({
      sessionRecording: { sampleRate: "1", maskAllInputs: true },
      supportedCompression: ["gzip", "base64"],
      scriptConfig: { script: "lazy-recorder" },
    }),
    publicFlags: async () => ({
      featureFlags: { prototype_flag: true },
      featureFlagPayloads: { prototype_flag: { value: "safe" } },
    }),
  });
  const headers = { "x-test-identity": "a" };
  const flags = await handleReplayPrototypeRequest(
    new Request(`https://harness.test${REPLAY_PROTOTYPE_FLAGS_PATH}?v=2`, {
      method: "POST",
      headers,
      body: JSON.stringify({ token: "public-placeholder-is-not-trusted" }),
    }),
    local.dependencies,
  );
  assert.equal(flags.status, 200);
  assert.deepEqual(await flags.json(), {
    flags: {},
    featureFlags: { prototype_flag: true },
    featureFlagPayloads: { prototype_flag: { value: "safe" } },
  });

  const config = await handleReplayPrototypeRequest(
    new Request(`https://harness.test${REPLAY_PROTOTYPE_REMOTE_CONFIG_PATH}`, { headers }),
    local.dependencies,
  );
  assert.equal(config.status, 200);
  assert.deepEqual(await config.json(), {
    sessionRecording: { sampleRate: "1", maskAllInputs: true },
    supportedCompression: ["gzip", "base64"],
    scriptConfig: { script: "lazy-recorder" },
  });

  const shim = await handleReplayPrototypeRequest(
    new Request(`https://harness.test${REPLAY_PROTOTYPE_REMOTE_CONFIG_SCRIPT_PATH}`, { headers }),
    local.dependencies,
  );
  assert.equal(shim.status, 200);
  assert.match(shim.headers.get("content-type") || "", /application\/javascript/);
  assert.equal((await shim.text()).includes("server-only-provider-token"), false);
});

test("fails closed when A's SDK session/window is reused by B", async () => {
  const local = fixture();
  await issue(local.dependencies, "a", [context("shared-session", "shared-window")]);
  const response = await handleReplayPrototypeRequest(
    new Request(`https://harness.test${REPLAY_PROTOTYPE_LEASE_PATH}`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-test-identity": "b" },
      body: JSON.stringify({
        audiences: ["event"],
        contexts: [context("shared-session", "shared-window")],
      }),
    }),
    local.dependencies,
  );
  assert.equal(response.status, 409);
});

test("a failed multi-context lease claim does not poison an earlier context", async () => {
  const local = fixture();
  await issue(local.dependencies, "a", [context("owned", "window")]);
  const rejected = await handleReplayPrototypeRequest(
    new Request(`https://harness.test${REPLAY_PROTOTYPE_LEASE_PATH}`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-test-identity": "b" },
      body: JSON.stringify({
        audiences: ["event"],
        contexts: [
          context("unclaimed-before-conflict", "window"),
          context("owned", "window"),
        ],
      }),
    }),
    local.dependencies,
  );
  assert.equal(rejected.status, 409);
  const bLease = await issue(
    local.dependencies,
    "b",
    [context("unclaimed-before-conflict", "window")],
    ["event"],
  );
  assert.match(bLease, /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
});

test("deletion begun after validation but before dispatch admission fails closed", async () => {
  const ledger = new InMemoryReplayPrototypeLedger({ environment: "test" });
  let deleteDuringLiveCheck = false;
  const local = fixture({
    ledger,
    checkLiveIdentity: async (identity) => {
      if (deleteDuringLiveCheck && identity.subject === accountA.subject) {
        deleteDuringLiveCheck = false;
        await ledger.beginDeletion(accountA.subject);
      }
      return "live";
    },
  });
  const lease = await issue(local.dependencies, "a");
  deleteDuringLiveCheck = true;
  const response = await handleReplayPrototypeRequest(
    new Request(`https://harness.test${REPLAY_PROTOTYPE_EVENT_PATH}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(event(lease)),
    }),
    local.dependencies,
  );
  assert.equal(response.status, 400);
  assert.equal(local.forwarded.length, 0);
});

test("permit completion is idempotent and releases a deletion waiter once", async () => {
  const ledger = new InMemoryReplayPrototypeLedger({ environment: "test" });
  const permit = await ledger.beginDispatch(accountA, "test-lease");
  assert.ok(permit);
  let deleted = false;
  const deletion = ledger.beginDeletion(accountA.subject).then(() => {
    deleted = true;
  });
  await ledger.finishDispatch(permit);
  await ledger.finishDispatch(permit);
  await deletion;
  assert.equal(deleted, true);
  assert.equal(await ledger.beginDispatch(accountA, "another-lease"), null);
});

test("fails closed at expiry and audience boundaries", async () => {
  let currentTime = 1_800_000_000_000;
  const local = fixture({ now: () => currentTime });
  const eventOnlyLease = await issue(local.dependencies, "a", [context()], ["event"]);
  currentTime += 5 * 60_000;
  const expired = await handleReplayPrototypeRequest(
    new Request(`https://harness.test${REPLAY_PROTOTYPE_EVENT_PATH}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(event(eventOnlyLease)),
    }),
    local.dependencies,
  );
  assert.equal(expired.status, 400);

  currentTime = 1_800_000_000_000;
  const freshEventOnlyLease = await issue(local.dependencies, "a", [context("s2", "w2")], ["event"]);
  const wrongAudience = await handleReplayPrototypeRequest(
    new Request(`https://harness.test${REPLAY_PROTOTYPE_SNAPSHOT_PATH}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(event(freshEventOnlyLease, "s2", "w2", "$snapshot")),
    }),
    local.dependencies,
  );
  assert.equal(wrongAudience.status, 400);
  assert.equal(local.forwarded.length, 0);
});

test("deletion barrier blocks buffered A sends, drains inflight A, and leaves B independent", async () => {
  let releaseForward: (() => void) | undefined;
  let beganForward: (() => void) | undefined;
  const forwardStarted = new Promise<void>((resolve) => {
    beganForward = resolve;
  });
  const waitForward = new Promise<void>((resolve) => {
    releaseForward = resolve;
  });
  const local = fixture({
    forward: async () => {
      beganForward?.();
      await waitForward;
      return { ok: true };
    },
  });
  const leaseA = await issue(local.dependencies, "a");
  const leaseB = await issue(local.dependencies, "b", [context("session-b", "window-b")]);
  const inflightA = handleReplayPrototypeRequest(
    new Request(`https://harness.test${REPLAY_PROTOTYPE_EVENT_PATH}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(event(leaseA)),
    }),
    local.dependencies,
  );
  await forwardStarted;
  let deletionFinished = false;
  const deletion = local.ledger.beginDeletion(accountA.subject).then(() => {
    deletionFinished = true;
  });
  const bufferedA = await handleReplayPrototypeRequest(
    new Request(`https://harness.test${REPLAY_PROTOTYPE_EVENT_PATH}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(event(leaseA)),
    }),
    local.dependencies,
  );
  assert.equal(bufferedA.status, 400);
  assert.equal(deletionFinished, false);

  const bSend = handleReplayPrototypeRequest(
    new Request(`https://harness.test${REPLAY_PROTOTYPE_EVENT_PATH}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(event(leaseB, "session-b", "window-b")),
    }),
    local.dependencies,
  );
  releaseForward?.();
  assert.equal((await inflightA).status, 200);
  assert.equal((await bSend).status, 200);
  await deletion;
  assert.equal(deletionFinished, true);
});

test("revocation burns a guest epoch immediately", async () => {
  const local = fixture();
  const lease = await issue(local.dependencies, "guest");
  await local.ledger.revokeEpoch(guestA);
  const response = await handleReplayPrototypeRequest(
    new Request(`https://harness.test${REPLAY_PROTOTYPE_EVENT_PATH}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(event(lease)),
    }),
    local.dependencies,
  );
  assert.equal(response.status, 400);
  assert.equal(local.forwarded.length, 0);
});