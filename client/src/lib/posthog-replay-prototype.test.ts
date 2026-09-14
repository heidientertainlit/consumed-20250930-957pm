import assert from 'node:assert/strict';
import test from 'node:test';
import {
  REPLAY_PROTOTYPE_GATEWAY,
  REPLAY_PROTOTYPE_LEASE_PROPERTY,
  REPLAY_PROTOTYPE_PLACEHOLDER_TOKEN,
  createReplayPrototypeAdapter,
  excludePrototypeGatewayFromReplay,
  isReplayPrototypeEnabled,
  type IssuedReplayPrototypeLease,
  type PostHogEventEnvelope,
  type ReplayPrototypeSdk,
} from './posthog-replay-prototype';

type RecordedCall = { method: string; value?: unknown; token?: string };

function fakeSdk() {
  const calls: RecordedCall[] = [];
  let initConfig: Record<string, unknown> | undefined;
  let latestConfig: Record<string, unknown> | undefined;
  const contexts = [
    { sessionId: 'session-a', windowId: 'window-a' },
    { sessionId: 'session-b', windowId: 'window-b' },
    { sessionId: 'session-c', windowId: 'window-c' },
  ];
  let contextIndex = -1;
  const listeners = new Set<(sessionId: string, windowId: string) => void>();
  const sdk: ReplayPrototypeSdk = {
    init: (_token, config) => {
      initConfig = config;
      calls.push({ method: 'init', token: _token, value: config });
    },
    set_config: (config) => {
      latestConfig = config;
      calls.push({ method: 'set_config', value: config });
    },
    reset: () => {
      contextIndex += 1;
      calls.push({ method: 'reset' });
    },
    get_session_id: () => contexts[contextIndex]?.sessionId || '',
    onSessionId: (callback) => {
      listeners.add(callback);
      const context = contexts[contextIndex];
      if (context) callback(context.sessionId, context.windowId);
      return () => listeners.delete(callback);
    },
    startSessionRecording: () => calls.push({ method: 'startSessionRecording' }),
    stopSessionRecording: () => calls.push({ method: 'stopSessionRecording' }),
  };
  return {
    sdk,
    calls,
    initConfig: () => initConfig!,
    beforeSend: () => (latestConfig?.before_send || initConfig?.before_send) as
      | ((event: PostHogEventEnvelope) => PostHogEventEnvelope | null)
      | undefined,
    rotateSession: (sessionId: string, windowId: string) => {
      const index = contexts.findIndex(
        (context) => context.sessionId === sessionId && context.windowId === windowId,
      );
      contextIndex = index;
      for (const listener of listeners) listener(sessionId, windowId);
    },
  };
}

const leaseA: IssuedReplayPrototypeLease = {
  value: 'lease-a.secret-a',
  recorderEpoch: 'epoch-a',
  expiresAt: 1_900_000_000_000,
  context: { sessionId: 'session-a', windowId: 'window-a' },
};
const leaseB: IssuedReplayPrototypeLease = {
  value: 'lease-b.secret-b',
  recorderEpoch: 'epoch-b',
  expiresAt: 1_900_000_100_000,
  context: { sessionId: 'session-b', windowId: 'window-b' },
};

function testAdapter(
  sdk: ReplayPrototypeSdk,
  issueLease: (context: { sessionId: string; windowId: string }) => Promise<IssuedReplayPrototypeLease | null>,
) {
  return createReplayPrototypeAdapter(sdk, { issueLease }, {
    // Unit tests explicitly fire renewal callbacks where relevant; do not
    // retain a real Node timer for the lease's multi-minute lifetime.
    schedule: () => null,
  });
}

function fakeClock(start = 1_000) {
  let current = start;
  let nextId = 0;
  const timers = new Map<number, { due: number; callback: () => void }>();
  return {
    now: () => current,
    schedule: (callback: () => void, delayMs: number) => {
      const id = nextId++;
      timers.set(id, { due: current + delayMs, callback });
      return id;
    },
    cancel: (handle: unknown) => timers.delete(handle as number),
    advance: async (milliseconds: number) => {
      current += milliseconds;
      const due = [...timers.entries()]
        .filter(([, timer]) => timer.due <= current)
        .sort((left, right) => left[1].due - right[1].due);
      for (const [id, timer] of due) {
        timers.delete(id);
        timer.callback();
      }
      await Promise.resolve();
      await Promise.resolve();
    },
  };
}

async function settle() {
  await new Promise<void>((resolve) => setImmediate(resolve));
}

test('prototype flag is exact true and defaults off', () => {
  assert.equal(isReplayPrototypeEnabled(undefined), false);
  assert.equal(isReplayPrototypeEnabled({}), false);
  assert.equal(isReplayPrototypeEnabled({ VITE_POSTHOG_REPLAY_PROTOTYPE: 'false' }), false);
  assert.equal(isReplayPrototypeEnabled({ VITE_POSTHOG_REPLAY_PROTOTYPE: 'true' }), true);
  assert.equal(isReplayPrototypeEnabled({ VITE_POSTHOG_REPLAY_PROTOTYPE: 'TRUE' }), false);
});

test('initialization keeps full SDK capture defaults and uses only the prototype gateway', () => {
  const fake = fakeSdk();
  const adapter = testAdapter(fake.sdk, async () => leaseA);

  adapter.initialize();

  assert.equal(fake.calls[0].method, 'init');
  assert.equal(fake.calls[0].token, REPLAY_PROTOTYPE_PLACEHOLDER_TOKEN);
  assert.equal(REPLAY_PROTOTYPE_PLACEHOLDER_TOKEN, 'consumed_replay_prototype');
  const config = fake.initConfig();
  assert.equal(config.api_host, REPLAY_PROTOTYPE_GATEWAY);
  assert.equal(config.debug, false);
  assert.equal(typeof config.before_send, 'function');
  // These omissions are intentional: PostHog's stock defaults and remote
  // configuration retain autocapture, replay, pageview/pageleave, attribution,
  // privacy/consent, persistence, batching, and compression behavior.
  for (const key of [
    'autocapture',
    'capture_pageview',
    'capture_pageleave',
    'disable_session_recording',
    'advanced_disable_decide',
    'advanced_disable_flags',
    'persistence',
    'request_batching',
    'disable_compression',
  ]) {
    assert.equal(key in config, false, `${key} must remain a stock SDK setting`);
  }
});

test('real PostHog snapshot envelope receives lease outside unchanged rrweb data', async () => {
  const fake = fakeSdk();
  const adapter = testAdapter(fake.sdk, async (context) => ({ ...leaseA, context }));
  adapter.initialize();
  assert.equal(await adapter.startRecorderEpoch(), true);

  // Shape mirrors PostHog JS replay capture: $snapshot is a normal SDK event,
  // with rrweb entries nested under properties.$snapshot_data.
  const rrwebSnapshot = [{ type: 2, timestamp: 1700000000000, data: { node: { id: 1, type: 0 } } }];
  const snapshot: PostHogEventEnvelope = {
    event: '$snapshot',
    uuid: '018f4a91-0a9f-7df5-9d0e-6c2d5ed85c5b',
    timestamp: '2026-01-01T00:00:00.000Z',
    properties: {
      $session_id: 'session-a',
      $window_id: 'window-a',
      $snapshot_data: rrwebSnapshot,
    },
  };
  const beforeSend = fake.beforeSend()!;
  const captured = beforeSend(snapshot)!;

  assert.equal(captured.properties!.$snapshot_data, rrwebSnapshot);
  assert.equal(
    captured.properties![REPLAY_PROTOTYPE_LEASE_PROPERTY],
    leaseA.value,
  );
  assert.equal(snapshot.properties![REPLAY_PROTOTYPE_LEASE_PROPERTY], undefined);
  assert.equal((captured as Record<string, unknown>).uuid, snapshot.uuid);
});

test('delayed raw A snapshot cannot receive B lease after B installs the current hook', async () => {
  const fake = fakeSdk();
  const adapter = testAdapter(fake.sdk, async (context) => (
      context.sessionId === 'session-a'
        ? { ...leaseA, context }
        : { ...leaseB, context }
    ));
  adapter.initialize();
  assert.equal(await adapter.startRecorderEpoch(), true);
  const beforeA = fake.beforeSend()!;
  const stampedA = beforeA({
    event: '$snapshot',
    properties: {
      $session_id: 'session-a',
      $window_id: 'window-a',
      $snapshot_data: [],
    },
  })!;

  assert.equal(await adapter.startRecorderEpoch(), true);
  const beforeB = fake.beforeSend()!;
  const methods = fake.calls.map(({ method }) => method);
  assert.deepEqual(methods.slice(-3), [
    'stopSessionRecording',
    'reset',
    'startSessionRecording',
  ]);
  assert.equal(
    stampedA.properties![REPLAY_PROTOTYPE_LEASE_PROPERTY],
    leaseA.value,
  );
  assert.equal(beforeA({
    event: '$snapshot',
    properties: {
      $session_id: 'session-a',
      $window_id: 'window-a',
      $snapshot_data: [],
    },
  }), null);
  // This models the real failure mode: rrweb had buffered A's raw event, then
  // invokes instance.capture after B installed its current before_send hook.
  // Explicit account retirement clears A routes: the current hook cannot
  // attach B to delayed raw A data (nor continue authorizing A locally).
  assert.equal(beforeB({
    event: '$snapshot',
    properties: {
      $session_id: 'session-a',
      $window_id: 'window-a',
      $snapshot_data: [],
    },
  }), null);
  assert.equal(
    beforeB({
      event: '$snapshot',
      properties: {
        $session_id: 'session-b',
        $window_id: 'window-b',
        $snapshot_data: [],
      },
    })!.properties![
      REPLAY_PROTOTYPE_LEASE_PROPERTY
    ],
    leaseB.value,
  );
});

test('prototype gateway network recording is excluded without modifying other requests', () => {
  const gatewayRequest = {
    name: 'https://app.consumed.example/api/replay-prototype/s/?ip=1',
    requestBody: '{"__consumed_upload_lease":"lease-a.secret-a"}',
  };
  const otherRequest = {
    name: 'https://api.consumed.example/v1/books',
    requestBody: '{"title":"Dune"}',
  };
  assert.equal(excludePrototypeGatewayFromReplay(gatewayRequest), undefined);
  assert.equal(excludePrototypeGatewayFromReplay(otherRequest), otherRequest);
});

test('opaque gateway lease format is not constrained by a client prototype prefix', async () => {
  const fake = fakeSdk();
  const adapter = testAdapter(fake.sdk, async (context) => ({ ...leaseA, context }));
  adapter.initialize();

  assert.equal(await adapter.startRecorderEpoch(), true);
  assert.equal(
    fake.beforeSend()!({
      event: '$pageview',
      properties: { $session_id: 'session-a', $window_id: 'window-a' },
    })!.properties![REPLAY_PROTOTYPE_LEASE_PROPERTY],
    'lease-a.secret-a',
  );
});

test('renewal before TTL keeps the same SDK context and does not reset recording', async () => {
  const fake = fakeSdk();
  const clock = fakeClock();
  let issued = 0;
  const adapter = createReplayPrototypeAdapter(fake.sdk, {
    issueLease: async (context) => ({
      value: `lease-${++issued}.secret`,
      recorderEpoch: `epoch-${issued}`,
      expiresAt: clock.now() + 1_000,
      context,
    }),
  }, {
    now: clock.now,
    schedule: clock.schedule,
    cancelScheduled: clock.cancel,
    renewBeforeMs: 100,
  });
  adapter.initialize();
  assert.equal(await adapter.startRecorderEpoch(), true);
  // Regression: scheduling a normal five-minute-scale lease must not invoke
  // renewal synchronously/microtask-loop before its timer is due.
  assert.equal(issued, 1);
  await clock.advance(900);

  assert.equal(issued, 2);
  assert.equal(fake.calls.filter((call) => call.method === 'reset').length, 1);
  assert.equal(
    fake.beforeSend()!({
      event: '$snapshot',
      properties: { $session_id: 'session-a', $window_id: 'window-a', $snapshot_data: [] },
    })!.properties![REPLAY_PROTOTYPE_LEASE_PROPERTY],
    'lease-2.secret',
  );
});

test('SDK session rotation leases a second context without resetting and preserves A routing', async () => {
  const fake = fakeSdk();
  const clock = fakeClock();
  const adapter = createReplayPrototypeAdapter(fake.sdk, {
    issueLease: async (context) => ({
      value: `lease-${context.sessionId}.secret`,
      recorderEpoch: `epoch-${context.sessionId}`,
      expiresAt: clock.now() + 10_000,
      context,
    }),
  }, {
    now: clock.now,
    schedule: clock.schedule,
    cancelScheduled: clock.cancel,
  });
  adapter.initialize();
  assert.equal(await adapter.startRecorderEpoch(), true);
  fake.rotateSession('session-b', 'window-b');
  await settle();

  assert.equal(fake.calls.filter((call) => call.method === 'reset').length, 1);
  const beforeSend = fake.beforeSend()!;
  assert.equal(
    beforeSend({
      event: '$snapshot',
      properties: { $session_id: 'session-a', $window_id: 'window-a', $snapshot_data: [] },
    })!.properties![REPLAY_PROTOTYPE_LEASE_PROPERTY],
    'lease-session-a.secret',
  );
  assert.equal(
    beforeSend({
      event: '$snapshot',
      properties: { $session_id: 'session-b', $window_id: 'window-b', $snapshot_data: [] },
    })!.properties![REPLAY_PROTOTYPE_LEASE_PROPERTY],
    'lease-session-b.secret',
  );
});

test('a stale B issuance response is discarded when SDK rotates again to C', async () => {
  const fake = fakeSdk();
  const clock = fakeClock();
  let resolveB!: (lease: IssuedReplayPrototypeLease) => void;
  let resolveC!: (lease: IssuedReplayPrototypeLease) => void;
  const calls: string[] = [];
  const adapter = createReplayPrototypeAdapter(fake.sdk, {
    issueLease: (context) => {
      calls.push(context.sessionId);
      if (context.sessionId === 'session-a') {
        return Promise.resolve({ ...leaseA, expiresAt: clock.now() + 10_000, context });
      }
      return new Promise((resolve) => {
        if (context.sessionId === 'session-b') resolveB = resolve;
        else resolveC = resolve;
      });
    },
  }, {
    now: clock.now,
    schedule: clock.schedule,
    cancelScheduled: clock.cancel,
  });
  adapter.initialize();
  assert.equal(await adapter.startRecorderEpoch(), true);
  fake.rotateSession('session-b', 'window-b');
  await settle();
  fake.rotateSession('session-c', 'window-c');
  resolveB({ ...leaseB, expiresAt: clock.now() + 10_000 });
  await settle();
  assert.equal(calls.join(','), 'session-a,session-b,session-c');
  resolveC({
    value: 'lease-c.secret-c',
    recorderEpoch: 'epoch-c',
    expiresAt: clock.now() + 10_000,
    context: { sessionId: 'session-c', windowId: 'window-c' },
  });
  await settle();

  const beforeSend = fake.beforeSend()!;
  assert.equal(beforeSend({
    event: '$snapshot',
    properties: { $session_id: 'session-b', $window_id: 'window-b', $snapshot_data: [] },
  }), null);
  assert.equal(
    beforeSend({
      event: '$snapshot',
      properties: { $session_id: 'session-c', $window_id: 'window-c', $snapshot_data: [] },
    })!.properties![REPLAY_PROTOTYPE_LEASE_PROPERTY],
    'lease-c.secret-c',
  );
});

test('delayed A renewal cannot relabel A as B or reset B while B lease is pending', async () => {
  const fake = fakeSdk();
  const clock = fakeClock();
  let resolveRenewalA!: (lease: IssuedReplayPrototypeLease) => void;
  let issuanceA = 0;
  const adapter = createReplayPrototypeAdapter(fake.sdk, {
    issueLease: (context) => {
      if (context.sessionId === 'session-a' && issuanceA++ === 0) {
        return Promise.resolve({ ...leaseA, expiresAt: clock.now() + 1_000, context });
      }
      if (context.sessionId === 'session-a') {
        return new Promise((resolve) => { resolveRenewalA = resolve; });
      }
      return Promise.resolve({ ...leaseB, expiresAt: clock.now() + 1_000, context });
    },
  }, {
    now: clock.now,
    schedule: clock.schedule,
    cancelScheduled: clock.cancel,
    renewBeforeMs: 100,
  });
  adapter.initialize();
  assert.equal(await adapter.startRecorderEpoch(), true);
  await clock.advance(900);
  fake.rotateSession('session-b', 'window-b');
  const beforeSend = fake.beforeSend()!;
  assert.equal(
    beforeSend({
      event: '$snapshot',
      properties: { $session_id: 'session-a', $window_id: 'window-a', $snapshot_data: [] },
    })!.properties![REPLAY_PROTOTYPE_LEASE_PROPERTY],
    leaseA.value,
  );
  assert.equal(beforeSend({
    event: '$snapshot',
    properties: { $session_id: 'session-b', $window_id: 'window-b', $snapshot_data: [] },
  }), null);

  resolveRenewalA({ ...leaseA, value: 'lease-a-renewed.secret', expiresAt: clock.now() + 1_000 });
  await settle();
  assert.equal(fake.calls.filter((call) => call.method === 'reset').length, 1);
  assert.equal(
    beforeSend({
      event: '$snapshot',
      properties: { $session_id: 'session-b', $window_id: 'window-b', $snapshot_data: [] },
    })!.properties![REPLAY_PROTOTYPE_LEASE_PROPERTY],
    leaseB.value,
  );
});

test('renewal errors are surfaced and bounded retry restores capture without another reset', async () => {
  const fake = fakeSdk();
  const clock = fakeClock();
  const errors: string[] = [];
  let attempts = 0;
  const adapter = createReplayPrototypeAdapter(fake.sdk, {
    issueLease: async (context) => {
      attempts += 1;
      if (attempts === 2) throw new Error('synthetic gateway unavailable');
      return {
        value: `lease-${attempts}.secret`,
        recorderEpoch: `epoch-${attempts}`,
        expiresAt: clock.now() + 1_000,
        context,
      };
    },
  }, {
    now: clock.now,
    schedule: clock.schedule,
    cancelScheduled: clock.cancel,
    renewBeforeMs: 100,
    retryDelayMs: 50,
    maxRenewAttempts: 1,
    onAuthorizationError: (error) => errors.push(error.code),
  });
  adapter.initialize();
  assert.equal(await adapter.startRecorderEpoch(), true);
  await clock.advance(900);
  await clock.advance(50);

  assert.equal(attempts, 3);
  assert.deepEqual(errors, ['lease_issue_failed']);
  assert.equal(fake.calls.filter((call) => call.method === 'reset').length, 1);
  assert.equal(
    fake.beforeSend()!({
      event: '$pageview',
      properties: { $session_id: 'session-a', $window_id: 'window-a' },
    })!.properties![REPLAY_PROTOTYPE_LEASE_PROPERTY],
    'lease-3.secret',
  );
});

test('a single failed B rotation automatically retries B and never renews A', async () => {
  const fake = fakeSdk();
  const clock = fakeClock();
  const calls: string[] = [];
  let bAttempts = 0;
  const adapter = createReplayPrototypeAdapter(fake.sdk, {
    issueLease: async (context) => {
      calls.push(context.sessionId);
      if (context.sessionId === 'session-a') {
        return { ...leaseA, expiresAt: clock.now() + 10_000, context };
      }
      if (bAttempts++ === 0) throw new Error('B first issuance failed');
      return { ...leaseB, expiresAt: clock.now() + 10_000, context };
    },
  }, {
    now: clock.now,
    schedule: clock.schedule,
    cancelScheduled: clock.cancel,
    retryDelayMs: 25,
    maxRenewAttempts: 1,
  });
  adapter.initialize();
  assert.equal(await adapter.startRecorderEpoch(), true);
  fake.rotateSession('session-b', 'window-b');
  await settle();

  const beforeSend = fake.beforeSend()!;
  assert.equal(calls.join(','), 'session-a,session-b');
  assert.equal(
    beforeSend({
      event: '$snapshot',
      properties: { $session_id: 'session-a', $window_id: 'window-a', $snapshot_data: [] },
    })!.properties![REPLAY_PROTOTYPE_LEASE_PROPERTY],
    leaseA.value,
  );
  assert.equal(beforeSend({
    event: '$snapshot',
    properties: { $session_id: 'session-b', $window_id: 'window-b', $snapshot_data: [] },
  }), null);

  await clock.advance(25);
  assert.equal(calls.join(','), 'session-a,session-b,session-b');
  assert.equal(calls.filter((context) => context === 'session-a').length, 1);
  assert.equal(
    beforeSend({
      event: '$snapshot',
      properties: { $session_id: 'session-b', $window_id: 'window-b', $snapshot_data: [] },
    })!.properties![REPLAY_PROTOTYPE_LEASE_PROPERTY],
    leaseB.value,
  );
});

test('manual retry uses current B after bounded B failures without another SDK callback', async () => {
  const fake = fakeSdk();
  const clock = fakeClock();
  const calls: string[] = [];
  let bAttempts = 0;
  const adapter = createReplayPrototypeAdapter(fake.sdk, {
    issueLease: async (context) => {
      calls.push(context.sessionId);
      if (context.sessionId === 'session-a') {
        return { ...leaseA, expiresAt: clock.now() + 10_000, context };
      }
      bAttempts += 1;
      if (bAttempts <= 2) throw new Error(`B attempt ${bAttempts} failed`);
      return { ...leaseB, expiresAt: clock.now() + 10_000, context };
    },
  }, {
    now: clock.now,
    schedule: clock.schedule,
    cancelScheduled: clock.cancel,
    retryDelayMs: 25,
    maxRenewAttempts: 1,
  });
  adapter.initialize();
  assert.equal(await adapter.startRecorderEpoch(), true);
  fake.rotateSession('session-b', 'window-b');
  await settle();
  await clock.advance(25);

  // No second SDK rotation callback occurs here. The adapter reads the actual
  // current B pair and retries only B after automatic retries are exhausted.
  assert.equal(await adapter.retryLease(), true);
  assert.equal(calls.join(','), 'session-a,session-b,session-b,session-b');
  assert.equal(calls.filter((context) => context === 'session-a').length, 1);
  assert.equal(fake.calls.filter((call) => call.method === 'reset').length, 1);
  assert.equal(
    fake.beforeSend()!({
      event: '$snapshot',
      properties: { $session_id: 'session-b', $window_id: 'window-b', $snapshot_data: [] },
    })!.properties![REPLAY_PROTOTYPE_LEASE_PROPERTY],
    leaseB.value,
  );
});