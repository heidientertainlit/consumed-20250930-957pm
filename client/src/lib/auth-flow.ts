const RECOVERY_FLOW_KEY = "consumed.recovery-auth-flow";
const RECOVERY_FLOW_MAX_AGE_MS = 10 * 60 * 1000;

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