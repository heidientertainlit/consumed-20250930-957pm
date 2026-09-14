/**
 * Disposable, default-off adapter for exercising the full PostHog SDK through
 * a replay-aware gateway. It intentionally has no Supabase dependency: the
 * reviewed gateway protocol will own identity verification and lease issuance.
 *
 * This does not replace the application's legacy PostHog integration. Callers
 * must opt into this isolated harness explicitly with
 * VITE_POSTHOG_REPLAY_PROTOTYPE=true.
 */

export const REPLAY_PROTOTYPE_GATEWAY = '/api/replay-prototype';
export const REPLAY_PROTOTYPE_PLACEHOLDER_TOKEN = 'consumed_replay_prototype';
export const REPLAY_PROTOTYPE_LEASE_PROPERTY = '__consumed_upload_lease';

export type PostHogEventEnvelope = {
  event: string;
  properties?: Record<string, unknown>;
  [key: string]: unknown;
};

export type CapturedNetworkRequest = {
  name?: string;
  url?: string;
  [key: string]: unknown;
};

export type ReplayPrototypeSdk = {
  init: (token: string, config: Record<string, unknown>) => unknown;
  set_config: (config: Record<string, unknown>) => void;
  reset: () => void;
  get_session_id: () => string;
  onSessionId: (
    callback: (sessionId: string, windowId: string) => void,
  ) => () => void;
  startSessionRecording: () => void;
  stopSessionRecording: () => void;
};

/**
 * This is deliberately an opaque gateway-issued credential, not an access
 * token or a PostHog project token. Its format must remain unconstrained here:
 * the local gateway currently issues opaque leaseId.secret values and a
 * client-side prefix requirement would be an incompatible second protocol.
 */
export type IssuedReplayPrototypeLease = Readonly<{
  value: string;
  recorderEpoch: string;
  expiresAt: number;
  context: ReplayPrototypeContext;
}>;

export type ReplayPrototypeContext = Readonly<{
  sessionId: string;
  windowId: string;
}>;

/**
 * Injection point for a future reviewed lease issuer. It is async only while
 * acquiring an epoch; before_send never invokes it or performs network I/O.
 * The provider must obtain an opaque lease from POST /api/replay-prototype/lease
 * with these exact SDK-generated session/window IDs, then retain those IDs in
 * the returned lease. It must never return a Supabase JWT as value.
 */
export type ReplayPrototypeLeaseProvider = {
  issueLease: (
    context: ReplayPrototypeContext,
  ) => Promise<IssuedReplayPrototypeLease | null>;
};

export type ReplayPrototypeAdapter = {
  initialize: () => void;
  startRecorderEpoch: () => Promise<boolean>;
  beginRecorderEpoch: (lease: IssuedReplayPrototypeLease) => boolean;
  retireRecorderEpoch: () => void;
  retryLease: () => Promise<boolean>;
};

export type ReplayPrototypeAuthorizationError = {
  code: 'lease_issue_failed' | 'lease_expired' | 'context_changed';
  context: ReplayPrototypeContext;
  cause?: unknown;
};

export type ReplayPrototypeAdapterOptions = {
  now?: () => number;
  schedule?: (callback: () => void, delayMs: number) => unknown;
  cancelScheduled?: (handle: unknown) => void;
  renewBeforeMs?: number;
  retryDelayMs?: number;
  maxRenewAttempts?: number;
  onAuthorizationError?: (error: ReplayPrototypeAuthorizationError) => void;
};

type RecorderContext = {
  readonly context: ReplayPrototypeContext;
  readonly generation: number;
};

function isValidIssuedLease(lease: IssuedReplayPrototypeLease): boolean {
  return (
    typeof lease.value === 'string' &&
    lease.value.length > 0 &&
    typeof lease.recorderEpoch === 'string' &&
    lease.recorderEpoch.length > 0 &&
    Number.isFinite(lease.expiresAt) &&
    validContext(lease.context)
  );
}

function validContext(context: ReplayPrototypeContext): boolean {
  return (
    typeof context.sessionId === 'string' &&
    context.sessionId.length > 0 &&
    typeof context.windowId === 'string' &&
    context.windowId.length > 0
  );
}

function sameContext(
  left: ReplayPrototypeContext,
  right: ReplayPrototypeContext,
): boolean {
  return left.sessionId === right.sessionId && left.windowId === right.windowId;
}

function leaseSnapshot(lease: IssuedReplayPrototypeLease): IssuedReplayPrototypeLease {
  return Object.freeze({
    value: lease.value,
    recorderEpoch: lease.recorderEpoch,
    expiresAt: lease.expiresAt,
    context: Object.freeze({
      sessionId: lease.context.sessionId,
      windowId: lease.context.windowId,
    }),
  });
}

function gatewayPathname(value: string): string | null {
  try {
    return new URL(value, 'https://consumed.invalid').pathname;
  } catch {
    return null;
  }
}

/**
 * Replay's network plugin sees this SDK's own upload body. Excluding only the
 * prototype route prevents the lease from entering rrweb data without changing
 * existing remote masking, header masking, body capture, or other network
 * analytics settings.
 */
export function excludePrototypeGatewayFromReplay(
  request: CapturedNetworkRequest,
  gateway = REPLAY_PROTOTYPE_GATEWAY,
): CapturedNetworkRequest | undefined {
  const pathname = gatewayPathname(request.name || request.url || '');
  const gatewayPath = gatewayPathname(gateway);
  if (
    pathname &&
    gatewayPath &&
    (pathname === gatewayPath || pathname.startsWith(`${gatewayPath}/`))
  ) {
    return undefined;
  }
  return request;
}

/**
 * Only the replay gateway upload is configured here. In particular, this
 * adapter does not set autocapture, session-recording masking, pageview,
 * pageleave, attribution, persistence, consent, batching, compression, or
 * feature-flag options. Those remain full SDK defaults/remote configuration.
 */
export function replayPrototypeSdkConfig(
  beforeSend: (event: PostHogEventEnvelope) => PostHogEventEnvelope | null,
): Record<string, unknown> {
  return {
    api_host: REPLAY_PROTOTYPE_GATEWAY,
    // Avoid SDK debug output containing the prototype envelope/lease.
    debug: false,
    session_recording: {
      maskCapturedNetworkRequestFn: excludePrototypeGatewayFromReplay,
    },
    before_send: beforeSend,
  };
}

/**
 * A reusable state machine around the public PostHog APIs available in app SDK
 * 1.352.0 and marketing SDK 1.430.3. No SDK internals, click replacement, or
 * browser API monkey-patching are used.
 */
export function createReplayPrototypeAdapter(
  sdk: ReplayPrototypeSdk,
  leaseProvider: ReplayPrototypeLeaseProvider,
  options: ReplayPrototypeAdapterOptions = {},
): ReplayPrototypeAdapter {
  let initialized = false;
  let recorderContext: RecorderContext | null = null;
  let contextGeneration = 0;
  let requestedGeneration = 0;
  let issueChain: Promise<void> = Promise.resolve();
  let renewalTimer: unknown = null;
  let renewalAttempts = 0;
  const leasesByContext = new Map<string, IssuedReplayPrototypeLease>();
  const now = options.now || (() => Date.now());
  const schedule = options.schedule || ((callback, delayMs) => setTimeout(callback, delayMs));
  const cancelScheduled = options.cancelScheduled || ((handle) => clearTimeout(handle as ReturnType<typeof setTimeout>));
  const renewBeforeMs = options.renewBeforeMs ?? 60_000;
  const retryDelayMs = options.retryDelayMs ?? 5_000;
  const maxRenewAttempts = options.maxRenewAttempts ?? 2;

  function contextKey(context: ReplayPrototypeContext): string {
    return `${context.sessionId}\u0000${context.windowId}`;
  }

  function report(
    code: ReplayPrototypeAuthorizationError['code'],
    context: ReplayPrototypeContext,
    cause?: unknown,
  ) {
    options.onAuthorizationError?.({ code, context, cause });
  }

  function cancelRenewal() {
    if (renewalTimer !== null) cancelScheduled(renewalTimer);
    renewalTimer = null;
  }

  function leaseForEvent(event: PostHogEventEnvelope): IssuedReplayPrototypeLease | null {
    const properties = event.properties || {};
    const sessionId = properties.$session_id;
    const windowId = properties.$window_id;
    if (typeof sessionId !== 'string' || typeof windowId !== 'string') return null;
    const lease = leasesByContext.get(contextKey({ sessionId, windowId }));
    if (!lease) return null;
    if (now() >= lease.expiresAt) {
      leasesByContext.delete(contextKey(lease.context));
      report('lease_expired', lease.context);
      return null;
    }
    return lease;
  }

  function beforeSend(event: PostHogEventEnvelope): PostHogEventEnvelope | null {
    const lease = leaseForEvent(event);
    if (!lease) return null;
    // $snapshot_data remains byte-for-byte/reference untouched. The lease is
    // an event property outside rrweb's snapshot payload.
    return {
      ...event,
      properties: {
        ...(event.properties || {}),
        [REPLAY_PROTOTYPE_LEASE_PROPERTY]: lease.value,
      },
    };
  }

  function currentSdkContext(): ReplayPrototypeContext | null {
    let observed: ReplayPrototypeContext | null = null;
    const unsubscribe = sdk.onSessionId((sessionId, windowId) => {
      if (typeof sessionId === 'string' && typeof windowId === 'string') {
        observed = { sessionId, windowId };
      }
    });
    // This public API initializes a fresh session after reset. onSessionId
    // then reports its paired window ID synchronously in both supported SDKs.
    sdk.get_session_id();
    unsubscribe();
    return observed && validContext(observed) ? observed : null;
  }

  function scheduleRenewal(lease: IssuedReplayPrototypeLease) {
    cancelRenewal();
    if (!recorderContext || !sameContext(recorderContext.context, lease.context)) return;
    const scheduleCurrentLease = () => {
      const active = recorderContext;
      const currentLease = leasesByContext.get(contextKey(lease.context));
      if (!active || currentLease !== lease || !sameContext(active.context, lease.context)) return;
      // Browser timers cannot safely schedule multi-week leases in one call.
      // Recheck at each capped timer instead of renewing prematurely.
      const remaining = lease.expiresAt - now();
      const lead = Math.min(renewBeforeMs, Math.max(1, remaining / 2));
      const delay = Math.max(1, remaining - lead);
      if (delay > 2_147_000_000) {
        renewalTimer = schedule(scheduleCurrentLease, 2_147_000_000);
        return;
      }
      renewalTimer = schedule(() => {
        renewalTimer = null;
        const latest = recorderContext;
        if (
          latest?.generation !== active.generation ||
          leasesByContext.get(contextKey(lease.context)) !== lease
        ) return;
        void requestLease(lease.context, active.generation, true);
      }, delay);
    };
    scheduleCurrentLease();
  }

  function installLease(lease: IssuedReplayPrototypeLease, startRecording: boolean): boolean {
    const observed = initialized ? currentSdkContext() : null;
    if (
      !initialized ||
      !isValidIssuedLease(lease) ||
      !observed ||
      !sameContext(observed, lease.context)
    ) return false;
    const immutableLease = leaseSnapshot(lease);
    leasesByContext.set(contextKey(immutableLease.context), immutableLease);
    recorderContext = {
      context: immutableLease.context,
      generation: contextGeneration,
    };
    renewalAttempts = 0;
    scheduleRenewal(immutableLease);
    if (startRecording) {
      // No override is passed: server-side replay sampling, triggers, and
      // masking remain effective. This merely resumes recording after a lease.
      sdk.startSessionRecording();
    }
    return true;
  }

  async function requestLease(
    context: ReplayPrototypeContext,
    generation: number,
    isRenewal: boolean,
  ): Promise<boolean> {
    const requestGeneration = ++requestedGeneration;
    let result = false;
    issueChain = issueChain.then(async () => {
      // A newer context request supersedes a queued stale request without
      // letting its eventual response overwrite the current routing map.
      if (requestGeneration !== requestedGeneration || generation !== contextGeneration) return;
      try {
        const lease = await leaseProvider.issueLease(context);
        const current = currentSdkContext();
        if (
          !lease ||
          requestGeneration !== requestedGeneration ||
          generation !== contextGeneration ||
          !current ||
          !sameContext(current, context) ||
          !sameContext(lease.context, context)
        ) {
          if (generation === contextGeneration) report('context_changed', context);
          return;
        }
        result = installLease(lease, !isRenewal);
        if (!result) report('context_changed', context);
      } catch (cause) {
        report('lease_issue_failed', context, cause);
      }
      if (
        !result &&
        generation === contextGeneration &&
        requestGeneration === requestedGeneration
      ) {
        renewalAttempts += 1;
        const current = currentSdkContext();
        if (current && sameContext(current, context) && renewalAttempts <= maxRenewAttempts) {
          cancelRenewal();
          renewalTimer = schedule(() => {
            renewalTimer = null;
            void requestLease(context, generation, isRenewal);
          }, retryDelayMs);
        }
      }
    });
    await issueChain;
    return result;
  }

  function retireRecorderEpoch() {
    cancelRenewal();
    // An explicit account boundary must not authorize any more A captures,
    // including snapshots emitted synchronously while stopping the recorder.
    leasesByContext.clear();
    if (recorderContext) sdk.stopSessionRecording();
    recorderContext = null;
    contextGeneration += 1;
    renewalAttempts = 0;
    sdk.reset();
  }

  function beginRecorderEpoch(lease: IssuedReplayPrototypeLease): boolean {
    return installLease(lease, !recorderContext);
  }

  async function retryLease(): Promise<boolean> {
    if (!initialized) return false;
    const current = currentSdkContext();
    if (!current) return false;
    renewalAttempts = 0;
    return requestLease(current, contextGeneration, leasesByContext.has(contextKey(current)));
  }

  return {
    initialize() {
      if (initialized) return;
      sdk.init(
        REPLAY_PROTOTYPE_PLACEHOLDER_TOKEN,
        replayPrototypeSdkConfig(beforeSend),
      );
      initialized = true;
      // Keep this subscription for the lifetime of the isolated SDK instance.
      // A session/window can roll independently of an explicit auth boundary.
      sdk.onSessionId((sessionId, windowId) => {
        const next = { sessionId, windowId };
        if (!validContext(next) || !recorderContext || sameContext(next, recorderContext.context)) return;
        // SDK session/window rotation is not an identity switch: do not reset
        // the recorder. Hold B events until B's scoped lease arrives while A
        // buffered data still routes only to A's immutable lease.
        contextGeneration += 1;
        const generation = contextGeneration;
        renewalAttempts = 0;
        cancelRenewal();
        report('context_changed', next);
        void requestLease(next, generation, false);
      });
    },

    async startRecorderEpoch() {
      if (!initialized) return false;
      // Explicit auth/account boundary: stop A, reset to a fresh SDK
      // session/window, and issue B's lease for that new pair. A routes have
      // been retired; B remains blocked until issuance.
      retireRecorderEpoch();
      const context = currentSdkContext();
      if (!context) return false;
      const generation = contextGeneration;
      return requestLease(context, generation, false);
    },

    beginRecorderEpoch,
    retireRecorderEpoch,
    retryLease,
  };
}

export function isReplayPrototypeEnabled(
  environment: Record<string, string | undefined> | undefined,
): boolean {
  return environment?.VITE_POSTHOG_REPLAY_PROTOTYPE === 'true';
}