/**
 * Shared wire names for the disposable replay gateway prototype.
 *
 * These values deliberately do not overlap the deployed posthog-capture
 * function. See exports/replay-prototype-contract.md before using them.
 */
export const REPLAY_PROTOTYPE_PREFIX = "/api/replay-prototype";
export const REPLAY_PROTOTYPE_LEASE_PROPERTY = "__consumed_upload_lease";
export const REPLAY_PROTOTYPE_PUBLIC_PLACEHOLDER = "consumed_replay_prototype";

export const REPLAY_PROTOTYPE_LEASE_PATH =
  `${REPLAY_PROTOTYPE_PREFIX}/lease`;
export const REPLAY_PROTOTYPE_EVENT_PATH =
  `${REPLAY_PROTOTYPE_PREFIX}/e/`;
export const REPLAY_PROTOTYPE_SNAPSHOT_PATH =
  `${REPLAY_PROTOTYPE_PREFIX}/s/`;
export const REPLAY_PROTOTYPE_CONFIG_PATH =
  `${REPLAY_PROTOTYPE_PREFIX}/decide/`;
/** Current full SDKs use /flags/?v=2 rather than a generic decide proxy. */
export const REPLAY_PROTOTYPE_FLAGS_PATH =
  `${REPLAY_PROTOTYPE_PREFIX}/flags/`;
/**
 * Current full SDK remote-config fallback paths. The literal placeholder is
 * public and is never a provider project token.
 */
export const REPLAY_PROTOTYPE_REMOTE_CONFIG_PATH =
  `${REPLAY_PROTOTYPE_PREFIX}/array/${REPLAY_PROTOTYPE_PUBLIC_PLACEHOLDER}/config`;
export const REPLAY_PROTOTYPE_REMOTE_CONFIG_SCRIPT_PATH =
  `${REPLAY_PROTOTYPE_REMOTE_CONFIG_PATH}.js`;

/**
 * Static files are named locally, rather than accepting a URL or provider
 * pathname from a browser. Adding a recorder asset is a source review change.
 */
export const REPLAY_PROTOTYPE_RECORDER_ASSET_PATHS = [
  `${REPLAY_PROTOTYPE_PREFIX}/static/lazy-recorder.js`,
] as const;

export const REPLAY_PROTOTYPE_MAX_COMPRESSED_BYTES = 1_048_576;
/** Allows base64's transport expansion while retaining the decoded bounds. */
export const REPLAY_PROTOTYPE_MAX_ENVELOPE_BYTES = 1_400_000;
export const REPLAY_PROTOTYPE_MAX_DECODED_BYTES = 8_388_608;
export const REPLAY_PROTOTYPE_MAX_BATCH_ITEMS = 100;
export const REPLAY_PROTOTYPE_MAX_EVENT_BYTES = 2_097_152;

export type ReplayPrototypeAudience = "event" | "replay";
export type ReplayPrototypeIngestRoute = "e" | "s";

export type ReplayPrototypeContext = {
  sessionId: string;
  windowId: string;
};

export type ReplayPrototypeIdentity = {
  /**
   * An exact account UUID or a server-signed persistent guest identifier.
   * The gateway never reads this value from a browser event.
   */
  kind: "account" | "guest";
  subject: string;
  /**
   * Account/guest lifecycle generation. A new login or burned guest receives
   * a new epoch and cannot use prior session/window bindings.
   */
  epoch: string;
};

export type ReplayPrototypeLeaseRecord = {
  leaseId: string;
  tokenDigest: string;
  identity: ReplayPrototypeIdentity;
  audiences: readonly ReplayPrototypeAudience[];
  contexts: readonly ReplayPrototypeContext[];
  issuedAt: number;
  expiresAt: number;
  captureExpiresAt: number;
  uploadDeadline: number;
};

export type ReplayPrototypeLeaseValidation =
  | { ok: true; lease: ReplayPrototypeLeaseRecord }
  | {
    ok: false;
    reason:
      | "unknown_lease"
      | "invalid_secret"
      | "expired"
      | "audience_denied"
      | "epoch_revoked"
      | "tombstoned";
  };

export type ReplayPrototypeContextClaim =
  | { ok: true }
  | { ok: false; reason: "context_not_authorized" | "context_owned_by_other_epoch" };

export type ReplayPrototypeDispatchPermit = {
  readonly permitId: string;
  readonly identity: ReplayPrototypeIdentity;
};

/**
 * Production must implement this against one authoritative durable store.
 * In particular, `beginDispatch` and account deletion need one atomic
 * lifecycle boundary; a local cache cannot provide that guarantee.
 */
export interface ReplayPrototypeLedger {
  createLease(record: ReplayPrototypeLeaseRecord): Promise<void>;
  validateLease(
    leaseId: string,
    tokenDigest: string,
    audience: ReplayPrototypeAudience,
    now: number,
  ): Promise<ReplayPrototypeLeaseValidation>;
  claimContext(
    identity: ReplayPrototypeIdentity,
    context: ReplayPrototypeContext,
  ): Promise<ReplayPrototypeContextClaim>;
  beginDispatch(
    identity: ReplayPrototypeIdentity,
    leaseId: string,
  ): Promise<ReplayPrototypeDispatchPermit | null>;
  finishDispatch(permit: ReplayPrototypeDispatchPermit): Promise<void>;
  revokeEpoch(identity: ReplayPrototypeIdentity): Promise<void>;
  /**
   * Marks the subject deleted before returning. The returned promise resolves
   * only after all previously admitted sends for that subject have finished.
   */
  beginDeletion(subject: string): Promise<void>;
}