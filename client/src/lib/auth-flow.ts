const RECOVERY_FLOW_KEY = "consumed.recovery-auth-flow";
const RECOVERY_FLOW_MAX_AGE_MS = 10 * 60 * 1000;
export const AUTH_STATE_REQUEST_TIMEOUT_MS = 15_000;

let recoveryFlowMarked = false;

function getStorage(): Storage | null {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

/**
 * Marks a recovery callback before setSession is called. This is kept
 * separate from the current route because native warm links set the session
 * before React can navigate to /reset-password.
 */
export function markRecoveryAuthFlow() {
  recoveryFlowMarked = true;
  getStorage()?.setItem(RECOVERY_FLOW_KEY, String(Date.now()));
}

export function clearRecoveryAuthFlow() {
  recoveryFlowMarked = false;
  getStorage()?.removeItem(RECOVERY_FLOW_KEY);
}

export function consumeRecoveryAuthFlow() {
  const storage = getStorage();
  let marked = recoveryFlowMarked;
  recoveryFlowMarked = false;

  const rawIssuedAt = storage?.getItem(RECOVERY_FLOW_KEY);
  storage?.removeItem(RECOVERY_FLOW_KEY);
  if (rawIssuedAt) {
    const issuedAt = Number(rawIssuedAt);
    const age = Date.now() - issuedAt;
    marked ||= Number.isFinite(issuedAt) && age >= 0 && age <= RECOVERY_FLOW_MAX_AGE_MS;
  }
  return marked;
}

export function isRecoveryAuthCallback(pathname: string) {
  const marked = consumeRecoveryAuthFlow();
  return pathname === "/reset-password" || marked;
}

export function withAuthStateRequestDeadline<T>(
  request: PromiseLike<T>,
  timeoutMs = AUTH_STATE_REQUEST_TIMEOUT_MS,
): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(
      () => reject(new Error("Your account session could not be checked. Please try again.")),
      timeoutMs,
    );
  });

  return Promise.race([Promise.resolve(request), timeout]).finally(() => {
    if (timeoutId !== undefined) clearTimeout(timeoutId);
  });
}

export function isSessionEstablishingAuthEvent(event: string, hasUserId: boolean) {
  return hasUserId && (event === "SIGNED_IN" || event === "INITIAL_SESSION");
}

export function createAuthWorkGenerationGuard() {
  let generation = 0;
  return {
    begin: () => ++generation,
    current: () => generation,
    isCurrent: (workGeneration: number) => workGeneration === generation,
  };
}

export function shouldInvalidateAuthWorkForEvent(event: string) {
  // A refresh changes credentials for the same session. It must not cancel an
  // in-flight identity/profile setup, because it has no replacement setup.
  return event !== "TOKEN_REFRESHED";
}

export function shouldApplyAuthStateEvent(event: string) {
  // INITIAL_SESSION is deliberately coalesced into the canonical, bounded
  // getSession startup read. It must not overwrite that read's fail-closed
  // decision, especially when the SDK emits a null initial event on failure.
  return event !== "INITIAL_SESSION";
}

export type InitialAuthStartupResult<T> =
  | { kind: "resolved"; session: T | null }
  | { kind: "cleared" }
  | { kind: "blocked" };

/**
 * An initial session lookup failure is not evidence that the browser is
 * signed out. Only a successful local SDK sign-out allows the app to present
 * guest state; otherwise callers must keep startup blocked and offer retry.
 */
export async function resolveInitialAuthStartup<T>(
  getSession: () => PromiseLike<{
    data: { session: T | null };
    error: unknown | null;
  }>,
  signOut: () => PromiseLike<{ error: unknown | null }>,
): Promise<InitialAuthStartupResult<T>> {
  try {
    const { data: { session }, error } = await withAuthStateRequestDeadline(getSession());
    if (error) throw error;
    return { kind: "resolved", session };
  } catch {
    const signOutResult = await withAuthStateRequestDeadline(signOut(), 5_000)
      .catch(() => null);
    return signOutResult && !signOutResult.error
      ? { kind: "cleared" }
      : { kind: "blocked" };
  }
}