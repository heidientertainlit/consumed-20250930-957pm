export type ProviderIdentityTransitionAdapter = {
  login: (externalId: string) => Promise<void> | void;
  logout: () => Promise<void> | void;
  getCurrentUserId: () => string | null;
};

type TransitionResult = {
  epoch: number;
  completion: Promise<void>;
};

/**
 * Serializes all provider identity operations. A login is allowed to start
 * only for the epoch and auth subject that requested it; if either changes
 * while the provider call is in flight, the same queued operation logs out
 * before any later transition can login the replacement identity.
 */
export function createProviderIdentityTransition(
  adapter: ProviderIdentityTransitionAdapter,
) {
  let currentIdentity: string | null = null;
  let epoch = 0;
  let queue: Promise<unknown> = Promise.resolve();

  const enqueue = <T>(operation: () => Promise<T> | T): Promise<T> => {
    const result = queue.then(operation, operation);
    queue = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  };

  const safeLogout = async () => {
    try {
      await adapter.logout();
    } catch (_) {
      // Logout is best-effort, but it must remain in the serialized chain.
    }
  };

  const transitionTo = (nextIdentity: string | null): TransitionResult => {
    if (currentIdentity === nextIdentity) {
      return {
        epoch,
        completion: queue.then(() => undefined, () => undefined),
      };
    }

    currentIdentity = nextIdentity;
    epoch += 1;
    const transitionEpoch = epoch;

    // Invalidate the old identity synchronously. The actual provider logout
    // is queued so a pending login cannot race a later login or logout.
    return {
      epoch: transitionEpoch,
      completion: enqueue(safeLogout).then(() => undefined),
    };
  };

  const login = (externalId: string): Promise<boolean> => {
    const requestedEpoch = epoch;
    const requestedIdentity = currentIdentity;

    return enqueue(async () => {
      // Revalidate both the transition epoch and the actual current auth
      // subject immediately before touching the provider.
      if (
        requestedEpoch !== epoch ||
        requestedIdentity !== externalId ||
        adapter.getCurrentUserId() !== externalId
      ) {
        return false;
      }

      try {
        await adapter.login(externalId);
      } catch (_) {
        // A provider login may have partially applied before rejecting.
        await safeLogout();
        return false;
      }

      // Auth can change while login is in flight. Cleanup stays in this same
      // queue callback, so the next identity cannot login before it finishes.
      if (
        requestedEpoch !== epoch ||
        requestedIdentity !== currentIdentity ||
        adapter.getCurrentUserId() !== externalId
      ) {
        await safeLogout();
        return false;
      }

      return true;
    });
  };

  const logout = () => enqueue(safeLogout).then(() => undefined);

  return {
    getEpoch: () => epoch,
    getCurrentIdentity: () => currentIdentity,
    transitionTo,
    login,
    logout,
  };
}