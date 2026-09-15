export const TERMS_CONSENT_REQUEST_TIMEOUT_MS = 15_000;

/**
 * A consent check must fail closed rather than leaving an authenticated user
 * behind the agreement gate forever when the network request never settles.
 */
export function withTermsConsentRequestDeadline<T>(
  request: PromiseLike<T>,
  timeoutMs = TERMS_CONSENT_REQUEST_TIMEOUT_MS,
): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(
        new Error(
          "We couldn't verify your Terms of Service agreement. Please try again.",
        ),
      );
    }, timeoutMs);
  });

  return Promise.race([Promise.resolve(request), timeout]).finally(() => {
    if (timeoutId !== undefined) clearTimeout(timeoutId);
  });
}