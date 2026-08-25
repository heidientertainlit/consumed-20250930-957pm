const ONBOARDING_KEY = "consumed_onboarding_completed";
const ONBOARDING_PROGRESS_KEY = "consumed_onboarding_progress";
const ONBOARDING_DISMISSED_KEY = "consumed_onboarding_dismissed";
const PROMPT_DISMISS_MS = 7 * 24 * 60 * 60 * 1000;

export type OnboardingResumeStep = "debate" | "interests" | "loved" | "love" | "drivers";

export interface OnboardingProgress {
  step: OnboardingResumeStep;
  updatedAt: string;
}

export function resolveOnboardingResumeStep({
  hasExistingProfile,
  resumeDNA,
  resumeRequested,
  isNewAccount,
  draftStep,
  hasFormats,
  hasGenres,
  hasLoveResponse,
  hasDriverResponse,
}: {
  hasExistingProfile: boolean;
  resumeDNA: boolean;
  resumeRequested: boolean;
  isNewAccount: boolean;
  draftStep?: OnboardingResumeStep | null;
  hasFormats: boolean;
  hasGenres: boolean;
  hasLoveResponse: boolean;
  hasDriverResponse: boolean;
}): OnboardingResumeStep {
  const isExistingDNARetake = resumeDNA && hasExistingProfile;
  if (isExistingDNARetake) return "love";

  if (!hasFormats || !hasGenres) {
    return draftStep === "debate" || (!draftStep && isNewAccount && !resumeRequested)
      ? "debate"
      : "interests";
  }

  // First-time setup must include title selection. Only a saved later step
  // proves the user already advanced beyond it.
  if (draftStep !== "love" && draftStep !== "drivers") return "loved";
  if (!hasLoveResponse) return "love";
  if (!hasDriverResponse) return "drivers";
  return "drivers";
}

function scopedKey(key: string, userId?: string | null): string {
  return userId ? `${key}:${userId}` : key;
}

export function isOnboardingComplete(userId?: string | null): boolean {
  return localStorage.getItem(scopedKey(ONBOARDING_KEY, userId)) === "true";
}

export function markOnboardingComplete(userId?: string | null): void {
  localStorage.setItem(scopedKey(ONBOARDING_KEY, userId), "true");
  localStorage.removeItem(scopedKey(ONBOARDING_PROGRESS_KEY, userId));
  localStorage.removeItem(scopedKey(ONBOARDING_DISMISSED_KEY, userId));
}

export function loadOnboardingProgress(userId?: string | null): OnboardingProgress | null {
  try {
    const raw = localStorage.getItem(scopedKey(ONBOARDING_PROGRESS_KEY, userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as OnboardingProgress;
    if (!["debate", "interests", "loved", "love", "drivers"].includes(parsed.step)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveOnboardingProgress(
  userId: string | null | undefined,
  step: OnboardingResumeStep,
  options?: { preserveCompletion?: boolean },
): void {
  if (!userId) return;
  localStorage.setItem(scopedKey(ONBOARDING_PROGRESS_KEY, userId), JSON.stringify({
    step,
    updatedAt: new Date().toISOString(),
  } satisfies OnboardingProgress));
  if (!options?.preserveCompletion) localStorage.removeItem(scopedKey(ONBOARDING_KEY, userId));
}

export function dismissOnboardingPrompt(userId?: string | null): void {
  if (!userId) return;
  localStorage.setItem(scopedKey(ONBOARDING_DISMISSED_KEY, userId), String(Date.now()));
}

export function isOnboardingPromptDismissed(userId?: string | null): boolean {
  if (!userId) return false;
  const dismissedAt = Number(localStorage.getItem(scopedKey(ONBOARDING_DISMISSED_KEY, userId)));
  return Number.isFinite(dismissedAt) && Date.now() - dismissedAt < PROMPT_DISMISS_MS;
}

export function resetOnboardingState(userId?: string | null): void {
  localStorage.removeItem(scopedKey(ONBOARDING_KEY, userId));
  localStorage.removeItem(scopedKey(ONBOARDING_PROGRESS_KEY, userId));
  localStorage.removeItem(scopedKey(ONBOARDING_DISMISSED_KEY, userId));
}