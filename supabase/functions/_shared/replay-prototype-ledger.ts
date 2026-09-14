import type {
  ReplayPrototypeContext,
  ReplayPrototypeContextClaim,
  ReplayPrototypeDispatchPermit,
  ReplayPrototypeIdentity,
  ReplayPrototypeLedger,
  ReplayPrototypeLeaseRecord,
  ReplayPrototypeLeaseValidation,
  ReplayPrototypeAudience,
} from "./replay-prototype-protocol.ts";

function identityKey(identity: ReplayPrototypeIdentity): string {
  return `${identity.kind}:${identity.subject}:${identity.epoch}`;
}

function sameIdentity(
  left: ReplayPrototypeIdentity,
  right: ReplayPrototypeIdentity,
): boolean {
  return identityKey(left) === identityKey(right);
}

function contextKey(context: ReplayPrototypeContext): string {
  return `${context.sessionId}\u0000${context.windowId}`;
}

/**
 * TEST_ONLY / local-harness implementation. It intentionally stores state in
 * process memory and must never be used for a deployed gateway. It exists to
 * make the required claim/revocation/deletion semantics executable in tests.
 */
export class InMemoryReplayPrototypeLedger implements ReplayPrototypeLedger {
  static readonly implementationKind = "TEST_ONLY_NONPRODUCTION";

  private readonly leases = new Map<string, ReplayPrototypeLeaseRecord>();
  private readonly contexts = new Map<string, ReplayPrototypeIdentity>();
  private readonly revokedEpochs = new Set<string>();
  private readonly tombstonedSubjects = new Set<string>();
  private readonly inflight = new Map<string, number>();
  private readonly permits = new Map<string, ReplayPrototypeIdentity>();
  private readonly deletionWaiters = new Map<string, Array<() => void>>();
  private permitSequence = 0;

  constructor(
    options: { environment?: "test" | "development" | "production" } = {},
  ) {
    if (options.environment === "production") {
      throw new Error("InMemoryReplayPrototypeLedger is TEST_ONLY_NONPRODUCTION");
    }
  }

  async createLease(record: ReplayPrototypeLeaseRecord): Promise<void> {
    if (this.leases.has(record.leaseId)) {
      throw new Error("Replay prototype lease ID collision");
    }
    if (this.tombstonedSubjects.has(record.identity.subject)) {
      throw new Error("Cannot issue a lease for a tombstoned subject");
    }
    // Preflight every context before writing any of them. `createLease` has no
    // await after this point, so a failed multi-context issuance cannot leave
    // an earlier context poisoned in this TEST_ONLY implementation.
    for (const context of record.contexts) {
      const existing = this.contexts.get(contextKey(context));
      if (existing && !sameIdentity(existing, record.identity)) {
        throw new Error("Cannot issue lease: context_owned_by_other_epoch");
      }
    }
    for (const context of record.contexts) {
      this.contexts.set(contextKey(context), record.identity);
    }
    this.leases.set(record.leaseId, record);
  }

  async validateLease(
    leaseId: string,
    tokenDigest: string,
    audience: ReplayPrototypeAudience,
    now: number,
  ): Promise<ReplayPrototypeLeaseValidation> {
    const lease = this.leases.get(leaseId);
    if (!lease) return { ok: false, reason: "unknown_lease" };
    if (lease.tokenDigest !== tokenDigest) {
      return { ok: false, reason: "invalid_secret" };
    }
    if (this.tombstonedSubjects.has(lease.identity.subject)) {
      return { ok: false, reason: "tombstoned" };
    }
    if (this.revokedEpochs.has(identityKey(lease.identity))) {
      return { ok: false, reason: "epoch_revoked" };
    }
    if (
      now >= lease.expiresAt ||
      now >= lease.uploadDeadline ||
      now >= lease.captureExpiresAt
    ) {
      return { ok: false, reason: "expired" };
    }
    if (!lease.audiences.includes(audience)) {
      return { ok: false, reason: "audience_denied" };
    }
    return { ok: true, lease };
  }

  async claimContext(
    identity: ReplayPrototypeIdentity,
    context: ReplayPrototypeContext,
  ): Promise<ReplayPrototypeContextClaim> {
    const key = contextKey(context);
    const existing = this.contexts.get(key);
    if (!existing) {
      this.contexts.set(key, identity);
      return { ok: true };
    }
    return sameIdentity(existing, identity)
      ? { ok: true }
      : { ok: false, reason: "context_owned_by_other_epoch" };
  }

  async beginDispatch(
    identity: ReplayPrototypeIdentity,
    leaseId: string,
  ): Promise<ReplayPrototypeDispatchPermit | null> {
    if (
      this.tombstonedSubjects.has(identity.subject) ||
      this.revokedEpochs.has(identityKey(identity))
    ) {
      return null;
    }
    const permit: ReplayPrototypeDispatchPermit = {
      permitId: `${leaseId}:${++this.permitSequence}`,
      identity,
    };
    this.permits.set(permit.permitId, identity);
    this.inflight.set(
      identity.subject,
      (this.inflight.get(identity.subject) || 0) + 1,
    );
    return permit;
  }

  async finishDispatch(permit: ReplayPrototypeDispatchPermit): Promise<void> {
    const identity = this.permits.get(permit.permitId);
    if (!identity) return;
    this.permits.delete(permit.permitId);
    const count = Math.max(0, (this.inflight.get(identity.subject) || 1) - 1);
    if (count === 0) {
      this.inflight.delete(identity.subject);
      const waiters = this.deletionWaiters.get(identity.subject) || [];
      this.deletionWaiters.delete(identity.subject);
      for (const resolve of waiters) resolve();
    } else {
      this.inflight.set(identity.subject, count);
    }
  }

  async revokeEpoch(identity: ReplayPrototypeIdentity): Promise<void> {
    this.revokedEpochs.add(identityKey(identity));
  }

  async beginDeletion(subject: string): Promise<void> {
    this.tombstonedSubjects.add(subject);
    if (!this.inflight.has(subject)) return;
    await new Promise<void>((resolve) => {
      const waiters = this.deletionWaiters.get(subject) || [];
      waiters.push(resolve);
      this.deletionWaiters.set(subject, waiters);
    });
  }
}