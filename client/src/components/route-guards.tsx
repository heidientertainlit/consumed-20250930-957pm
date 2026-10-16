import { useAuth } from "@/lib/auth";
import { useLocation } from "wouter";
import { useEffect, useRef } from "react";
import { authNavigationIntent } from "@/lib/auth-navigation-intent";
import {
  isOnboardingComplete,
  markOnboardingComplete,
  loadOnboardingProgress,
  saveOnboardingProgress,
  dismissOnboardingPrompt,
  isOnboardingPromptDismissed,
  resetOnboardingState,
  resolveOnboardingResumeStep,
  type OnboardingResumeStep,
  type OnboardingProgress,
} from "@/lib/onboarding-progress";

export {
  isOnboardingComplete,
  markOnboardingComplete,
  loadOnboardingProgress,
  saveOnboardingProgress,
  dismissOnboardingPrompt,
  isOnboardingPromptDismissed,
  resetOnboardingState,
  resolveOnboardingResumeStep,
};
export type { OnboardingResumeStep, OnboardingProgress };

interface RouteGuardProps {
  children: React.ReactNode;
}

function IdentityLoading({ label = "Loading..." }: { label?: string }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-slate-900 to-purple-900 flex items-center justify-center">
      <div className="text-center">
        <div className="w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto" />
        <div className="text-white text-sm mt-4">{label}</div>
      </div>
    </div>
  );
}

export function ProtectedRoute({ children }: RouteGuardProps) {
  const [location, setLocation] = useLocation();
  const { user, loading } = useAuth();
  const redirecting = useRef(false);

  useEffect(() => {
    if (loading) return;
    if (!user && !redirecting.current) {
      redirecting.current = true;
      const fullPath = window.location.pathname + window.location.search + window.location.hash;
      setLocation(authNavigationIntent.login(fullPath));
      return;
    }
  }, [loading, location, setLocation, user]);

  if (loading) return <IdentityLoading />;

  if (!user) {
    return null;
  }

  return <>{children}</>;
}

export function IdentityAwareRoute({ children }: RouteGuardProps) {
  const { loading } = useAuth();
  if (loading) return <IdentityLoading />;
  return <>{children}</>;
}

export function PublicOnlyRoute({ children }: RouteGuardProps) {
  const [, setLocation] = useLocation();
  const { user, loading } = useAuth();
  const redirected = useRef(false);

  useEffect(() => {
    if (loading || !user || redirected.current) return;
    redirected.current = true;
    setLocation(authNavigationIntent.takeAfterLogin(user.id) || "/activity");
  }, [loading, setLocation, user]);
  if (loading || user) return <IdentityLoading label={loading ? "Loading..." : "Redirecting..."} />;

  return <>{children}</>;
}
