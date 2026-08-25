import { useAuth } from "@/lib/auth";
import { useLocation } from "wouter";
import { useEffect, useState } from "react";

interface RouteGuardProps {
  children: React.ReactNode;
}

const ONBOARDING_KEY = 'consumed_onboarding_completed';
const ONBOARDING_PROGRESS_KEY = 'consumed_onboarding_progress';
const ONBOARDING_DISMISSED_KEY = 'consumed_onboarding_dismissed';
const NEW_USER_WINDOW_MS = 10 * 60 * 1000; // 10 minutes
const PROMPT_DISMISS_MS = 7 * 24 * 60 * 60 * 1000;

export type OnboardingResumeStep = 'debate' | 'interests' | 'loved' | 'love' | 'drivers';

export interface OnboardingProgress {
  step: OnboardingResumeStep;
  updatedAt: string;
}

// The flag is scoped per user id — a shared browser-wide flag used to make
// every subsequent signup on the same browser skip onboarding entirely.
function onboardingKey(userId?: string | null): string {
  return userId ? `${ONBOARDING_KEY}:${userId}` : ONBOARDING_KEY;
}

export function isOnboardingComplete(userId?: string | null): boolean {
  return localStorage.getItem(onboardingKey(userId)) === 'true';
}

export function markOnboardingComplete(userId?: string | null): void {
  localStorage.setItem(onboardingKey(userId), 'true');
  localStorage.removeItem(onboardingProgressKey(userId));
  localStorage.removeItem(onboardingDismissedKey(userId));
}

function onboardingProgressKey(userId?: string | null): string {
  return userId ? `${ONBOARDING_PROGRESS_KEY}:${userId}` : ONBOARDING_PROGRESS_KEY;
}

function onboardingDismissedKey(userId?: string | null): string {
  return userId ? `${ONBOARDING_DISMISSED_KEY}:${userId}` : ONBOARDING_DISMISSED_KEY;
}

export function loadOnboardingProgress(userId?: string | null): OnboardingProgress | null {
  try {
    const raw = localStorage.getItem(onboardingProgressKey(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as OnboardingProgress;
    if (!['debate', 'interests', 'loved', 'love', 'drivers'].includes(parsed.step)) return null;
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
  localStorage.setItem(onboardingProgressKey(userId), JSON.stringify({
    step,
    updatedAt: new Date().toISOString(),
  } satisfies OnboardingProgress));
  if (!options?.preserveCompletion) localStorage.removeItem(onboardingKey(userId));
}

export function dismissOnboardingPrompt(userId?: string | null): void {
  if (!userId) return;
  localStorage.setItem(onboardingDismissedKey(userId), String(Date.now()));
}

export function isOnboardingPromptDismissed(userId?: string | null): boolean {
  if (!userId) return false;
  const dismissedAt = Number(localStorage.getItem(onboardingDismissedKey(userId)));
  return Number.isFinite(dismissedAt) && Date.now() - dismissedAt < PROMPT_DISMISS_MS;
}

export function resetOnboardingState(userId?: string | null): void {
  localStorage.removeItem(onboardingKey(userId));
  localStorage.removeItem(onboardingProgressKey(userId));
  localStorage.removeItem(onboardingDismissedKey(userId));
}

export function ProtectedRoute({ children }: RouteGuardProps) {
  const { user, loading } = useAuth();
  const [, setLocation] = useLocation();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      const fullPath = window.location.pathname + window.location.search + window.location.hash;
      if (fullPath !== '/login') {
        sessionStorage.setItem('returnUrl', fullPath);
      }
      setLocation('/login');
      return;
    }

    if (!loading && user) {
      setReady(true);
    }
  }, [user, loading, setLocation]);

  if (loading || !ready) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-black via-slate-900 to-purple-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <div className="text-white text-sm mt-4">Loading...</div>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return <>{children}</>;
}

export function PublicOnlyRoute({ children }: RouteGuardProps) {
  const { user, loading } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!loading && user) {
      const onboardingDone = isOnboardingComplete(user.id);
      if (onboardingDone) {
        setLocation('/activity');
      } else {
        const createdAt = new Date(user.created_at).getTime();
        const isNewUser = Date.now() - createdAt < NEW_USER_WINDOW_MS;
        if (isNewUser && !isOnboardingPromptDismissed(user.id)) {
          setLocation('/onboarding');
        } else {
          setLocation('/activity');
        }
      }
    }
  }, [user, loading, setLocation]);

  if (loading || user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-black via-slate-900 to-purple-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <div className="text-white text-sm mt-4">{loading ? "Loading..." : "Redirecting..."}</div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
