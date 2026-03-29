import { useAuth } from "@/lib/auth";
import { useLocation } from "wouter";
import { useEffect, useState } from "react";

interface RouteGuardProps {
  children: React.ReactNode;
}

const ONBOARDING_KEY = 'consumed_onboarding_completed';
const NEW_USER_WINDOW_MS = 10 * 60 * 1000; // 10 minutes

export function isOnboardingComplete(): boolean {
  return localStorage.getItem(ONBOARDING_KEY) === 'true';
}

export function markOnboardingComplete(): void {
  localStorage.setItem(ONBOARDING_KEY, 'true');
}

export function ProtectedRoute({ children }: RouteGuardProps) {
  const { user, loading } = useAuth();
  const [, setLocation] = useLocation();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      const fullPath = window.location.pathname + window.location.hash;
      if (fullPath !== '/login') {
        sessionStorage.setItem('returnUrl', fullPath);
      }
      setLocation('/login');
      return;
    }

    if (!loading && user) {
      const currentPath = window.location.pathname;
      const onboardingDone = isOnboardingComplete();

      if (!onboardingDone) {
        const createdAt = new Date(user.created_at).getTime();
        const isNewUser = Date.now() - createdAt < NEW_USER_WINDOW_MS;

        if (isNewUser && currentPath !== '/onboarding') {
          setLocation('/onboarding');
          return;
        } else {
          // Existing user without the key — mark complete silently
          markOnboardingComplete();
        }
      }

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
      const onboardingDone = isOnboardingComplete();
      if (onboardingDone) {
        setLocation('/activity');
      } else {
        const createdAt = new Date(user.created_at).getTime();
        const isNewUser = Date.now() - createdAt < NEW_USER_WINDOW_MS;
        if (isNewUser) {
          setLocation('/onboarding');
        } else {
          markOnboardingComplete();
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
