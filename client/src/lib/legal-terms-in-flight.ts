export type LegalTermsAcceptanceAttemptTracker = {
  begin: () => number;
  finish: (attemptId: number) => void;
  isInFlight: () => boolean;
};

type TimerApi = Pick<typeof globalThis, "setTimeout" | "clearTimeout">;

/**
 * Tracks concurrent pre-auth acceptance writes independently. A timed-out
 * attempt only releases itself, never another tab/action's gate hold.
 */
export function createLegalTermsAcceptanceAttemptTracker(
  onChange: () => void,
  timeoutMs: number,
  timers: TimerApi = globalThis,
): LegalTermsAcceptanceAttemptTracker {
  let nextAttemptId = 0;
  const attempts = new Map<number, ReturnType<typeof setTimeout>>();

  const finish = (attemptId: number) => {
    const timeoutId = attempts.get(attemptId);
    if (timeoutId === undefined) return;
    timers.clearTimeout(timeoutId);
    attempts.delete(attemptId);
    onChange();
  };

  return {
    begin: () => {
      const attemptId = ++nextAttemptId;
      const timeoutId = timers.setTimeout(() => finish(attemptId), timeoutMs);
      attempts.set(attemptId, timeoutId);
      onChange();
      return attemptId;
    },
    finish,
    isInFlight: () => attempts.size > 0,
  };
}