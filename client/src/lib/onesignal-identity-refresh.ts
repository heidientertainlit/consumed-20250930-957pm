export type OneSignalJwtRefreshBridge = {
  getCurrentUserId: () => string | null;
  requestJwt: (externalId: string) => Promise<string>;
  updateUserJwt: (externalId: string, jwt: string) => Promise<void>;
};

export type OneSignalJwtRefreshQueueOptions = {
  getCurrentEpoch: () => number;
  maxAttempts?: number;
  cleanupStaleProviderIdentity?: () => Promise<void>;
};

/**
 * Serializes native JWT refreshes and revalidates the auth subject/epoch
 * around every async boundary. This helper intentionally has no legacy-login
 * fallback: callers receive false when the refresh is stale or exhausted.
 */
export function createOneSignalJwtRefreshQueue(
  bridge: OneSignalJwtRefreshBridge,
  options: OneSignalJwtRefreshQueueOptions,
) {
  const maxAttempts = Math.max(1, Math.min(options.maxAttempts ?? 2, 2));
  let queue: Promise<unknown> = Promise.resolve();

  const enqueue = <T>(operation: () => Promise<T>): Promise<T> => {
    const result = queue.then(operation, operation);
    queue = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  };

  const refresh = (
    externalId: string,
    requestedEpoch: number,
  ): Promise<boolean> =>
    enqueue(async () => {
      for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
        const stillCurrent = () =>
          options.getCurrentEpoch() === requestedEpoch &&
          bridge.getCurrentUserId() === externalId;

        if (!stillCurrent()) return false;

        try {
          const jwt = await bridge.requestJwt(externalId);
          if (!stillCurrent()) return false;

          await bridge.updateUserJwt(externalId, jwt);
          if (stillCurrent()) return true;
          await options.cleanupStaleProviderIdentity?.();
          return false;
        } catch {
          if (attempt + 1 >= maxAttempts || !stillCurrent()) return false;
        }
      }

      return false;
    });

  return { refresh };
}